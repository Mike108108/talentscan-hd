/**
 * HR Talent Map v3 — Career Reading Layers v1 generation pipeline (Stage 4.10-B).
 * Eight sequential OpenAI layers → career_reading_layers in content_json.
 */

import type { HandlerEvent } from "@netlify/functions";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  CAREER_READING_LAYER_CATALOG_V1,
  CAREER_READING_LAYER_KEYS_V1,
  CAREER_READING_LAYERS_VERSION_V1,
  buildCareerReadingLayerInputsV1,
  type CareerReadingLayerKeyV1,
} from "../../src/lib/hr/careerReadingLayersV1";
import { buildCareerReadingLayerPromptV1 } from "./hr-career-reading-layer-prompts-v1";
import {
  asRecord,
  asString,
  asStringArray,
  buildInputHashPayload,
  buildMinimalDataQuality,
  buildModelPolicySnapshot,
  buildTuningPolicySnapshot,
  computeCostSummary,
  computeInputHash,
  createSupabaseClient,
  extractBearerToken,
  extractOpenAiUsage,
  extractResponsesOutputText,
  getFunctionOrigin,
  inferGenerationErrorKind,
  isTuningRelatedOpenAiError,
  jsonResponse,
  loadActiveCandidateChart,
  logSpikeStage,
  mergeOpenAiUsageSnapshots,
  parseCompanyCandidateIds,
  requireUuid,
  resolveCoreLayersModelPolicy,
  resolveOpenAiApiKey,
  resolveSupabaseConfig,
  scanLayerBaseFitHireLanguage,
  scanLayerBaseForbiddenHdTerms,
  scanLayerMatchingSummaryFitHireLanguage,
  serializeGenerationError,
  type CoreLayersModelPolicy,
  type GenerationCancellationMeta,
  type LayerGenerationSummary,
  type LayerProgressItem,
  type LayerRunPhase,
  type LayerRunStatus,
  type OffendingMatch,
  type OpenAiUsageSnapshot,
  type RequestTuningSnapshot,
  SpikeConfigError,
} from "./hr-talent-map-v2-core-layers-shared";

export {
  createSupabaseClient,
  extractBearerToken,
  getFunctionOrigin,
  jsonResponse,
  loadActiveCandidateChart,
  logSpikeStage,
  parseCompanyCandidateIds,
  requireUuid,
  resolveCoreLayersModelPolicy,
  resolveOpenAiApiKey,
  resolveSupabaseConfig,
  buildMinimalDataQuality,
  computeInputHash,
  buildModelPolicySnapshot,
  inferGenerationErrorKind,
  serializeGenerationError,
  mergeOpenAiUsageSnapshots,
  asRecord,
  asString,
  asStringArray,
  type CoreLayersModelPolicy,
  type GenerationCancellationMeta,
  type LayerRunStatus,
  type OffendingMatch,
  type OpenAiUsageSnapshot,
  SpikeConfigError,
};

export const REPORT_TYPE = "hr_person_talent_map" as const;
export const SCHEMA_VERSION = "hr_person_talent_map_v3" as const;
export const PROMPT_VERSION = "hr_person_talent_map_v3_career_reading_layers_0_1" as const;
export const GENERATION_MODE = "career_reading_layers_v1" as const;
export const SOURCE_ANALYSIS_PACKET_VERSION = "analysis_packet_v1_1" as const;
export const CONTENT_CONTRACT_VERSION = "3.0.0" as const;

/** Alias for endpoints that historically used SPIKE_REPORT_TYPE. */
export const SPIKE_REPORT_TYPE = REPORT_TYPE;
export const SPIKE_PROMPT_VERSION = PROMPT_VERSION;

export const CAREER_READING_LAYERS_ORDER = [...CAREER_READING_LAYER_KEYS_V1] as const;
export const CAREER_READING_LAYER_COUNT = CAREER_READING_LAYERS_ORDER.length;

export type CareerReadingLayerKey = CareerReadingLayerKeyV1;

export type CareerReadingLayerGenerationState = {
  status: "generating" | "ready" | "error";
  started_at: string;
  updated_at?: string;
  finished_at: string | null;
  duration_ms: number;
  ready_count?: number;
  total_count?: number;
  current_layer_key?: CareerReadingLayerKey | null;
  current_layer_title?: string | null;
  cancel_requested?: boolean;
  cancel_requested_at?: string | null;
  cancelled_at?: string | null;
  cancelled_by?: string | null;
  mode: "sequential";
  run_mode: "smoke" | "layer";
  selected_model: string;
  max_output_tokens: number;
  output_token_policy: { smoke: number; layer: number };
  model_policy: {
    smoke: string;
    layer: string;
    reasoning: string;
    tuning_policy?: RequestTuningSnapshot & { warnings?: string[] };
  };
  request_tuning?: RequestTuningSnapshot;
  tuning_policy?: RequestTuningSnapshot & { warnings?: string[] };
  layers_order: CareerReadingLayerKey[];
  summary: LayerGenerationSummary;
  layers: Record<CareerReadingLayerKey, LayerRunStatus>;
};

export type CareerReadingLayerValidationResult =
  | { ok: true }
  | {
      ok: false;
      stage: string;
      message: string;
      offending_matches?: OffendingMatch[];
      details?: unknown;
    };

const OUTPUT_TEXT_TAIL_MAX = 500;
const RETRY_COMPACT_HINT = `Return valid JSON only. No markdown. Keep arrays concise. HR language in base only.`;

function strictObjectSchema(properties: Record<string, unknown>) {
  return {
    type: "object",
    properties,
    required: Object.keys(properties),
    additionalProperties: false,
  };
}

function strictEmptyObjectSchema() {
  return {
    type: "object",
    properties: {},
    required: [] as string[],
    additionalProperties: false,
  };
}

function assertStrictObjectsHaveAdditionalPropertiesFalse(
  schema: unknown,
  path = "schema",
): void {
  if (schema == null || typeof schema !== "object") return;
  if (Array.isArray(schema)) {
    schema.forEach((item, index) =>
      assertStrictObjectsHaveAdditionalPropertiesFalse(item, `${path}[${index}]`),
    );
    return;
  }
  const record = schema as Record<string, unknown>;
  if (record.type === "object" && record.additionalProperties !== false) {
    throw new Error(`${path} is object schema without additionalProperties:false`);
  }
  for (const [key, value] of Object.entries(record)) {
    if (key === "additionalProperties") continue;
    assertStrictObjectsHaveAdditionalPropertiesFalse(value, `${path}.${key}`);
  }
}

function assertStrictObjectsHaveAllPropertiesRequired(schema: unknown, path = "schema"): void {
  if (!schema || typeof schema !== "object") return;
  const record = schema as Record<string, unknown>;

  if (record.type === "object") {
    const properties = record.properties;
    const required = record.required;

    if (properties && typeof properties === "object" && !Array.isArray(properties)) {
      const propertyKeys = Object.keys(properties as Record<string, unknown>).sort();
      const requiredKeys = Array.isArray(required) ? [...required].map(String).sort() : [];

      const missing = propertyKeys.filter((key) => !requiredKeys.includes(key));

      if (missing.length > 0) {
        throw new Error(`${path} object schema missing required keys: ${missing.join(", ")}`);
      }
    }
  }

  for (const [key, value] of Object.entries(record)) {
    if (Array.isArray(value)) {
      value.forEach((item, index) =>
        assertStrictObjectsHaveAllPropertiesRequired(item, `${path}.${key}[${index}]`),
      );
    } else if (value && typeof value === "object") {
      assertStrictObjectsHaveAllPropertiesRequired(value, `${path}.${key}`);
    }
  }
}

function buildRequestTuningSnapshot(
  modelPolicy: CoreLayersModelPolicy,
  overrides?: Partial<RequestTuningSnapshot>,
): RequestTuningSnapshot {
  return {
    reasoning_effort: modelPolicy.reasoningEffort,
    verbosity: modelPolicy.verbosity,
    prompt_cache_key: modelPolicy.promptCacheKey,
    prompt_cache_retention: modelPolicy.promptCacheRetention,
    fallbacks: [],
    ...overrides,
  };
}

const confidenceEnum = { type: "string", enum: ["high", "medium", "low"] };
const statusEnum = {
  type: "string",
  enum: ["ready", "partial", "not_applicable", "missing_data"],
};
const nullableString = { type: ["string", "null"] };
const stringArraySchema = { type: "array", items: { type: "string" } };

const checkSchema = strictObjectSchema({
  hypothesis: { type: "string" },
  check_method: { type: "string" },
  good_signal: { type: "string" },
  warning_signal: { type: "string" },
});

const pointSchema = strictObjectSchema({
  title: { type: "string" },
  description: { type: "string" },
  source_layer_keys: stringArraySchema,
});

const riskSchema = strictObjectSchema({
  title: { type: "string" },
  description: { type: "string" },
  how_it_may_show_up: nullableString,
  mitigation: nullableString,
});

const chartElementSchema = strictObjectSchema({
  kind: { type: "string" },
  key: { type: "string" },
  value: { type: "string" },
  side: nullableString,
  planet: nullableString,
  line: nullableString,
});

const evidenceSchema = strictObjectSchema({
  source_fields: stringArraySchema,
  source_chart_elements: { type: "array", items: chartElementSchema },
  confidence: confidenceEnum,
  warnings: stringArraySchema,
});

const classicalSourceSchema = strictObjectSchema({
  source_key: { type: "string" },
  source_label: { type: "string" },
  raw_path: { type: "string" },
  value_summary: { type: "string" },
  confidence: confidenceEnum,
});

