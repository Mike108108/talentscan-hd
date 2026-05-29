import type { Handler, HandlerEvent, HandlerContext } from "@netlify/functions";
import { createHash } from "crypto";
import { createClient } from "@supabase/supabase-js";
import {
  BANNED_TERMS_USER_MESSAGE,
  buildInputHashPayload,
  findBannedClientTerms,
  normalizePersonTalentMapContent,
} from "./hr-report-normalize";

const PROMPT_VERSION = "hr_person_talent_map_v1";
const DEFAULT_REPORT_TYPE = "hr_person_talent_map";

type ReportType = "hr_person_talent_map";

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

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((v) => stableStringify(v)).join(",")}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(",")}}`;
}

function computeInputHash(parts: Record<string, unknown>): string {
  return createHash("sha256").update(stableStringify(parts)).digest("hex");
}

function buildSystemPrompt(): string {
  return `Ты — TalentScan HR Analysis Engine.

Правила:
- Пиши только на русском языке.
- Используй HR-язык для работодателя: рабочий формат, сильные стороны, риски, условия, интервью, онбординг.
- ЗАПРЕЩЕНО использовать технические термины Human Design, соционики и внутренней методологии в клиентских полях.
- Запрещённые слова и темы: Human Design, Дизайн Человека, бодиграф, ворота, каналы, центры, сакрал, селезёнка, эмоциональный центр, профиль (в смысле HD), авторитет, стратегия (в смысле HD), Генератор, Проектор, Манифестор, Рефлектор, Генный Ключ, соционика, социотип, ЧС, БЭ, БЛ, ЧИ и похожие обозначения.
- Не придумывай опыт, факты, должности и достижения кандидата — опирайся только на переданный analysis_packet.
- Все выводы формулируй как HR-гипотезы, не как финальный приговор о найме.
- В working_formula.text можно использовать только теги <em> и <strong> для акцентов.
- Верни ТОЛЬКО валидный JSON без markdown и без пояснений вне JSON.`;
}

function buildUserPrompt(analysisPacket: Record<string, unknown>, reportType: ReportType): string {
  return `Сгенерируй отчёт типа "${reportType}" на основе analysis_packet ниже.

analysis_packet:
${JSON.stringify(analysisPacket, null, 2)}

Верни JSON строго со следующей структурой (все поля обязательны, массивы — не пустые где возможно):

{
  "hero": {
    "name": "string",
    "subtitle": "string",
    "status_label": "string",
    "best_work_format": "string",
    "key_talent": "string",
    "main_risk": "string",
    "headline": "string"
  },
  "data_quality": {
    "completeness": "string",
    "confidence": "string",
    "notes": "string",
    "metrics": [{ "label": "string", "value": "string", "hint": "string" }]
  },
  "executive_summary": {
    "text": "string",
    "fit_score": 0
  },
  "working_formula": { "text": "string" },
  "talents": [{ "title": "string", "body": "string" }],
  "strengths": [{ "title": "string", "body": "string" }],
  "risks": [{ "title": "string", "body": "string" }],
  "suitable_directions": [{ "title": "string", "body": "string", "fit": "string" }],
  "questionable_directions": [{ "title": "string", "body": "string" }],
  "roles": [{ "role": "string", "fit": "string", "note": "string" }],
  "work_environment": [{ "title": "string", "body": "string" }],
  "management_style": [{ "title": "string", "body": "string" }],
  "interview_questions": [{ "title": "string", "body": "string" }],
  "test_tasks": [{ "title": "string", "body": "string" }],
  "onboarding_7_30_90": {
    "day_7": "string",
    "day_30": "string",
    "day_90": "string",
    "items": [{ "title": "string", "body": "string" }]
  },
  "final_hr_recommendation": { "text": "string" },
  "qa_meta": {
    "hypothesis_level": "string",
    "disclaimers": ["string"]
  }
}

