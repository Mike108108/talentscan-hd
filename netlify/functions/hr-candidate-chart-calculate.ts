import type { Handler, HandlerEvent, HandlerContext } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import tzLookup from "tz-lookup";
import { fetchHumanDesignChart } from "./hd-api-shared";
import { normalizeHdChart } from "./hd-normalize";
import { buildCandidateTalentMap } from "./hr-build-talent-map";

function jsonResponse(statusCode: number, body: unknown) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

function asString(value: unknown, fallback = ""): string {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number") return String(value);
  return fallback;
}

/** Normalize Postgres time to HH:MM for HD API */
function formatBirthTime(raw: unknown): string {
  const s = asString(raw);
  if (!s) return "";
  const match = s.match(/^(\d{1,2}):(\d{2})/);
  if (match) return `${match[1].padStart(2, "0")}:${match[2]}`;
  return s.slice(0, 5);
}

export const handler: Handler = async (
  event: HandlerEvent,
  _context: HandlerContext,
) => {
  if (event.httpMethod !== "POST") {
    return jsonResponse(405, { error: "Разрешён только метод POST." });
  }

  const authHeader =
    event.headers["authorization"] ?? event.headers["Authorization"] ?? "";
  const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!bearerMatch) {
    return jsonResponse(401, { error: "Требуется вход.", source: "auth" });
  }
  const token = bearerMatch[1];

  const supabaseUrl =
    process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "";
  const supabaseAnonKey =
    process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY ?? "";

  if (!supabaseUrl.trim() || !supabaseAnonKey.trim()) {
    return jsonResponse(500, { error: "Supabase не настроен на сервере.", source: "config" });
  }

  const authClient = createClient(supabaseUrl, supabaseAnonKey);
  const { data: authData, error: authErr } = await authClient.auth.getUser(token);
  if (authErr || !authData.user) {
    return jsonResponse(401, { error: "Требуется вход.", source: "auth" });
  }

  let body: { candidate_id?: string; company_id?: string };
  try {
    body = event.body ? JSON.parse(event.body) : {};
  } catch {
    return jsonResponse(400, { error: "Некорректный JSON.", source: "validation" });
  }

  const candidateId = asString(body.candidate_id);
  const companyId = asString(body.company_id);
  if (!candidateId || !companyId) {
    return jsonResponse(400, {
      error: "Укажите candidate_id и company_id.",
      source: "validation",
    });
  }

  const db = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: company, error: companyErr } = await db
    .from("hr_companies")
    .select("id, owner_user_id, name")
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

  const birthDate = asString(candidate.birth_date);
  const birthTime = formatBirthTime(candidate.birth_time);
  const birthPlaceText = asString(candidate.birth_place_text);
  const lat =
    typeof candidate.birth_place_lat === "number" ? candidate.birth_place_lat : null;
  const lng =
    typeof candidate.birth_place_lon === "number" ? candidate.birth_place_lon : null;

  if (!birthDate || !birthTime || !birthPlaceText || lat === null || lng === null) {
    return jsonResponse(400, {
      error:
        "Для расчёта нужны дата, время, город и координаты. Уточните данные кандидата.",
      source: "validation",
    });
  }

  let timezone = asString(candidate.birth_timezone);
  if (!timezone) {
    try {
      timezone = tzLookup(lat, lng);
    } catch {
      timezone = "";
    }
  }

  const markError = async () => {
    await db
      .from("hr_candidates")
      .update({ chart_status: "calculation_error", updated_at: new Date().toISOString() })
      .eq("id", candidateId);
  };

  await db
    .from("hr_candidates")
    .update({ chart_status: "calculating", updated_at: new Date().toISOString() })
    .eq("id", candidateId);

  const birthSnapshot = {
    birth_date: birthDate,
    birth_time: birthTime,
    birth_place_text: birthPlaceText,
    birth_place_lat: lat,
    birth_place_lon: lng,
    birth_timezone: timezone,
  };

  let rawChart: unknown;
  try {
    rawChart = await fetchHumanDesignChart(birthDate, birthTime, lat, lng);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Ошибка расчёта карты.";
    await markError();
    return jsonResponse(502, { error: message, source: "chart-api" });
  }

  const normalized = normalizeHdChart(rawChart);
  const now = new Date().toISOString();

  try {
  const { data: existingChart } = await db
    .from("hr_candidate_charts")
    .select("id")
    .eq("candidate_id", candidateId)
    .maybeSingle();

  const chartPayload = {
    candidate_id: candidateId,
    company_id: companyId,
    calculation_status: "calculated",
    raw_chart_data: rawChart as object,
    normalized_chart_data: normalized as object,
    birth_data_snapshot: birthSnapshot,
    calculated_at: now,
    calculation_error: null,
    updated_at: now,
  };

  let chartRow: Record<string, unknown> | null = null;
  if (existingChart?.id) {
    const { data, error } = await db
      .from("hr_candidate_charts")
      .update(chartPayload)
      .eq("id", existingChart.id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    chartRow = data;
  } else {
    const { data, error } = await db
      .from("hr_candidate_charts")
      .insert(chartPayload)
      .select()
      .single();
    if (error) throw new Error(error.message);
    chartRow = data;
  }

  const talentMapData = buildCandidateTalentMap(
    asString(candidate.name),
    normalized,
    asString(candidate.vacancy_title),
  );

  const mapPayload = {
    candidate_id: candidateId,
    company_id: companyId,
    candidate_chart_id: chartRow?.id ?? null,
    report_status: "ready",
    summary: talentMapData.summary,
    best_work_format: talentMapData.best_work_format,
    key_talent: talentMapData.key_talent,
    main_risk: talentMapData.main_risk,
    formula: talentMapData.formula,
    metrics: talentMapData.metrics,
    talents: talentMapData.talents,
    strengths: talentMapData.strengths,
    risks: talentMapData.risks,
    directions: talentMapData.directions,
    not_fit_directions: talentMapData.not_fit_directions,
    roles: talentMapData.roles,
    conditions: talentMapData.conditions,
    tests: talentMapData.tests,
    final_recommendation: talentMapData.final_recommendation,
    updated_at: now,
  };

  const { data: existingMap } = await db
    .from("hr_candidate_talent_maps")
    .select("id")
    .eq("candidate_id", candidateId)
    .maybeSingle();

  let talentMapRow: Record<string, unknown> | null = null;
  if (existingMap?.id) {
    const { data, error } = await db
      .from("hr_candidate_talent_maps")
      .update(mapPayload)
      .eq("id", existingMap.id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    talentMapRow = data;
  } else {
    const { data, error } = await db
      .from("hr_candidate_talent_maps")
      .insert(mapPayload)
      .select()
      .single();
    if (error) throw new Error(error.message);
    talentMapRow = data;
  }

  const { data: updatedCandidate, error: updErr } = await db
    .from("hr_candidates")
    .update({
      chart_status: "calculated",
      birth_timezone: timezone || null,
      updated_at: now,
    })
    .eq("id", candidateId)
    .select()
    .single();

  if (updErr) throw new Error(updErr.message);

  return jsonResponse(200, {
    candidate: updatedCandidate,
    chart: chartRow,
    talent_map: talentMapRow,
  });
  } catch (err) {
    await markError();
    const message = err instanceof Error ? err.message : "Ошибка сохранения результата.";
    return jsonResponse(500, { error: message, source: "db" });
  }
};
