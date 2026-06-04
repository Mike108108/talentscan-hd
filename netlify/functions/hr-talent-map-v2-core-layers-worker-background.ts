/**
 * Background worker for HR Talent Map v3 Career Reading Layers (8 layers, sequential).
 */

import type { BackgroundHandler, HandlerEvent } from "@netlify/functions";
import {
  CAREER_READING_LAYERS_ORDER,
  PROMPT_VERSION,
  REPORT_TYPE,
  SpikeConfigError,
  asRecord,
  asString,
  buildCareerReadingCompactInput,
  buildCareerReadingContentJson,
  buildPartialCareerReadingContentJson,
  callOpenAiForCareerReadingForbiddenTermsRepair,
  callOpenAiForCareerReadingValidationRepair,
  callOpenAiForCareerReadingLayerWithRetry,
  isCareerReadingValidationRepairable,
  CareerReadingOpenAiRetryExhaustedError,
  createSupabaseClient,
  extractBearerToken,
  initCareerReadingLayerGenerationState,
  isForbiddenBaseTermsValidation,
  isGenerationCancelRequested,
  loadActiveCandidateChart,
  logSpikeStage,
  mergeOpenAiUsageSnapshots,
  normalizeCareerReadingLayerForValidation,
  requireUuid,
  inferGenerationErrorKind,
  resolveCoreLayersModelPolicy,
  resolveOpenAiApiKey,
  resolveSupabaseConfig,
  saveCareerReadingLayerGenerationProgress,
  saveReportError,
  serializeGenerationCancelledError,
  serializeGenerationError,
  summarizeCareerReadingLayerGeneration,
  syncCareerReadingLayerGenerationProgress,
  validateCareerReadingLayer,
  type CareerReadingLayerGenerationState,
  type CareerReadingLayerKey,
  type CoreLayersModelPolicy,
  type GenerationCancellationMeta,
  type LayerRunStatus,
  type OffendingMatch,
  type OpenAiUsageSnapshot,
} from "./hr-talent-map-v2-career-reading-layers-shared";

