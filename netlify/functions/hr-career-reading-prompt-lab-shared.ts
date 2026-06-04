/**
 * Prompt Lab C0 shared helpers (Stage 4.10-C0).
 * Preview/test only — does not mutate hr_reports or production worker.
 */

import type { HandlerEvent } from "@netlify/functions";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildHdMethodologyBlueprintPromptBlockV1 } from "../../src/lib/hr/hdMethodologyBlueprintV1";
import { buildCareerReadingWritingStandardPromptBlockV1 } from "../../src/lib/hr/careerReadingWritingStandardV1";
import {
  CAREER_READING_LAYER_KEYS_V1,
  type CareerReadingLayerKeyV1,
} from "../../src/lib/hr/careerReadingLayersV1";
import { buildCareerReadingLayerPromptV1 } from "./hr-career-reading-layer-prompts-v1";
import {
  asRecord,
  asString,
  buildCareerReadingCompactInput,
  buildCareerReadingLayerSchema,
  buildCareerReadingModelPolicySnapshot,
  createSupabaseClient,
  extractBearerToken,
  jsonResponse,
  loadActiveCandidateChart,
  requireUuid,
  resolveCareerReadingLayersModelPolicy,
  resolveSupabaseConfig,
  type CoreLayersModelPolicy,
} from "./hr-talent-map-v2-career-reading-layers-shared";

export const PROMPT_LAB_STAGE = "4.10-C0" as const;
export const PROMPT_LAB_MODEL = "gpt-5-nano" as const;

const ALLOWED_REASONING_EFFORT = new Set(["low", "medium"]);
const ALLOWED_VERBOSITY = new Set(["low", "medium", "high"]);
const ALLOWED_MAX_OUTPUT_TOKENS = new Set([8000, 12000, 16000]);

export type PromptLabCareerReadingRequest = {
  company_id: string;
  candidate_id: string;
  layer_key: CareerReadingLayerKeyV1;
  reasoning_effort: "low" | "medium";
  verbosity: "low" | "medium" | "high";
  max_output_tokens: 8000 | 12000 | 16000;
  include_methodology_context: boolean;
  model: typeof PROMPT_LAB_MODEL;
};

