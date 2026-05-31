/**
 * Shared helpers for HR Talent Map v2 work_format background spike (Stage 4.2).
 */

import { createHash } from "crypto";
import type { HandlerEvent } from "@netlify/functions";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { findBannedClientTerms } from "./hr-report-normalize";
import { V2_SCHEMA_VERSION } from "./hr-talent-map-v2-limited";

export const SPIKE_REPORT_TYPE = "hr_person_talent_map_work_format_spike";
export const SPIKE_PROMPT_VERSION =
  "hr_person_talent_map_v2_work_format_background_spike_0_1";
export const SOURCE_ANALYSIS_PACKET_VERSION = "analysis_packet_v1_1";
export const CONTENT_CONTRACT_VERSION = "2.0.0";
export const WORK_FORMAT_LAYER_KEY = "work_format";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class SpikeConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SpikeConfigError";
  }
}

export type SpikeLogContext = {
  companyId?: string;
  candidateId?: string;
  reportId?: string;
  model?: string;
  promptVersion?: string;
};

export function jsonResponse(statusCode: number, body: unknown) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

export function asString(value: unknown, fallback = ""): string {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return fallback;
}

export function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

export function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((v) => asString(v)).filter(Boolean);
}

export function requireUuid(value: string, fieldName: string): string {
  if (!value) throw new Error(`Missing ${fieldName}`);
  if (!UUID_RE.test(value)) throw new Error(`Invalid ${fieldName}`);
  return value;
}

export function resolveSupabaseConfig(): { url: string; anonKey: string } {
  const urlRaw = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const keyRaw = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY;
  if (!urlRaw?.trim()) throw new SpikeConfigError("Missing SUPABASE_URL");
  if (!keyRaw?.trim()) throw new SpikeConfigError("Missing SUPABASE_ANON_KEY");
  return { url: urlRaw.trim(), anonKey: keyRaw.trim() };
}

export function resolveOpenAiApiKey(): string {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new SpikeConfigError("Missing OPENAI_API_KEY");
  return apiKey;
}

export function resolveResponsesModel(): string {
  const model = process.env.OPENAI_RESPONSES_MODEL?.trim();
  if (!model) throw new SpikeConfigError("missing_OPENAI_RESPONSES_MODEL");
  return model;
}

export function isSpikeEnabled(): boolean {
  return process.env.HR_TALENT_MAP_V2_BACKGROUND_WORK_FORMAT_ENABLED === "true";
}

export function createSupabaseClient(url: string, anonKey: string, token?: string) {
  return createClient(url, anonKey, {
    auth: { persistSession: false },
    ...(token ? { global: { headers: { Authorization: `Bearer ${token}` } } } : {}),
  });
}

export function extractBearerToken(event: HandlerEvent): string | null {
  const authHeader =
    event.headers.authorization ?? event.headers.Authorization ?? "";
  const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);
  const token = bearerMatch?.[1]?.trim();
  return token || null;
}

export function parseCompanyCandidateIds(body: Record<string, unknown>): {
  companyId: string;
  candidateId: string;
} {
  const companyId = asString(body.company_id) || asString(body.companyId);
  const candidateId = asString(body.candidate_id) || asString(body.candidateId);
  return {
    companyId: requireUuid(companyId, "company_id"),
    candidateId: requireUuid(candidateId, "candidate_id"),
  };
}