type CareerReadingOpenAiErrorLike = {
  message: string;
  httpStatus?: number;
  responseStatus?: string | null;
  incompleteDetails?: unknown;
  outputTextLength?: number;
  outputTextTail?: string | null;
  parseError?: string | null;
};

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

  let careerReadingLayers: Record<string, unknown>[] = [];
  let modelPolicy: CoreLayersModelPolicy | null = null;
  let layerGeneration: CareerReadingLayerGenerationState | null = null;

  const persistProgress = async (cancellation?: GenerationCancellationMeta) => {
    if (!db || !reportId || !layerGeneration) return;
    if (await isGenerationCancelRequested(db, reportId)) {
      layerGeneration.cancel_requested = true;
    }
    syncCareerReadingLayerGenerationProgress(layerGeneration);
    await saveCareerReadingLayerGenerationProgress(db, reportId, {
      layerGeneration,
      careerReadingLayers,
      cancellation,
    });
  };

  const finishCancelled = async (afterLayerKey?: CareerReadingLayerKey) => {
    if (!db || !reportId || !layerGeneration || !modelPolicy) return;

    const finishedAt = new Date().toISOString();
    const durationMs = Date.now() - startedAt;

    if (afterLayerKey) {
      markRemainingLayersSkipped(afterLayerKey, layerGeneration.layers);
    } else {
      for (const key of CAREER_READING_LAYERS_ORDER) {
        if (layerGeneration.layers[key].status === "pending") {
          layerGeneration.layers[key] = { status: "skipped" };
        }
      }
    }

    layerGeneration.status = "error";
    layerGeneration.finished_at = finishedAt;
    layerGeneration.duration_ms = durationMs;
    layerGeneration.cancelled_at = finishedAt;
    layerGeneration.current_layer_key = null;
    layerGeneration.current_layer_title = null;
    layerGeneration.summary = summarizeCareerReadingLayerGeneration(
      layerGeneration.layers,
      modelPolicy.selectedModel,
    );

    const cancellation: GenerationCancellationMeta = {
      requested: true,
      requested_at: layerGeneration.cancel_requested_at ?? finishedAt,
      requested_by: layerGeneration.cancelled_by ?? null,
      status: "cancelled",
      cancelled_at: finishedAt,
    };

    syncCareerReadingLayerGenerationProgress(layerGeneration);

    const partialContentJson = buildPartialCareerReadingContentJson({
      layerGeneration,
      careerReadingLayers,
      cancellation,
    });

    logSpikeStage("worker", "generation_cancelled", logCtx, {
      duration_ms: durationMs,
      ready_layers: layerGeneration.ready_count ?? 0,
    });

    await saveReportError(
      db,
      reportId,
      serializeGenerationCancelledError(),
      partialContentJson,
    );
  };

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
      layerGeneration.summary = summarizeCareerReadingLayerGeneration(
        layerGeneration.layers,
        modelPolicy?.selectedModel,
      );
    }

    logSpikeStage("worker", "save_error", logCtx, {
      stage,
      message,
      failed_layer_key: failedLayerKey,
      duration_ms: durationMs,
      ...extra,
    });

    if (db && reportId && layerGeneration) {
      syncCareerReadingLayerGenerationProgress(layerGeneration);
      await saveCareerReadingLayerGenerationProgress(db, reportId, {
        layerGeneration,
        careerReadingLayers,
      });
    }

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
        partialContentJson = buildCareerReadingContentJson({
          careerReadingLayers,
          candidate: candidate as Record<string, unknown>,
          company: company as Record<string, unknown>,
          chart: chart as Record<string, unknown>,
          normalizedChart,
          model: logCtx.model,
          modelPolicy,
          generatedAt: finishedAt,
          layerGeneration: layerGeneration as unknown as Record<string, unknown>,
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
      layerGeneration = initCareerReadingLayerGenerationState(pipelineStartedAt, modelPolicy);
    } catch (err) {
      await fail(
        "config",
        err instanceof SpikeConfigError ? err.message : "Invalid model policy configuration",
        undefined,
      );
      return;
    }

    const model = modelPolicy.selectedModel;

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
      report.report_type !== REPORT_TYPE
    ) {
      await fail("ownership", "Report does not match company/candidate/type", undefined);
      return;
    }

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

    await persistProgress();

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

    for (const layerKey of CAREER_READING_LAYERS_ORDER) {
      if (!layerGeneration || !db || !reportId) break;

      if (await isGenerationCancelRequested(db, reportId)) {
        layerGeneration.cancel_requested = true;
        await finishCancelled();
        return;
      }

      logCtx.layerKey = layerKey;
      const layerStartedAt = Date.now();
      const layerStartedIso = new Date().toISOString();

      layerGeneration.layers[layerKey] = {
        status: "generating",
        started_at: layerStartedIso,
        model,
        prompt_version: PROMPT_VERSION,
        max_output_tokens: modelPolicy.maxOutputTokens,
      };
      syncCareerReadingLayerGenerationProgress(layerGeneration);
      await persistProgress();

      const compactInput = buildCareerReadingCompactInput({
        layerKey,
        candidate: candidate as Record<string, unknown>,
        company: company as Record<string, unknown>,
        normalizedChart,
      });
      const layerInput = compactInput.layer_input;

      let layer: Record<string, unknown>;
      let httpStatus = 0;
      let openAiAttempts = 0;
      let openAiCallResult: Awaited<
        ReturnType<typeof callOpenAiForCareerReadingLayerWithRetry>
      > | null = null;

      try {
        openAiCallResult = await callOpenAiForCareerReadingLayerWithRetry({
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
        const openAiErr = extractOpenAiError(err);
        const message = openAiErr?.message ?? (err instanceof Error ? err.message : "OpenAI error");
        const attempts =
          err instanceof CareerReadingOpenAiRetryExhaustedError ? err.attempts : openAiErr ? 1 : undefined;

        layerGeneration.layers[layerKey] = {
          ...layerGeneration.layers[layerKey],
          status: "error",
          finished_at: new Date().toISOString(),
          duration_ms: Date.now() - layerStartedAt,
          attempts,
          error: {
            kind: inferGenerationErrorKind({
              stage: "openai_responses",
              message,
              parse_error: openAiErr?.parseError ?? null,
              response_status: openAiErr?.responseStatus ?? null,
              output_text_length: openAiErr?.outputTextLength,
            }),
            message,
            attempts: attempts ?? null,
          },
        };
        layerGeneration.summary = summarizeCareerReadingLayerGeneration(
          layerGeneration.layers,
          modelPolicy.selectedModel,
        );
        markRemainingLayersSkipped(layerKey, layerGeneration.layers);
        await persistProgress();
        await fail("openai_responses", message, layerKey, {
          status: openAiErr?.httpStatus ?? (httpStatus || undefined),
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
      layerGeneration.layers[layerKey] = {
        ...layerGeneration.layers[layerKey],
        status: "validating",
      };
      await persistProgress();

      layer = normalizeCareerReadingLayerForValidation({ layer, layerKey, layerInput });
      let validation = validateCareerReadingLayer(layer, layerKey, layerInput);

      let mergedUsage: OpenAiUsageSnapshot | undefined = openAiCallResult?.usage;
      let repairAttempts = 0;

      if (
        !validation.ok &&
        (isForbiddenBaseTermsValidation(validation) ||
          isCareerReadingValidationRepairable(validation))
      ) {
        layerGeneration.layers[layerKey] = {
          ...layerGeneration.layers[layerKey],
          status: "repairing",
        };
        await persistProgress();

        try {
          const repairResult = isForbiddenBaseTermsValidation(validation)
            ? await callOpenAiForCareerReadingForbiddenTermsRepair({
                apiKey,
                model,
                layerKey,
                compactInput,
                maxOutputTokens: modelPolicy.maxOutputTokens,
                modelPolicy,
                offendingMatches: validation.offending_matches ?? [],
              })
            : await callOpenAiForCareerReadingValidationRepair({
                apiKey,
                model,
                layerKey,
                compactInput,
                maxOutputTokens: modelPolicy.maxOutputTokens,
                modelPolicy,
                validationMessage: validation.message,
              });
          repairAttempts = 1;
          openAiAttempts += 1;
          layer = repairResult.layer;
          httpStatus = repairResult.httpStatus;
          mergedUsage = mergedUsage
            ? mergeOpenAiUsageSnapshots(mergedUsage, repairResult.usage)
            : repairResult.usage;
          layer = normalizeCareerReadingLayerForValidation({ layer, layerKey, layerInput });
          validation = validateCareerReadingLayer(layer, layerKey, layerInput);
        } catch {
          // keep failed validation
        }
      }

      if (!validation.ok) {
        layerGeneration.layers[layerKey] = {
          ...layerGeneration.layers[layerKey],
          status: "error",
          finished_at: new Date().toISOString(),
          duration_ms: layerDurationMs,
          attempts: openAiAttempts,
          repair_attempts: repairAttempts,
          error: {
            kind: inferGenerationErrorKind({
              stage: validation.stage,
              message: validation.message,
              validation_stage: validation.stage,
            }),
            message: validation.message,
            attempts: openAiAttempts,
          },
        };
        layerGeneration.summary = summarizeCareerReadingLayerGeneration(
          layerGeneration.layers,
          modelPolicy.selectedModel,
        );
        markRemainingLayersSkipped(layerKey, layerGeneration.layers);
        await persistProgress();
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
        completed_at: layerFinishedIso,
        duration_ms: layerDurationMs,
        model,
        prompt_version: PROMPT_VERSION,
        max_output_tokens: modelPolicy.maxOutputTokens,
        attempts: openAiAttempts,
        repair_attempts: repairAttempts,
        usage: mergedUsage,
        request_tuning: openAiCallResult?.request_tuning,
        request_tuning_fallback: openAiCallResult?.request_tuning_fallback,
        request_tuning_fallback_reason:
          openAiCallResult?.request_tuning_fallback_reason ?? null,
      };
      layerGeneration.summary = summarizeCareerReadingLayerGeneration(
        layerGeneration.layers,
        modelPolicy.selectedModel,
      );

      careerReadingLayers.push(layer);
      await persistProgress();

      if (db && reportId && (await isGenerationCancelRequested(db, reportId))) {
        layerGeneration.cancel_requested = true;
        await finishCancelled(layerKey);
        return;
      }
    }

    if (!layerGeneration || !modelPolicy) return;

    const generatedAt = new Date().toISOString();
    const pipelineDurationMs = Date.now() - startedAt;

    layerGeneration.status = "ready";
    layerGeneration.finished_at = generatedAt;
    layerGeneration.duration_ms = pipelineDurationMs;
    layerGeneration.summary = summarizeCareerReadingLayerGeneration(
      layerGeneration.layers,
      modelPolicy.selectedModel,
    );

    const contentJson = buildCareerReadingContentJson({
      careerReadingLayers,
      candidate: candidate as Record<string, unknown>,
      company: company as Record<string, unknown>,
      chart: chart as Record<string, unknown>,
      normalizedChart,
      model,
      modelPolicy,
      generatedAt,
      layerGeneration: layerGeneration as unknown as Record<string, unknown>,
    });

    const firstHeadline = asString(asRecord(careerReadingLayers[0]?.base).headline);

    logSpikeStage("worker", "save_ready", logCtx, {
      duration_ms: pipelineDurationMs,
      layer_count: careerReadingLayers.length,
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
        prompt_version: PROMPT_VERSION,
        summary: firstHeadline || null,
        updated_at: generatedAt,
      })
      .eq("id", reportId);

    if (saveErr) {
      await fail("save_ready", saveErr.message, undefined);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal worker error";
    console.error("[hr-talent-map-v2-core-layers-worker] unhandled", { message, ...logCtx });
    if (db && reportId) {
      await fail("internal", message, logCtx.layerKey, undefined);
    }
  }
};

function extractOpenAiError(err: unknown): CareerReadingOpenAiErrorLike | null {
  if (err instanceof CareerReadingOpenAiRetryExhaustedError) {
    return err.lastOpenAiError;
  }
  if (err && typeof err === "object" && "failedLayerKey" in err) {
    return err as CareerReadingOpenAiErrorLike;
  }
  return null;
}

function markRemainingLayersSkipped(
  failedLayerKey: CareerReadingLayerKey,
  layers: Record<CareerReadingLayerKey, LayerRunStatus>,
) {
  let markSkipped = false;
  for (const key of CAREER_READING_LAYERS_ORDER) {
    if (key === failedLayerKey) {
      markSkipped = true;
      continue;
    }
    if (markSkipped && layers[key].status === "pending") {
      layers[key] = { status: "skipped" };
    }
  }
}