export function parsePromptLabCareerReadingBody(
  body: Record<string, unknown>,
):
  | { ok: true; value: PromptLabCareerReadingRequest }
  | { ok: false; status: number; error: string; source: string } {
  const modelRaw = asString(body.model);
  if (modelRaw && modelRaw !== PROMPT_LAB_MODEL) {
    return {
      ok: false,
      status: 400,
      error: "Prompt Lab C0 supports only gpt-5-nano.",
      source: "validation",
    };
  }

  let companyId: string;
  let candidateId: string;
  try {
    companyId = requireUuid(
      asString(body.company_id) || asString(body.companyId),
      "company_id",
    );
    candidateId = requireUuid(
      asString(body.candidate_id) || asString(body.candidateId),
      "candidate_id",
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid request IDs.";
    return { ok: false, status: 400, error: message, source: "validation" };
  }

  const layerKeyRaw = asString(body.layer_key) || asString(body.layerKey);
  if (!layerKeyRaw || !CAREER_READING_LAYER_KEYS_V1.includes(layerKeyRaw as CareerReadingLayerKeyV1)) {
    return {
      ok: false,
      status: 400,
      error: `Invalid layer_key. Allowed: ${CAREER_READING_LAYER_KEYS_V1.join(", ")}`,
      source: "validation",
    };
  }

  const reasoningEffortRaw =
    asString(body.reasoning_effort) || asString(body.reasoningEffort) || "low";
  if (!ALLOWED_REASONING_EFFORT.has(reasoningEffortRaw)) {
    return {
      ok: false,
      status: 400,
      error: "reasoning_effort must be low or medium.",
      source: "validation",
    };
  }

  const verbosityRaw = asString(body.verbosity) || "medium";
  if (!ALLOWED_VERBOSITY.has(verbosityRaw)) {
    return {
      ok: false,
      status: 400,
      error: "verbosity must be low, medium, or high.",
      source: "validation",
    };
  }

  const maxOutputRaw = body.max_output_tokens ?? body.maxOutputTokens ?? 8000;
  const maxOutputTokens =
    typeof maxOutputRaw === "number" ? maxOutputRaw : Number.parseInt(String(maxOutputRaw), 10);
  if (!ALLOWED_MAX_OUTPUT_TOKENS.has(maxOutputTokens as 8000 | 12000 | 16000)) {
    return {
      ok: false,
      status: 400,
      error: "max_output_tokens must be 8000, 12000, or 16000.",
      source: "validation",
    };
  }

  const includeMethodologyContext =
    body.include_methodology_context === true || body.includeMethodologyContext === true;

  return {
    ok: true,
    value: {
      company_id: companyId,
      candidate_id: candidateId,
      layer_key: layerKeyRaw as CareerReadingLayerKeyV1,
      reasoning_effort: reasoningEffortRaw as "low" | "medium",
      verbosity: verbosityRaw as "low" | "medium" | "high",
      max_output_tokens: maxOutputTokens as 8000 | 12000 | 16000,
      include_methodology_context: includeMethodologyContext,
      model: PROMPT_LAB_MODEL,
    },
  };
}

export function resolvePromptLabCareerReadingModelPolicy(overrides: {
  reasoning_effort: "low" | "medium";
  verbosity: "low" | "medium" | "high";
  max_output_tokens: 8000 | 12000 | 16000;
}): CoreLayersModelPolicy {
  const base = resolveCareerReadingLayersModelPolicy();
  const tuningWarnings = [...base.tuningWarnings];
  if (overrides.reasoning_effort === "medium") {
    tuningWarnings.push("prompt_lab: reasoning_effort=medium may increase latency and cost.");
  }
  if (overrides.reasoning_effort === "medium" && overrides.max_output_tokens === 16000) {
    tuningWarnings.push(
      "prompt_lab: medium reasoning + 16000 max_output_tokens is an expensive QA combo.",
    );
  }
  if (overrides.max_output_tokens === 16000) {
    tuningWarnings.push("prompt_lab: max_output_tokens=16000 increases output cost.");
  }

  return {
    ...base,
    selectedModel: PROMPT_LAB_MODEL,
    smokeModel: PROMPT_LAB_MODEL,
    layerModel: PROMPT_LAB_MODEL,
    reasoningModel: PROMPT_LAB_MODEL,
    reasoningEffort: overrides.reasoning_effort,
    verbosity: overrides.verbosity,
    maxOutputTokens: overrides.max_output_tokens,
    outputTokenPolicy: {
      smoke: overrides.max_output_tokens,
      layer: overrides.max_output_tokens,
    },
    tuningWarnings,
  };
}

export function buildPromptLabMethodologyBlocks(): {
  methodology_prompt_block: string;
  writing_standard_prompt_block: string;
} {
  return {
    methodology_prompt_block: buildHdMethodologyBlueprintPromptBlockV1(),
    writing_standard_prompt_block: buildCareerReadingWritingStandardPromptBlockV1(),
  };
}

export function buildPromptLabCareerReadingRequestPreview(args: {
  req: PromptLabCareerReadingRequest;
  compactInput: Record<string, unknown>;
  modelPolicy: CoreLayersModelPolicy;
}): {
  request: {
    model: string;
    reasoning_effort: string;
    verbosity: string;
    max_output_tokens: number;
    instructions: string;
    input: string;
    json_schema_name: string;
    schema: ReturnType<typeof buildCareerReadingLayerSchema>;
  };
  warnings: string[];
} {
  const blocks = buildPromptLabMethodologyBlocks();
  const prompts = buildCareerReadingLayerPromptV1({
    layer_key: args.req.layer_key,
    candidate_snapshot: args.compactInput.candidate_snapshot,
    normalized_chart_data: args.compactInput.normalized_chart_data,
    layer_input: args.compactInput.layer_input,
    include_methodology_context: args.req.include_methodology_context,
    methodology_prompt_block: blocks.methodology_prompt_block,
    writing_standard_prompt_block: blocks.writing_standard_prompt_block,
  });
  const schema = buildCareerReadingLayerSchema(args.req.layer_key);
  return {
    request: {
      model: PROMPT_LAB_MODEL,
      reasoning_effort: args.modelPolicy.reasoningEffort,
      verbosity: args.modelPolicy.verbosity,
      max_output_tokens: args.modelPolicy.maxOutputTokens,
      instructions: prompts.system,
      input: prompts.user,
      json_schema_name: prompts.json_schema_name,
      schema,
    },
    warnings: [...args.modelPolicy.tuningWarnings],
  };
}

export async function loadPromptLabCareerReadingContext(args: {
  event: HandlerEvent;
  companyId: string;
  candidateId: string;
  layerKey: CareerReadingLayerKeyV1;
}): Promise<
  | {
      ok: true;
      token: string;
      db: SupabaseClient;
      company: Record<string, unknown>;
      candidate: Record<string, unknown>;
      chart: Record<string, unknown>;
      normalizedChart: Record<string, unknown>;
      compactInput: Record<string, unknown>;
    }
  | { ok: false; response: ReturnType<typeof jsonResponse> }
> {
  const token = extractBearerToken(args.event);
  if (!token) {
    return {
      ok: false,
      response: jsonResponse(401, { error: "Требуется вход.", source: "auth" }),
    };
  }

  let supabaseUrl: string;
  let supabaseAnonKey: string;
  try {
    ({ url: supabaseUrl, anonKey: supabaseAnonKey } = resolveSupabaseConfig());
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid Supabase configuration.";
    return {
      ok: false,
      response: jsonResponse(500, { error: message, source: "config" }),
    };
  }

  const authClient = createSupabaseClient(supabaseUrl, supabaseAnonKey);
  const { data: authData, error: authErr } = await authClient.auth.getUser(token);
  if (authErr || !authData.user) {
    return {
      ok: false,
      response: jsonResponse(401, { error: "Требуется вход.", source: "auth" }),
    };
  }

  const db = createSupabaseClient(supabaseUrl, supabaseAnonKey, token);

  const { data: company, error: companyErr } = await db
    .from("hr_companies")
    .select("id, owner_user_id, name, industry")
    .eq("id", args.companyId)
    .maybeSingle();

  if (companyErr || !company) {
    return {
      ok: false,
      response: jsonResponse(404, { error: "Компания не найдена.", source: "company" }),
    };
  }

  const { data: candidate, error: candErr } = await db
    .from("hr_candidates")
    .select("*")
    .eq("id", args.candidateId)
    .eq("company_id", args.companyId)
    .maybeSingle();

  if (candErr || !candidate) {
    return {
      ok: false,
      response: jsonResponse(404, { error: "Кандидат не найден.", source: "candidate" }),
    };
  }

  const { chart, error: chartLoadErr } = await loadActiveCandidateChart(
    db,
    args.companyId,
    args.candidateId,
  );
  if (chartLoadErr || !chart) {
    return {
      ok: false,
      response: jsonResponse(400, {
        error: "Сначала рассчитайте карту кандидата.",
        source: "chart",
      }),
    };
  }

  const normalizedChart =
    chart.normalized_chart_data && typeof chart.normalized_chart_data === "object"
      ? (chart.normalized_chart_data as Record<string, unknown>)
      : null;

  if (!normalizedChart) {
    return {
      ok: false,
      response: jsonResponse(400, {
        error: "У кандидата нет normalized_chart_data.",
        source: "chart",
        stage: "missing_normalized_chart_data",
      }),
    };
  }

  const compactInput = buildCareerReadingCompactInput({
    layerKey: args.layerKey,
    candidate: candidate as Record<string, unknown>,
    company: company as Record<string, unknown>,
    normalizedChart,
  });

  return {
    ok: true,
    token,
    db,
    company: company as Record<string, unknown>,
    candidate: candidate as Record<string, unknown>,
    chart: chart as Record<string, unknown>,
    normalizedChart,
    compactInput,
  };
}

export {
  buildCareerReadingModelPolicySnapshot,
  extractBearerToken,
  jsonResponse,
};
