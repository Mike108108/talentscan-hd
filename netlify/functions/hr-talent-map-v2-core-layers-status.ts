/**
 * QA status endpoint for HR Talent Map v2 core layers background spike.
 * Stage 4.4-lite: run_mode, model_policy, layer key diagnostics, QA flags.
 */

import type { Handler, HandlerEvent, HandlerContext } from "@netlify/functions";
import {
  SPIKE_REPORT_TYPE,
  asRecord,
  asString,
  createSupabaseClient,
  extractBearerToken,
  extractLayerKeysByStatus,
  extractReadyLayerKeys,
  isSpikeEnabled,
  jsonResponse,
  logSpikeStage,
  requireUuid,
  resolveSupabaseConfig,
  SpikeConfigError,
} from "./hr-talent-map-v2-core-layers-shared";

function layerReportsHaveSection(
  layerReports: Record<string, unknown>[],
  section: "base" | "pro" | "evidence",
): boolean {
  if (layerReports.length === 0) return false;
  return layerReports.every((layer) => {
    const sectionValue = asRecord(layer[section]);
    return Object.keys(sectionValue).length > 0;
  });
}

export const handler: Handler = async (
  event: HandlerEvent,
  _context: HandlerContext,
) => {
  const logCtx: { reportId?: string } = {};

  try {
    if (event.httpMethod !== "GET" && event.httpMethod !== "POST") {
      return jsonResponse(405, { error: "Разрешены методы GET и POST." });
    }

    if (!isSpikeEnabled()) {
      return jsonResponse(403, { error: "background_core_layers_spike_disabled" });
    }

    const token = extractBearerToken(event);
    if (!token) {
      return jsonResponse(401, { error: "Требуется вход.", source: "auth" });
    }

    let supabaseUrl: string;
    let supabaseAnonKey: string;
    try {
      ({ url: supabaseUrl, anonKey: supabaseAnonKey } = resolveSupabaseConfig());
    } catch (err) {
      const message = err instanceof SpikeConfigError ? err.message : "Invalid Supabase configuration.";
      return jsonResponse(500, { error: message, source: "config" });
    }

    const authClient = createSupabaseClient(supabaseUrl, supabaseAnonKey);
    const { data: authData, error: authErr } = await authClient.auth.getUser(token);
    if (authErr || !authData.user) {
      return jsonResponse(401, { error: "Требуется вход.", source: "auth" });
    }

    let reportIdRaw = "";
    if (event.httpMethod === "GET") {
      reportIdRaw =
        event.queryStringParameters?.report_id ??
        event.queryStringParameters?.reportId ??
        "";
    } else {
      let body: Record<string, unknown> = {};
      try {
        body = event.body ? JSON.parse(event.body) : {};
      } catch {
        return jsonResponse(400, { error: "Некорректный JSON.", source: "validation" });
      }
      reportIdRaw = asString(body.report_id) || asString(body.reportId);
    }

    let reportId: string;
    try {
      reportId = requireUuid(reportIdRaw, "report_id");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Invalid report_id.";
      return jsonResponse(400, { error: message, source: "validation" });
    }

    logCtx.reportId = reportId;
    logSpikeStage("status", "load_report", logCtx);

    const db = createSupabaseClient(supabaseUrl, supabaseAnonKey, token);
    const { data: report, error: reportErr } = await db
      .from("hr_reports")
      .select("*")
      .eq("id", reportId)
      .maybeSingle();

    if (reportErr || !report) {
      return jsonResponse(404, { error: "Отчёт не найден.", source: "report" });
    }

    if (report.report_type !== SPIKE_REPORT_TYPE) {
      return jsonResponse(404, {
        error: "Отчёт не является core layers spike.",
        source: "report_type",
      });
    }

    const contentJson = asRecord(report.content_json);
    const generationMeta = asRecord(contentJson.generation_meta);
    const layerGeneration = asRecord(generationMeta.layer_generation);
    const hasLayerGeneration = Object.keys(layerGeneration).length > 0;
    const layerReports = Array.isArray(contentJson.layer_reports)
      ? (contentJson.layer_reports as Record<string, unknown>[])
      : [];

    const runMode =
      asString(generationMeta.run_mode) ||
      asString(layerGeneration.run_mode) ||
      null;
    const selectedModel =
      asString(generationMeta.selected_model) ||
      asString(layerGeneration.selected_model) ||
      asString(report.model) ||
      null;
    const modelPolicyRaw = asRecord(generationMeta.model_policy);
    const layerModelPolicyRaw = asRecord(layerGeneration.model_policy);
    const modelPolicy =
      Object.keys(modelPolicyRaw).length > 0
        ? modelPolicyRaw
        : Object.keys(layerModelPolicyRaw).length > 0
          ? layerModelPolicyRaw
          : null;

    const readyLayerKeys = extractReadyLayerKeys(layerReports);
    const errorLayerKeys = hasLayerGeneration
      ? extractLayerKeysByStatus(layerGeneration, "error")
      : [];
    const skippedLayerKeys = hasLayerGeneration
      ? extractLayerKeysByStatus(layerGeneration, "skipped")
      : [];

    let parsedGenerationError: unknown = null;
    if (report.generation_error) {
      try {
        parsedGenerationError = JSON.parse(String(report.generation_error));
      } catch {
        parsedGenerationError = report.generation_error;
      }
    }

    return jsonResponse(200, {
      report_id: report.id,
      report_status: report.report_status,
      fit_score: report.fit_score ?? null,
      vacancy_id: report.vacancy_id ?? null,
      report_type: report.report_type,
      prompt_version: report.prompt_version,
      model: report.model,
      run_mode: runMode,
      selected_model: selectedModel,
      model_policy: modelPolicy,
      layer_generation_status: hasLayerGeneration
        ? asString(layerGeneration.status) || null
        : null,
      generated_at: report.generated_at,
      generation_meta: Object.keys(generationMeta).length > 0 ? generationMeta : null,
      generation_error: parsedGenerationError,
      company_id: report.company_id,
      candidate_id: report.candidate_id,
      input_hash: report.input_hash,
      layer_reports_count: layerReports.length,
      ready_layer_keys: readyLayerKeys,
      error_layer_keys: errorLayerKeys,
      skipped_layer_keys: skippedLayerKeys,
      layer_generation: hasLayerGeneration ? layerGeneration : null,
      qa: {
        fit_score_is_null: report.fit_score == null,
        vacancy_id_is_null: report.vacancy_id == null,
        role_fit_is_separate: true,
        has_layer_generation: hasLayerGeneration,
        all_ready_layers_have_base: layerReportsHaveSection(layerReports, "base"),
        all_ready_layers_have_pro: layerReportsHaveSection(layerReports, "pro"),
        all_ready_layers_have_evidence: layerReportsHaveSection(layerReports, "evidence"),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    console.error("[hr-talent-map-v2-core-layers-status] unhandled", {
      message,
      report_id: logCtx.reportId,
    });
    return jsonResponse(500, { error: message, source: "internal" });
  }
};