const sectionSchema = strictObjectSchema({
  title: { type: "string" },
  body: nullableString,
  items: stringArraySchema,
});

const channelTalentSchema = strictObjectSchema({
  channel_key: { type: "string" },
  classical_name: nullableString,
  gates: stringArraySchema,
  centers: stringArraySchema,
  circuit: nullableString,
  title: { type: "string" },
  summary: { type: "string" },
  where_useful: stringArraySchema,
  how_it_appears_at_work: { type: "string" },
  risk: { type: "string" },
  management_tip: { type: "string" },
  what_to_check: { type: "array", items: checkSchema },
  evidence: evidenceSchema,
});

const centerZoneSchema = strictObjectSchema({
  center_key: { type: "string" },
  classical_name: { type: "string" },
  defined: { type: "boolean" },
  title: { type: "string" },
  work_meaning: { type: "string" },
  potential_strength: nullableString,
  risk_under_pressure: nullableString,
  management_tip: nullableString,
  what_to_check: { type: "array", items: checkSchema },
});

const repeatedGateThemeSchema = strictObjectSchema({
  gate: { type: "string" },
  sources: stringArraySchema,
  title: { type: "string" },
  summary: { type: "string" },
  talent_potential: nullableString,
  risk_pattern: nullableString,
  what_to_check: { type: "array", items: checkSchema },
});

function buildSpecialPayloadSchema(layerKey: CareerReadingLayerKey) {
  if (layerKey === "talent_channels") {
    return strictObjectSchema({
      channel_talents: { type: "array", items: channelTalentSchema },
      channels_count: { type: "integer" },
    });
  }
  if (layerKey === "centers_stability_and_sensitivity") {
    return strictObjectSchema({
      center_zones: { type: "array", items: centerZoneSchema },
    });
  }
  if (layerKey === "repeated_themes") {
    return strictObjectSchema({
      repeated_gate_themes: { type: "array", items: repeatedGateThemeSchema },
    });
  }
  return strictEmptyObjectSchema();
}

export function buildCareerReadingLayerSchema(layerKey: CareerReadingLayerKey) {
  const catalog = CAREER_READING_LAYER_CATALOG_V1[layerKey];
  return strictObjectSchema({
    layer_key: { type: "string", enum: [layerKey] },
    title: { type: "string", enum: [catalog.title] },
    status: statusEnum,
    ui_priority: { type: "integer", enum: [catalog.ui_priority] },
    source_facts: strictEmptyObjectSchema(),
    base: strictObjectSchema({
      headline: { type: "string" },
      short_summary: { type: "string" },
      detailed_explanation: { type: "string" },
      how_it_appears_at_work: { type: "string" },
      where_useful: stringArraySchema,
      strengths: { type: "array", items: pointSchema },
      risks: { type: "array", items: riskSchema },
      management_tips: stringArraySchema,
      what_to_check: { type: "array", items: checkSchema },
      sections: { type: "array", items: sectionSchema },
    }),
    pro: strictObjectSchema({
      technical_title: nullableString,
      classical_sources: { type: "array", items: classicalSourceSchema },
      source_values: strictEmptyObjectSchema(),
      connection_logic: { type: "string" },
      confidence: confidenceEnum,
      limitations: stringArraySchema,
      human_check: nullableString,
    }),
    evidence: evidenceSchema,
    summary_for_synthesis: strictObjectSchema({
      one_sentence: { type: "string" },
      strengths: stringArraySchema,
      risks: stringArraySchema,
      conditions: stringArraySchema,
      management_focus: stringArraySchema,
      what_to_check: stringArraySchema,
    }),
    matching_summary: strictObjectSchema({
      good_for: stringArraySchema,
      bad_for: stringArraySchema,
      role_fit_positive_signals: stringArraySchema,
      role_fit_risk_signals: stringArraySchema,
      check_in_role_fit: stringArraySchema,
    }),
    special_payload: buildSpecialPayloadSchema(layerKey),
    qa: strictObjectSchema({
      base_has_forbidden_hd_terms: { type: "boolean" },
      pro_has_classical_sources: { type: "boolean" },
      has_summary_for_synthesis: { type: "boolean" },
      has_matching_summary: { type: "boolean" },
      human_review_recommended: { type: "boolean" },
    }),
  });
}

for (const layerKey of CAREER_READING_LAYERS_ORDER) {
  const schema = buildCareerReadingLayerSchema(layerKey);
  assertStrictObjectsHaveAdditionalPropertiesFalse(schema, layerKey);
  assertStrictObjectsHaveAllPropertiesRequired(schema, layerKey);
}

function nonEmptyArray(value: unknown, path: string): CareerReadingLayerValidationResult | null {
  if (!Array.isArray(value) || value.length === 0) {
    return { ok: false, stage: "validate_layer", message: `${path} must be non-empty array` };
  }
  return null;
}

function collectCareerReadingBaseText(layer: Record<string, unknown>): Array<{ path: string; text: string }> {
  const base = asRecord(layer.base);
  const fields: Array<{ path: string; text: string }> = [];
  for (const key of [
    "headline",
    "short_summary",
    "detailed_explanation",
    "how_it_appears_at_work",
  ]) {
    const text = asString(base[key]);
    if (text) fields.push({ path: `base.${key}`, text });
  }
  asStringArray(base.where_useful).forEach((text, i) => {
    if (text) fields.push({ path: `base.where_useful[${i}]`, text });
  });
  asStringArray(base.management_tips).forEach((text, i) => {
    if (text) fields.push({ path: `base.management_tips[${i}]`, text });
  });
  const risks = Array.isArray(base.risks) ? base.risks : [];
  risks.forEach((risk, i) => {
    const rec = asRecord(risk);
    for (const key of ["title", "description", "how_it_may_show_up", "mitigation"]) {
      const text = asString(rec[key]);
      if (text) fields.push({ path: `base.risks[${i}].${key}`, text });
    }
  });
  return fields;
}

const CAREER_READING_CONFIDENCE_VALUES = ["high", "medium", "low"] as const;
const CAREER_READING_BASE_HEADLINE_FALLBACK = "Рабочий слой карты";
const CAREER_READING_GENERIC_INTERVIEW_FALLBACK =
  "Требует проверки на интервью или рабочем кейсе.";
const CAREER_READING_RISK_FALLBACK =
  "Риск требует проверки через реальные рабочие ситуации.";
const CAREER_READING_CONDITIONS_FALLBACK =
  "Условия раскрытия нужно уточнить через интервью и рабочий кейс.";
const CAREER_READING_MANAGEMENT_FOCUS_FALLBACK =
  "Руководителю важно задать ясный контекст задачи и проверить реакцию кандидата на практике.";
const CAREER_READING_WHAT_TO_CHECK_FALLBACK =
  "Проверить через интервью, кейс и первые рабочие задачи.";
const CAREER_READING_BAD_FOR_FALLBACK =
  "Роли без ясного контекста требуют отдельной проверки.";
const WORK_MODE_CONDITIONS_FALLBACK =
  "Ясная постановка задачи, понятный запрос на участие и возможность принять решение без лишнего давления.";

function toNonEmptyStringArray(value: unknown, fallback: string[]): string[] {
  const items = Array.isArray(value)
    ? value.map(String).map((x) => x.trim()).filter(Boolean)
    : typeof value === "string" && value.trim()
      ? [value.trim()]
      : [];

  const fallbackItems = fallback.map(String).map((x) => x.trim()).filter(Boolean);

  return items.length > 0
    ? items
    : fallbackItems.length > 0
      ? fallbackItems
      : [CAREER_READING_GENERIC_INTERVIEW_FALLBACK];
}

function collectBaseStrengthTexts(base: Record<string, unknown>): string[] {
  const out: string[] = [...asStringArray(base.where_useful)];
  const strengths = Array.isArray(base.strengths) ? base.strengths : [];
  for (const item of strengths) {
    const rec = asRecord(item);
    const title = asString(rec.title);
    const description = asString(rec.description);
    if (title) out.push(title);
    if (description) out.push(description);
  }
  const headline = asString(base.headline);
  if (headline) out.push(headline);
  return out;
}

function collectBaseRiskTexts(base: Record<string, unknown>): string[] {
  const out: string[] = [];
  const risks = Array.isArray(base.risks) ? base.risks : [];
  for (const item of risks) {
    const rec = asRecord(item);
    const title = asString(rec.title);
    const description = asString(rec.description);
    if (title) out.push(title);
    if (description) out.push(description);
  }
  const checks = Array.isArray(base.what_to_check) ? base.what_to_check : [];
  for (const item of checks) {
    const warning = asString(asRecord(item).warning_signal);
    if (warning) out.push(warning);
  }
  return out;
}

function collectBaseWhatToCheckTexts(base: Record<string, unknown>): string[] {
  const out: string[] = [];
  const checks = Array.isArray(base.what_to_check) ? base.what_to_check : [];
  for (const item of checks) {
    const rec = asRecord(item);
    const hypothesis = asString(rec.hypothesis);
    const checkMethod = asString(rec.check_method);
    if (hypothesis) out.push(hypothesis);
    if (checkMethod) out.push(checkMethod);
  }
  return out;
}

function collectBaseManagementFocusTexts(base: Record<string, unknown>): string[] {
  const out: string[] = [...asStringArray(base.management_tips)];
  const checks = Array.isArray(base.what_to_check) ? base.what_to_check : [];
  for (const item of checks) {
    const checkMethod = asString(asRecord(item).check_method);
    if (checkMethod) out.push(checkMethod);
  }
  return out;
}

