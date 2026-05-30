import type { Handler, HandlerEvent, HandlerContext } from "@netlify/functions";
import { createHash } from "crypto";
import { createClient } from "@supabase/supabase-js";
import { buildHrPersonTalentMapAnalysisPacketV11 } from "./hr-analysis-packet";
import {
  BANNED_TERMS_USER_MESSAGE,
  buildInputHashPayload,
  findBannedClientTerms,
  normalizePersonTalentMapContent,
} from "./hr-report-normalize";
import {
  V2GenerationError,
  V2_LIMITED_PROMPT_VERSION,
  buildHrTalentMapV2LimitedContent,
  buildV2LimitedReportSummary,
  buildV2LimitedReportTitle,
} from "./hr-talent-map-v2-limited";

const PROMPT_VERSION = "hr_person_talent_map_v1_2";
const DEFAULT_REPORT_TYPE = "hr_person_talent_map";
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type ReportType = "hr_person_talent_map";

class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

function logCaughtError(context: string, err: unknown) {
  if (err instanceof Error) {
    console.error(`[hr-generate-candidate-report] ${context}`, {
      name: err.name,
      message: err.message,
      stack: err.stack,
    });
    return;
  }
  console.error(`[hr-generate-candidate-report] ${context}`, err);
}

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

function resolveSupabaseConfig(): { url: string; anonKey: string } {
  const urlRaw = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const keyRaw = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY;

  if (!urlRaw?.trim()) {
    throw new ConfigError("Missing SUPABASE_URL");
  }
  if (!keyRaw?.trim()) {
    throw new ConfigError("Missing SUPABASE_ANON_KEY");
  }

  const url = urlRaw.trim();
  const anonKey = keyRaw.trim();

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new ConfigError("Invalid SUPABASE_URL");
    }
  } catch (err) {
    if (err instanceof ConfigError) throw err;
    throw new ConfigError("Invalid SUPABASE_URL");
  }

  if (anonKey.length < 20) {
    throw new ConfigError("Invalid SUPABASE_ANON_KEY");
  }

  return { url, anonKey };
}

function resolveOpenAiApiKey(): string {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new ConfigError("Missing OPENAI_API_KEY");
  }
  return apiKey;
}

function requireUuid(value: string, fieldName: string): string {
  if (!value) {
    throw new Error(`Missing ${fieldName}`);
  }
  if (!UUID_RE.test(value)) {
    throw new Error(`Invalid ${fieldName}`);
  }
  return value;
}