fit_score — целое 0–100, предварительная оценка соответствия (гипотеза).
qa_meta — служебные пометки для HR, тоже без запрещённых терминов.`;
}

function buildAnalysisPacket(
  company: Record<string, unknown>,
  candidate: Record<string, unknown>,
  vacancy: Record<string, unknown> | null,
  normalizedChart: Record<string, unknown> | null,
): Record<string, unknown> {
  return {
    company: {
      id: company.id,
      name: company.name,
      industry: company.industry ?? null,
    },
    candidate: {
      id: candidate.id,
      name: candidate.name,
      email: candidate.email ?? null,
      phone: candidate.phone ?? null,
      vacancy_title: candidate.vacancy_title ?? null,
      status: candidate.status ?? null,
      hr_comment: candidate.hr_comment ?? null,
      birth_date: candidate.birth_date ?? null,
      birth_time: candidate.birth_time ?? null,
      birth_place_text: candidate.birth_place_text ?? null,
      birth_timezone: candidate.birth_timezone ?? null,
      chart_status: candidate.chart_status ?? null,
    },
    vacancy: vacancy
      ? {
          id: vacancy.id,
          title: vacancy.title,
          status: vacancy.status,
          department: vacancy.department ?? null,
          employment_format: vacancy.employment_format ?? null,
          work_format: vacancy.work_format ?? null,
          location: vacancy.location ?? null,
          schedule: vacancy.schedule ?? null,
          role_description: vacancy.role_description ?? null,
          responsibilities: vacancy.responsibilities ?? null,
          kpi: vacancy.kpi ?? null,
          must_have: vacancy.must_have ?? null,
          nice_to_have: vacancy.nice_to_have ?? null,
          working_conditions: vacancy.working_conditions ?? null,
          manager_context: vacancy.manager_context ?? null,
          team_context: vacancy.team_context ?? null,
          hiring_priorities: vacancy.hiring_priorities ?? null,
          risks_to_check: vacancy.risks_to_check ?? null,
        }
      : null,
    normalized_chart: normalizedChart,
    prompt_version: PROMPT_VERSION,
  };
}

function extractJsonContent(raw: string): Record<string, unknown> {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)```$/i);
  const jsonText = fenced ? fenced[1].trim() : trimmed;
  const parsed: unknown = JSON.parse(jsonText);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("OpenAI вернул JSON неожиданной структуры.");
  }
  return parsed as Record<string, unknown>;
}

async function callOpenAiJson(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
): Promise<Record<string, unknown>> {
  const openAiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.5,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  if (!openAiResponse.ok) {
    const errText = await openAiResponse.text();
    console.error("OpenAI API error:", openAiResponse.status, errText);
    throw new Error(`OpenAI API вернул ошибку (${openAiResponse.status}).`);
  }

  const data = (await openAiResponse.json()) as {
    choices?: { message?: { content?: string | null } }[];
  };
  const rawContent = data.choices?.[0]?.message?.content?.trim();
  if (!rawContent) {
    throw new Error("OpenAI вернул пустой ответ.");
  }

  return extractJsonContent(rawContent);
}

async function cleanupBannedTerms(
  apiKey: string,
  model: string,
  contentJson: Record<string, unknown>,
  bannedTerms: string[],
): Promise<Record<string, unknown>> {
  const cleanupPrompt = `Исправь JSON отчёта: убери запрещённые внутренние термины (${bannedTerms.join(", ")}).
Сохрани ту же структуру и смысл HR-гипотез, но замени запрещённые слова на обычный HR-язык.
Не добавляй новых фактов. Верни только JSON.

Исходный JSON:
${JSON.stringify(contentJson, null, 2)}`;

  return callOpenAiJson(apiKey, model, buildSystemPrompt(), cleanupPrompt);
}