function collectBaseConditionsTexts(
  base: Record<string, unknown>,
  layerKey: CareerReadingLayerKey,
): string[] {
  const out: string[] = [];
  if (layerKey === "work_mode_and_decisions") {
    out.push(WORK_MODE_CONDITIONS_FALLBACK);
  }
  out.push(...asStringArray(base.where_useful));
  out.push(...asStringArray(base.management_tips));
  const howItAppears = asString(base.how_it_appears_at_work);
  if (howItAppears) out.push(howItAppears);
  const shortSummary = asString(base.short_summary);
  if (shortSummary) out.push(shortSummary);
  return out;
}

function ensureCareerReadingSummaryDefaults(
  layer: Record<string, unknown>,
  layerKey: CareerReadingLayerKey,
): void {
  const catalog = CAREER_READING_LAYER_CATALOG_V1[layerKey];
  const base = asRecord(layer.base);
  const layerTitle = asString(layer.title) || catalog.title;

  const strengthSources = collectBaseStrengthTexts(base);
  const riskSources = collectBaseRiskTexts(base);
  const whatToCheckSources = collectBaseWhatToCheckTexts(base);
  const managementSources = collectBaseManagementFocusTexts(base);
  const conditionsSources = collectBaseConditionsTexts(base, layerKey);

  const synthesisRaw = asRecord(layer.summary_for_synthesis);
  const oneSentence =
    asString(synthesisRaw.one_sentence) ||
    asString(base.short_summary) ||
    asString(base.headline) ||
    layerTitle;

  const synthesisStrengths = toNonEmptyStringArray(synthesisRaw.strengths, strengthSources);
  const synthesisRisks = toNonEmptyStringArray(synthesisRaw.risks, [
    ...riskSources,
    CAREER_READING_RISK_FALLBACK,
  ]);
  const synthesisConditions = toNonEmptyStringArray(synthesisRaw.conditions, [
    ...conditionsSources,
    CAREER_READING_CONDITIONS_FALLBACK,
  ]);
  const synthesisManagementFocus = toNonEmptyStringArray(synthesisRaw.management_focus, [
    ...managementSources,
    CAREER_READING_MANAGEMENT_FOCUS_FALLBACK,
  ]);
  const synthesisWhatToCheck = toNonEmptyStringArray(synthesisRaw.what_to_check, [
    ...whatToCheckSources,
    CAREER_READING_WHAT_TO_CHECK_FALLBACK,
  ]);

  layer.summary_for_synthesis = {
    one_sentence: oneSentence,
    strengths: synthesisStrengths,
    risks: synthesisRisks,
    conditions: synthesisConditions,
    management_focus: synthesisManagementFocus,
    what_to_check: synthesisWhatToCheck,
  };

  const matchingRaw = asRecord(layer.matching_summary);
  layer.matching_summary = {
    good_for: toNonEmptyStringArray(matchingRaw.good_for, [
      ...asStringArray(base.where_useful),
      ...synthesisStrengths,
      layerTitle,
    ]),
    bad_for: toNonEmptyStringArray(matchingRaw.bad_for, [
      ...synthesisRisks,
      ...riskSources,
      CAREER_READING_BAD_FOR_FALLBACK,
    ]),
    role_fit_positive_signals: toNonEmptyStringArray(matchingRaw.role_fit_positive_signals, [
      ...synthesisStrengths,
      ...strengthSources,
    ]),
    role_fit_risk_signals: toNonEmptyStringArray(matchingRaw.role_fit_risk_signals, [
      ...synthesisRisks,
      ...riskSources,
    ]),
    check_in_role_fit: toNonEmptyStringArray(matchingRaw.check_in_role_fit, [
      ...synthesisWhatToCheck,
      ...whatToCheckSources,
    ]),
  };
}

const BASE_MANAGEMENT_TIP_FALLBACK =
  "Задавать ясный контекст задачи, фиксировать ожидания и проверять выводы через практический кейс.";
const BASE_WHERE_USEFUL_FALLBACK =
  "Роли и задачи, где этот паттерн можно проверить через конкретный рабочий кейс.";
const BASE_STRENGTH_DESCRIPTION_FALLBACK =
  "Сильная сторона требует проверки на интервью и рабочем кейсе.";

function defaultGenericBaseRiskRecord(): Record<string, unknown> {
  return normalizeRiskRecord({
    title: "Зона проверки",
    description:
      "Риск требует проверки через интервью, рабочий кейс и наблюдение в первых задачах.",
    how_it_may_show_up: "Может проявиться только в конкретном рабочем контексте.",
    mitigation:
      "Проверить гипотезу через кейс, уточняющие вопросы и первые рабочие договорённости.",
  });
}

function defaultRepeatedThemesBaseRiskRecord(): Record<string, unknown> {
  return normalizeRiskRecord({
    title: "Риск зацикливания на сильной теме",
    description:
      "Повторяющаяся рабочая тема может быть талантом, но в неподходящей среде способна превращаться в устойчивый паттерн напряжения.",
    how_it_may_show_up:
      "Кандидат может снова возвращаться к одной и той же теме, спору или способу оценки задачи.",
    mitigation:
      "Проверить через кейс: где эта тема помогает результату, а где начинает ограничивать гибкость.",
  });
}

function defaultGenericWhatToCheckRecord(): Record<string, unknown> {
  return normalizeCheckRecord({
    hypothesis: "Проверить, как рабочий паттерн проявляется в реальной задаче.",
    check_method: "Дать короткий кейс и попросить объяснить ход решения.",
    good_signal: "Кандидат ясно объясняет логику, ограничения и следующий шаг.",
    warning_signal: "Ответ остаётся общим, без связи с задачей и критериями результата.",
  });
}

function riskRecordsFromTextLines(lines: string[]): Record<string, unknown>[] {
  const items = lines.map((x) => x.trim()).filter(Boolean);
  if (items.length === 0) return [];
  return items.map((text) =>
    normalizeRiskRecord({
      title: firstSentence(text) || "Зона проверки",
      description: text,
      how_it_may_show_up: "Может проявиться только в конкретном рабочем контексте.",
      mitigation:
        "Проверить гипотезу через кейс, уточняющие вопросы и первые рабочие договорённости.",
    }),
  );
}

function strengthRecordsFromTextLines(
  lines: string[],
  layerKey: CareerReadingLayerKey,
  base: Record<string, unknown>,
): Record<string, unknown>[] {
  const items = lines.map((x) => x.trim()).filter(Boolean);
  const descriptionFallback =
    asString(base.short_summary) || asString(base.headline) || BASE_STRENGTH_DESCRIPTION_FALLBACK;
  if (items.length === 0) {
    return [
      normalizePointRecord({
        title: "Рабочая сильная сторона",
        description: descriptionFallback,
        source_layer_keys: [layerKey],
      }),
    ];
  }
  return items.map((text) =>
    normalizePointRecord({
      title: firstSentence(text) || "Рабочая сильная сторона",
      description: text,
      source_layer_keys: [layerKey],
    }),
  );
}

function whatToCheckRecordsFromTextLines(lines: string[]): Record<string, unknown>[] {
  const items = lines.map((x) => x.trim()).filter(Boolean);
  if (items.length === 0) return [defaultGenericWhatToCheckRecord()];
  return items.map((text) =>
    normalizeCheckRecord({
      hypothesis: text,
      check_method: text,
      good_signal: "Кандидат ясно объясняет логику, ограничения и следующий шаг.",
      warning_signal: "Ответ остаётся общим, без связи с задачей и критериями результата.",
    }),
  );
}

function ensureCareerReadingBaseArrayDefaults(
  layer: Record<string, unknown>,
  layerKey: CareerReadingLayerKey,
): void {
  const base = asRecord(layer.base);
  const synthesis = asRecord(layer.summary_for_synthesis);
  const matching = asRecord(layer.matching_summary);

  const strengths = Array.isArray(base.strengths) ? base.strengths : [];
  if (strengths.length === 0) {
    base.strengths = strengthRecordsFromTextLines(
      [
        ...asStringArray(synthesis.strengths),
        asString(base.headline),
        asString(base.short_summary),
      ],
      layerKey,
      base,
    );
  }

  const risks = Array.isArray(base.risks) ? base.risks : [];
  if (risks.length === 0) {
    const riskLines = [
      ...asStringArray(synthesis.risks),
      ...asStringArray(matching.role_fit_risk_signals),
      ...collectBaseRiskTexts(base),
    ];
    const fromLines = riskRecordsFromTextLines(riskLines);
    if (fromLines.length > 0) {
      base.risks = fromLines;
    } else if (layerKey === "repeated_themes") {
      base.risks = [defaultRepeatedThemesBaseRiskRecord()];
    } else {
      base.risks = [defaultGenericBaseRiskRecord()];
    }
  }

  if (asStringArray(base.management_tips).length === 0) {
    base.management_tips = toNonEmptyStringArray(null, [
      ...asStringArray(synthesis.management_focus),
      ...asStringArray(matching.check_in_role_fit),
      BASE_MANAGEMENT_TIP_FALLBACK,
    ]);
  }

  const whatToCheck = Array.isArray(base.what_to_check) ? base.what_to_check : [];
  if (whatToCheck.length === 0) {
    base.what_to_check = whatToCheckRecordsFromTextLines([
      ...asStringArray(synthesis.what_to_check),
      ...asStringArray(matching.check_in_role_fit),
    ]);
  }

  if (asStringArray(base.where_useful).length === 0) {
    base.where_useful = toNonEmptyStringArray(null, [
      ...asStringArray(matching.good_for),
      ...asStringArray(synthesis.conditions),
      BASE_WHERE_USEFUL_FALLBACK,
    ]);
  }

  layer.base = base;
}

