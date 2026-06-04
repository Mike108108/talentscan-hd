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

const checkSchema = {
  type: "object",
  properties: {
    hypothesis: { type: "string" },
    check_method: { type: "string" },
    good_signal: { type: "string" },
    warning_signal: { type: "string" },
  },
  required: ["hypothesis", "check_method", "good_signal", "warning_signal"],
  additionalProperties: false,
};

const pointSchema = {
  type: "object",
  properties: {
    title: { type: "string" },
    description: { type: "string" },
    source_layer_keys: { type: "array", items: { type: "string" } },
  },
  required: ["title", "description"],
  additionalProperties: false,
};

const riskSchema = {
  type: "object",
  properties: {
    title: { type: "string" },
    description: { type: "string" },
    how_it_may_show_up: { type: "string" },
    mitigation: { type: "string" },
  },
  required: ["title", "description"],
  additionalProperties: false,
};

const evidenceSchema = {
  type: "object",
  properties: {
    source_fields: { type: "array", items: { type: "string" } },
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
  required: ["source_fields", "source_chart_elements", "confidence", "warnings"],
  additionalProperties: false,
};

const channelTalentSchema = {
  type: "object",
  properties: {
    channel_key: { type: "string" },
    classical_name: { type: "string" },
    gates: { type: "array", items: { type: "string" } },
    centers: { type: "array", items: { type: "string" } },
    circuit: { type: "string" },
    title: { type: "string" },
    summary: { type: "string" },
    where_useful: { type: "array", items: { type: "string" } },
    how_it_appears_at_work: { type: "string" },
    risk: { type: "string" },
    management_tip: { type: "string" },
    what_to_check: { type: "array", items: checkSchema },
    evidence: evidenceSchema,
  },
  required: [
    "channel_key",
    "title",
    "summary",
    "where_useful",
    "how_it_appears_at_work",
    "risk",
    "management_tip",
    "what_to_check",
    "evidence",
  ],
  additionalProperties: false,
};

const centerZoneSchema = {
  type: "object",
  properties: {
    center_key: { type: "string" },
    classical_name: { type: "string" },
    defined: { type: "boolean" },
    title: { type: "string" },
    work_meaning: { type: "string" },
    potential_strength: { type: "string" },
    risk_under_pressure: { type: "string" },
    management_tip: { type: "string" },
    what_to_check: { type: "array", items: checkSchema },
  },
  required: ["center_key", "classical_name", "defined", "title", "work_meaning"],
  additionalProperties: false,
};

const repeatedGateThemeSchema = {
  type: "object",
  properties: {
    gate: { type: "string" },
    sources: { type: "array", items: { type: "string" } },
    title: { type: "string" },
    summary: { type: "string" },
    talent_potential: { type: "string" },
    risk_pattern: { type: "string" },
    what_to_check: { type: "array", items: checkSchema },
  },
  required: ["gate", "sources", "title", "summary"],
  additionalProperties: false,
};

function buildSpecialPayloadSchema(layerKey: CareerReadingLayerKey) {
  if (layerKey === "talent_channels") {
    return {
      type: "object",
      properties: {
        channel_talents: { type: "array", items: channelTalentSchema },
        channels_count: { type: "integer" },
      },
      required: ["channel_talents"],
      additionalProperties: false,
    };
  }
  if (layerKey === "centers_stability_and_sensitivity") {
    return {
      type: "object",
      properties: {
        center_zones: { type: "array", items: centerZoneSchema },
      },
      required: ["center_zones"],
      additionalProperties: false,
    };
  }
  if (layerKey === "repeated_themes") {
    return {
      type: "object",
      properties: {
        repeated_gate_themes: { type: "array", items: repeatedGateThemeSchema },
      },
      required: ["repeated_gate_themes"],
      additionalProperties: false,
    };
  }
  return {
    type: "object",
    properties: {},
    additionalProperties: false,
  };
}

export function buildCareerReadingLayerSchema(layerKey: CareerReadingLayerKey) {
  const catalog = CAREER_READING_LAYER_CATALOG_V1[layerKey];
  return {
    type: "object",
    properties: {
      layer_key: { type: "string", enum: [layerKey] },
      title: { type: "string", enum: [catalog.title] },
      status: statusEnum,
      ui_priority: { type: "integer", enum: [catalog.ui_priority] },
      source_facts: { type: "object", additionalProperties: true },
      base: {
        type: "object",
        properties: {
          headline: { type: "string" },
          short_summary: { type: "string" },
          detailed_explanation: { type: "string" },
          how_it_appears_at_work: { type: "string" },
          where_useful: { type: "array", items: { type: "string" } },
          strengths: { type: "array", items: pointSchema },
          risks: { type: "array", items: riskSchema },
          management_tips: { type: "array", items: { type: "string" } },
          what_to_check: { type: "array", items: checkSchema },
          sections: {
            type: "array",
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                body: { type: "string" },
                items: { type: "array", items: { type: "string" } },
              },
              required: ["title"],
              additionalProperties: false,
            },
          },
        },
        required: [
          "headline",
          "short_summary",
          "how_it_appears_at_work",
          "where_useful",
          "risks",
          "management_tips",
          "what_to_check",
        ],
        additionalProperties: false,
      },
      pro: {
        type: "object",
        properties: {
          technical_title: { type: "string" },
          classical_sources: {
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
          source_values: { type: "object", additionalProperties: true },
          connection_logic: { type: "string" },
          confidence: confidenceEnum,
          limitations: { type: "array", items: { type: "string" } },
          human_check: { type: "string" },
        },
        required: ["classical_sources", "connection_logic", "confidence"],
        additionalProperties: false,
      },
      evidence: evidenceSchema,
      summary_for_synthesis: {
        type: "object",
        properties: {
          one_sentence: { type: "string" },
          strengths: { type: "array", items: { type: "string" } },
          risks: { type: "array", items: { type: "string" } },
          conditions: { type: "array", items: { type: "string" } },
          management_focus: { type: "array", items: { type: "string" } },
          what_to_check: { type: "array", items: { type: "string" } },
        },
        required: [
          "one_sentence",
          "strengths",
          "risks",
          "conditions",
          "management_focus",
          "what_to_check",
        ],
        additionalProperties: false,
      },
      matching_summary: {
        type: "object",
        properties: {
          good_for: { type: "array", items: { type: "string" } },
          bad_for: { type: "array", items: { type: "string" } },
          role_fit_positive_signals: { type: "array", items: { type: "string" } },
          role_fit_risk_signals: { type: "array", items: { type: "string" } },
          check_in_role_fit: { type: "array", items: { type: "string" } },
        },
        required: [
          "good_for",
          "bad_for",
          "role_fit_positive_signals",
          "role_fit_risk_signals",
          "check_in_role_fit",
        ],
        additionalProperties: false,
      },
      special_payload: buildSpecialPayloadSchema(layerKey),
      qa: {
        type: "object",
        properties: {
          base_has_forbidden_hd_terms: { type: "boolean" },
          pro_has_classical_sources: { type: "boolean" },
          has_summary_for_synthesis: { type: "boolean" },
          has_matching_summary: { type: "boolean" },
          human_review_recommended: { type: "boolean" },
        },
        required: [
          "pro_has_classical_sources",
          "has_summary_for_synthesis",
          "has_matching_summary",
        ],
        additionalProperties: false,
      },
    },
    required: [
      "layer_key",
      "title",
      "status",
      "ui_priority",
      "source_facts",
      "base",
      "pro",
      "evidence",
      "summary_for_synthesis",
      "matching_summary",
      "qa",
    ],
    additionalProperties: false,
  } as const;
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

export function normalizeCareerReadingLayerForValidation(args: {
  layer: Record<string, unknown>;
  layerKey: CareerReadingLayerKey;
}): Record<string, unknown> {
  const catalog = CAREER_READING_LAYER_CATALOG_V1[args.layerKey];
  const layer = { ...args.layer };
  if (!asString(layer.layer_key)) layer.layer_key = args.layerKey;
  if (!asString(layer.title)) layer.title = catalog.title;
  if (typeof layer.ui_priority !== "number") layer.ui_priority = catalog.ui_priority;
  if (!asString(layer.status)) layer.status = "ready";
  return layer;
}

export function validateCareerReadingLayer(
  layer: Record<string, unknown>,
  layerKey: CareerReadingLayerKey,
  layerInput?: unknown,
): CareerReadingLayerValidationResult {
  const catalog = CAREER_READING_LAYER_CATALOG_V1[layerKey];

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

  const layer = parseLayerJson(rawText, args.layerKey, data, httpStatus);
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