function createSupabaseClient(url: string, anonKey: string, token?: string) {
  if (!url.trim() || !anonKey.trim()) {
    throw new ConfigError("Missing Supabase configuration");
  }

  try {
    return createClient(url, anonKey, {
      auth: { persistSession: false },
      ...(token
        ? { global: { headers: { Authorization: `Bearer ${token}` } } }
        : {}),
    });
  } catch (err) {
    logCaughtError("createSupabaseClient", err);
    throw new ConfigError("Invalid Supabase client configuration");
  }
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

Режим работы:
- Сначала прочитай analysis_layers в analysis_packet по порядку priority (1 → 8).
- Используй каждый слой analysis_packet.analysis_layers как источник HR-гипотез — не пересказывай технические данные.
- Пакет слойный, но сейчас ты работаешь в режиме single-call: синтезируй выводы в цельную HR-карту кандидата.
- Не перечисляй технические слои и analysis_layers клиенту — синтезируй выводы в цельную HR-карту кандидата.
- Это hr_person_talent_map — общая карта талантов кандидата, НЕ оценка под конкретную вакансию.
- vacancy_context, если есть, используй только как контекст — не для процента соответствия и не для role-fit score.

Правила:
- Пиши только на русском языке.
- Используй HR-язык для работодателя: рабочий стиль, рабочий формат, талант, риск, условия раскрытия, среда, управление, коммуникация, интервью, тестовое, адаптация, следующий шаг, проверка гипотезы, что проверить перед решением.
- Следуй prompt_rules из analysis_packet: forbidden_client_terms, interpretation_rules, priority_rules.
- ЗАПРЕЩЕНО использовать технические термины Human Design, соционики и внутренней методологии в клиентских полях.
- Запрещённые слова и темы: Human Design, Дизайн Человека, бодиграф, ворота, каналы, центры, сакрал, селезёнка, эмоциональный центр, профиль (в смысле HD), авторитет, стратегия (в смысле HD), Генератор, Манифестирующий Генератор, Проектор, Манифестор, Рефлектор, Генный Ключ, соционика, социотип, ЧС, БЭ, БЛ, ЧИ и похожие обозначения.
- Исключение: технические термины допустимы ТОЛЬКО во внутреннем evidence_map.based_on при client_visible: false. Во всех остальных полях — запрещены.
- Не придумывай опыт, факты, должности и достижения кандидата — опирайся только на переданный analysis_packet.
- Все выводы формулируй как HR-гипотезы, не как финальный приговор о найме.
- Каждый важный вывод оформляй как hypothesis_cards (тип talent/risk/condition/management/growth).
- Каждый важный риск связывай с проверкой в risk_checks (интервью + тестовое + профилактика для руководителя).
- НЕ считай role-fit, НЕ возвращай fit_score, проценты соответствия и формулировки вроде «подходит на 80%».
- В working_formula.text можно использовать только теги <em> и <strong> для акцентов.
- Верни ТОЛЬКО валидный JSON без markdown и без пояснений вне JSON.`;
}

function buildUserPrompt(analysisPacket: Record<string, unknown>, reportType: ReportType): string {
  return `Сгенерируй отчёт типа "${reportType}" на основе analysis_packet ниже.

Важно:
- Это общая карта талантов кандидата (hr_person_talent_map), а НЕ оценка под вакансию.
- Используй analysis_packet.analysis_layers — каждый слой должен отразиться в layer_map.
- vacancy_context, если присутствует, используй только как контекст — не для процента соответствия.
- НЕ возвращай fit_score в executive_summary или других полях.
- НЕ возвращай проценты соответствия и формулировки вроде «подходит на 80%».
- НЕ считай role-fit.

8 слоёв для layer_map (source_layer_id → title):
- passport_work_format → Рабочий формат и вход в задачи
- main_axes → Главная рабочая тема
- channels_talent_links → Связки талантов
- centers_stability_and_sensitivity → Устойчивость и чувствительность к среде
- strong_gate_themes → Повторяющиеся рабочие темы
- planetary_work_roles → Коммуникация, ценности и точки роста
- variables_environment_motivation → Среда, мотивация и восстановление
- data_quality_and_next_steps → Качество данных и следующий шаг

analysis_packet:
${JSON.stringify(analysisPacket, null, 2)}

Верни JSON строго со следующей структурой (все поля обязательны, массивы — не пустые где возможно):

{
  "schema_version": "hr_person_talent_map_v1_2",
  "executive_snapshot": {
    "one_sentence": "string — главный вывод за 30 секунд",
    "best_use": "string — где кандидат даст максимум пользы",
    "main_value": "string — главная ценность для команды",
    "main_risk": "string — главный риск",
    "how_to_check_first": "string — что проверить первым",
    "decision_note": "string — заметка для решения"
  },
  "layer_map": [{
    "id": "string",
    "title": "string",
    "client_summary": "string",
    "hr_meaning": "string",
    "key_signal": "string",
    "risk_signal": "string",
    "how_to_check": "string",
    "confidence": "high|medium|low",
    "ui_priority": 1,
    "source_layer_id": "string"
  }],
  "hypothesis_cards": [{
    "id": "string",
    "type": "talent|risk|condition|management|growth",
    "title": "string",
    "statement": "string",
    "why_it_matters": "string",
    "workplace_manifestation": "string",
    "how_to_check": "string",
    "good_signal": "string",
    "warning_signal": "string",
    "related_layer_ids": ["string"],
    "confidence": "high|medium|low",
    "client_visible": true
  }],
  "risk_checks": [{
    "id": "string",
    "risk": "string",
    "how_it_may_show_up": "string",
    "interview_check": "string",
    "test_task_check": "string",
    "good_signal": "string",
    "warning_signal": "string",
    "management_prevention": "string",
    "related_hypothesis_ids": ["string"],
    "confidence": "high|medium|low"
  }],
  "management_playbook": {
    "how_to_set_tasks": "string",
    "how_to_give_feedback": "string",
    "how_to_motivate": "string",
    "what_not_to_do": "string",
    "best_environment": "string",
    "overload_signals": "string",
    "first_30_days_focus": "string"
  },
  "verification_plan": {
    "first_check": "string",
    "interview_focus": "string",
    "test_task_focus": "string",
    "what_to_observe": "string",
    "decision_after_check": "string"
  },
  "evidence_map": [{
    "id": "string",
    "conclusion": "string",
    "based_on": ["string — технические ссылки, только если client_visible: false"],
    "source_layer_ids": ["string"],
    "confidence": "high|medium|low",
    "client_visible": false
  }],
  "ui": {},
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
    "text": "string"
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
  "interview_questions": [{
    "question": "string",
    "checks": "string",
    "related_hypothesis_id": "string",
    "good_answer": "string",
    "warning_sign": "string",
    "how_to_evaluate": "string"
  }],
  "test_tasks": [{
    "task": "string",
    "checks": "string",
    "time_estimate": "string",
    "criteria": "string",
    "warning_sign": "string",
    "next_step": "string"
  }],
  "onboarding_7_30_90": {
    "day_7": { "summary": "string", "focus": "string", "give": "string", "verify": "string", "success_signal": "string", "risk": "string" },
    "day_30": { "summary": "string", "focus": "string", "give": "string", "verify": "string", "success_signal": "string", "risk": "string" },
    "day_90": { "summary": "string", "focus": "string", "give": "string", "verify": "string", "success_signal": "string", "risk": "string" },
    "items": [{ "title": "string", "body": "string" }]
  },
  "final_hr_recommendation": { "text": "string" },
  "qa_meta": {
    "hypothesis_level": "string",
    "report_type_note": "general_candidate_talent_map",
    "next_best_report": "hr_candidate_role_fit",
    "disclaimers": ["string"]
  }
}

qa_meta — служебные пометки для HR, без запрещённых терминов.
evidence_map — служебное поле, по умолчанию client_visible: false.`;
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
  try {
  if (event.httpMethod !== "POST") {
    return jsonResponse(405, { error: "Разрешён только метод POST." });
  }

  const authHeader =
    event.headers["authorization"] ?? event.headers["Authorization"] ?? "";
  const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!bearerMatch) {
    return jsonResponse(401, { error: "Требуется вход.", source: "auth" });
  }
  const token = bearerMatch[1].trim();
  if (!token) {
    return jsonResponse(401, { error: "Требуется вход.", source: "auth" });
  }

  let supabaseUrl: string;
  let supabaseAnonKey: string;
  try {
    ({ url: supabaseUrl, anonKey: supabaseAnonKey } = resolveSupabaseConfig());
  } catch (err) {
    logCaughtError("resolveSupabaseConfig", err);
    if (err instanceof ConfigError) {
      return jsonResponse(500, { error: err.message, source: "config" });
    }
    return jsonResponse(500, { error: "Invalid Supabase configuration.", source: "config" });
  }

  const authClient = createSupabaseClient(supabaseUrl, supabaseAnonKey);
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
  } catch (err) {
    logCaughtError("parse_request_body", err);
    return jsonResponse(400, { error: "Некорректный JSON.", source: "validation" });
  }

  let companyId: string;
  let candidateId: string;
  let vacancyId: string | null = null;
  try {
    companyId = requireUuid(asString(body.company_id), "company_id");
    candidateId = requireUuid(asString(body.candidate_id), "candidate_id");
    if (body.vacancy_id) {
      vacancyId = requireUuid(asString(body.vacancy_id), "vacancy_id");
    }
  } catch (err) {
    logCaughtError("validate_request_ids", err);
    const message = err instanceof Error ? err.message : "Invalid request IDs.";
    return jsonResponse(400, { error: message, source: "validation" });
  }

  const reportType: ReportType =
    body.report_type === "hr_person_talent_map" ? body.report_type : DEFAULT_REPORT_TYPE;
  const forceRegenerate = body.force_regenerate === true;
  const useV2LimitedLayers =
    process.env.HR_TALENT_MAP_V2_LIMITED_LAYERS_ENABLED === "true" &&
    reportType === "hr_person_talent_map";
  const promptVersion = useV2LimitedLayers ? V2_LIMITED_PROMPT_VERSION : PROMPT_VERSION;

  const db = createSupabaseClient(supabaseUrl, supabaseAnonKey, token);

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

  const analysisPacket = buildHrPersonTalentMapAnalysisPacketV11({
    company: company as Record<string, unknown>,
    candidate: candidate as Record<string, unknown>,
    vacancy,
    normalizedChart,
    promptVersion,
  });

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

  let apiKey: string;
  try {
    apiKey = resolveOpenAiApiKey();
  } catch (err) {
    logCaughtError("resolveOpenAiApiKey", err);
    if (err instanceof ConfigError) {
      return jsonResponse(500, { error: err.message, source: "config" });
    }
    return jsonResponse(500, { error: "Missing OPENAI_API_KEY", source: "config" });
  }

  const model = process.env.OPENAI_MODEL?.trim() || "gpt-4o";
  const now = new Date().toISOString();

  if (useV2LimitedLayers) {
    let contentJson: Record<string, unknown>;
    try {
      contentJson = await buildHrTalentMapV2LimitedContent({
        apiKey,
        model,
        analysisPacket,
        candidate: candidate as Record<string, unknown>,
        chart: chart as Record<string, unknown>,
        inputHash,
        generatedAt: now,
      });
    } catch (err) {
      const stage =
        err instanceof V2GenerationError ? err.stage : "v2_limited_layers_prompt";
      const message =
        err instanceof Error ? err.message : "Ошибка генерации v2 отчёта.";
      console.error("[hr-generate-candidate-report] v2 limited generation failed", {
        stage,
        message,
        err,
      });
      return jsonResponse(502, {
        error: message,
        source: "openai",
        stage,
      });
    }

    const title = buildV2LimitedReportTitle(contentJson, asString(candidate.name));
    const summary = buildV2LimitedReportSummary(contentJson);

    const reportPayload = {
      company_id: companyId,
      candidate_id: candidateId,
      vacancy_id: vacancyId,
      report_type: reportType,
      report_status: "ready",
      title,
      summary: summary || null,
      fit_score: null,
      content_json: contentJson,
      input_snapshot: analysisPacket,
      input_hash: inputHash,
      model,
      prompt_version: V2_LIMITED_PROMPT_VERSION,
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
      console.error("[hr-generate-candidate-report] v2 report save failed", {
        stage: "v2_report_save",
        error: saveErr,
      });
      return jsonResponse(500, {
        error: saveErr ?? "Ошибка сохранения отчёта.",
        source: "db",
        stage: "v2_report_save",
      });
    }

    return jsonResponse(200, { report: saved });
  }

  let rawContentJson: Record<string, unknown>;
  try {
    rawContentJson = await callOpenAiJson(
      apiKey,
      model,
      buildSystemPrompt(),
      buildUserPrompt(analysisPacket, reportType),
    );
  } catch (err) {
    logCaughtError("openai_generate", err);
    const message = err instanceof Error ? err.message : "Ошибка генерации отчёта.";
    return jsonResponse(502, { error: message, source: "openai" });
  }

  let banned = findBannedClientTerms(rawContentJson);
  if (banned.length > 0) {
    try {
      rawContentJson = await cleanupBannedTerms(apiKey, model, rawContentJson, banned);
      banned = findBannedClientTerms(rawContentJson);
    } catch (err) {
      logCaughtError("openai_cleanup", err);
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
  const summary =
    contentJson.executive_snapshot?.one_sentence ||
    contentJson.executive_summary.text ||
    contentJson.final_hr_recommendation.text ||
    null;
  const fitScore = null;

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
  } catch (err) {
    logCaughtError("handler", err);
    if (err instanceof ConfigError) {
      return jsonResponse(500, { error: err.message, source: "config" });
    }
    const message =
      err instanceof Error ? err.message : "Внутренняя ошибка сервера.";
    return jsonResponse(500, { error: message, source: "server" });
  }
};