function firstSentence(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return "";
  const match = trimmed.match(/^[^.!?…]+[.!?…]?/u);
  return (match ? match[0] : trimmed.split(/\s+/).slice(0, 12).join(" ")).trim();
}

function inferChannelKeyFromLong(entry: string): string {
  const text = asString(entry);
  if (!text) return "";
  const beforeColon = text.split(":")[0]?.trim();
  return beforeColon || text;
}

function ensureCareerReadingBaseDefaults(
  layer: Record<string, unknown>,
  layerKey: CareerReadingLayerKey,
): void {
  const catalog = CAREER_READING_LAYER_CATALOG_V1[layerKey];
  const catalogTitle = catalog.title;
  const layerTitle = asString(layer.title) || catalogTitle;
  const base = asRecord(layer.base);

  let shortSummary = asString(base.short_summary);
  if (!shortSummary) {
    shortSummary = asString(base.headline) || catalogTitle || layerTitle;
  }

  let headline = asString(base.headline);
  if (!headline) {
    headline =
      firstSentence(shortSummary) ||
      catalogTitle ||
      layerTitle ||
      CAREER_READING_BASE_HEADLINE_FALLBACK;
  }

  if (!asString(base.short_summary)) {
    base.short_summary = shortSummary || headline || catalogTitle;
  }
  base.headline = headline;
  layer.base = base;
}

function normalizeNullableString(value: unknown): string | null {
  if (value == null) return null;
  const text = asString(value);
  return text || null;
}

function normalizeConfidence(value: unknown): (typeof CAREER_READING_CONFIDENCE_VALUES)[number] {
  const text = asString(value);
  if ((CAREER_READING_CONFIDENCE_VALUES as readonly string[]).includes(text)) {
    return text as (typeof CAREER_READING_CONFIDENCE_VALUES)[number];
  }
  return "medium";
}

function normalizeCheckRecord(value: unknown): Record<string, unknown> {
  const rec = asRecord(value);
  return {
    hypothesis: asString(rec.hypothesis) || "",
    check_method: asString(rec.check_method) || "",
    good_signal: asString(rec.good_signal) || "",
    warning_signal: asString(rec.warning_signal) || "",
  };
}

function normalizePointRecord(value: unknown): Record<string, unknown> {
  const rec = asRecord(value);
  return {
    title: asString(rec.title) || "",
    description: asString(rec.description) || "",
    source_layer_keys: asStringArray(rec.source_layer_keys),
  };
}

function normalizeRiskRecord(value: unknown): Record<string, unknown> {
  const rec = asRecord(value);
  return {
    title: asString(rec.title) || "",
    description: asString(rec.description) || "",
    how_it_may_show_up: normalizeNullableString(rec.how_it_may_show_up),
    mitigation: normalizeNullableString(rec.mitigation),
  };
}

function normalizeSectionRecord(value: unknown): Record<string, unknown> {
  const rec = asRecord(value);
  return {
    title: asString(rec.title) || "",
    body: normalizeNullableString(rec.body),
    items: asStringArray(rec.items),
  };
}

function normalizeChartElementRecord(value: unknown): Record<string, unknown> {
  const rec = asRecord(value);
  return {
    kind: asString(rec.kind) || "other",
    key: asString(rec.key) || "",
    value: asString(rec.value) || "",
    side: normalizeNullableString(rec.side),
    planet: normalizeNullableString(rec.planet),
    line: normalizeNullableString(rec.line),
  };
}

function normalizeClassicalSourceRecord(value: unknown): Record<string, unknown> {
  const rec = asRecord(value);
  return {
    source_key: asString(rec.source_key) || "",
    source_label: asString(rec.source_label) || "",
    raw_path: asString(rec.raw_path) || "",
    value_summary: asString(rec.value_summary) || "",
    confidence: normalizeConfidence(rec.confidence),
  };
}

function normalizeEvidenceRecord(
  value: unknown,
  defaultSourceFields: string[],
): Record<string, unknown> {
  const rec = asRecord(value);
  const sourceFields = asStringArray(rec.source_fields);
  return {
    source_fields: sourceFields.length > 0 ? sourceFields : [...defaultSourceFields],
    source_chart_elements: (Array.isArray(rec.source_chart_elements)
      ? rec.source_chart_elements
      : []
    ).map(normalizeChartElementRecord),
    confidence: normalizeConfidence(rec.confidence),
    warnings: asStringArray(rec.warnings),
  };
}

function normalizeChannelTalentRecord(
  value: unknown,
  opts?: {
    channelKeyHint?: string;
    evidenceFallback?: Record<string, unknown>;
    defaultSourceFields?: string[];
  },
): Record<string, unknown> {
  const rec = asRecord(value);
  const channelKey = asString(rec.channel_key) || opts?.channelKeyHint || "";
  const classicalName = normalizeNullableString(rec.classical_name);
  const evidenceRaw = asRecord(rec.evidence);
  const hasEvidence =
    asStringArray(evidenceRaw.source_fields).length > 0 ||
    (Array.isArray(evidenceRaw.source_chart_elements) &&
      evidenceRaw.source_chart_elements.length > 0);
  const defaultSourceFields = opts?.defaultSourceFields ?? [];
  return {
    channel_key: channelKey,
    classical_name: classicalName,
    gates: asStringArray(rec.gates),
    centers: asStringArray(rec.centers),
    circuit: normalizeNullableString(rec.circuit),
    title:
      asString(rec.title) ||
      classicalName ||
      channelKey ||
      "Связка талантов",
    summary: asString(rec.summary) || "Требует ручной проверки после генерации.",
    where_useful: asStringArray(rec.where_useful),
    how_it_appears_at_work: asString(rec.how_it_appears_at_work) || "",
    risk: asString(rec.risk) || "",
    management_tip: asString(rec.management_tip) || "",
    what_to_check: (Array.isArray(rec.what_to_check) ? rec.what_to_check : []).map(
      normalizeCheckRecord,
    ),
    evidence: normalizeEvidenceRecord(
      hasEvidence ? rec.evidence : opts?.evidenceFallback,
      defaultSourceFields,
    ),
  };
}

function normalizeCenterZoneRecord(value: unknown): Record<string, unknown> {
  const rec = asRecord(value);
  return {
    center_key: asString(rec.center_key) || "",
    classical_name: asString(rec.classical_name) || "",
    defined: rec.defined === true,
    title: asString(rec.title) || "",
    work_meaning: asString(rec.work_meaning) || "",
    potential_strength: normalizeNullableString(rec.potential_strength),
    risk_under_pressure: normalizeNullableString(rec.risk_under_pressure),
    management_tip: normalizeNullableString(rec.management_tip),
    what_to_check: (Array.isArray(rec.what_to_check) ? rec.what_to_check : []).map(
      normalizeCheckRecord,
    ),
  };
}

function normalizeRepeatedGateThemeRecord(value: unknown): Record<string, unknown> {
  const rec = asRecord(value);
  return {
    gate: asString(rec.gate) || "",
    sources: asStringArray(rec.sources),
    title: asString(rec.title) || "",
    summary: asString(rec.summary) || "",
    talent_potential: normalizeNullableString(rec.talent_potential),
    risk_pattern: normalizeNullableString(rec.risk_pattern),
    what_to_check: (Array.isArray(rec.what_to_check) ? rec.what_to_check : []).map(
      normalizeCheckRecord,
    ),
  };
}

function normalizeSpecialPayload(
  layerKey: CareerReadingLayerKey,
  value: unknown,
  layerInput?: unknown,
  layerEvidenceFallback?: Record<string, unknown>,
): Record<string, unknown> {
  const special = asRecord(value);
  if (layerKey === "talent_channels") {
    const input = layerInput != null ? asRecord(layerInput) : {};
    const channelsShort = asStringArray(input.channelsShort);
    const channelsLong = asStringArray(input.channelsLong);
    const defaultSourceFields = [...CAREER_READING_LAYER_CATALOG_V1.talent_channels.source_fields];
    const channelTalents = (Array.isArray(special.channel_talents)
      ? special.channel_talents
      : []
    ).map((item, index) =>
      normalizeChannelTalentRecord(item, {
        channelKeyHint:
          channelsShort[index] || inferChannelKeyFromLong(channelsLong[index] ?? ""),
        evidenceFallback: layerEvidenceFallback,
        defaultSourceFields,
      }),
    );
    const expectedCount = channelsShort.length || channelsLong.length;
    return {
      channel_talents: channelTalents,
      channels_count:
        typeof special.channels_count === "number"
          ? special.channels_count
          : expectedCount > 0
            ? expectedCount
            : channelTalents.length,
    };
  }
  if (layerKey === "centers_stability_and_sensitivity") {
    return {
      center_zones: (Array.isArray(special.center_zones) ? special.center_zones : []).map(
        normalizeCenterZoneRecord,
      ),
    };
  }
  if (layerKey === "repeated_themes") {
    return {
      repeated_gate_themes: (
        Array.isArray(special.repeated_gate_themes) ? special.repeated_gate_themes : []
      ).map(normalizeRepeatedGateThemeRecord),
    };
  }
  return {};
}