export function getFunctionOrigin(event: HandlerEvent): string {
  const proto =
    event.headers["x-forwarded-proto"] ??
    event.headers["X-Forwarded-Proto"] ??
    "https";
  const host = event.headers.host ?? event.headers.Host;
  if (host) return `${proto}://${host}`;
  const envUrl =
    process.env.URL ??
    process.env.DEPLOY_URL ??
    process.env.DEPLOY_PRIME_URL ??
    (process.env.DEPLOY_CONTEXT === "dev" ? "http://localhost:8888" : "");
  if (envUrl) return envUrl.replace(/\/$/, "");
  return "http://localhost:8888";
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

export function computeInputHash(parts: Record<string, unknown>): string {
  return createHash("sha256").update(stableStringify(parts)).digest("hex");
}

export function buildInputHashPayload(args: {
  companyId: string;
  candidateId: string;
  chartId: string;
  chartUpdatedAt: string;
  normalizedChart: Record<string, unknown>;
  model: string;
}): Record<string, unknown> {
  return {
    company_id: args.companyId,
    candidate_id: args.candidateId,
    chart_id: args.chartId,
    chart_updated_at: args.chartUpdatedAt,
    normalized_chart: {
      type: args.normalizedChart.type ?? null,
      strategy: args.normalizedChart.strategy ?? null,
      authority: args.normalizedChart.authority ?? null,
      definedCenters: asStringArray(args.normalizedChart.definedCenters),
      openCenters: asStringArray(args.normalizedChart.openCenters),
      signature: args.normalizedChart.signature ?? null,
      notSelfTheme: args.normalizedChart.notSelfTheme ?? null,
    },
    layer_key: WORK_FORMAT_LAYER_KEY,
    prompt_version: SPIKE_PROMPT_VERSION,
    model: args.model,
  };
}

export function buildMinimalDataQuality(
  candidate: Record<string, unknown>,
  normalizedChart: Record<string, unknown> | null,
): Record<string, unknown> {
  const hasBirthTime = Boolean(asString(candidate.birth_time));
  const hasBirthPlace = Boolean(asString(candidate.birth_place_text));
  const hasBirthDate = Boolean(asString(candidate.birth_date));
  const hasHrComment = Boolean(asString(candidate.hr_comment));

  return {
    report_confidence_hint: normalizedChart ? "medium" : "low",
    chart: {
      has_normalized_chart: normalizedChart != null,
      can_render_bodygraph: normalizedChart?.canRenderBodygraph === true,
    },
    candidate: {
      has_birth_date: hasBirthDate,
      has_birth_time: hasBirthTime,
      has_birth_place: hasBirthPlace,
      has_hr_comment: hasHrComment,
    },
  };
}

export function buildWorkFormatCompactInput(args: {
  candidate: Record<string, unknown>;
  company: Record<string, unknown>;
  normalizedChart: Record<string, unknown>;
}): Record<string, unknown> {
  const dataQuality = buildMinimalDataQuality(args.candidate, args.normalizedChart);
  return {
    candidate: {
      name: asString(args.candidate.name) || null,
      hr_comment: asString(args.candidate.hr_comment) || null,
    },
    company: {
      name: asString(args.company.name) || null,
      industry: asString(args.company.industry) || null,
    },
    chart: {
      type: args.normalizedChart.type ?? null,
      strategy: args.normalizedChart.strategy ?? null,
      authority: args.normalizedChart.authority ?? null,
      definedCenters: asStringArray(args.normalizedChart.definedCenters),
      openCenters: asStringArray(args.normalizedChart.openCenters),
      signature: args.normalizedChart.signature ?? null,
      notSelfTheme: args.normalizedChart.notSelfTheme ?? null,
      data_quality: dataQuality,
    },
  };
}

export async function loadActiveCandidateChart(
  db: SupabaseClient,
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
  return { chart: charts?.[0] ?? null, error: null };
}

export async function findExistingSpikeReport(
  db: SupabaseClient,
  companyId: string,
  candidateId: string,
  inputHash: string,
) {
  return db
    .from("hr_reports")
    .select("id, report_status")
    .eq("company_id", companyId)
    .eq("candidate_id", candidateId)
    .eq("report_type", SPIKE_REPORT_TYPE)
    .eq("input_hash", inputHash)
    .is("vacancy_id", null)
    .maybeSingle();
}

export function logSpikeStage(
  fn: "start" | "worker" | "status",
  stage: string,
  ctx: SpikeLogContext,
  extra?: Record<string, unknown>,
) {
  console.info(`[hr-talent-map-v2-work-format-${fn}]`, {
    stage,
    company_id: ctx.companyId,
    candidate_id: ctx.candidateId,
    report_id: ctx.reportId,
    model: ctx.model,
    prompt_version: ctx.promptVersion ?? SPIKE_PROMPT_VERSION,
    ...extra,
  });
}

export function serializeGenerationError(args: {
  stage: string;
  message: string;
  status?: number;
  duration_ms?: number;
  validation_result?: unknown;
}): string {
  return JSON.stringify({
    stage: args.stage,
    message: args.message,
    status: args.status ?? null,
    duration_ms: args.duration_ms ?? null,
    validation_result: args.validation_result ?? null,
  });
}

const confidenceEnum = {
  type: "string",
  enum: ["high", "medium", "low", "unknown"],
};

export const workFormatLayerSchema = {
  type: "object",
  properties: {
    layer_key: { type: "string", enum: ["work_format"] },
    hr_title: { type: "string", enum: ["Рабочий формат"] },
    group: { type: "string", enum: ["energy_and_decision"] },
    status: { type: "string", enum: ["ready"] },
    ui_priority: { type: "integer" },
    base: {
      type: "object",
      properties: {
        short_summary: { type: "string" },
        detailed_explanation: { type: "string" },
        how_it_appears_at_work: { type: "string" },
        where_useful: { type: "array", items: { type: "string" } },
        risks: {
          type: "array",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              description: { type: "string" },
              how_it_may_show_up: { type: "string" },
              mitigation: { type: "string" },
            },
            required: ["title", "description", "how_it_may_show_up", "mitigation"],
            additionalProperties: false,
          },
        },
        management_tips: { type: "array", items: { type: "string" } },
        what_to_check: {
          type: "array",
          items: {
            type: "object",
            properties: {
              hypothesis: { type: "string" },
              check_method: { type: "string" },
              good_signal: { type: "string" },
              warning_signal: { type: "string" },
            },
            required: ["hypothesis", "check_method", "good_signal", "warning_signal"],
            additionalProperties: false,
          },
        },
        good_signals: { type: "array", items: { type: "string" } },
        warning_signals: { type: "array", items: { type: "string" } },
      },
      required: [
        "short_summary",
        "detailed_explanation",
        "how_it_appears_at_work",
        "where_useful",
        "risks",
        "management_tips",
        "what_to_check",
        "good_signals",
        "warning_signals",
      ],
      additionalProperties: false,
    },
    pro: {
      type: "object",
      properties: {
        technical_sources: {
          type: "array",
          items: {
            type: "object",
            properties: {
              source_key: { type: "string" },
              source_label: { type: "string" },
              raw_path: { type: "string" },
              value_summary: { type: "string" },
              confidence: confidenceEnum,
            },
            required: [
              "source_key",
              "source_label",
              "raw_path",
              "value_summary",
              "confidence",
            ],
            additionalProperties: false,
          },
        },
        source_values: {
          type: "object",
          properties: {
            type: { type: "string" },
            strategy: { type: "string" },
            authority: { type: "string" },
            defined_centers: { type: "array", items: { type: "string" } },
            open_centers: { type: "array", items: { type: "string" } },
            signature: { type: "string" },
            not_self_theme: { type: "string" },
          },
          required: [
            "type",
            "strategy",
            "authority",
            "defined_centers",
            "open_centers",
            "signature",
            "not_self_theme",
          ],
          additionalProperties: false,
        },
        connection_logic: { type: "string" },
        confidence: confidenceEnum,
        limitations: { type: "array", items: { type: "string" } },
        human_check: { type: "string" },
      },
      required: [
        "technical_sources",
        "source_values",
        "connection_logic",
        "confidence",
        "limitations",
        "human_check",
      ],
      additionalProperties: false,
    },
    evidence: {
      type: "object",
      properties: {
        source_fields: { type: "array", items: { type: "string" } },
        source_layer_keys: { type: "array", items: { type: "string" } },
        source_chart_elements: {
          type: "array",
          items: {
            type: "object",
            properties: {
              kind: { type: "string" },
              key: { type: "string" },
              value: { type: "string" },
              side: { type: ["string", "null"] },
              planet: { type: ["string", "null"] },
              line: { type: ["string", "null"] },
            },
            required: ["kind", "key", "value", "side", "planet", "line"],
            additionalProperties: false,
          },
        },
        confidence: confidenceEnum,
        warnings: { type: "array", items: { type: "string" } },
      },
      required: [
        "source_fields",
        "source_layer_keys",
        "source_chart_elements",
        "confidence",
        "warnings",
      ],
      additionalProperties: false,
    },
  },
  required: [
    "layer_key",
    "hr_title",
    "group",
    "status",
    "ui_priority",
    "base",
    "pro",
    "evidence",
  ],
  additionalProperties: false,
} as const;

