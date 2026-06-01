/**
 * Shared helpers for HR Talent Map v2 core layers background spike (Stage 4.5).
 * Architecturally separate from Stage 4.2 work_format spike.
 */

import { createHash } from "crypto";
import type { HandlerEvent } from "@netlify/functions";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { findBannedClientTerms } from "./hr-report-normalize";
import { V2_SCHEMA_VERSION } from "./hr-talent-map-v2-limited";

export const SPIKE_REPORT_TYPE = "hr_person_talent_map_core_layers_spike";
export const SPIKE_PROMPT_VERSION =
  "hr_person_talent_map_v2_core_layers_background_0_2";
export const GENERATION_MODE = "layered_background_core_layers_spike";
export const SOURCE_ANALYSIS_PACKET_VERSION = "analysis_packet_v1_1";
export const CONTENT_CONTRACT_VERSION = "2.0.0";
export const CORE_LAYER_MAX_OUTPUT_TOKENS = 8000;

const OUTPUT_TEXT_TAIL_MAX = 500;
const RETRY_COMPACT_HINT = `Return valid JSON only.
No markdown.
No explanation outside JSON.
Keep all arrays concise.
Use shorter sentences.
Do not use technical Human Design terms in base.
Keep technical sources only in pro/evidence.
Do not include fit_score, role-fit, hire/no-hire, or vacancy match language.
Follow the JSON Schema exactly.`;

const DEFAULT_SMOKE_MODEL = "gpt-5.4-nano";
const DEFAULT_LAYER_MODEL = "gpt-5.4-mini";
const DEFAULT_REASONING_MODEL = "gpt-5.4";

const LAYER_OUTPUT_LENGTH_GUIDE = `=== Ограничения объёма (соблюдай строго, не раздувай JSON) ===
- short_summary: 1–2 предложения
- detailed_explanation: 4–6 предложений
- how_it_appears_at_work: 3–5 предложений
- where_useful: 3–5 пунктов
- risks: 2–3 карточки
- management_tips: 3–5 пунктов
- what_to_check: 2–3 проверки
- good_signals: 3–5 пунктов
- warning_signals: 3–5 пунктов
- connection_logic: 3–5 предложений`;

export const CORE_LAYERS_ORDER = [
  "work_format",
  "task_entry",
  "decision_style",
  "work_signature",
  "inner_coherence",
  "stable_zones",
  "sensitive_zones",
] as const;

export type CoreLayerKey = (typeof CORE_LAYERS_ORDER)[number];

export type CoreLayerGroup =
  | "energy_and_decision"
  | "core"
  | "centers_channels_gates";

export type CoreLayerDef = {
  layer_key: CoreLayerKey;
  hr_title: string;
  group: CoreLayerGroup;
  ui_priority: number;
  sourceValueKeys: readonly string[];
};

export const CORE_LAYER_DEFS: Record<CoreLayerKey, CoreLayerDef> = {
  work_format: {
    layer_key: "work_format",
    hr_title: "Рабочий формат",
    group: "energy_and_decision",
    ui_priority: 20,
    sourceValueKeys: [
      "type",
      "strategy",
      "authority",
      "profile",
      "definition",
      "defined_centers",
      "open_centers",
      "signature",
      "not_self_theme",
    ],
  },
  task_entry: {
    layer_key: "task_entry",
    hr_title: "Вход в задачи",
    group: "energy_and_decision",
    ui_priority: 30,
    sourceValueKeys: [
      "type",
      "strategy",
      "authority",
      "profile",
      "definition",
      "defined_centers",
      "open_centers",
    ],
  },
  decision_style: {
    layer_key: "decision_style",
    hr_title: "Принятие решений",
    group: "energy_and_decision",
    ui_priority: 40,
    sourceValueKeys: [
      "type",
      "strategy",
      "authority",
      "profile",
      "definition",
      "defined_centers",
      "open_centers",
    ],
  },
  work_signature: {
    layer_key: "work_signature",
    hr_title: "Рабочий почерк",
    group: "core",
    ui_priority: 50,
    sourceValueKeys: [
      "profile",
      "personality_sun",
      "design_sun",
      "type",
      "strategy",
    ],
  },
  inner_coherence: {
    layer_key: "inner_coherence",
    hr_title: "Внутренняя связность",
    group: "core",
    ui_priority: 60,
    sourceValueKeys: [
      "definition",
      "channels_long",
      "channels_short",
      "defined_centers",
      "open_centers",
    ],
  },
  stable_zones: {
    layer_key: "stable_zones",
    hr_title: "Устойчивые зоны",
    group: "centers_channels_gates",
    ui_priority: 70,
    sourceValueKeys: [
      "defined_centers",
      "channels_long",
      "channels_short",
      "authority",
      "type",
    ],
  },
  sensitive_zones: {
    layer_key: "sensitive_zones",
    hr_title: "Чувствительные зоны",
    group: "centers_channels_gates",
    ui_priority: 80,
    sourceValueKeys: [
      "open_centers",
      "not_self_theme",
      "defined_centers",
      "environment",
      "motivation",
      "transference",
    ],
  },
};

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
  layerKey?: string;
};

export type OffendingMatch = {
  path: string;
  term: string;
  snippet: string;
};

export type CoreLayersRunMode = "smoke" | "layer";

export type CoreLayersModelPolicy = {
  runMode: CoreLayersRunMode;
  selectedModel: string;
  smokeModel: string;
  layerModel: string;
  reasoningModel: string;
};

export type LayerRunStatus = {
  status: "pending" | "generating" | "ready" | "error" | "skipped";
  started_at?: string;
  finished_at?: string;
  duration_ms?: number;
  model?: string;
  prompt_version?: string;
  attempts?: number;
  error?: string | Record<string, unknown> | null;
};

export type LayerGenerationSummary = {
  total: number;
  ready: number;
  error: number;
  skipped: number;
  attempts_total: number;
};