export function normalizeCareerReadingLayerForValidation(args: {
  layer: Record<string, unknown>;
  layerKey: CareerReadingLayerKey;
  layerInput?: unknown;
}): Record<string, unknown> {
  const catalog = CAREER_READING_LAYER_CATALOG_V1[args.layerKey];
  const layer = { ...args.layer };
  if (!asString(layer.layer_key)) layer.layer_key = args.layerKey;
  if (!asString(layer.title)) layer.title = catalog.title;
  if (typeof layer.ui_priority !== "number") layer.ui_priority = catalog.ui_priority;
  if (!asString(layer.status)) layer.status = "ready";

  const sourceFacts = asRecord(layer.source_facts);
  layer.source_facts = { ...sourceFacts };

  const base =
    layer.base != null && typeof layer.base === "object" && !Array.isArray(layer.base)
      ? asRecord(layer.base)
      : {};
  layer.base = {
    headline: asString(base.headline) || "",
    short_summary: asString(base.short_summary) || "",
    detailed_explanation: asString(base.detailed_explanation) || "",
    how_it_appears_at_work: asString(base.how_it_appears_at_work) || "",
    where_useful: asStringArray(base.where_useful),
    strengths: (Array.isArray(base.strengths) ? base.strengths : []).map(normalizePointRecord),
    risks: (Array.isArray(base.risks) ? base.risks : []).map(normalizeRiskRecord),
    management_tips: asStringArray(base.management_tips),
    what_to_check: (Array.isArray(base.what_to_check) ? base.what_to_check : []).map(
      normalizeCheckRecord,
    ),
    sections: (Array.isArray(base.sections) ? base.sections : []).map(normalizeSectionRecord),
  };
  ensureCareerReadingBaseDefaults(layer, args.layerKey);

  const pro = asRecord(layer.pro);
  layer.pro = {
    technical_title: normalizeNullableString(pro.technical_title),
    classical_sources: (Array.isArray(pro.classical_sources) ? pro.classical_sources : []).map(
      normalizeClassicalSourceRecord,
    ),
    source_values: { ...asRecord(pro.source_values) },
    connection_logic: asString(pro.connection_logic) || "",
    confidence: normalizeConfidence(pro.confidence),
    limitations: asStringArray(pro.limitations),
    human_check: normalizeNullableString(pro.human_check),
  };

  if (args.layerInput != null) {
    const inputFacts = asRecord(args.layerInput);
    layer.source_facts = { ...inputFacts };
    const normalizedPro = asRecord(layer.pro);
    normalizedPro.source_values = { ...inputFacts };
    layer.pro = normalizedPro;
  }

  layer.evidence = normalizeEvidenceRecord(layer.evidence, catalog.source_fields);

  if (
    layer.summary_for_synthesis == null ||
    typeof layer.summary_for_synthesis !== "object" ||
    Array.isArray(layer.summary_for_synthesis)
  ) {
    layer.summary_for_synthesis = {};
  }
  if (
    layer.matching_summary == null ||
    typeof layer.matching_summary !== "object" ||
    Array.isArray(layer.matching_summary)
  ) {
    layer.matching_summary = {};
  }
  ensureCareerReadingSummaryDefaults(layer, args.layerKey);
  ensureCareerReadingBaseArrayDefaults(layer, args.layerKey);

  layer.special_payload = normalizeSpecialPayload(
    args.layerKey,
    layer.special_payload,
    args.layerInput,
    asRecord(layer.evidence),
  );

  const qa = asRecord(layer.qa);
  layer.qa = {
    base_has_forbidden_hd_terms: qa.base_has_forbidden_hd_terms === true,
    pro_has_classical_sources: qa.pro_has_classical_sources === true,
    has_summary_for_synthesis: true,
    has_matching_summary: true,
    human_review_recommended: qa.human_review_recommended === true,
  };

  return layer;
}

export function validateCareerReadingLayer(
  layer: Record<string, unknown>,
  layerKey: CareerReadingLayerKey,
  layerInput?: unknown,
): CareerReadingLayerValidationResult {
  const catalog = CAREER_READING_LAYER_CATALOG_V1[layerKey];
  ensureCareerReadingBaseDefaults(layer, layerKey);
  ensureCareerReadingSummaryDefaults(layer, layerKey);
  ensureCareerReadingBaseArrayDefaults(layer, layerKey);

  if (asString(layer.layer_key) !== layerKey) {
    return { ok: false, stage: "validate_layer", message: `layer_key must be ${layerKey}` };
  }
  if (asString(layer.title) !== catalog.title) {
    return { ok: false, stage: "validate_layer", message: `title must be ${catalog.title}` };
  }
  if (!["ready", "partial", "not_applicable", "missing_data"].includes(asString(layer.status))) {
    return { ok: false, stage: "validate_layer", message: "invalid status" };
  }

  const base = asRecord(layer.base);
  if (!asString(base.headline)) {
    return { ok: false, stage: "validate_layer", message: "base.headline is required" };
  }
  if (!asString(base.short_summary)) {
    return { ok: false, stage: "validate_layer", message: "base.short_summary is required" };
  }
  for (const field of ["where_useful", "management_tips", "what_to_check", "risks"]) {
    const err = nonEmptyArray(base[field], `base.${field}`);
    if (err) return err;
  }

  const pro = asRecord(layer.pro);
  const classicalSources = Array.isArray(pro.classical_sources) ? pro.classical_sources : [];
  if (classicalSources.length === 0) {
    return { ok: false, stage: "validate_layer", message: "pro.classical_sources must be non-empty" };
  }
  if (!asString(pro.connection_logic)) {
    return { ok: false, stage: "validate_layer", message: "pro.connection_logic is required" };
  }

  const evidence = asRecord(layer.evidence);
  if (asStringArray(evidence.source_fields).length === 0) {
    return { ok: false, stage: "validate_layer", message: "evidence.source_fields must be non-empty" };
  }

  const synthesis = asRecord(layer.summary_for_synthesis);
  if (!asString(synthesis.one_sentence)) {
    return { ok: false, stage: "validate_layer", message: "summary_for_synthesis.one_sentence is required" };
  }
  for (const field of ["strengths", "risks", "conditions", "management_focus", "what_to_check"]) {
    const err = nonEmptyArray(synthesis[field], `summary_for_synthesis.${field}`);
    if (err) return err;
  }

  const matching = asRecord(layer.matching_summary);
  for (const field of [
    "good_for",
    "bad_for",
    "role_fit_positive_signals",
    "role_fit_risk_signals",
    "check_in_role_fit",
  ]) {
    const err = nonEmptyArray(matching[field], `matching_summary.${field}`);
    if (err) return err;
  }

  const qa = asRecord(layer.qa);
  if (qa.has_summary_for_synthesis !== true) {
    return { ok: false, stage: "validate_layer", message: "qa.has_summary_for_synthesis must be true" };
  }
  if (qa.has_matching_summary !== true) {
    return { ok: false, stage: "validate_layer", message: "qa.has_matching_summary must be true" };
  }

  if (layerKey === "talent_channels" && layerInput != null) {
    const input = asRecord(layerInput);
    const channelsCount = asStringArray(input.channelsShort).length;
    const special = asRecord(layer.special_payload);
    const talents = Array.isArray(special.channel_talents) ? special.channel_talents : [];
    if (channelsCount > 0 && talents.length === 0) {
      return {
        ok: false,
        stage: "validate_layer",
        message: "talent_channels must include channel_talents when channels exist",
      };
    }
    if (channelsCount > 0 && talents.length !== channelsCount) {
      return {
        ok: false,
        stage: "validate_layer",
        message: `channel_talents count (${talents.length}) should match channels (${channelsCount})`,
      };
    }
  }

  if (layerKey === "centers_stability_and_sensitivity" && layerInput != null) {
    const input = asRecord(layerInput);
    const defined = asStringArray(input.definedCenters ?? input.defined_centers);
    const open = asStringArray(input.openCenters ?? input.open_centers);
    const totalCenters = defined.length + open.length;
    if (totalCenters > 0) {
      const special = asRecord(layer.special_payload);
      const zones = Array.isArray(special.center_zones) ? special.center_zones : [];
      if (zones.length === 0) {
        return {
          ok: false,
          stage: "validate_layer",
          message: "centers layer must include center_zones when center data exists",
        };
      }
    }
  }

  const hdMatches = scanLayerBaseForbiddenHdTerms({
    base: layer.base,
    matching_summary: { summary: asStringArray(asRecord(layer.matching_summary).good_for).join(" ") },
  } as Record<string, unknown>);
  const careerHdMatches = collectCareerReadingBaseText(layer).flatMap((field) => {
    const forbidden = scanLayerBaseForbiddenHdTerms({
      base: { short_summary: field.text },
    } as Record<string, unknown>);
    return forbidden.map((m) => ({ ...m, path: field.path }));
  });
  if (careerHdMatches.length > 0 || hdMatches.length > 0) {
    return {
      ok: false,
      stage: "forbidden_base_terms",
      message: "base_forbidden_technical_terms",
      offending_matches: [...careerHdMatches, ...hdMatches],
    };
  }

  const fitMatches = [
    ...scanLayerBaseFitHireLanguage(layer),
    ...scanLayerMatchingSummaryFitHireLanguage(layer),
  ];
  if (fitMatches.length > 0) {
    return {
      ok: false,
      stage: "validate_layer",
      message: "forbidden fit/hire language",
      offending_matches: fitMatches,
    };
  }

  return { ok: true };
}

export function isForbiddenBaseTermsValidation(result: CareerReadingLayerValidationResult): boolean {
  return !result.ok && result.stage === "forbidden_base_terms";
}

