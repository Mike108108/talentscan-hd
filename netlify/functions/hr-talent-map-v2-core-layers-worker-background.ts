/**
 * Background worker for HR Talent Map v2 core layers spike (12 layers, sequential).
 * Stage 4.6: expand to 12 layers; talent/axis layers; output token ceiling policy.
 */

import type { BackgroundHandler, HandlerEvent } from "@netlify/functions";
import {
  CORE_LAYERS_ORDER,
  SPIKE_PROMPT_VERSION,
  SPIKE_REPORT_TYPE,
  SpikeConfigError,
  asRecord,
  asString,
  buildCoreLayersCompactInput,
  buildCoreLayersContentJson,
  callOpenAiResponsesForLayerWithRetry,
  createSupabaseClient,
  OpenAiLayerResponseError,
  OpenAiLayerRetryExhaustedError,
  extractBearerToken,
  initLayerGenerationState,
  loadActiveCandidateChart,
  logSpikeStage,
  requireUuid,
  inferGenerationErrorKind,
  resolveCoreLayersModelPolicy,
  resolveOpenAiApiKey,
  resolveSupabaseConfig,
  saveReportError,
  serializeGenerationError,
  summarizeLayerGeneration,
  validateCoreLayer,
  type CoreLayerKey,
  type CoreLayersModelPolicy,
  type LayerGenerationState,
  type LayerRunStatus,
  type OffendingMatch,
} from "./hr-talent-map-v2-core-layers-shared";