async function loadActiveCandidateChart(
  db: ReturnType<typeof createClient>,
  companyId: string,
  candidateId: string,
) {
  const { data: charts, error } = await db
    .from("hr_candidate_charts")
    .select("*")
    .eq("candidate_id", candidateId)
    .eq("company_id", companyId)
    .eq("calculation_status", "calculated")
    .order("calculated_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) return { chart: null, error: error.message };
  const chart = charts?.[0] ?? null;
  return { chart, error: null };
}

async function findExistingReport(
  db: ReturnType<typeof createClient>,
  companyId: string,
  candidateId: string,
  reportType: ReportType,
  inputHash: string,
  vacancyId: string | null,
) {
  let query = db
    .from("hr_reports")
    .select("id")
    .eq("company_id", companyId)
    .eq("candidate_id", candidateId)
    .eq("report_type", reportType)
    .eq("input_hash", inputHash);

  if (vacancyId) {
    query = query.eq("vacancy_id", vacancyId);
  } else {
    query = query.is("vacancy_id", null);
  }

  return query.maybeSingle();
}

async function saveReport(
  db: ReturnType<typeof createClient>,
  companyId: string,
  candidateId: string,
  reportType: ReportType,
  inputHash: string,
  vacancyId: string | null,
  reportPayload: Record<string, unknown>,
) {
  const { data: existingRow } = await findExistingReport(
    db,
    companyId,
    candidateId,
    reportType,
    inputHash,
    vacancyId,
  );

  if (existingRow?.id) {
    const { data, error } = await db
      .from("hr_reports")
      .update(reportPayload)
      .eq("id", existingRow.id)
      .select()
      .single();
    if (error) return { saved: null, error: error.message };
    return { saved: data, error: null };
  }

  const { data, error } = await db
    .from("hr_reports")
    .insert(reportPayload)
    .select()
    .single();

  if (error?.code === "23505") {
    const { data: retryExisting } = await findExistingReport(
      db,
      companyId,
      candidateId,
      reportType,
      inputHash,
      vacancyId,
    );
    if (retryExisting?.id) {
      const { data: updated, error: updateErr } = await db
        .from("hr_reports")
        .update(reportPayload)
        .eq("id", retryExisting.id)
        .select()
        .single();
      if (updateErr) return { saved: null, error: updateErr.message };
      return { saved: updated, error: null };
    }
  }

  if (error) return { saved: null, error: error.message };
  return { saved: data, error: null };
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

  let body: {
    company_id?: string;
    candidate_id?: string;
    vacancy_id?: string | null;
    report_type?: ReportType;
    force_regenerate?: boolean;
  };
  try {
    body = event.body ? JSON.parse(event.body) : {};
  } catch {
    return jsonResponse(400, { error: "Некорректный JSON.", source: "validation" });
  }

  const companyId = asString(body.company_id);
  const candidateId = asString(body.candidate_id);
  const vacancyId = body.vacancy_id ? asString(body.vacancy_id) : null;
  const reportType: ReportType =
    body.report_type === "hr_person_talent_map" ? body.report_type : DEFAULT_REPORT_TYPE;
  const forceRegenerate = body.force_regenerate === true;

  if (!companyId || !candidateId) {
    return jsonResponse(400, {
      error: "Укажите company_id и candidate_id.",
      source: "validation",
    });
  }

  const db = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

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

  const { chart, error: chartLoadErr } = await loadActiveCandidateChart(db, companyId, candidateId);
  if (chartLoadErr || !chart) {
    return jsonResponse(400, {
      error: "Сначала рассчитайте карту кандидата.",
      source: "chart",
    });
  }

  let vacancy: Record<string, unknown> | null = null;
  if (vacancyId) {
    const { data: vac, error: vacErr } = await db
      .from("hr_vacancies")
      .select("*")
      .eq("id", vacancyId)
      .eq("company_id", companyId)
      .maybeSingle();
    if (vacErr || !vac) {
      return jsonResponse(404, { error: "Вакансия не найдена.", source: "vacancy" });
    }
    vacancy = vac as Record<string, unknown>;
  }

  const normalizedChart =
    chart.normalized_chart_data && typeof chart.normalized_chart_data === "object"
      ? (chart.normalized_chart_data as Record<string, unknown>)
      : null;

  const analysisPacket = buildAnalysisPacket(
    company as Record<string, unknown>,
    candidate as Record<string, unknown>,
    vacancy,
    normalizedChart,
  );

  const inputHash = computeInputHash(buildInputHashPayload(reportType, analysisPacket));

  if (!forceRegenerate) {
    let cachedQuery = db
      .from("hr_reports")
      .select("*")
      .eq("company_id", companyId)
      .eq("candidate_id", candidateId)
      .eq("report_type", reportType)
      .eq("input_hash", inputHash)
      .eq("report_status", "ready");

    if (vacancyId) {
      cachedQuery = cachedQuery.eq("vacancy_id", vacancyId);
    } else {
      cachedQuery = cachedQuery.is("vacancy_id", null);
    }

    const { data: cached } = await cachedQuery.maybeSingle();
    if (cached) {
      return jsonResponse(200, { report: cached });
    }
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return jsonResponse(500, {
      error: "Ключ OpenAI не настроен (OPENAI_API_KEY).",
      source: "config",
    });
  }

  const model = process.env.OPENAI_MODEL ?? "gpt-4o";
  const now = new Date().toISOString();

  let rawContentJson: Record<string, unknown>;
  try {
    rawContentJson = await callOpenAiJson(
      apiKey,
      model,
      buildSystemPrompt(),
      buildUserPrompt(analysisPacket, reportType),
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Ошибка генерации отчёта.";
    return jsonResponse(502, { error: message, source: "openai" });
  }

  let banned = findBannedClientTerms(rawContentJson);
  if (banned.length > 0) {
    try {
      rawContentJson = await cleanupBannedTerms(apiKey, model, rawContentJson, banned);
      banned = findBannedClientTerms(rawContentJson);
    } catch (err) {
      console.error("Banned terms cleanup failed:", err);
    }
  }

  if (banned.length > 0) {
    const failedPayload = {
      company_id: companyId,
      candidate_id: candidateId,
      vacancy_id: vacancyId,
      report_type: reportType,
      report_status: "error",
      title: `Карта талантов — ${asString(candidate.name)}`,
      summary: null,
      fit_score: null,
      content_json: normalizePersonTalentMapContent(rawContentJson),
      input_snapshot: analysisPacket,
      input_hash: inputHash,
      model,
      prompt_version: PROMPT_VERSION,
      generation_error: `${BANNED_TERMS_USER_MESSAGE}: ${banned.join(", ")}`,
      generated_at: now,
      updated_at: now,
    };

    await saveReport(
      db,
      companyId,
      candidateId,
      reportType,
      inputHash,
      vacancyId,
      failedPayload,
    );

    return jsonResponse(502, {
      error: BANNED_TERMS_USER_MESSAGE,
      source: "validation",
    });
  }

  const contentJson = normalizePersonTalentMapContent(rawContentJson);
  const title =
    contentJson.hero.headline ||
    (contentJson.hero.name ? `Карта талантов — ${contentJson.hero.name}` : "") ||
    `Карта талантов — ${asString(candidate.name)}`;
  const summary = contentJson.executive_summary.text || contentJson.final_hr_recommendation.text || null;
  const fitScore = contentJson.executive_summary.fit_score;

  const reportPayload = {
    company_id: companyId,
    candidate_id: candidateId,
    vacancy_id: vacancyId,
    report_type: reportType,
    report_status: "ready",
    title,
    summary: summary || null,
    fit_score: fitScore,
    content_json: contentJson,
    input_snapshot: analysisPacket,
    input_hash: inputHash,
    model,
    prompt_version: PROMPT_VERSION,
    generation_error: null,
    generated_at: now,
    updated_at: now,
  };

  const { saved, error: saveErr } = await saveReport(
    db,
    companyId,
    candidateId,
    reportType,
    inputHash,
    vacancyId,
    reportPayload,
  );

  if (saveErr || !saved) {
    return jsonResponse(500, { error: saveErr ?? "Ошибка сохранения отчёта.", source: "db" });
  }

  return jsonResponse(200, { report: saved });
};