export function isCareerReadingValidationRepairable(
  result: CareerReadingLayerValidationResult,
): boolean {
  if (result.ok || result.stage !== "validate_layer") return false;
  const message = result.message;
  return (
    message.includes("base.headline") ||
    message.includes("base.short_summary") ||
    message.includes("base.strengths") ||
    message.includes("base.risks") ||
    message.includes("base.management_tips") ||
    message.includes("base.what_to_check") ||
    message.includes("base.where_useful") ||
    message.includes("summary_for_synthesis") ||
    message.includes("matching_summary")
  );
}

class CareerReadingOpenAiError extends Error {
  readonly failedLayerKey: CareerReadingLayerKey;
  readonly responseStatus: string | null;
  readonly incompleteDetails: unknown;
  readonly outputTextLength: number;
  readonly outputTextTail: string | null;
  readonly parseError: string | null;
  readonly httpStatus: number;
  readonly retryable: boolean;

  constructor(opts: {
    message: string;
    failedLayerKey: CareerReadingLayerKey;
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

export class CareerReadingOpenAiRetryExhaustedError extends Error {
  readonly attempts = 2;
  readonly lastOpenAiError: CareerReadingOpenAiError;
  constructor(last: CareerReadingOpenAiError) {
    super(last.message);
    this.lastOpenAiError = last;
  }
}

function buildResponsesRequestBody(args: {
  model: string;
  schemaName: string;
  instructions: string;
  input: string;
  maxOutputTokens: number;
  schema: ReturnType<typeof buildCareerReadingLayerSchema>;
  modelPolicy?: CoreLayersModelPolicy | null;
  includeTuning?: boolean;
}): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model: args.model,
    instructions: args.instructions,
    input: args.input,
    max_output_tokens: args.maxOutputTokens,
    text: {
      format: {
        type: "json_schema",
        name: args.schemaName,
        strict: true,
        schema: args.schema,
      },
    },
    store: false,
  };
  const text = asRecord(body.text);
  if (args.includeTuning !== false && args.modelPolicy) {
    if (args.modelPolicy.reasoningEffort) {
      body.reasoning = { effort: args.modelPolicy.reasoningEffort };
    }
    if (args.modelPolicy.verbosity) text.verbosity = args.modelPolicy.verbosity;
    if (args.modelPolicy.promptCacheKey) body.prompt_cache_key = args.modelPolicy.promptCacheKey;
    if (args.modelPolicy.promptCacheRetention) {
      body.prompt_cache_retention = args.modelPolicy.promptCacheRetention;
    }
  }
  return body;
}

function parseLayerJson(raw: string, layerKey: CareerReadingLayerKey, data: Record<string, unknown>, httpStatus: number) {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)```$/i);
  const jsonText = fenced ? fenced[1].trim() : trimmed;
  try {
    const parsed: unknown = JSON.parse(jsonText);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("unexpected JSON structure");
    }
    return parsed as Record<string, unknown>;
  } catch (err) {
    const parseError = err instanceof Error ? err.message : String(err);
    const tail = raw.length <= OUTPUT_TEXT_TAIL_MAX ? raw : raw.slice(-OUTPUT_TEXT_TAIL_MAX);
    throw new CareerReadingOpenAiError({
      message: "openai_response_json_parse_failed",
      failedLayerKey: layerKey,
      responseStatus: asString(data.status) || null,
      incompleteDetails: data.incomplete_details ?? null,
      outputTextLength: raw.length,
      outputTextTail: tail,
      parseError,
      httpStatus,
      retryable: true,
    });
  }
}

async function postOpenAi(args: {
  apiKey: string;
  requestBody: Record<string, unknown>;
}): Promise<{ data: Record<string, unknown>; httpStatus: number }> {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${args.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args.requestBody),
  });
  return { data: asRecord(await response.json().catch(() => ({}))), httpStatus: response.status };
}

export function buildCareerReadingCompactInput(args: {
  layerKey: CareerReadingLayerKey;
  candidate: Record<string, unknown>;
  company: Record<string, unknown>;
  normalizedChart: Record<string, unknown>;
}): Record<string, unknown> {
  const layerInputs = buildCareerReadingLayerInputsV1(args.normalizedChart);
  return {
    layer_key: args.layerKey,
    candidate_snapshot: {
      name: asString(args.candidate.name) || null,
      hr_comment: asString(args.candidate.hr_comment) || null,
    },
    company: {
      name: asString(args.company.name) || null,
      industry: asString(args.company.industry) || null,
    },
    normalized_chart_data: args.normalizedChart,
    layer_input: layerInputs[args.layerKey],
  };
}

export async function callOpenAiForCareerReadingLayer(args: {
  apiKey: string;
  model: string;
  layerKey: CareerReadingLayerKey;
  compactInput: Record<string, unknown>;
  maxOutputTokens: number;
  compactRetry?: boolean;
  modelPolicy?: CoreLayersModelPolicy | null;
  inputOverride?: string;
}): Promise<{
  layer: Record<string, unknown>;
  httpStatus: number;
  usage: OpenAiUsageSnapshot;
  request_tuning: RequestTuningSnapshot;
  request_tuning_fallback: boolean;
  request_tuning_fallback_reason: string | null;
}> {
  const prompts = buildCareerReadingLayerPromptV1({
    layer_key: args.layerKey,
    candidate_snapshot: compactInputCandidateSnapshot(args.compactInput),
    normalized_chart_data: args.compactInput.normalized_chart_data,
    layer_input: args.compactInput.layer_input,
  });

  const instructions = prompts.system;
  let input =
    args.inputOverride ??
    (args.compactRetry
      ? `${prompts.user}\n\n${RETRY_COMPACT_HINT}`
      : prompts.user);

  const schema = buildCareerReadingLayerSchema(args.layerKey);
  const tuningSnapshot = args.modelPolicy
    ? buildRequestTuningSnapshot(args.modelPolicy)
    : {
        reasoning_effort: null,
        verbosity: null,
        prompt_cache_key: null,
        prompt_cache_retention: null,
        fallbacks: [] as string[],
      };

  let requestBody = buildResponsesRequestBody({
    model: args.model,
    schemaName: prompts.json_schema_name,
    instructions,
    input,
    maxOutputTokens: args.maxOutputTokens,
    schema,
    modelPolicy: args.modelPolicy,
    includeTuning: true,
  });

  let { data, httpStatus } = await postOpenAi({ apiKey: args.apiKey, requestBody });
  let fallback = false;
  let fallbackReason: string | null = null;

  if (httpStatus < 200 || httpStatus >= 300) {
    const message = asString(asRecord(data.error).message) || `OpenAI error (${httpStatus})`;
    if (args.modelPolicy && isTuningRelatedOpenAiError(httpStatus, message)) {
      requestBody = buildResponsesRequestBody({
        model: args.model,
        schemaName: prompts.json_schema_name,
        instructions,
        input,
        maxOutputTokens: args.maxOutputTokens,
        schema,
        modelPolicy: args.modelPolicy,
        includeTuning: false,
      });
      ({ data, httpStatus } = await postOpenAi({ apiKey: args.apiKey, requestBody }));
      fallback = true;
      fallbackReason = message;
      tuningSnapshot.fallback_used = true;
    }
    if (httpStatus < 200 || httpStatus >= 300) {
      throw new CareerReadingOpenAiError({
        message: asString(asRecord(data.error).message) || `OpenAI error (${httpStatus})`,
        failedLayerKey: args.layerKey,
        httpStatus,
        retryable: false,
      });
    }
  }

  const apiError = asString(asRecord(data.error).message);
  if (apiError) {
    throw new CareerReadingOpenAiError({
      message: apiError,
      failedLayerKey: args.layerKey,
      httpStatus,
      retryable: false,
    });
  }

  const rawText = extractResponsesOutputText(data);
  if (
    asString(data.status) === "incomplete" ||
    data.incomplete_details != null ||
    !rawText.trim()
  ) {
    throw new CareerReadingOpenAiError({
      message: "openai_response_incomplete",
      failedLayerKey: args.layerKey,
      responseStatus: asString(data.status) || null,
      incompleteDetails: data.incomplete_details ?? null,
      outputTextLength: rawText.length,
      retryable: true,
    });
  }

  const parsed = parseLayerJson(rawText, args.layerKey, data, httpStatus);
  const layer = normalizeCareerReadingLayerForValidation({
    layer: parsed,
    layerKey: args.layerKey,
    layerInput: args.compactInput.layer_input,
  });
  return {
    layer,
    httpStatus,
    usage: extractOpenAiUsage(data),
    request_tuning: tuningSnapshot,
    request_tuning_fallback: fallback,
    request_tuning_fallback_reason: fallbackReason,
  };
}

function compactInputCandidateSnapshot(compactInput: Record<string, unknown>): unknown {
  return compactInput.candidate_snapshot ?? asRecord(compactInput.candidate);
}

export async function callOpenAiForCareerReadingLayerWithRetry(
  args: Parameters<typeof callOpenAiForCareerReadingLayer>[0],
): Promise<
  Awaited<ReturnType<typeof callOpenAiForCareerReadingLayer>> & { attempts: number }
> {
  let last: CareerReadingOpenAiError | null = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const result = await callOpenAiForCareerReadingLayer({
        ...args,
        compactRetry: attempt === 2,
      });
      return { ...result, attempts: attempt };
    } catch (err) {
      if (err instanceof CareerReadingOpenAiError && err.retryable && attempt < 2) {
        last = err;
        continue;
      }
      if (err instanceof CareerReadingOpenAiError && err.retryable) {
        throw new CareerReadingOpenAiRetryExhaustedError(err);
      }
      throw err;
    }
  }
  if (last) throw new CareerReadingOpenAiRetryExhaustedError(last);
  throw new Error("openai_retry_exhausted");
}

export async function callOpenAiForCareerReadingForbiddenTermsRepair(args: {
  apiKey: string;
  model: string;
  layerKey: CareerReadingLayerKey;
  compactInput: Record<string, unknown>;
  maxOutputTokens: number;
  modelPolicy?: CoreLayersModelPolicy | null;
  offendingMatches: OffendingMatch[];
}): Promise<Awaited<ReturnType<typeof callOpenAiForCareerReadingLayer>>> {
  const terms = Array.from(new Set(args.offendingMatches.map((m) => m.term))).join(", ");
  const repairPrompt = `${buildCareerReadingLayerPromptV1({
    layer_key: args.layerKey,
    candidate_snapshot: compactInputCandidateSnapshot(args.compactInput),
    normalized_chart_data: args.compactInput.normalized_chart_data,
    layer_input: args.compactInput.layer_input,
  }).user}

REPAIR: Base contains forbidden technical HD terms (${terms}). Rewrite base fields in plain HR language only. Keep pro/classical_sources unchanged in meaning. Return full JSON again.`;
  return callOpenAiForCareerReadingLayer({
    ...args,
    inputOverride: repairPrompt,
  });
}

export async function callOpenAiForCareerReadingValidationRepair(args: {
  apiKey: string;
  model: string;
  layerKey: CareerReadingLayerKey;
  compactInput: Record<string, unknown>;
  maxOutputTokens: number;
  modelPolicy?: CoreLayersModelPolicy | null;
  validationMessage: string;
}): Promise<Awaited<ReturnType<typeof callOpenAiForCareerReadingLayer>>> {
  const repairPrompt = `${buildCareerReadingLayerPromptV1({
    layer_key: args.layerKey,
    candidate_snapshot: compactInputCandidateSnapshot(args.compactInput),
    normalized_chart_data: args.compactInput.normalized_chart_data,
    layer_input: args.compactInput.layer_input,
  }).user}

REPAIR: Layer JSON failed validation (${args.validationMessage}). Return the full layer JSON again.
Return base.headline and base.short_summary as non-empty strings.
Return non-empty base.strengths, base.risks, base.management_tips, base.what_to_check, and base.where_useful arrays.
Return non-empty arrays for all summary_for_synthesis fields and all matching_summary fields.`;
  return callOpenAiForCareerReadingLayer({
    apiKey: args.apiKey,
    model: args.model,
    layerKey: args.layerKey,
    compactInput: args.compactInput,
    maxOutputTokens: args.maxOutputTokens,
    modelPolicy: args.modelPolicy,
    inputOverride: repairPrompt,
  });
}

export function layerPhaseProgressPercent(status: LayerRunPhase): number | null {
  switch (status) {
    case "pending":
      return 0;
    case "generating":
      return null;
    case "repairing":
      return 70;
    case "validating":
      return 85;
    case "ready":
      return 100;
    default:
      return null;
  }
}

export function summarizeCareerReadingLayerGeneration(
  layers: Record<CareerReadingLayerKey, LayerRunStatus>,
  model?: string,
): LayerGenerationSummary {
  let ready = 0;
  let error = 0;
  let skipped = 0;
  let attempts_total = 0;
  let input_tokens_total = 0;
  let cached_input_tokens_total = 0;
  let output_tokens_total = 0;
  let reasoning_tokens_total = 0;
  let total_tokens_total = 0;
  let tuning_fallbacks_total = 0;

  for (const key of CAREER_READING_LAYERS_ORDER) {
    const layer = layers[key];
    if (layer.status === "ready") ready++;
    if (layer.status === "error") error++;
    if (layer.status === "skipped") skipped++;
    attempts_total += typeof layer.attempts === "number" ? layer.attempts : 0;
    if (layer.usage) {
      input_tokens_total += layer.usage.input_tokens ?? 0;
      cached_input_tokens_total += layer.usage.cached_input_tokens ?? 0;
      output_tokens_total += layer.usage.output_tokens ?? 0;
      reasoning_tokens_total += layer.usage.reasoning_tokens ?? 0;
      total_tokens_total += layer.usage.total_tokens ?? 0;
    }
    if (layer.request_tuning_fallback) tuning_fallbacks_total++;
  }

  const modelForCost =
    model ??
    CAREER_READING_LAYERS_ORDER.map((key) => asString(layers[key].model)).find(Boolean) ??
    "gpt-5-nano";

  const cost_summary = computeCostSummary({
    model: modelForCost,
    inputTokens: input_tokens_total,
    cachedInputTokens: cached_input_tokens_total,
    outputTokens: output_tokens_total,
    reasoningTokens: reasoning_tokens_total,
    totalTokens: total_tokens_total,
    readyLayers: ready,
  });

  return {
    total: CAREER_READING_LAYER_COUNT,
    ready,
    error,
    skipped,
    attempts_total,
    usage_summary: {
      input_tokens_total,
      cached_input_tokens_total,
      output_tokens_total,
      reasoning_tokens_total,
      total_tokens_total,
      cached_input_tokens_ratio:
        input_tokens_total > 0 ? cached_input_tokens_total / input_tokens_total : 0,
      tuning_fallbacks_total,
      cost_summary,
    },
  };
}

export function syncCareerReadingLayerGenerationProgress(
  state: CareerReadingLayerGenerationState,
): void {
  state.updated_at = new Date().toISOString();
  let readyCount = 0;
  let currentKey: CareerReadingLayerKey | null = null;
  let currentTitle: string | null = null;

  for (const key of CAREER_READING_LAYERS_ORDER) {
    const layer = state.layers[key];
    const catalog = CAREER_READING_LAYER_CATALOG_V1[key];
    layer.hr_title = catalog.title;
    layer.progress_percent = layerPhaseProgressPercent(layer.status);
    if (layer.status === "ready") {
      readyCount++;
      continue;
    }
    if (
      !currentKey &&
      (layer.status === "generating" ||
        layer.status === "repairing" ||
        layer.status === "validating")
    ) {
      currentKey = key;
      currentTitle = catalog.title;
    }
  }

  state.ready_count = readyCount;
  state.total_count = CAREER_READING_LAYER_COUNT;
  state.current_layer_key = currentKey;
  state.current_layer_title = currentTitle;
}

export function initCareerReadingLayerGenerationState(
  pipelineStartedAt: string,
  modelPolicy: CoreLayersModelPolicy,
): CareerReadingLayerGenerationState {
  const layers = {} as Record<CareerReadingLayerKey, LayerRunStatus>;
  for (const key of CAREER_READING_LAYERS_ORDER) {
    layers[key] = {
      status: "pending",
      hr_title: CAREER_READING_LAYER_CATALOG_V1[key].title,
      progress_percent: 0,
    };
  }
  const state: CareerReadingLayerGenerationState = {
    status: "generating",
    started_at: pipelineStartedAt,
    finished_at: null,
    duration_ms: 0,
    mode: "sequential",
    run_mode: modelPolicy.runMode,
    selected_model: modelPolicy.selectedModel,
    max_output_tokens: modelPolicy.maxOutputTokens,
    output_token_policy: {
      smoke: modelPolicy.outputTokenPolicy.smoke,
      layer: modelPolicy.outputTokenPolicy.layer,
    },
    model_policy: {
      smoke: modelPolicy.smokeModel,
      layer: modelPolicy.layerModel,
      reasoning: modelPolicy.reasoningModel,
      tuning_policy: buildTuningPolicySnapshot(modelPolicy),
    },
    request_tuning: buildRequestTuningSnapshot(modelPolicy),
    tuning_policy: buildTuningPolicySnapshot(modelPolicy),
    layers_order: [...CAREER_READING_LAYERS_ORDER],
    summary: summarizeCareerReadingLayerGeneration(layers, modelPolicy.selectedModel),
    layers,
  };
  syncCareerReadingLayerGenerationProgress(state);
  return state;
}

export function buildCareerReadingLayersProgressArray(
  layerGeneration: Record<string, unknown>,
): LayerProgressItem[] {
  const layers = asRecord(layerGeneration.layers);
  return CAREER_READING_LAYERS_ORDER.map((key) => {
    const layer = asRecord(layers[key]);
    const catalog = CAREER_READING_LAYER_CATALOG_V1[key];
    const statusRaw = asString(layer.status);
    const phases: LayerRunPhase[] = [
      "pending",
      "generating",
      "repairing",
      "validating",
      "ready",
      "error",
      "skipped",
    ];
    const status = phases.includes(statusRaw as LayerRunPhase)
      ? (statusRaw as LayerRunPhase)
      : "pending";
    return {
      layer_key: key,
      hr_title: asString(layer.hr_title) || catalog.title,
      status,
      progress_percent:
        typeof layer.progress_percent === "number"
          ? layer.progress_percent
          : layerPhaseProgressPercent(status),
      started_at: asString(layer.started_at) || null,
      completed_at: asString(layer.completed_at) || asString(layer.finished_at) || null,
      attempts: typeof layer.attempts === "number" ? layer.attempts : 0,
      repair_attempts: typeof layer.repair_attempts === "number" ? layer.repair_attempts : 0,
      error: layer.error ?? null,
    };
  });
}

export function buildPartialCareerReadingContentJson(args: {
  layerGeneration: CareerReadingLayerGenerationState;
  careerReadingLayers: Record<string, unknown>[];
  cancellation?: GenerationCancellationMeta;
}): Record<string, unknown> {
  syncCareerReadingLayerGenerationProgress(args.layerGeneration);
  const generationMeta: Record<string, unknown> = {
    prompt_version: PROMPT_VERSION,
    schema_version: SCHEMA_VERSION,
    generation_mode: GENERATION_MODE,
    career_reading_layers_version: CAREER_READING_LAYERS_VERSION_V1,
    content_contract_version: CONTENT_CONTRACT_VERSION,
    source_analysis_packet_version: SOURCE_ANALYSIS_PACKET_VERSION,
    layer_generation: args.layerGeneration,
  };
  if (args.cancellation && Object.keys(args.cancellation).length > 0) {
    generationMeta.cancellation = args.cancellation;
  }
  return {
    schema_version: SCHEMA_VERSION,
    report_type: REPORT_TYPE,
    career_reading_layers: args.careerReadingLayers,
    generation_meta: generationMeta,
  };
}

export function preserveCancellationInContentJson(
  existingContentJson: Record<string, unknown>,
  nextContentJson: Record<string, unknown>,
): Record<string, unknown> {
  const existingMeta = asRecord(existingContentJson.generation_meta);
  const existingCancellation = asRecord(existingMeta.cancellation);
  const existingLayerGeneration = asRecord(existingMeta.layer_generation);
  const nextMeta = asRecord(nextContentJson.generation_meta);
  const nextLayerGeneration = asRecord(nextMeta.layer_generation);

  if (
    existingLayerGeneration.cancel_requested === true ||
    existingCancellation.requested === true
  ) {
    nextLayerGeneration.cancel_requested = true;
    nextLayerGeneration.cancel_requested_at =
      asString(existingLayerGeneration.cancel_requested_at) ||
      asString(existingCancellation.requested_at) ||
      null;
    nextLayerGeneration.cancelled_by =
      asString(existingLayerGeneration.cancelled_by) ||
      asString(existingCancellation.requested_by) ||
      null;
  }

  if (Object.keys(existingCancellation).length > 0) {
    nextMeta.cancellation = { ...existingCancellation, ...asRecord(nextMeta.cancellation) };
  }
  nextMeta.layer_generation = nextLayerGeneration;
  return { ...nextContentJson, generation_meta: nextMeta };
}

export async function saveCareerReadingLayerGenerationProgress(
  db: SupabaseClient,
  reportId: string,
  args: {
    layerGeneration: CareerReadingLayerGenerationState;
    careerReadingLayers: Record<string, unknown>[];
    cancellation?: GenerationCancellationMeta;
  },
): Promise<void> {
  let contentJson = buildPartialCareerReadingContentJson(args);
  const { data: existingRow } = await db
    .from("hr_reports")
    .select("content_json")
    .eq("id", reportId)
    .maybeSingle();
  if (existingRow?.content_json && typeof existingRow.content_json === "object") {
    contentJson = preserveCancellationInContentJson(
      asRecord(existingRow.content_json),
      contentJson,
    );
  }
  await db
    .from("hr_reports")
    .update({ content_json: contentJson, updated_at: new Date().toISOString() })
    .eq("id", reportId)
    .eq("report_status", "generating");
}

export function serializeGenerationCancelledError(): string {
  return JSON.stringify({
    kind: "generation_cancelled_by_user",
    stage: "cancellation",
    message: "Генерация отменена пользователем.",
  });
}

export async function isGenerationCancelRequested(
  db: SupabaseClient,
  reportId: string,
): Promise<boolean> {
  const { data: report } = await db
    .from("hr_reports")
    .select("content_json")
    .eq("id", reportId)
    .maybeSingle();
  if (!report) return false;
  const meta = asRecord(asRecord(report.content_json).generation_meta);
  const lg = asRecord(meta.layer_generation);
  const cancellation = asRecord(meta.cancellation);
  return lg.cancel_requested === true || cancellation.requested === true;
}

export function buildCareerReadingInputHashPayload(args: {
  companyId: string;
  candidateId: string;
  chartId: string;
  chartUpdatedAt: string;
  normalizedChart: Record<string, unknown>;
  candidateHrComment: string | null;
  companyIndustry: string | null;
  model: string;
  run_mode: "smoke" | "layer";
}): Record<string, unknown> {
  const base = buildInputHashPayload(args);
  return {
    ...base,
    report_type: REPORT_TYPE,
    prompt_version: PROMPT_VERSION,
    generation_mode: GENERATION_MODE,
    layers_order: [...CAREER_READING_LAYERS_ORDER],
    career_reading_layers_version: CAREER_READING_LAYERS_VERSION_V1,
  };
}

export async function findExistingCareerReadingReport(
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
    .eq("report_type", REPORT_TYPE)
    .eq("input_hash", inputHash)
    .is("vacancy_id", null)
    .maybeSingle();
}

export function extractReadyCareerReadingLayerKeys(
  layers: Record<string, unknown>[],
): string[] {
  return layers
    .map((l) => asString(l.layer_key))
    .filter((key): key is CareerReadingLayerKey =>
      (CAREER_READING_LAYERS_ORDER as readonly string[]).includes(key),
    );
}

export function extractLayerKeysByStatus(
  layerGeneration: Record<string, unknown>,
  status: LayerRunPhase,
): string[] {
  const layers = asRecord(layerGeneration.layers);
  const keys: string[] = [];
  for (const key of CAREER_READING_LAYERS_ORDER) {
    if (asString(asRecord(layers[key]).status) === status) keys.push(key);
  }
  return keys;
}

function allLayersHaveQaFlags(layers: Record<string, unknown>[]): boolean {
  return layers.every((layer) => {
    const base = asRecord(layer.base);
    const pro = asRecord(layer.pro);
    const evidence = asRecord(layer.evidence);
    const synthesis = asRecord(layer.summary_for_synthesis);
    const matching = asRecord(layer.matching_summary);
    const qa = asRecord(layer.qa);
    return (
      Object.keys(base).length > 0 &&
      Object.keys(pro).length > 0 &&
      Object.keys(evidence).length > 0 &&
      asString(synthesis.one_sentence).length > 0 &&
      Array.isArray(matching.good_for) &&
      matching.good_for.length > 0 &&
      qa.has_summary_for_synthesis === true &&
      qa.has_matching_summary === true
    );
  });
}

export function buildCareerReadingContentJson(args: {
  careerReadingLayers: Record<string, unknown>[];
  candidate: Record<string, unknown>;
  company: Record<string, unknown>;
  chart: Record<string, unknown>;
  normalizedChart: Record<string, unknown>;
  model: string;
  modelPolicy: CoreLayersModelPolicy;
  generatedAt: string;
  layerGeneration: Record<string, unknown>;
}): Record<string, unknown> {
  const name = asString(args.candidate.name, "Кандидат");
  const dataQuality = buildMinimalDataQuality(args.candidate, args.normalizedChart);
  const layerGenerationSummary = asRecord(asRecord(args.layerGeneration).summary);
  const usageSummary = asRecord(layerGenerationSummary.usage_summary);
  const modelPolicySnapshot = buildModelPolicySnapshot(args.modelPolicy);

  return {
    schema_version: SCHEMA_VERSION,
    report_type: REPORT_TYPE,
    generation_meta: {
      content_contract_version: CONTENT_CONTRACT_VERSION,
      generation_mode: GENERATION_MODE,
      career_reading_layers_version: CAREER_READING_LAYERS_VERSION_V1,
      prompt_version: PROMPT_VERSION,
      schema_version: SCHEMA_VERSION,
      language: "ru",
      generated_at: args.generatedAt,
      model: args.model,
      run_mode: args.modelPolicy.runMode,
      selected_model: args.modelPolicy.selectedModel,
      max_output_tokens: args.modelPolicy.maxOutputTokens,
      model_policy: modelPolicySnapshot,
      request_tuning: buildRequestTuningSnapshot(args.modelPolicy),
      usage_summary: Object.keys(usageSummary).length > 0 ? usageSummary : undefined,
      source_analysis_packet_version: SOURCE_ANALYSIS_PACKET_VERSION,
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
    career_reading_layers: args.careerReadingLayers,
    synthesis_blocks: {},
    derived_action_sources: {
      interview: { status: "not_generated", source_layer_keys: [], source_synthesis_keys: [] },
      test_task: { status: "not_generated", source_layer_keys: [], source_synthesis_keys: [] },
      adaptation_plan: { status: "not_generated", source_layer_keys: [], source_synthesis_keys: [] },
      role_fit: { status: "separate_report_type", source_layer_keys: [], source_synthesis_keys: [] },
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
      fit_score_removed: true,
      all_career_reading_layers_have_base: allLayersHaveQaFlags(args.careerReadingLayers),
      all_career_reading_layers_have_pro: allLayersHaveQaFlags(args.careerReadingLayers),
      all_career_reading_layers_have_evidence: allLayersHaveQaFlags(args.careerReadingLayers),
      all_career_reading_layers_have_summary_for_synthesis: allLayersHaveQaFlags(
        args.careerReadingLayers,
      ),
      all_career_reading_layers_have_matching_summary: allLayersHaveQaFlags(
        args.careerReadingLayers,
      ),
      human_review_recommended: true,
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
  if (contentJson) update.content_json = contentJson;
  return db.from("hr_reports").update(update).eq("id", reportId);
}