export function buildWorkFormatInstructions(): string {
  return `TalentScan HR Layer Engine — background spike for work_format (Responses API).

Верни один JSON-объект layer_report для слоя work_format.
status=ready. Пиши только на русском языке в base-полях.

=== Продуктовый контекст ===
Это общая карта кандидата (hr_person_talent_map), НЕ оценка под вакансию.
Запрещено: fit_score, проценты соответствия, role-fit, «брать/не брать», «подходит на XX%».

=== HR-вопросы слоя work_format ===
- Какой общий рабочий формат у кандидата?
- Как он лучше включается в работу?
- Какой тип задач и темпа ему подходит?
- Где он может терять включённость?
- Как руководителю лучше использовать этот формат?
- Что проверить на интервью / в рабочем кейсе?

=== Base: HR-язык ===
Base описывает рабочее поведение и управленческие гипотезы.
Base НЕ должен использовать: Human Design, Дизайн Человека, бодиграф, ворота, каналы, центры,
сакрал, селезёнка, эмоциональный центр, профиль, авторитет, стратегия, Генератор, Проектор,
Манифестор, Рефлектор, Генный Ключ, соционика, социотип, ЧС, БЭ, БЛ, ЧИ.
Технические термины допустимы ТОЛЬКО в pro/evidence.

=== Pro/evidence ===
pro.technical_sources — массив объектов с source_key, source_label, raw_path, value_summary, confidence.
pro.source_values — заполни поля type, strategy, authority, defined_centers, open_centers, signature, not_self_theme
из compact_input.chart (не выдумывать).
pro.connection_logic — почему эти поля дают HR-вывод.
evidence.source_fields — пути к полям chart.
what_to_check — массив объектов с hypothesis, check_method, good_signal, warning_signal (отдельные поля).

ui_priority=20. group=energy_and_decision. hr_title=«Рабочий формат». layer_key=work_format.`;
}

