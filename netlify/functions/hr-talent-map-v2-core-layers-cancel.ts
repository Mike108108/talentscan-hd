/**
 * Soft cancel for HR Talent Map v2 core layers generation.
 * Sets cancel_requested flag; worker stops between layers.
 */

import type { Handler, HandlerEvent, HandlerContext } from "@netlify/functions";
import {
  REPORT_TYPE,
  asRecord,
  asString,
  createSupabaseClient,
  extractBearerToken,
  jsonResponse,
  logSpikeStage,
  requireUuid,
  resolveSupabaseConfig,
  SpikeConfigError,
} from "./hr-talent-map-v2-career-reading-layers-shared";

const LEGACY_SPIKE_REPORT_TYPE = "hr_person_talent_map_core_layers_spike";

function isSupportedReportType(reportType: string): boolean {
  return reportType === REPORT_TYPE || reportType === LEGACY_SPIKE_REPORT_TYPE;
}

export const handler: Handler = async (
  event: HandlerEvent,
  _context: HandlerContext,
) => {
  const logCtx: { reportId?: string } = {};

  try {
    if (event.httpMethod !== "POST") {
      return jsonResponse(405, { error: "Разрешён только метод POST." });
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
      return jsonResponse(401, { error: "Требуется вход.", source: "auth" });
    }

    let body: Record<string, unknown> = {};
    try {
      body = event.body ? JSON.parse(event.body) : {};
    } catch {
      return jsonResponse(400, { error: "Некорректный JSON.", source: "validation" });
    }

    let reportId: string;
    try {
      reportId = requireUuid(
        asString(body.report_id) ||
          asString(body.reportId) ||
          asString(body.id),
        "report_id",
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Invalid report_id.";
      return jsonResponse(400, { error: message, source: "validation" });
    }

    logCtx.reportId = reportId;
    logSpikeStage("cancel", "request", logCtx);

    const db = createSupabaseClient(supabaseUrl, supabaseAnonKey, token);
    const { data: report, error: reportErr } = await db
      .from("hr_reports")
      .select("*")
      .eq("id", reportId)
      .maybeSingle();

    if (reportErr || !report) {
      return jsonResponse(404, { error: "Отчёт не найден.", source: "report" });
    }

    if (!isSupportedReportType(asString(report.report_type))) {
      return jsonResponse(404, {
        error: "Отчёт не является послойной картой кандидата v2.",
        source: "report_type",
      });
    }

    if (report.report_status !== "generating") {
      return jsonResponse(409, {
        error: "Отмена доступна только для отчёта в статусе generating.",
        source: "report_status",
        report_status: report.report_status,
      });
    }

    const requestedAt = new Date().toISOString();
    const requestedBy =
      authData.user.email ?? authData.user.id ?? null;

    const contentJson = asRecord(report.content_json);
    const generationMeta = asRecord(contentJson.generation_meta);
    const layerGeneration = {
      ...asRecord(generationMeta.layer_generation),
    };

    layerGeneration.cancel_requested = true;
    layerGeneration.cancel_requested_at = requestedAt;
    layerGeneration.cancelled_by = requestedBy;

    const cancellation = {
      requested: true,
      requested_at: requestedAt,
      requested_by: requestedBy,
      status: "requested",
    };

    const nextContentJson = {
      ...contentJson,
      generation_meta: {
        ...generationMeta,
        layer_generation: layerGeneration,
        cancellation: {
          ...asRecord(generationMeta.cancellation),
          ...cancellation,
        },
      },
    };

    const { data: updatedRow, error: updateErr } = await db
      .from("hr_reports")
      .update({
        content_json: nextContentJson,
        updated_at: requestedAt,
      })
      .eq("id", reportId)
      .eq("report_status", "generating")
      .select("id")
      .maybeSingle();

    if (updateErr) {
      console.error("[hr-talent-map-v2-core-layers-cancel] update failed", {
        report_id: reportId,
        message: updateErr.message,
      });
      return jsonResponse(500, {
        error: "Не удалось запросить отмену генерации.",
        source: "db",
      });
    }

    if (!updatedRow) {
      return jsonResponse(409, {
        error: "Не удалось обновить отчёт: генерация уже завершена или статус изменился.",
        source: "report_status",
        report_id: reportId,
        report_status: report.report_status,
      });
    }

    logSpikeStage("cancel", "requested", logCtx, { requested_by: requestedBy });

    return jsonResponse(200, {
      ok: true,
      success: true,
      report_id: reportId,
      report_status: "generating",
      cancel_requested: true,
      cancellation,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    console.error("[hr-talent-map-v2-core-layers-cancel] unhandled", {
      message,
      report_id: logCtx.reportId,
    });
    return jsonResponse(500, { error: message, source: "internal" });
  }
};
