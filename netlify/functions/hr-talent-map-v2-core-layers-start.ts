/**
 * Sync starter for HR Talent Map v2 core layers pipeline.
 */

import type { Handler, HandlerEvent, HandlerContext } from "@netlify/functions";
import {
  SPIKE_PROMPT_VERSION,
  SPIKE_REPORT_TYPE,
  SpikeConfigError,
  buildCoreLayersCompactInput,
  buildInputHashPayload,
  buildMinimalDataQuality,
  computeInputHash,
  createSupabaseClient,
  extractBearerToken,
  findExistingSpikeReport,
  getFunctionOrigin,
  jsonResponse,
  loadActiveCandidateChart,
  logSpikeStage,
  parseCompanyCandidateIds,
  buildModelPolicySnapshot,
  initLayerGenerationState,
  resolveCoreLayersModelPolicy,
  resolveSupabaseConfig,
  saveLayerGenerationProgress,
  saveReportError,
  serializeGenerationError,
  asString,
} from "./hr-talent-map-v2-core-layers-shared";

export const handler: Handler = async (
  event: HandlerEvent,
  _context: HandlerContext,
) => {
  const logCtx: { companyId?: string; candidateId?: string; reportId?: string } = {};

  try {
    logSpikeStage("start", "start", logCtx);

    if (event.httpMethod !== "POST") {
      return jsonResponse(405, { error: "Разрешён только метод POST." });
    }

    let modelPolicy;
    try {
      modelPolicy = resolveCoreLayersModelPolicy();
    } catch (err) {
      if (err instanceof SpikeConfigError) {
        return jsonResponse(500, { error: err.message, source: "config" });
      }
      throw err;
    }

    const model = modelPolicy.selectedModel;

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
    logSpikeStage("start", "auth_ok", logCtx);

    let body: Record<string, unknown>;
    try {
      body = event.body ? JSON.parse(event.body) : {};
    } catch {
      return jsonResponse(400, { error: "Некорректный JSON.", source: "validation" });
    }

    let companyId: string;
    let candidateId: string;
    try {
      ({ companyId, candidateId } = parseCompanyCandidateIds(body));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Invalid request IDs.";
      return jsonResponse(400, { error: message, source: "validation" });
    }

    logCtx.companyId = companyId;
    logCtx.candidateId = candidateId;

    const db = createSupabaseClient(supabaseUrl, supabaseAnonKey, token);

    logSpikeStage("start", "load_candidate", logCtx);
    const { data: company, error: companyErr } = await db
      .from("hr_companies")
      .select("id, owner_user_id, name, industry")
      .eq("id", companyId)
      .maybeSingle();

    if (companyErr || !company) {
      return jsonResponse(404, { error: "Компания не найдена.", source: "company" });
    }

    const { data: candidate, error: candErr } = await db
      .from("hr_candidates")
      .select("*")
      .eq("id", candidateId)
      .eq("company_id", companyId)
      .maybeSingle();

    if (candErr || !candidate) {
      return jsonResponse(404, { error: "Кандидат не найден.", source: "candidate" });
    }

    logSpikeStage("start", "load_chart", logCtx);
    const { chart, error: chartLoadErr } = await loadActiveCandidateChart(
      db,
      companyId,
      candidateId,
    );
    if (chartLoadErr || !chart) {
      return jsonResponse(400, {
        error: "Сначала рассчитайте карту кандидата.",
        source: "chart",
      });
    }

    const normalizedChart =
      chart.normalized_chart_data && typeof chart.normalized_chart_data === "object"
        ? (chart.normalized_chart_data as Record<string, unknown>)
        : null;

    if (!normalizedChart) {
      return jsonResponse(400, {
        error: "У кандидата нет normalized_chart_data.",
        source: "chart",
        stage: "missing_normalized_chart_data",
      });
    }

    const compactInput = buildCoreLayersCompactInput({
      layerKey: "work_format",
      candidate: candidate as Record<string, unknown>,
      company: company as Record<string, unknown>,
      normalizedChart,
    });

    const inputHash = computeInputHash(
      buildInputHashPayload({
        companyId,
        candidateId,
        chartId: String(chart.id),
        chartUpdatedAt: String(chart.updated_at ?? chart.calculated_at ?? ""),
        normalizedChart,
        candidateHrComment: asString(candidate.hr_comment) || null,
        companyIndustry: asString(company.industry) || null,
        model,
        run_mode: modelPolicy.runMode,
      }),
    );

    logSpikeStage("start", "create_report_row", logCtx, { input_hash: inputHash });

    const reportPayload = {
      company_id: companyId,
      candidate_id: candidateId,
      vacancy_id: null,
      report_type: SPIKE_REPORT_TYPE,
      report_status: "generating",
      title: "Core layers background spike",
      summary: null,
      fit_score: null,
      content_json: {},
      input_snapshot: compactInput,
      input_hash: inputHash,
      model,
      prompt_version: SPIKE_PROMPT_VERSION,
      generation_error: null,
      generated_at: null,
    };

    const { data: existingRow } = await findExistingSpikeReport(
      db,
      companyId,
      candidateId,
      inputHash,
    );

    let reportId: string;
    if (existingRow?.id) {
      const { data: updated, error: updateErr } = await db
        .from("hr_reports")
        .update({
          ...reportPayload,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingRow.id)
        .select("id")
        .single();
      if (updateErr || !updated) {
        return jsonResponse(500, {
          error: updateErr?.message ?? "Не удалось обновить spike-отчёт.",
          source: "database",
        });
      }
      reportId = updated.id as string;
    } else {
      const { data: inserted, error: insertErr } = await db
        .from("hr_reports")
        .insert(reportPayload)
        .select("id")
        .single();

      if (insertErr?.code === "23505") {
        const { data: retryExisting } = await findExistingSpikeReport(
          db,
          companyId,
          candidateId,
          inputHash,
        );
        if (retryExisting?.id) {
          const { data: updated, error: updateErr } = await db
            .from("hr_reports")
            .update({
              ...reportPayload,
              updated_at: new Date().toISOString(),
            })
            .eq("id", retryExisting.id)
            .select("id")
            .single();
          if (updateErr || !updated) {
            return jsonResponse(500, {
              error: updateErr?.message ?? "Не удалось обновить spike-отчёт.",
              source: "database",
            });
          }
          reportId = updated.id as string;
        } else {
          return jsonResponse(500, {
            error: insertErr.message,
            source: "database",
          });
        }
      } else if (insertErr || !inserted) {
        return jsonResponse(500, {
          error: insertErr?.message ?? "Не удалось создать spike-отчёт.",
          source: "database",
        });
      } else {
        reportId = inserted.id as string;
      }
    }

    logCtx.reportId = reportId;

    const pipelineStartedAt = new Date().toISOString();
    const initialLayerGeneration = initLayerGenerationState(
      pipelineStartedAt,
      modelPolicy,
    );
    await saveLayerGenerationProgress(db, reportId, {
      layerGeneration: initialLayerGeneration,
      layerReports: [],
    });

    logSpikeStage("start", "trigger_background_worker", logCtx);

    const origin = getFunctionOrigin(event);
    const workerUrl = `${origin}/.netlify/functions/hr-talent-map-v2-core-layers-worker-background`;

    try {
      const workerResponse = await fetch(workerUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          report_id: reportId,
          company_id: companyId,
          candidate_id: candidateId,
        }),
      });

      if (!workerResponse.ok) {
        const triggerError = serializeGenerationError({
          stage: "trigger_background_worker",
          message: `Background worker trigger failed (${workerResponse.status})`,
          status: workerResponse.status,
          run_mode: modelPolicy.runMode,
          model,
          selected_model: model,
        });
        await saveReportError(db, reportId, triggerError);
        return jsonResponse(502, {
          error: "Background worker trigger failed",
          report_id: reportId,
          report_status: "error",
          stage: "trigger_background_worker",
          http_status: workerResponse.status,
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Background worker trigger failed";
      const triggerError = serializeGenerationError({
        stage: "trigger_background_worker",
        message,
        run_mode: modelPolicy.runMode,
        model,
        selected_model: model,
      });
      await saveReportError(db, reportId, triggerError);
      logSpikeStage("start", "trigger_background_worker", logCtx, { error: message });
      return jsonResponse(502, {
        error: "Background worker trigger failed",
        report_id: reportId,
        report_status: "error",
        stage: "trigger_background_worker",
        message,
      });
    }

    return jsonResponse(200, {
      report_id: reportId,
      report_status: "generating",
      report_type: SPIKE_REPORT_TYPE,
      prompt_version: SPIKE_PROMPT_VERSION,
      input_hash: inputHash,
      run_mode: modelPolicy.runMode,
      selected_model: modelPolicy.selectedModel,
      model_policy: buildModelPolicySnapshot(modelPolicy),
      data_quality: buildMinimalDataQuality(
        candidate as Record<string, unknown>,
        normalizedChart,
      ),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    console.error("[hr-talent-map-v2-core-layers-start] unhandled", {
      message,
      company_id: logCtx.companyId,
      candidate_id: logCtx.candidateId,
      report_id: logCtx.reportId,
    });
    return jsonResponse(500, { error: message, source: "internal" });
  }
};