export const handler: BackgroundHandler = async (event: HandlerEvent) => {
  const startedAt = Date.now();
  const pipelineStartedAt = new Date().toISOString();
  const logCtx: {
    companyId?: string;
    candidateId?: string;
    reportId?: string;
    model?: string;
    layerKey?: string;
  } = {};

  let db: ReturnType<typeof createSupabaseClient> | null = null;
  let reportId: string | null = null;

  let layerReports: Record<string, unknown>[] = [];
  let modelPolicy: CoreLayersModelPolicy | null = null;
  let layerGeneration: LayerGenerationState | null = null;

  const fail = async (
    stage: string,
    message: string,
    failedLayerKey: string | undefined,
    extra?: {
      status?: number;
      validation_result?: unknown;
      offending_matches?: OffendingMatch[];
      attempts?: number;
      last_error?: string;
      response_status?: string | null;
      incomplete_details?: unknown;
      output_text_length?: number;
      output_text_tail?: string | null;
      parse_error?: string | null;
      validation_stage?: string;
    },
  ) => {
    const finishedAt = new Date().toISOString();
    const durationMs = Date.now() - startedAt;

    if (layerGeneration) {
      layerGeneration.status = "error";
      layerGeneration.finished_at = finishedAt;
      layerGeneration.duration_ms = durationMs;
      layerGeneration.summary = summarizeLayerGeneration(layerGeneration.layers);
    }

    logSpikeStage("worker", "save_error", logCtx, {
      stage,
      message,
      failed_layer_key: failedLayerKey,
      duration_ms: durationMs,
      offending_match_count: extra?.offending_matches?.length ?? 0,
      ...extra,
    });

    if (db && reportId && logCtx.companyId && logCtx.candidateId) {
      const { data: company } = await db
        .from("hr_companies")
        .select("id, name, industry")
        .eq("id", logCtx.companyId)
        .maybeSingle();

      const { data: candidate } = await db
        .from("hr_candidates")
        .select("*")
        .eq("id", logCtx.candidateId)
        .maybeSingle();

      const { chart } = await loadActiveCandidateChart(
        db,
        logCtx.companyId,
        logCtx.candidateId,
      );

      const normalizedChart =
        chart?.normalized_chart_data && typeof chart.normalized_chart_data === "object"
          ? (chart.normalized_chart_data as Record<string, unknown>)
          : null;

      let partialContentJson: Record<string, unknown> | undefined;
      if (
        layerGeneration &&
        company &&
        candidate &&
        chart &&
        normalizedChart &&
        logCtx.model &&
        modelPolicy
      ) {
        partialContentJson = buildCoreLayersContentJson({
          layerReports,
          candidate: candidate as Record<string, unknown>,
          company: company as Record<string, unknown>,
          chart: chart as Record<string, unknown>,
          normalizedChart,
          model: logCtx.model,
          modelPolicy,
          generatedAt: finishedAt,
          pipelineStartedAt,
          pipelineDurationMs: durationMs,
          layerGeneration: layerGeneration as unknown as Record<string, unknown>,
          overallStatus: "error",
        });
      }

      await saveReportError(
        db,
        reportId,
        serializeGenerationError({
          stage,
          message,
          status: extra?.status,
          duration_ms: durationMs,
          validation_result: extra?.validation_result,
          offending_matches: extra?.offending_matches,
          failed_layer_key: failedLayerKey,
          layer_statuses: layerGeneration?.layers,
          attempts: extra?.attempts,
          last_error: extra?.last_error,
          response_status: extra?.response_status,
          incomplete_details: extra?.incomplete_details,
          output_text_length: extra?.output_text_length,
          output_text_tail: extra?.output_text_tail,
          parse_error: extra?.parse_error,
          run_mode: modelPolicy?.runMode,
          model: logCtx.model,
          selected_model: logCtx.model,
          validation_stage: extra?.validation_stage,
        }),
        partialContentJson,
      );
    }
  };

  try {
    logSpikeStage("worker", "start", logCtx);

    const token = extractBearerToken(event);
    if (!token) {
      console.error("[hr-talent-map-v2-core-layers-worker] missing auth token");
      return;
    }

    let body: Record<string, unknown>;
    try {
      body = event.body ? JSON.parse(event.body) : {};
    } catch {
      console.error("[hr-talent-map-v2-core-layers-worker] invalid JSON body");
      return;
    }

    try {
      reportId = requireUuid(asString(body.report_id), "report_id");
      logCtx.reportId = reportId;
      logCtx.companyId = requireUuid(
        asString(body.company_id) || asString(body.companyId),
        "company_id",
      );
      logCtx.candidateId = requireUuid(
        asString(body.candidate_id) || asString(body.candidateId),
        "candidate_id",
      );
    } catch (err) {
      console.error("[hr-talent-map-v2-core-layers-worker] invalid ids", err);
      return;
    }

    let supabaseUrl: string;
    let supabaseAnonKey: string;
    try {
      ({ url: supabaseUrl, anonKey: supabaseAnonKey } = resolveSupabaseConfig());
    } catch (err) {
      console.error("[hr-talent-map-v2-core-layers-worker] supabase config", err);
      return;
    }

    const authClient = createSupabaseClient(supabaseUrl, supabaseAnonKey);
    const { data: authData, error: authErr } = await authClient.auth.getUser(token);
    if (authErr || !authData.user) {
      console.error("[hr-talent-map-v2-core-layers-worker] auth failed");
      return;
    }
    logSpikeStage("worker", "auth_ok", logCtx);

    db = createSupabaseClient(supabaseUrl, supabaseAnonKey, token);

    try {
      modelPolicy = resolveCoreLayersModelPolicy();
      logCtx.model = modelPolicy.selectedModel;
      layerGeneration = initLayerGenerationState(pipelineStartedAt, modelPolicy);
    } catch (err) {
      await fail(
        "config",
        err instanceof SpikeConfigError ? err.message : "Invalid model policy configuration",
        undefined,
      );
      return;
    }

    const model = modelPolicy.selectedModel;

    logSpikeStage("worker", "load_report", logCtx);
    const { data: report, error: reportErr } = await db
      .from("hr_reports")
      .select("*")
      .eq("id", reportId)
      .maybeSingle();

    if (reportErr || !report) {
      console.error("[hr-talent-map-v2-core-layers-worker] report not found", reportErr);
      return;
    }

    if (
      report.company_id !== logCtx.companyId ||
      report.candidate_id !== logCtx.candidateId ||
      report.report_type !== SPIKE_REPORT_TYPE
    ) {
      await fail("ownership", "Report does not match company/candidate/type", undefined);
      return;
    }

    logSpikeStage("worker", "load_candidate", logCtx);
    const { data: company, error: companyErr } = await db
      .from("hr_companies")
      .select("id, owner_user_id, name, industry")
      .eq("id", logCtx.companyId)
      .maybeSingle();

    if (companyErr || !company) {
      await fail("company", "Компания не найдена.", undefined);
      return;
    }

    const { data: candidate, error: candErr } = await db
      .from("hr_candidates")
      .select("*")
      .eq("id", logCtx.candidateId)
      .eq("company_id", logCtx.companyId)
      .maybeSingle();

    if (candErr || !candidate) {
      await fail("candidate", "Кандидат не найден.", undefined);
      return;
    }

    logSpikeStage("worker", "load_chart", logCtx);
    const { chart, error: chartLoadErr } = await loadActiveCandidateChart(
      db,
      logCtx.companyId,
      logCtx.candidateId,
    );
    if (chartLoadErr || !chart) {
      await fail("chart", chartLoadErr ?? "Карта кандидата не найдена.", undefined);
      return;
    }

    const normalizedChart =
      chart.normalized_chart_data && typeof chart.normalized_chart_data === "object"
        ? (chart.normalized_chart_data as Record<string, unknown>)
        : null;

    if (!normalizedChart) {
      await fail("missing_normalized_chart_data", "normalized_chart_data отсутствует.", undefined);
      return;
    }

    let apiKey: string;
    try {
      apiKey = resolveOpenAiApiKey();
    } catch (err) {
      await fail(
        "config",
        err instanceof SpikeConfigError ? err.message : "Missing OPENAI_API_KEY",
        undefined,
      );
      return;
    }

    for (const layerKey of CORE_LAYERS_ORDER) {
      if (!layerGeneration) break;

      logCtx.layerKey = layerKey;
      const layerStartedAt = Date.now();
      const layerStartedIso = new Date().toISOString();

      layerGeneration.layers[layerKey] = {
        status: "generating",
        started_at: layerStartedIso,
        model,
        prompt_version: SPIKE_PROMPT_VERSION,
        max_output_tokens: modelPolicy.maxOutputTokens,
      };

      logSpikeStage("worker", "openai_responses_start", logCtx, { model, layer_key: layerKey });

      const compactInput = buildCoreLayersCompactInput({
        layerKey,
        candidate: candidate as Record<string, unknown>,
        company: company as Record<string, unknown>,
        normalizedChart,
      });

      let layer: Record<string, unknown>;
      let httpStatus = 0;
      let openAiAttempts = 0;
      let openAiCallResult: Awaited<
        ReturnType<typeof callOpenAiResponsesForLayerWithRetry>
      > | null = null;

      try {
        openAiCallResult = await callOpenAiResponsesForLayerWithRetry({
          apiKey,
          model,
          layerKey,
          compactInput,
          maxOutputTokens: modelPolicy.maxOutputTokens,
          modelPolicy,
        });
        layer = openAiCallResult.layer;
        httpStatus = openAiCallResult.httpStatus;
        openAiAttempts = openAiCallResult.attempts;
      } catch (err) {
        const openAiErr =
          err instanceof OpenAiLayerRetryExhaustedError
            ? err.lastOpenAiError
            : err instanceof OpenAiLayerResponseError
              ? err
              : null;

        const message =
          openAiErr?.message ??
          (err instanceof Error ? err.message : "OpenAI Responses API error");
        const stage = "openai_responses";
        const attempts =
          err instanceof OpenAiLayerRetryExhaustedError
            ? err.attempts
            : openAiErr
              ? 1
              : undefined;

        const errorKind = inferGenerationErrorKind({
          stage,
          message,
          parse_error: openAiErr?.parseError ?? null,
          response_status: openAiErr?.responseStatus ?? null,
          output_text_length: openAiErr?.outputTextLength,
        });

        layerGeneration.layers[layerKey] = {
          ...layerGeneration.layers[layerKey],
          status: "error",
          finished_at: new Date().toISOString(),
          duration_ms: Date.now() - layerStartedAt,
          attempts,
          error: {
            kind: errorKind,
            message,
            attempts: attempts ?? null,
          },
        };

        layerGeneration.summary = summarizeLayerGeneration(layerGeneration.layers);

        markRemainingLayersSkipped(layerKey, layerGeneration.layers);

        const resolvedHttpStatus = openAiErr?.httpStatus ?? (httpStatus || undefined);

        await fail(stage, message, layerKey, {
          status: resolvedHttpStatus,
          attempts,
          last_error: message,
          response_status: openAiErr?.responseStatus ?? null,
          incomplete_details: openAiErr?.incompleteDetails ?? null,
          output_text_length: openAiErr?.outputTextLength,
          output_text_tail: openAiErr?.outputTextTail ?? null,
          parse_error: openAiErr?.parseError ?? null,
        });
        return;
      }

      const layerDurationMs = Date.now() - layerStartedAt;
      logSpikeStage("worker", "openai_responses_done", logCtx, {
        model,
        layer_key: layerKey,
        duration_ms: layerDurationMs,
        http_status: httpStatus,
      });

      logSpikeStage("worker", "validate_layer", logCtx, { layer_key: layerKey });
      const validation = validateCoreLayer(layer, layerKey);
      if (!validation.ok) {
        const errorKind = inferGenerationErrorKind({
          stage: validation.stage,
          message: validation.message,
          validation_stage: validation.stage,
        });

        layerGeneration.layers[layerKey] = {
          ...layerGeneration.layers[layerKey],
          status: "error",
          finished_at: new Date().toISOString(),
          duration_ms: layerDurationMs,
          attempts: openAiAttempts,
          error: {
            kind: errorKind,
            message: validation.message,
            attempts: openAiAttempts,
          },
        };

        layerGeneration.summary = summarizeLayerGeneration(layerGeneration.layers);

        markRemainingLayersSkipped(layerKey, layerGeneration.layers);

        await fail(validation.stage, validation.message, layerKey, {
          validation_result: validation.details ?? null,
          offending_matches: validation.offending_matches,
          attempts: openAiAttempts,
          validation_stage: validation.stage,
        });
        return;
      }

      const layerFinishedIso = new Date().toISOString();
      layerGeneration.layers[layerKey] = {
        status: "ready",
        started_at: layerStartedIso,
        finished_at: layerFinishedIso,
        duration_ms: layerDurationMs,
        model,
        prompt_version: SPIKE_PROMPT_VERSION,
        max_output_tokens: modelPolicy.maxOutputTokens,
        attempts: openAiAttempts,
        usage: openAiCallResult?.usage,
        request_tuning: openAiCallResult?.request_tuning,
        request_tuning_fallback: openAiCallResult?.request_tuning_fallback,
        request_tuning_fallback_reason:
          openAiCallResult?.request_tuning_fallback_reason ?? null,
      };

      layerGeneration.summary = summarizeLayerGeneration(layerGeneration.layers);

      layerReports.push(layer);
    }

    if (!layerGeneration || !modelPolicy) return;

    const generatedAt = new Date().toISOString();
    const pipelineDurationMs = Date.now() - startedAt;

    layerGeneration.status = "ready";
    layerGeneration.finished_at = generatedAt;
    layerGeneration.duration_ms = pipelineDurationMs;
    layerGeneration.summary = summarizeLayerGeneration(layerGeneration.layers);

    const contentJson = buildCoreLayersContentJson({
      layerReports,
      candidate: candidate as Record<string, unknown>,
      company: company as Record<string, unknown>,
      chart: chart as Record<string, unknown>,
      normalizedChart,
      model,
      modelPolicy,
      generatedAt,
      pipelineStartedAt,
      pipelineDurationMs,
      layerGeneration: layerGeneration as unknown as Record<string, unknown>,
      overallStatus: "ready",
    });

    const firstSummary = asString(asRecord(layerReports[0]?.base).short_summary);

    logSpikeStage("worker", "save_ready", logCtx, {
      duration_ms: pipelineDurationMs,
      validation_result: "ok",
      layer_count: layerReports.length,
    });

    const { error: saveErr } = await db
      .from("hr_reports")
      .update({
        report_status: "ready",
        content_json: contentJson,
        generation_error: null,
        fit_score: null,
        generated_at: generatedAt,
        model,
        prompt_version: SPIKE_PROMPT_VERSION,
        summary: firstSummary || null,
        updated_at: generatedAt,
      })
      .eq("id", reportId);

    if (saveErr) {
      await fail("save_ready", saveErr.message, undefined);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal worker error";
    console.error("[hr-talent-map-v2-core-layers-worker] unhandled", {
      message,
      company_id: logCtx.companyId,
      candidate_id: logCtx.candidateId,
      report_id: logCtx.reportId,
      layer_key: logCtx.layerKey,
    });
    if (db && reportId) {
      await fail("internal", message, logCtx.layerKey, undefined);
    }
  }
};

function markRemainingLayersSkipped(
  failedLayerKey: CoreLayerKey,
  layers: Record<CoreLayerKey, LayerRunStatus>,
) {
  let markSkipped = false;
  for (const key of CORE_LAYERS_ORDER) {
    if (key === failedLayerKey) {
      markSkipped = true;
      continue;
    }
    if (markSkipped && layers[key].status === "pending") {
      layers[key] = { status: "skipped" };
    }
  }
}