export type LayerGenerationState = {
  status: "generating" | "ready" | "error";
  started_at: string;
  finished_at: string | null;
  duration_ms: number;
  mode: "sequential";
  run_mode: CoreLayersRunMode;
  selected_model: string;
  model_policy: {
    smoke: string;
    layer: string;
    reasoning: string;
  };
  layers_order: CoreLayerKey[];
  summary: LayerGenerationSummary;
  layers: Record<CoreLayerKey, LayerRunStatus>;
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

export function resolveCoreLayersModelPolicy(): CoreLayersModelPolicy {
  const rawRunMode =
    process.env.HR_TALENT_MAP_V2_CORE_LAYERS_RUN_MODE?.trim() || "smoke";

  if (rawRunMode !== "smoke" && rawRunMode !== "layer") {
    throw new SpikeConfigError(
      `Invalid HR_TALENT_MAP_V2_CORE_LAYERS_RUN_MODE: "${rawRunMode}". Allowed: smoke, layer.`,
    );
  }

  const runMode = rawRunMode as CoreLayersRunMode;
  const smokeModel =
    process.env.OPENAI_RESPONSES_MODEL_SMOKE?.trim() || DEFAULT_SMOKE_MODEL;
  const layerModel =
    process.env.OPENAI_RESPONSES_MODEL_LAYER?.trim() || DEFAULT_LAYER_MODEL;
  const reasoningModel =
    process.env.OPENAI_RESPONSES_MODEL_REASONING?.trim() ||
    DEFAULT_REASONING_MODEL;
  const selectedModel = runMode === "smoke" ? smokeModel : layerModel;

  return {
    runMode,
    selectedModel,
    smokeModel,
    layerModel,
    reasoningModel,
  };
}

export function isSpikeEnabled(): boolean {
  return (
    process.env.HR_TALENT_MAP_V2_BACKGROUND_CORE_LAYERS_ENABLED === "true"
  );
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

function getActivationPlanet(
  normalizedChart: Record<string, unknown>,
  side: "personality" | "design",
  planet: string,
): string | null {
  const activations = asRecord(normalizedChart.activations);
  const sideMap = asRecord(activations[side]);
  const value = asString(sideMap[planet]);
  return value || null;
}

function buildChartFieldsForCompactInput(
  normalizedChart: Record<string, unknown>,
  candidate: Record<string, unknown>,
): Record<string, unknown> {
  const dataQuality = buildMinimalDataQuality(candidate, normalizedChart);
  return {
    type: normalizedChart.type ?? null,
    strategy: normalizedChart.strategy ?? null,
    authority: normalizedChart.authority ?? null,
    profile: normalizedChart.profile ?? null,
    definition: normalizedChart.definition ?? null,
    definedCenters: asStringArray(normalizedChart.definedCenters),
    openCenters: asStringArray(normalizedChart.openCenters),
    channelsLong: asStringArray(normalizedChart.channelsLong),
    channelsShort: asStringArray(normalizedChart.channelsShort),
    signature: normalizedChart.signature ?? null,
    notSelfTheme: normalizedChart.notSelfTheme ?? null,
    environment: normalizedChart.environment ?? null,
    motivation: normalizedChart.motivation ?? null,
    transference: normalizedChart.transference ?? null,
    activations: {
      personality: {
        sun: getActivationPlanet(normalizedChart, "personality", "sun"),
      },
      design: {
        sun: getActivationPlanet(normalizedChart, "design", "sun"),
      },
    },
    canRenderBodygraph: normalizedChart.canRenderBodygraph === true,
    data_quality: dataQuality,
  };
}

export function buildInputHashPayload(args: {
  companyId: string;
  candidateId: string;
  chartId: string;
  chartUpdatedAt: string;
  normalizedChart: Record<string, unknown>;
  candidateHrComment: string | null;
  companyIndustry: string | null;
  model: string;
  run_mode: CoreLayersRunMode;
}): Record<string, unknown> {
  return {
    company_id: args.companyId,
    candidate_id: args.candidateId,
    chart_id: args.chartId,
    chart_updated_at: args.chartUpdatedAt,
    report_type: SPIKE_REPORT_TYPE,
    prompt_version: SPIKE_PROMPT_VERSION,
    model: args.model,
    run_mode: args.run_mode,
    layers_order: [...CORE_LAYERS_ORDER],
    normalized_chart: {
      type: args.normalizedChart.type ?? null,
      strategy: args.normalizedChart.strategy ?? null,
      authority: args.normalizedChart.authority ?? null,
      profile: args.normalizedChart.profile ?? null,
      definition: args.normalizedChart.definition ?? null,
      definedCenters: asStringArray(args.normalizedChart.definedCenters),
      openCenters: asStringArray(args.normalizedChart.openCenters),
      channelsLong: asStringArray(args.normalizedChart.channelsLong),
      channelsShort: asStringArray(args.normalizedChart.channelsShort),
      signature: args.normalizedChart.signature ?? null,
      notSelfTheme: args.normalizedChart.notSelfTheme ?? null,
      environment: args.normalizedChart.environment ?? null,
      motivation: args.normalizedChart.motivation ?? null,
      transference: args.normalizedChart.transference ?? null,
      canRenderBodygraph: args.normalizedChart.canRenderBodygraph === true,
    },
    candidate_hr_comment: args.candidateHrComment,
    company_industry: args.companyIndustry,
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

export function buildCoreLayersCompactInput(args: {
  layerKey: CoreLayerKey;
  candidate: Record<string, unknown>;
  company: Record<string, unknown>;
  normalizedChart: Record<string, unknown>;
}): Record<string, unknown> {
  return {
    layer_key: args.layerKey,
    candidate: {
      name: asString(args.candidate.name) || null,
      hr_comment: asString(args.candidate.hr_comment) || null,
    },
    company: {
      name: asString(args.company.name) || null,
      industry: asString(args.company.industry) || null,
    },
    chart: buildChartFieldsForCompactInput(args.normalizedChart, args.candidate),
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
  console.info(`[hr-talent-map-v2-core-layers-${fn}]`, {
    stage,
    company_id: ctx.companyId,
    candidate_id: ctx.candidateId,
    report_id: ctx.reportId,
    layer_key: ctx.layerKey,
    model: ctx.model,
    prompt_version: ctx.promptVersion ?? SPIKE_PROMPT_VERSION,
    ...extra,
  });
}

export function inferGenerationErrorKind(args: {
  stage: string;
  message: string;
  parse_error?: string | null;
  response_status?: string | null;
  output_text_length?: number;
  validation_stage?: string;
}): string {
  const { stage, message, parse_error, response_status, output_text_length } =
    args;
  const validationStage = args.validation_stage ?? stage;

  if (stage === "config") return "config_error";
  if (stage === "missing_normalized_chart_data") return "missing_normalized_chart_data";
  if (stage === "chart") return "missing_chart";
  if (stage === "candidate" || stage === "company" || stage === "ownership") {
    return "missing_input";
  }
  if (stage === "trigger_background_worker") return "worker_trigger_error";
  if (stage === "save_ready" || stage === "save_error") return "supabase_write_error";

  if (parse_error || message === "openai_response_json_parse_failed") {
    return "json_parse_error";
  }
  if (
    message === "openai_response_incomplete" ||
    response_status === "incomplete"
  ) {
    return "openai_incomplete_response";
  }
  if (
    stage === "openai_responses" &&
    output_text_length === 0 &&
    !parse_error
  ) {
    return "openai_empty_output";
  }
  if (stage === "openai_responses") return "openai_request_error";

  if (validationStage === "forbidden_base_terms") return "forbidden_base_terms";
  if (
    validationStage === "validate_layer" &&
    message.includes("forbidden fit/hire")
  ) {
    return "forbidden_role_fit_language";
  }
  if (stage === "validate_layer" || validationStage === "validate_layer") {
    return "schema_validation_error";
  }

  return "unknown_error";
}

export function serializeGenerationError(args: {
  stage: string;
  message: string;
  status?: number;
  duration_ms?: number;
  validation_result?: unknown;
  offending_matches?: OffendingMatch[];
  failed_layer_key?: string;
  layer_statuses?: Record<string, LayerRunStatus>;
  attempts?: number;
  last_error?: string;
  response_status?: string | null;
  incomplete_details?: unknown;
  output_text_length?: number;
  output_text_tail?: string | null;
  parse_error?: string | null;
  run_mode?: string;
  model?: string;
  selected_model?: string;
  validation_stage?: string;
}): string {
  const kind = inferGenerationErrorKind({
    stage: args.stage,
    message: args.message,
    parse_error: args.parse_error,
    response_status: args.response_status,
    output_text_length: args.output_text_length,
    validation_stage: args.validation_stage,
  });

  return JSON.stringify({
    kind,
    stage: args.stage,
    message: args.message,
    status: args.status ?? null,
    duration_ms: args.duration_ms ?? null,
    validation_result: args.validation_result ?? null,
    offending_matches: args.offending_matches ?? null,
    failed_layer_key: args.failed_layer_key ?? null,
    layer_statuses: args.layer_statuses ?? null,
    attempts: args.attempts ?? null,
    last_error: args.last_error ?? null,
    response_status: args.response_status ?? null,
    incomplete_details: args.incomplete_details ?? null,
    output_text_length: args.output_text_length ?? null,
    output_text_tail: args.output_text_tail ?? null,
    parse_error: args.parse_error ?? null,
    run_mode: args.run_mode ?? null,
    model: args.model ?? null,
    selected_model: args.selected_model ?? args.model ?? null,
  });
}

export class OpenAiLayerResponseError extends Error {
  readonly name = "OpenAiLayerResponseError";
  readonly stage = "openai_responses" as const;
  readonly failedLayerKey: CoreLayerKey;
  readonly responseStatus: string | null;
  readonly incompleteDetails: unknown;
  readonly outputTextLength: number;
  readonly outputTextTail: string | null;
  readonly parseError: string | null;
  readonly httpStatus: number;
  readonly retryable: boolean;

  constructor(opts: {
    message: string;
    failedLayerKey: CoreLayerKey;
    responseStatus?: string | null;
    incompleteDetails?: unknown;
    outputTextLength?: number;
    outputTextTail?: string | null;
    parseError?: string | null;
    httpStatus?: number;
    retryable?: boolean;
  }) {
    super(opts.message);
    this.failedLayerKey = opts.failedLayerKey;
    this.responseStatus = opts.responseStatus ?? null;
    this.incompleteDetails = opts.incompleteDetails ?? null;
    this.outputTextLength = opts.outputTextLength ?? 0;
    this.outputTextTail = opts.outputTextTail ?? null;
    this.parseError = opts.parseError ?? null;
    this.httpStatus = opts.httpStatus ?? 0;
    this.retryable = opts.retryable ?? true;
  }
}

export class OpenAiLayerRetryExhaustedError extends Error {
  readonly name = "OpenAiLayerRetryExhaustedError";
  readonly attempts = 2;
  readonly lastOpenAiError: OpenAiLayerResponseError;

  constructor(lastOpenAiError: OpenAiLayerResponseError) {
    super(lastOpenAiError.message);
    this.lastOpenAiError = lastOpenAiError;
  }
}

const confidenceEnum = {
  type: "string",
  enum: ["high", "medium", "low", "unknown"],
};

const nullableString = { type: ["string", "null"] as const };
const stringArray = { type: "array" as const, items: { type: "string" as const } };

const baseSchema = {
  type: "object" as const,
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
};

function buildSourceValuesSchema(keys: readonly string[]) {
  const arrayKeys = new Set([
    "defined_centers",
    "open_centers",
    "channels_long",
    "channels_short",
  ]);
  const properties: Record<string, unknown> = {};
  for (const key of keys) {
    if (arrayKeys.has(key)) {
      properties[key] = stringArray;
    } else {
      properties[key] = nullableString;
    }
  }
  return {
    type: "object",
    properties,
    required: [...keys],
    additionalProperties: false,
  };
}

export function buildCoreLayerSchema(layerKey: CoreLayerKey) {
  const def = CORE_LAYER_DEFS[layerKey];
  return {
    type: "object",
    properties: {
      layer_key: { type: "string", enum: [def.layer_key] },
      hr_title: { type: "string", enum: [def.hr_title] },
      group: { type: "string", enum: [def.group] },
      status: { type: "string", enum: ["ready"] },
      ui_priority: { type: "integer", enum: [def.ui_priority] },
      base: baseSchema,
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
          source_values: buildSourceValuesSchema(def.sourceValueKeys),
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
}

function layerFocusInstructions(layerKey: CoreLayerKey): string {
  switch (layerKey) {
    case "work_format":
      return `=== Слой work_format (Рабочий формат) ===
HR-фокус:
- В каком рабочем режиме человек приносит пользу?
- Какой формат участия/темпа/контекста ему подходит?
- Что снижает включённость?
- Как руководителю использовать этот формат?
- Что проверить на интервью или рабочем кейсе?

Основные источники: type, strategy, signature, notSelfTheme, profile, definedCenters, openCenters.
НЕ своди слой только к «приглашение/признание».
НЕ дублируй task_entry (вход в задачи) или decision_style (принятие решений).`;
    case "task_entry":
      return `=== Слой task_entry (Вход в задачи) ===
HR-фокус:
- Как человеку лучше получать задачи?
- Как он стартует?
- Какой контекст нужен перед началом?
- Что будет ясным входом? Что будет плохим входом?
- Как проверить, умеет ли человек входить в задачи?

Основные источники: strategy, authority, type, profile, definedCenters, openCenters.
НЕ повторяй work_format. Фокус на старте задачи, постановке, первом шаге и входе в процесс.`;
    case "decision_style":
      return `=== Слой decision_style (Принятие решений) ===
HR-фокус:
- Как человек выбирает, уточняет и принимает рабочие решения?
- Какие сигналы/данные/рамки ему нужны?
- Где решения сильные? Где риск поспешности или необъяснённости?
- Как руководителю давать рамку?
- Как проверить на интервью/кейсе?

Основные источники: authority, strategy, type, definedCenters, openCenters.
НЕ упрощай до «интуиция против рациональности». Пиши про управляемую проверку решений.
НЕ дублируй work_format или task_entry.`;
    case "work_signature":
      return `=== Слой work_signature (Рабочий почерк) ===
HR-фокус:
- Как человек учится?
- Как входит в роль?
- Как набирает доверие?
- Какой темп адаптации ему подходит?
- Как проявляется социально и профессионально?
- Где риск ожидать от него мгновенной уверенности?
- Что проверить на интервью / тестовом / в первые рабочие недели?

Основной источник: profile.
Поддерживающие: activations.personality.sun, activations.design.sun, type, strategy.

Base НЕ должен использовать: профиль, линия, Солнце, Дизайн, Личность, Human Design, бодиграф.
Хороший HR-язык: «человеку важно сначала разобраться в основе», «может учиться через практическую проверку»,
«ему полезен понятный вход в роль», «доверие набирается через...».

НЕ дублируй work_format, task_entry или decision_style.`;
    case "inner_coherence":
      return `=== Слой inner_coherence (Внутренняя связность) ===
HR-фокус:
- Как человек собирает внутреннюю ясность?
- Легче ли ему решать самостоятельно или через диалог/среду?
- Что помогает ему синхронизироваться?
- Как давать обратную связь?
- Риск изоляции или хаотичной коммуникации?
- Что проверить в рабочем кейсе?

Основной источник: definition.
Поддерживающие: channelsLong, channelsShort, definedCenters, openCenters.

Base НЕ должен использовать: Single Definition, Split Definition, определение, центр, канал.
Хороший HR-язык: «быстрее собирает решение внутри себя», «может нуждаться в правильном диалоге»,
«важна среда, где части задачи связываются в понятную картину».

НЕ дублируй decision_style или work_signature.`;
    case "stable_zones":
      return `=== Слой stable_zones (Устойчивые зоны) ===
HR-фокус:
- Где у человека есть устойчивые рабочие паттерны?
- В каких задачах это полезно?
- Где можно ожидать повторяемости?
- Как руководителю использовать эти устойчивые зоны?
- Какие хорошие сигналы?
- Какие тревожные сигналы?

Основной источник: definedCenters.
Поддерживающие: channelsLong, channelsShort, authority, type.

Base НЕ должен использовать: определённые центры, Аджна, Сакрал, Горло, Эго, Селезёнка, G-центр, Root, Solar Plexus.
Хороший HR-язык: «устойчивость в обработке информации», «повторяемый способ включаться в задачи»,
«устойчивость в выражении», «стабильный рабочий отклик».

НЕ дублируй work_format или sensitive_zones.`;
    case "sensitive_zones":
      return `=== Слой sensitive_zones (Чувствительные зоны) ===
HR-фокус:
- Где человек сильнее зависит от среды?
- Где может брать лишнее давление?
- Где может подстраиваться под ожидания?
- Какие риски перегруза?
- Как руководителю не усиливать слабое место?
- Что проверить?
- Какие условия помогают?

Основной источник: openCenters.
Поддерживающие: notSelfTheme, definedCenters, environment, motivation, transference.
environment, motivation, transference — только как осторожный supporting context, не как главный аргумент.

Base НЕ должен использовать: открытые центры, Эго-центр, Сакрал, Селезёнка, эмоциональный центр,
трансференция, мотивация, среда в Human Design.
Хороший HR-язык: «может брать на себя лишнее, чтобы доказать ценность», «может усиливаться под давлением срочности»,
«важно проверять устойчивость по действиям, а не по обещаниям»,
«может сильнее реагировать на эмоциональную атмосферу команды».

Используй осторожные формулировки: «может проявляться», «стоит проверить», «в такой среде возможно»,
«хорошим сигналом будет», «тревожным сигналом будет». Не делай категоричных выводов.

НЕ дублируй stable_zones.`;
    default:
      return "";
  }
}

export function buildLayerInstructions(layerKey: CoreLayerKey): string {
  const def = CORE_LAYER_DEFS[layerKey];
  return `TalentScan HR Layer Engine — background core layers spike (Stage 4.5).

Верни один JSON-объект layer_report для слоя ${def.layer_key}.
status=ready. Пиши только на русском языке в base-полях.

=== Продуктовый контекст ===
Это общая карта кандидата (hr_person_talent_map), НЕ оценка под вакансию.
НЕ оценивай кандидата под вакансию, не давай hiring verdict.

${layerFocusInstructions(layerKey)}

=== ЗАПРЕЩЕНО в Base (ни в одном base-поле) ===
fit_score, score, match percentage, процент соответствия, подходит на XX%, соответствует на XX%,
брать / не брать, нанять / не нанять, решение о найме, финальное решение по кандидату,
оценка под вакансию, соответствие вакансии, role-fit, vacancy fit, hire decision, hire/no hire.

Допустимо в Base: «подходит более динамичный формат задач», «важно принимать решения без давления» —
если речь о рабочем стиле, а не о найме или % соответствия вакансии.

=== Base: HR-язык ===
Base описывает рабочее поведение и управленческие гипотезы.
Base НЕ должен использовать: Human Design, Дизайн Человека, бодиграф, ворота, каналы, центры,
сакрал, селезёнка, эмоциональный центр, профиль, авторитет, стратегия, Генератор, Проектор,
Манифестор, Рефлектор, signature, not-self, Projector, Splenic, Wait for Invitation,
соционика, социотип, ЧС, БЭ, БЛ, ЧИ.
Технические термины допустимы ТОЛЬКО в pro/evidence.

=== Pro/evidence ===
pro.technical_sources — массив объектов с source_key, source_label, raw_path, value_summary, confidence.
pro.source_values — заполни только разрешённые поля из compact_input.chart (не выдумывать отсутствующие значения; null если нет данных).
pro.connection_logic — почему эти поля дают HR-вывод.
evidence.source_fields — пути к полям chart.
what_to_check — массив объектов с hypothesis, check_method, good_signal, warning_signal (отдельные поля, не в одной строке).

${LAYER_OUTPUT_LENGTH_GUIDE}

ui_priority=${def.ui_priority}. group=${def.group}. hr_title=«${def.hr_title}». layer_key=${def.layer_key}.`;
}

export function buildLayerUserPrompt(
  layerKey: CoreLayerKey,
  compactInput: Record<string, unknown>,
  compactRetry = false,
): string {
  const def = CORE_LAYER_DEFS[layerKey];
  const retryBlock = compactRetry
    ? `\n\n${RETRY_COMPACT_HINT}\n`
    : "";
  return `Сгенерируй один layer_report ${def.layer_key} по compact_input ниже.
Используй только релевантные поля chart из compact_input.
В Base НЕ используй: fit_score, score, match percentage, проценты соответствия вакансии,
«подходит на XX%», «брать/не брать», «нанять/не нанять», решение о найме, оценку под вакансию.

Соблюдай ограничения объёма из instructions (краткие строки, без лишних абзацев).
Без markdown. Без HTML.${retryBlock}

compact_input:
${JSON.stringify(compactInput)}`;
}

function hasDisallowedHtml(text: string): boolean {
  if (!/<[a-z!/]/i.test(text)) return false;
  const stripped = text.replace(/<\/?(em|strong)\b[^>]*>/gi, "");
  return /<[a-z!/]/i.test(stripped);
}

type BaseTextField = { path: string; text: string };

const FIT_HIRE_FORBIDDEN_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
  { label: "fit_score", pattern: /\bfit_score\b/i },
  { label: "candidate fit score", pattern: /\bcandidate fit score\b/i },
  { label: "role fit score", pattern: /\brole fit score\b/i },
  { label: "vacancy fit", pattern: /\bvacancy fit\b/i },
  { label: "match percentage", pattern: /\bmatch percentage\b/i },
  { label: "hire decision", pattern: /\bhire decision\b/i },
  { label: "hire / no hire", pattern: /\bhire\s*\/\s*no hire\b/i },
  { label: "role-fit", pattern: /\brole[\s-]?fit\b/i },
  { label: "подходит на N%", pattern: /подходит\s+на\s+\d+\s*%/iu },
  { label: "соответствует на N%", pattern: /соответствует\s+на\s+\d+\s*%/iu },
  { label: "процент соответствия", pattern: /процент\s+соответствия/iu },
  { label: "соответствие вакансии", pattern: /соответствие\s+вакансии/iu },
  { label: "оценка под вакансию", pattern: /оценка\s+под\s+вакансию/iu },
  { label: "не брать", pattern: /(?<![\p{L}])не\s+брать(?![\p{L}])/iu },
  {
    label: "брать (hire verdict)",
    pattern: /(?<![\p{L}])брать(?![\p{L}])\s+(?:кандидат|на\s+(?:работу|роль|позицию)|в\s+команду)/iu,
  },
  { label: "не нанять", pattern: /(?<![\p{L}])не\s+нанять(?![\p{L}])/iu },
  { label: "не нанимать", pattern: /(?<![\p{L}])не\s+нанимать(?![\p{L}])/iu },
  {
    label: "нанять (hire verdict)",
    pattern: /(?<![\p{L}])нанять(?![\p{L}])\s+(?:кандидат|на\s+(?:работу|роль|позицию)|в\s+команду)/iu,
  },
  { label: "решение о найме", pattern: /решени[ея]\s+о\s+найме/iu },
  {
    label: "финальное решение по кандидату",
    pattern: /финальн(?:ое|ого)\s+решени[ея][^.]{0,40}кандидат/iu,
  },
];

function makeSnippet(text: string, matchIndex: number, maxLen = 180): string {
  if (!text) return "";
  if (text.length <= maxLen) return text;
  const half = Math.floor((maxLen - 3) / 2);
  const start = Math.max(0, matchIndex - half);
  const end = Math.min(text.length, start + maxLen);
  const prefix = start > 0 ? "…" : "";
  const suffix = end < text.length ? "…" : "";
  return `${prefix}${text.slice(start, end)}${suffix}`;
}

function collectLayerBaseTextFields(layer: Record<string, unknown>): BaseTextField[] {
  const base = asRecord(layer.base);
  const fields: BaseTextField[] = [];

  for (const key of [
    "short_summary",
    "detailed_explanation",
    "how_it_appears_at_work",
  ]) {
    const text = asString(base[key]);
    if (text) fields.push({ path: `base.${key}`, text });
  }

  asStringArray(base.where_useful).forEach((text, index) => {
    if (text) fields.push({ path: `base.where_useful[${index}]`, text });
  });

  const risks = Array.isArray(base.risks) ? base.risks : [];
  risks.forEach((risk, index) => {
    const rec = asRecord(risk);
    for (const key of ["title", "description", "how_it_may_show_up", "mitigation"]) {
      const text = asString(rec[key]);
      if (text) fields.push({ path: `base.risks[${index}].${key}`, text });
    }
  });

  asStringArray(base.management_tips).forEach((text, index) => {
    if (text) fields.push({ path: `base.management_tips[${index}]`, text });
  });

  const checks = Array.isArray(base.what_to_check) ? base.what_to_check : [];
  checks.forEach((check, index) => {
    const rec = asRecord(check);
    for (const key of ["hypothesis", "check_method", "good_signal", "warning_signal"]) {
      const text = asString(rec[key]);
      if (text) fields.push({ path: `base.what_to_check[${index}].${key}`, text });
    }
  });

  asStringArray(base.good_signals).forEach((text, index) => {
    if (text) fields.push({ path: `base.good_signals[${index}]`, text });
  });

  asStringArray(base.warning_signals).forEach((text, index) => {
    if (text) fields.push({ path: `base.warning_signals[${index}]`, text });
  });

  return fields;
}

function scanPatternInBaseFields(
  fields: BaseTextField[],
  patterns: Array<{ label: string; pattern: RegExp }>,
): OffendingMatch[] {
  const matches: OffendingMatch[] = [];

  for (const field of fields) {
    for (const { label, pattern } of patterns) {
      pattern.lastIndex = 0;
      const hit = pattern.exec(field.text);
      if (!hit) continue;
      matches.push({
        path: field.path,
        term: label,
        snippet: makeSnippet(field.text, hit.index),
      });
    }
  }

  return matches;
}

export function scanLayerBaseFitHireLanguage(
  layer: Record<string, unknown>,
): OffendingMatch[] {
  return scanPatternInBaseFields(
    collectLayerBaseTextFields(layer),
    FIT_HIRE_FORBIDDEN_PATTERNS,
  );
}

export function scanLayerBaseForbiddenHdTerms(
  layer: Record<string, unknown>,
): OffendingMatch[] {
  const matches: OffendingMatch[] = [];

  for (const field of collectLayerBaseTextFields(layer)) {
    const terms = findBannedClientTerms({
      layer_reports: [{ base: { _scan: field.text } }],
    });
    for (const term of terms) {
      matches.push({
        path: field.path,
        term,
        snippet: makeSnippet(field.text, 0),
      });
    }
  }

  return matches;
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

function outputTextTail(text: string): string {
  if (text.length <= OUTPUT_TEXT_TAIL_MAX) return text;
  return text.slice(-OUTPUT_TEXT_TAIL_MAX);
}

function hasIncompleteResponse(data: Record<string, unknown>, rawText: string): boolean {
  const responseStatus = asString(data.status);
  if (responseStatus === "incomplete") return true;
  if (data.incomplete_details != null) return true;
  return !rawText.trim();
}

function parseLayerReportJsonOrThrow(args: {
  raw: string;
  layerKey: CoreLayerKey;
  data: Record<string, unknown>;
  httpStatus: number;
}): Record<string, unknown> {
  const trimmed = args.raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)```$/i);
  const jsonText = fenced ? fenced[1].trim() : trimmed;

  try {
    const parsed: unknown = JSON.parse(jsonText);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("OpenAI returned unexpected JSON structure.");
    }
    return parsed as Record<string, unknown>;
  } catch (err) {
    const parseError = err instanceof Error ? err.message : String(err);
    throw new OpenAiLayerResponseError({
      message: "openai_response_json_parse_failed",
      failedLayerKey: args.layerKey,
      responseStatus: asString(args.data.status) || null,
      incompleteDetails: args.data.incomplete_details ?? null,
      outputTextLength: args.raw.length,
      outputTextTail: outputTextTail(args.raw),
      parseError,
      httpStatus: args.httpStatus,
      retryable: true,
    });
  }
}

function processOpenAiResponsesBody(args: {
  data: Record<string, unknown>;
  layerKey: CoreLayerKey;
  httpStatus: number;
}): { layer: Record<string, unknown>; rawOutputChars: number } {
  const apiError = args.data.error ? asRecord(args.data.error) : null;
  const apiErrorMessage = apiError ? asString(apiError.message) : "";

  if (apiErrorMessage) {
    throw new OpenAiLayerResponseError({
      message: apiErrorMessage,
      failedLayerKey: args.layerKey,
      responseStatus: asString(args.data.status) || null,
      incompleteDetails: args.data.incomplete_details ?? null,
      outputTextLength: 0,
      outputTextTail: null,
      parseError: null,
      httpStatus: args.httpStatus,
      retryable: false,
    });
  }

  const rawText = extractResponsesOutputText(args.data);

  if (hasIncompleteResponse(args.data, rawText)) {
    throw new OpenAiLayerResponseError({
      message: "openai_response_incomplete",
      failedLayerKey: args.layerKey,
      responseStatus: asString(args.data.status) || null,
      incompleteDetails: args.data.incomplete_details ?? null,
      outputTextLength: rawText.length,
      outputTextTail: rawText ? outputTextTail(rawText) : null,
      parseError: null,
      httpStatus: args.httpStatus,
      retryable: true,
    });
  }

  const layer = parseLayerReportJsonOrThrow({
    raw: rawText,
    layerKey: args.layerKey,
    data: args.data,
    httpStatus: args.httpStatus,
  });

  return { layer, rawOutputChars: rawText.length };
}

export type LayerValidationResult =
  | { ok: true }
  | {
      ok: false;
      stage: string;
      message: string;
      offending_matches?: OffendingMatch[];
      details?: unknown;
    };

function nonEmptyArray(value: unknown, field: string): LayerValidationResult | null {
  if (!Array.isArray(value) || value.length === 0) {
    return { ok: false, stage: "validate_layer", message: `${field} must be non-empty` };
  }
  return null;
}

export function validateCoreLayer(
  layer: Record<string, unknown>,
  layerKey: CoreLayerKey,
): LayerValidationResult {
  const def = CORE_LAYER_DEFS[layerKey];

  if (asString(layer.layer_key) !== def.layer_key) {
    return {
      ok: false,
      stage: "validate_layer",
      message: `layer_key must be ${def.layer_key}`,
    };
  }
  if (asString(layer.hr_title) !== def.hr_title) {
    return {
      ok: false,
      stage: "validate_layer",
      message: `hr_title must be ${def.hr_title}`,
    };
  }
  if (asString(layer.group) !== def.group) {
    return {
      ok: false,
      stage: "validate_layer",
      message: `group must be ${def.group}`,
    };
  }
  if (asString(layer.status) !== "ready") {
    return { ok: false, stage: "validate_layer", message: "status must be ready" };
  }
  if (Number(layer.ui_priority) !== def.ui_priority) {
    return {
      ok: false,
      stage: "validate_layer",
      message: `ui_priority must be ${def.ui_priority}`,
    };
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

  for (const field of [
    "where_useful",
    "risks",
    "management_tips",
    "what_to_check",
    "good_signals",
    "warning_signals",
  ]) {
    const err = nonEmptyArray(base[field], `base.${field}`);
    if (err) return err;
  }

  const whatToCheck = Array.isArray(base.what_to_check) ? base.what_to_check : [];
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

  const pro = asRecord(layer.pro);
  const technicalSources = Array.isArray(pro.technical_sources) ? pro.technical_sources : [];
  if (technicalSources.length === 0) {
    return {
      ok: false,
      stage: "validate_layer",
      message: "pro.technical_sources must be non-empty",
    };
  }
  if (!asString(pro.connection_logic)) {
    return {
      ok: false,
      stage: "validate_layer",
      message: "pro.connection_logic is required",
    };
  }

  const evidence = asRecord(layer.evidence);
  if (asStringArray(evidence.source_fields).length === 0) {
    return {
      ok: false,
      stage: "validate_layer",
      message: "evidence.source_fields must be non-empty",
    };
  }
  if (!asString(evidence.confidence)) {
    return {
      ok: false,
      stage: "validate_layer",
      message: "evidence.confidence is required",
    };
  }

  const baseFields = collectLayerBaseTextFields(layer);

  for (const field of baseFields) {
    if (hasDisallowedHtml(field.text)) {
      return {
        ok: false,
        stage: "validate_layer",
        message: "Base contains disallowed HTML",
        offending_matches: [
          {
            path: field.path,
            term: "html",
            snippet: makeSnippet(field.text, 0),
          },
        ],
      };
    }
  }

  const fitHireMatches = scanLayerBaseFitHireLanguage(layer);
  if (fitHireMatches.length > 0) {
    return {
      ok: false,
      stage: "validate_layer",
      message: "Base contains forbidden fit/hire/percentage language",
      offending_matches: fitHireMatches,
    };
  }

  const hdTermMatches = scanLayerBaseForbiddenHdTerms(layer);
  if (hdTermMatches.length > 0) {
    return {
      ok: false,
      stage: "forbidden_base_terms",
      message: "Base contains forbidden technical terms",
      offending_matches: hdTermMatches,
      details: Array.from(new Set(hdTermMatches.map((m) => m.term))),
    };
  }

  return { ok: true };
}

export async function callOpenAiResponsesForLayer(args: {
  apiKey: string;
  model: string;
  layerKey: CoreLayerKey;
  compactInput: Record<string, unknown>;
  compactRetry?: boolean;
}): Promise<{ layer: Record<string, unknown>; rawOutputChars: number; httpStatus: number }> {
  const instructions = buildLayerInstructions(args.layerKey);
  const input = buildLayerUserPrompt(
    args.layerKey,
    args.compactInput,
    args.compactRetry === true,
  );
  const schema = buildCoreLayerSchema(args.layerKey);

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
      max_output_tokens: CORE_LAYER_MAX_OUTPUT_TOKENS,
      text: {
        format: {
          type: "json_schema",
          name: `hr_talent_map_${args.layerKey}_layer`,
          strict: true,
          schema,
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
    throw new OpenAiLayerResponseError({
      message,
      failedLayerKey: args.layerKey,
      responseStatus: asString(data.status) || null,
      incompleteDetails: data.incomplete_details ?? null,
      outputTextLength: extractResponsesOutputText(data).length,
      outputTextTail: null,
      parseError: null,
      httpStatus,
      retryable: false,
    });
  }

  const { layer, rawOutputChars } = processOpenAiResponsesBody({
    data,
    layerKey: args.layerKey,
    httpStatus,
  });

  return { layer, rawOutputChars, httpStatus };
}

export async function callOpenAiResponsesForLayerWithRetry(args: {
  apiKey: string;
  model: string;
  layerKey: CoreLayerKey;
  compactInput: Record<string, unknown>;
}): Promise<{
  layer: Record<string, unknown>;
  rawOutputChars: number;
  httpStatus: number;
  attempts: number;
}> {
  let lastRetryableError: OpenAiLayerResponseError | null = null;

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const result = await callOpenAiResponsesForLayer({
        ...args,
        compactRetry: attempt === 2,
      });
      return { ...result, attempts: attempt };
    } catch (err) {
      if (err instanceof OpenAiLayerResponseError && err.retryable) {
        lastRetryableError = err;
        if (attempt < 2) {
          console.info("[hr-talent-map-v2-core-layers-shared] openai_layer_retry", {
            layer_key: args.layerKey,
            attempt,
            message: err.message,
            output_text_length: err.outputTextLength,
            response_status: err.responseStatus,
          });
          continue;
        }
        throw new OpenAiLayerRetryExhaustedError(err);
      }
      throw err;
    }
  }

  if (lastRetryableError) {
    throw new OpenAiLayerRetryExhaustedError(lastRetryableError);
  }
  throw new Error("openai_layer_retry_exhausted");
}

export function summarizeLayerGeneration(
  layers: Record<CoreLayerKey, LayerRunStatus>,
): LayerGenerationSummary {
  let ready = 0;
  let error = 0;
  let skipped = 0;
  let attempts_total = 0;

  for (const key of CORE_LAYERS_ORDER) {
    const layer = layers[key];
    if (layer.status === "ready") ready++;
    else if (layer.status === "error") error++;
    else if (layer.status === "skipped") skipped++;
    attempts_total += layer.attempts ?? 0;
  }

  return {
    total: CORE_LAYERS_ORDER.length,
    ready,
    error,
    skipped,
    attempts_total,
  };
}

export function initLayerGenerationState(
  pipelineStartedAt: string,
  modelPolicy: CoreLayersModelPolicy,
): LayerGenerationState {
  const layers = {} as Record<CoreLayerKey, LayerRunStatus>;
  for (const key of CORE_LAYERS_ORDER) {
    layers[key] = { status: "pending" };
  }
  return {
    status: "generating",
    started_at: pipelineStartedAt,
    finished_at: null,
    duration_ms: 0,
    mode: "sequential",
    run_mode: modelPolicy.runMode,
    selected_model: modelPolicy.selectedModel,
    model_policy: {
      smoke: modelPolicy.smokeModel,
      layer: modelPolicy.layerModel,
      reasoning: modelPolicy.reasoningModel,
    },
    layers_order: [...CORE_LAYERS_ORDER],
    summary: summarizeLayerGeneration(layers),
    layers,
  };
}

export function extractLayerKeysByStatus(
  layerGeneration: Record<string, unknown>,
  status: LayerRunStatus["status"],
): string[] {
  const layers = asRecord(layerGeneration.layers);
  const keys: string[] = [];
  for (const key of CORE_LAYERS_ORDER) {
    const layerStatus = asRecord(layers[key]);
    if (asString(layerStatus.status) === status) {
      keys.push(key);
    }
  }
  return keys;
}

export function buildModelPolicySnapshot(
  modelPolicy: CoreLayersModelPolicy,
): { smoke: string; layer: string; reasoning: string } {
  return {
    smoke: modelPolicy.smokeModel,
    layer: modelPolicy.layerModel,
    reasoning: modelPolicy.reasoningModel,
  };
}

export function buildCoreLayersContentJson(args: {
  layerReports: Record<string, unknown>[];
  candidate: Record<string, unknown>;
  company: Record<string, unknown>;
  chart: Record<string, unknown>;
  normalizedChart: Record<string, unknown>;
  model: string;
  modelPolicy: CoreLayersModelPolicy;
  generatedAt: string;
  pipelineStartedAt: string;
  pipelineDurationMs: number;
  layerGeneration: Record<string, unknown>;
  overallStatus: "ready" | "error";
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
      generation_mode: GENERATION_MODE,
      generated_at: args.generatedAt,
      model: args.model,
      run_mode: args.modelPolicy.runMode,
      selected_model: args.modelPolicy.selectedModel,
      model_policy: buildModelPolicySnapshot(args.modelPolicy),
      source_analysis_packet_version: SOURCE_ANALYSIS_PACKET_VERSION,
      content_contract_version: CONTENT_CONTRACT_VERSION,
      background_spike: true,
      layer_generation: args.layerGeneration,
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
    layer_reports: args.layerReports,
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
      all_ready_layers_have_evidence: args.overallStatus === "ready",
      human_review_recommended: true,
      background_spike: true,
      disclaimers: [
        "Background spike: семь AI-слоёв work_format, task_entry, decision_style, work_signature, inner_coherence, stable_zones, sensitive_zones через Responses API (sequential).",
        "Не является полной картой талантов кандидата.",
        "Synthesis blocks не генерировались на этом этапе.",
      ],
    },
  };
}

export async function saveReportError(
  db: SupabaseClient,
  reportId: string,
  generationError: string,
  contentJson?: Record<string, unknown>,
) {
  const update: Record<string, unknown> = {
    report_status: "error",
    generation_error: generationError,
    fit_score: null,
    updated_at: new Date().toISOString(),
  };
  if (contentJson) {
    update.content_json = contentJson;
  }
  return db.from("hr_reports").update(update).eq("id", reportId);
}

export function extractReadyLayerKeys(
  layerReports: Record<string, unknown>[],
): string[] {
  return layerReports
    .map((layer) => asString(layer.layer_key))
    .filter((key): key is CoreLayerKey =>
      (CORE_LAYERS_ORDER as readonly string[]).includes(key),
    );
}
