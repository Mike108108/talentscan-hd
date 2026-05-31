/**
 * Background worker for HR Talent Map v2 work_format spike (OpenAI Responses API).
 */

import type { BackgroundHandler, HandlerEvent } from "@netlify/functions";
import {
  SPIKE_PROMPT_VERSION,
  SPIKE_REPORT_TYPE,
  SpikeConfigError,
  asRecord,
  asString,
  buildSpikeContentJson,
  buildWorkFormatCompactInput,
  callOpenAiResponsesForWorkFormat,
  createSupabaseClient,
  extractBearerToken,
  loadActiveCandidateChart,
  logSpikeStage,
  requireUuid,
  resolveOpenAiApiKey,
  resolveResponsesModel,
  resolveSupabaseConfig,
  saveReportError,
  serializeGenerationError,
  validateWorkFormatLayer,
  type OffendingMatch,
} from "./hr-talent-map-v2-work-format-spike-shared";

export const handler: BackgroundHandler = async (event: HandlerEvent) => {
  const startedAt = Date.now();
  const pipelineStartedAt = new Date().toISOString();
  const logCtx: {
    companyId?: string;
    candidateId?: string;
    reportId?: string;
    model?: string;
  } = {};

  let db: ReturnType<typeof createSupabaseClient> | null = null;
  let reportId: string | null = null;

  const fail = async (
    stage: string,
    message: string,
    extra?: {
      status?: number;
      validation_result?: unknown;
      offending_matches?: OffendingMatch[];
    },
  ) => {
    logSpikeStage("worker", "save_error", logCtx, {
      stage,
      message,
      duration_ms: Date.now() - startedAt,
      offending_match_count: extra?.offending_matches?.length ?? 0,
      ...extra,
    });
    if (db && reportId) {
      await saveReportError(
        db,
        reportId,
        serializeGenerationError({
          stage,
          message,
          status: extra?.status,
          duration_ms: Date.now() - startedAt,
          validation_result: extra?.validation_result,
          offending_matches: extra?.offending_matches,
        }),
      );
    }
  };

  try {
    logSpikeStage("worker", "start", logCtx);

    const token = extractBearerToken(event);
    if (!token) {
      console.error("[hr-talent-map-v2-work-format-worker] missing auth token");
      return;
    }

    let body: Record<string, unknown>;
    try {
      body = event.body ? JSON.parse(event.body) : {};
    } catch {
      console.error("[hr-talent-map-v2-work-format-worker] invalid JSON body");
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
      console.error("[hr-talent-map-v2-work-format-worker] invalid ids", err);
      return;
    }

    let supabaseUrl: string;
    let supabaseAnonKey: string;
    try {
      ({ url: supabaseUrl, anonKey: supabaseAnonKey } = resolveSupabaseConfig());
    } catch (err) {
      console.error("[hr-talent-map-v2-work-format-worker] supabase config", err);
      return;
    }

    const authClient = createSupabaseClient(supabaseUrl, supabaseAnonKey);
    const { data: authData, error: authErr } = await authClient.auth.getUser(token);
    if (authErr || !authData.user) {
      console.error("[hr-talent-map-v2-work-format-worker] auth failed");
      return;
    }
    logSpikeStage("worker", "auth_ok", logCtx);

    db = createSupabaseClient(supabaseUrl, supabaseAnonKey, token);

    let model: string;
    try {
      model = resolveResponsesModel();
      logCtx.model = model;
    } catch (err) {
      await fail(
        "config",
        err instanceof SpikeConfigError ? err.message : "missing_OPENAI_RESPONSES_MODEL",
      );
      return;
    }

    logSpikeStage("worker", "load_report", logCtx);
    const { data: report, error: reportErr } = await db
      .from("hr_reports")
      .select("*")
      .eq("id", reportId)
      .maybeSingle();

    if (reportErr || !report) {
      console.error("[hr-talent-map-v2-work-format-worker] report not found", reportErr);
      return;
    }

    if (
      report.company_id !== logCtx.companyId ||
      report.candidate_id !== logCtx.candidateId ||
      report.report_type !== SPIKE_REPORT_TYPE
    ) {
      await fail("ownership", "Report does not match company/candidate/type");
      return;
    }

    logSpikeStage("worker", "load_candidate", logCtx);
    const { data: company, error: companyErr } = await db
      .from("hr_companies")
      .select("id, owner_user_id, name, industry")
      .eq("id", logCtx.companyId)
      .maybeSingle();

    if (companyErr || !company) {
      await fail("company", "Компания не найдена.");
      return;
    }

    const { data: candidate, error: candErr } = await db
      .from("hr_candidates")
      .select("*")
      .eq("id", logCtx.candidateId)
      .eq("company_id", logCtx.companyId)
      .maybeSingle();

    if (candErr || !candidate) {
      await fail("candidate", "Кандидат не найден.");
      return;
    }

    logSpikeStage("worker", "load_chart", logCtx);
    const { chart, error: chartLoadErr } = await loadActiveCandidateChart(
      db,
      logCtx.companyId,
      logCtx.candidateId,
    );
    if (chartLoadErr || !chart) {
      await fail("chart", chartLoadErr ?? "Карта кандидата не найдена.");
      return;
    }

    const normalizedChart =
      chart.normalized_chart_data && typeof chart.normalized_chart_data === "object"
        ? (chart.normalized_chart_data as Record<string, unknown>)
        : null;

    if (!normalizedChart) {
      await fail("missing_normalized_chart_data", "normalized_chart_data отсутствует.");
      return;
    }

    const compactInput = buildWorkFormatCompactInput({
      candidate: candidate as Record<string, unknown>,
      company: company as Record<string, unknown>,
      normalizedChart,
    });

    let apiKey: string;
    try {
      apiKey = resolveOpenAiApiKey();
    } catch (err) {
      await fail(
        "config",
        err instanceof SpikeConfigError ? err.message : "Missing OPENAI_API_KEY",
      );
      return;
    }

    const openAiStartedAt = Date.now();
    logSpikeStage("worker", "openai_responses_start", logCtx, { model });

    let layer: Record<string, unknown>;
    let rawOutputChars = 0;
    let httpStatus = 0;

    try {
      const openAiResult = await callOpenAiResponsesForWorkFormat({
        apiKey,
        model,
        compactInput,
      });
      layer = openAiResult.layer;
      rawOutputChars = openAiResult.rawOutputChars;
      httpStatus = openAiResult.httpStatus;
    } catch (err) {
      const message = err instanceof Error ? err.message : "OpenAI Responses API error";
      const stage = message === "openai_empty_output" ? "openai_empty_output" : "openai_responses";
      await fail(stage, message, { status: httpStatus || undefined });
      return;
    }

    const openAiDurationMs = Date.now() - openAiStartedAt;
    logSpikeStage("worker", "openai_responses_done", logCtx, {
      model,
      duration_ms: openAiDurationMs,
      http_status: httpStatus,
      raw_output_chars: rawOutputChars,
    });

    logSpikeStage("worker", "parse_output", logCtx);
    logSpikeStage("worker", "validate_layer", logCtx);

    const validation = validateWorkFormatLayer(layer);
    if (!validation.ok) {
      await fail(validation.stage, validation.message, {
        validation_result: validation.details ?? null,
        offending_matches: validation.offending_matches,
      });
      return;
    }

    const generatedAt = new Date().toISOString();
    const contentJson = buildSpikeContentJson({
      layerReport: layer,
      candidate: candidate as Record<string, unknown>,
      company: company as Record<string, unknown>,
      chart: chart as Record<string, unknown>,
      normalizedChart,
      model,
      generatedAt,
      layerDurationMs: openAiDurationMs,
      pipelineStartedAt,
    });

    logSpikeStage("worker", "save_ready", logCtx, {
      duration_ms: Date.now() - startedAt,
      validation_result: "ok",
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
        updated_at: generatedAt,
      })
      .eq("id", reportId);

    if (saveErr) {
      await fail("save_ready", saveErr.message);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal worker error";
    console.error("[hr-talent-map-v2-work-format-worker] unhandled", {
      message,
      company_id: logCtx.companyId,
      candidate_id: logCtx.candidateId,
      report_id: logCtx.reportId,
    });
    if (db && reportId) {
      await fail("internal", message);
    }
  }
};
