/**
 * QA status endpoint for HR Talent Map v3 Career Reading Layers pipeline.
 */

import type { Handler, HandlerEvent, HandlerContext } from "@netlify/functions";
import {
  CAREER_READING_LAYER_COUNT,
  REPORT_TYPE,
  asRecord,
  asString,
  asStringArray,
  buildCareerReadingLayersProgressArray,
  createSupabaseClient,
  extractBearerToken,
  extractLayerKeysByStatus,
  extractReadyCareerReadingLayerKeys,
  jsonResponse,
  logSpikeStage,
  requireUuid,
  resolveSupabaseConfig,
  SpikeConfigError,
} from "./hr-talent-map-v2-career-reading-layers-shared";

const LEGACY_SPIKE_REPORT_TYPE = "hr_person_talent_map_core_layers_spike";

function isCareerReadingReportType(reportType: string): boolean {
  return reportType === REPORT_TYPE || reportType === LEGACY_SPIKE_REPORT_TYPE;
}

function getCareerReadingLayers(contentJson: Record<string, unknown>): Record<string, unknown>[] {
  if (Array.isArray(contentJson.career_reading_layers)) {
    return contentJson.career_reading_layers as Record<string, unknown>[];
  }
  if (Array.isArray(contentJson.layer_reports)) {
    return contentJson.layer_reports as Record<string, unknown>[];
  }
  return [];
}

function layersHaveSection(
  layers: Record<string, unknown>[],
  section: "base" | "pro" | "evidence",
): boolean {
  if (layers.length === 0) return false;
  return layers.every((layer) => Object.keys(asRecord(layer[section])).length > 0);
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

    const token = extractBearerToken(event);
    if (!token) {
      return jsonResponse(401, { error: "Требуется вход.", source: "auth" });
    }

    let supabaseUrl: string;
    let supabaseAnonKey: string;
    try {
      ({ url: supabaseUrl, anonKey: supabaseAnonKey } = resolveSupabaseConfig());
    } catch (err) {
      const message =
        err instanceof SpikeConfigError ? err.message : "Invalid Supabase configuration.";
      return jsonResponse(500, { error: message, source: "config" });
    }

    const authClient = createSupabaseClient(supabaseUrl, supabaseAnonKey);
    const { data: authData, error: authErr } = await authClient.auth.getUser(token);
    if (authErr || !authData.user) {
      return jsonResponse(401, { error: "Tребуется вход.", source: "auth" });
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

    if (!isCareerReadingReportType(asString(report.report_type))) {
      return jsonResponse(404, {
        error: "Отчёт не является послойной картой кандидата.",
        source: "report_type",
      });
    }

    const contentJson = asRecord(report.content_json);
    const generationMeta = asRecord(contentJson.generation_meta);
    const layerGeneration = asRecord(generationMeta.layer_generation);
    const hasLayerGeneration = Object.keys(layerGeneration).length > 0;
    const careerLayers = getCareerReadingLayers(contentJson);

    const layerSummary = asRecord(layerGeneration.summary);
    const usageSummary = layerSummary.usage_summary ?? generationMeta.usage_summary ?? null;

    const readyLayerKeys = extractReadyCareerReadingLayerKeys(careerLayers);
    const layersProgress = hasLayerGeneration
      ? buildCareerReadingLayersProgressArray(layerGeneration)
      : [];
    const readyCountFromProgress = layersProgress.filter((item) => item.status === "ready").length;
    const readyCount =
      typeof layerGeneration.ready_count === "number"
        ? layerGeneration.ready_count
        : readyCountFromProgress > 0
          ? readyCountFromProgress
          : readyLayerKeys.length;
    const totalCount =
      typeof layerGeneration.total_count === "number"
        ? layerGeneration.total_count
        : layersProgress.length > 0
          ? layersProgress.length
          : CAREER_READING_LAYER_COUNT;
    const progressPercent =
      totalCount > 0
        ? Math.min(100, Math.max(0, Math.round((readyCount / totalCount) * 100)))
        : 0;
    const currentLayerKey =
      asString(layerGeneration.current_layer_key) ||
      layersProgress.find(
        (item) =>
          item.status === "generating" ||
          item.status === "repairing" ||
          item.status === "validating",
      )?.layer_key ||
      null;
    const currentLayerTitle =
      asString(layerGeneration.current_layer_title) ||
      layersProgress.find((item) => item.layer_key === currentLayerKey)?.hr_title ||
      null;

    const cancellation = asRecord(generationMeta.cancellation);
    const cancelRequested =
      layerGeneration.cancel_requested === true || cancellation.requested === true;
    const cancelled =
      cancellation.status === "cancelled" || layerGeneration.cancelled_at != null;

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
      generation_meta: Object.keys(generationMeta).length > 0 ? generationMeta : null,
      generation_error: parsedGenerationError,
      ready_count: readyCount,
      total_count: totalCount,
      progress_percent: progressPercent,
      current_layer_key: currentLayerKey,
      current_layer_title: currentLayerTitle,
      layers_progress: layersProgress,
      cancel_requested: cancelRequested,
      cancelled,
      cancellation: Object.keys(cancellation).length > 0 ? cancellation : null,
      career_reading_layers_count: careerLayers.length,
      ready_layer_keys: readyLayerKeys,
      error_layer_keys: hasLayerGeneration
        ? extractLayerKeysByStatus(layerGeneration, "error")
        : [],
      skipped_layer_keys: hasLayerGeneration
        ? extractLayerKeysByStatus(layerGeneration, "skipped")
        : [],
      usage_summary: usageSummary,
      qa: {
        fit_score_is_null: report.fit_score == null,
        has_layer_generation: hasLayerGeneration,
        all_ready_layers_have_base: layersHaveSection(careerLayers, "base"),
        all_ready_layers_have_pro: layersHaveSection(careerLayers, "pro"),
        all_ready_layers_have_evidence: layersHaveSection(careerLayers, "evidence"),
        all_ready_layers_have_summary_for_synthesis:
          careerLayers.length > 0 &&
          careerLayers.every((layer) =>
            asString(asRecord(layer.summary_for_synthesis).one_sentence),
          ),
        all_ready_layers_have_matching_summary:
          careerLayers.length > 0 &&
          careerLayers.every((layer) => {
            const matching = asRecord(layer.matching_summary);
            return asStringArray(matching.good_for).length > 0;
          }),
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