export function buildWorkFormatUserPrompt(compactInput: Record<string, unknown>): string {
  return `Сгенерируй один layer_report work_format по compact_input ниже.
Используй только релевантные поля chart: type, strategy, authority, definedCenters, openCenters, signature, notSelfTheme, data_quality.
Без markdown. Без HTML.

compact_input:
${JSON.stringify(compactInput)}`;
}

function hasDisallowedHtml(text: string): boolean {
  if (!/<[a-z!/]/i.test(text)) return false;
  const stripped = text.replace(/<\/?(em|strong)\b[^>]*>/gi, "");
  return /<[a-z!/]/i.test(stripped);
}

function collectWorkFormatBaseTexts(layer: Record<string, unknown>): string[] {
  const base = asRecord(layer.base);
  const texts: string[] = [];

  for (const key of [
    "short_summary",
    "detailed_explanation",
    "how_it_appears_at_work",
  ]) {
    const v = base[key];
    if (typeof v === "string" && v.trim()) texts.push(v);
  }

  for (const key of ["where_useful", "management_tips", "good_signals", "warning_signals"]) {
    for (const item of asStringArray(base[key])) texts.push(item);
  }

  const risks = Array.isArray(base.risks) ? base.risks : [];
  for (const risk of risks) {
    const rec = asRecord(risk);
    for (const key of ["title", "description", "how_it_may_show_up", "mitigation"]) {
      const v = rec[key];
      if (typeof v === "string" && v.trim()) texts.push(v);
    }
  }

  const checks = Array.isArray(base.what_to_check) ? base.what_to_check : [];
  for (const check of checks) {
    const rec = asRecord(check);
    for (const key of ["hypothesis", "check_method", "good_signal", "warning_signal"]) {
      const v = rec[key];
      if (typeof v === "string" && v.trim()) texts.push(v);
    }
  }

  return texts;
}

export function findWorkFormatBaseBannedTerms(layer: Record<string, unknown>): string[] {
  return findBannedClientTerms({ layer_reports: [{ base: asRecord(layer.base) }] });
}

export function extractResponsesOutputText(data: Record<string, unknown>): string {
  if (typeof data.output_text === "string" && data.output_text.trim()) {
    return data.output_text.trim();
  }

  const output = Array.isArray(data.output) ? data.output : [];
  for (const item of output) {
    const rec = asRecord(item);
    if (rec.type === "message") {
      const content = Array.isArray(rec.content) ? rec.content : [];
      for (const part of content) {
        const p = asRecord(part);
        if (p.type === "output_text" || p.type === "text") {
          const text = asString(p.text ?? p.output_text);
          if (text) return text;
        }
      }
    }
    if (rec.type === "output_text" || rec.type === "text") {
      const text = asString(rec.text ?? rec.output_text);
      if (text) return text;
    }
  }

  return "";
}

export function parseLayerReportJson(raw: string): Record<string, unknown> {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)```$/i);
  const jsonText = fenced ? fenced[1].trim() : trimmed;
  const parsed: unknown = JSON.parse(jsonText);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("OpenAI returned unexpected JSON structure.");
  }
  return parsed as Record<string, unknown>;
}

function containsFitScoreOrHireDecision(text: string): boolean {
  const lower = text.toLowerCase();
  if (/\bfit_score\b/i.test(text)) return true;
  if (/\d+\s*%/.test(text) && /(подход|соответ|fit|match)/i.test(text)) return true;
  if (/(брать|не брать|не нанимать|отказать в найме)/i.test(lower)) return true;
  return false;
}

export type LayerValidationResult =
  | { ok: true }
  | { ok: false; stage: string; message: string; details?: unknown };

export function validateWorkFormatLayer(layer: Record<string, unknown>): LayerValidationResult {
  if (asString(layer.layer_key) !== WORK_FORMAT_LAYER_KEY) {
    return { ok: false, stage: "validate_layer", message: "layer_key must be work_format" };
  }
  if (asString(layer.hr_title) !== "Рабочий формат") {
    return { ok: false, stage: "validate_layer", message: "hr_title must be Рабочий формат" };
  }
  if (asString(layer.group) !== "energy_and_decision") {
    return { ok: false, stage: "validate_layer", message: "group must be energy_and_decision" };
  }
  if (asString(layer.status) !== "ready") {
    return { ok: false, stage: "validate_layer", message: "status must be ready" };
  }

  const base = asRecord(layer.base);
  for (const field of [
    "short_summary",
    "detailed_explanation",
    "how_it_appears_at_work",
  ]) {
    if (!asString(base[field])) {
      return { ok: false, stage: "validate_layer", message: `base.${field} is required` };
    }
  }

  const whatToCheck = Array.isArray(base.what_to_check) ? base.what_to_check : [];
  if (whatToCheck.length === 0) {
    return { ok: false, stage: "validate_layer", message: "base.what_to_check must be non-empty" };
  }
  for (const item of whatToCheck) {
    const rec = asRecord(item);
    for (const key of ["hypothesis", "check_method", "good_signal", "warning_signal"]) {
      if (!asString(rec[key])) {
        return {
          ok: false,
          stage: "validate_layer",
          message: `base.what_to_check item missing ${key}`,
        };
      }
    }
  }

  if (asStringArray(base.good_signals).length === 0) {
    return { ok: false, stage: "validate_layer", message: "base.good_signals must be non-empty" };
  }
  if (asStringArray(base.warning_signals).length === 0) {
    return { ok: false, stage: "validate_layer", message: "base.warning_signals must be non-empty" };
  }

  const pro = asRecord(layer.pro);
  const technicalSources = Array.isArray(pro.technical_sources) ? pro.technical_sources : [];
  if (technicalSources.length === 0) {
    return { ok: false, stage: "validate_layer", message: "pro.technical_sources must be non-empty" };
  }
  if (!asString(pro.connection_logic)) {
    return { ok: false, stage: "validate_layer", message: "pro.connection_logic is required" };
  }

  const evidence = asRecord(layer.evidence);
  if (asStringArray(evidence.source_fields).length === 0) {
    return { ok: false, stage: "validate_layer", message: "evidence.source_fields must be non-empty" };
  }
  if (!asString(evidence.confidence)) {
    return { ok: false, stage: "validate_layer", message: "evidence.confidence is required" };
  }

  for (const text of collectWorkFormatBaseTexts(layer)) {
    if (hasDisallowedHtml(text)) {
      return { ok: false, stage: "validate_layer", message: "Base contains disallowed HTML" };
    }
    if (containsFitScoreOrHireDecision(text)) {
      return {
        ok: false,
        stage: "validate_layer",
        message: "Base contains fit_score, hire decision, or match percentage",
      };
    }
  }

  const banned = findWorkFormatBaseBannedTerms(layer);
  if (banned.length > 0) {
    return {
      ok: false,
      stage: "forbidden_base_terms",
      message: "Base contains forbidden technical terms",
      details: banned,
    };
  }

  return { ok: true };
}

export async function callOpenAiResponsesForWorkFormat(args: {
  apiKey: string;
  model: string;
  compactInput: Record<string, unknown>;
}): Promise<{ layer: Record<string, unknown>; rawOutputChars: number; httpStatus: number }> {
  const instructions = buildWorkFormatInstructions();
  const input = buildWorkFormatUserPrompt(args.compactInput);

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${args.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: args.model,
      instructions,
      input,
      max_output_tokens: 3500,
      text: {
        format: {
          type: "json_schema",
          name: "hr_talent_map_work_format_layer",
          strict: true,
          schema: workFormatLayerSchema,
        },
      },
      store: false,
    }),
  });

  const httpStatus = response.status;
  const data = asRecord(await response.json().catch(() => ({})));

  if (!response.ok) {
    const message =
      asString(data.error && asRecord(data.error).message) ||
      `OpenAI Responses API error (${httpStatus})`;
    throw new Error(message);
  }

  const rawText = extractResponsesOutputText(data);
  if (!rawText) {
    throw new Error("openai_empty_output");
  }

  const layer = parseLayerReportJson(rawText);
  return { layer, rawOutputChars: rawText.length, httpStatus };
}

export function buildSpikeContentJson(args: {
  layerReport: Record<string, unknown>;
  candidate: Record<string, unknown>;
  company: Record<string, unknown>;
  chart: Record<string, unknown>;
  normalizedChart: Record<string, unknown>;
  model: string;
  generatedAt: string;
  layerDurationMs: number;
  pipelineStartedAt: string;
}): Record<string, unknown> {
  const name = asString(args.candidate.name, "Кандидат");
  const dataQuality = buildMinimalDataQuality(args.candidate, args.normalizedChart);

  return {
    schema_version: V2_SCHEMA_VERSION,
    report_type: SPIKE_REPORT_TYPE,
    generation_meta: {
      prompt_version: SPIKE_PROMPT_VERSION,
      schema_version: V2_SCHEMA_VERSION,
      language: "ru",
      generation_mode: "layered_background_work_format_spike",
      generated_at: args.generatedAt,
      model: args.model,
      source_analysis_packet_version: SOURCE_ANALYSIS_PACKET_VERSION,
      content_contract_version: CONTENT_CONTRACT_VERSION,
      background_spike: true,
      layer_generation: {
        status: "ready",
        started_at: args.pipelineStartedAt,
        finished_at: args.generatedAt,
        duration_ms: args.layerDurationMs,
        layers: {
          work_format: {
            status: "ready",
            duration_ms: args.layerDurationMs,
          },
        },
      },
    },
    candidate_snapshot: {
      name,
      company_name: asString(args.company.name) || null,
    },
    source_snapshot: {
      candidate_chart_id: asString(args.chart.id),
      normalized_chart_hash: asString(args.chart.input_hash ?? args.chart.chart_hash),
      company_id: asString(args.company.id),
    },
    technical_chart_status: {
      status: asString(args.chart.calculation_status, "calculated"),
      calculated_at: args.chart.calculated_at ?? null,
      can_render_bodygraph: args.normalizedChart.canRenderBodygraph === true,
      missing_fields: asStringArray(args.normalizedChart.missingForBodygraph),
    },
    data_quality: dataQuality,
    layer_reports: [args.layerReport],
    synthesis_blocks: {},
    derived_action_sources: {
      interview: {
        status: "not_generated",
        source_layer_keys: [],
        source_synthesis_keys: [],
      },
      test_task: {
        status: "not_generated",
        source_layer_keys: [],
        source_synthesis_keys: [],
      },
      adaptation_plan: {
        status: "not_generated",
        source_layer_keys: [],
        source_synthesis_keys: [],
      },
      role_fit: {
        status: "separate_report_type",
        source_layer_keys: [],
        source_synthesis_keys: [],
      },
    },
    ui: {
      default_mode: "base",
      layer_sidebar_enabled: true,
      pro_mode_enabled: true,
      show_technical_language_in_base: false,
      show_fit_score: false,
      legacy_v1_fallback_allowed: true,
    },
    qa_meta: {
      forbidden_base_terms_checked: true,
      fit_score_removed: true,
      html_sanitized: true,
      all_synthesis_blocks_have_sources: false,
      all_ready_layers_have_evidence: true,
      human_review_recommended: true,
      background_spike: true,
      disclaimers: [
        "Background spike: один AI-слой work_format через Responses API.",
        "Не является полной картой талантов кандидата.",
      ],
    },
  };
}

export async function saveReportError(
  db: SupabaseClient,
  reportId: string,
  generationError: string,
) {
  return db
    .from("hr_reports")
    .update({
      report_status: "error",
      generation_error: generationError,
      fit_score: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", reportId);
}
