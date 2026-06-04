/**
 * Prompt Lab C0 — single-layer career reading test generation (no hr_reports write).
 */

import type { Handler, HandlerEvent } from "@netlify/functions";
import { scanCareerReadingLayerQualityV1 } from "../../src/lib/hr/careerReadingQualityScanV1";
import {
  PROMPT_LAB_STAGE,
  buildPromptLabCareerReadingRequestPreview,
  buildPromptLabMethodologyBlocks,
  jsonResponse,
  loadPromptLabCareerReadingContext,
  parsePromptLabCareerReadingBody,
  resolvePromptLabCareerReadingModelPolicy,
  buildCareerReadingModelPolicySnapshot,
} from "./hr-career-reading-prompt-lab-shared";
import { computeCostSummary } from "./hr-talent-map-v2-core-layers-shared";
import {
  callOpenAiForCareerReadingLayerWithRetry,
  normalizeCareerReadingLayerForValidation,
  resolveOpenAiApiKey,
  validateCareerReadingLayer,
  type CareerReadingOpenAiRetryExhaustedError,
} from "./hr-talent-map-v2-career-reading-layers-shared";

function serializeOpenAiLabError(err: unknown): Record<string, unknown> {
  if (err && typeof err === "object" && "message" in err) {
    const e = err as {
      message: string;
      responseStatus?: string | null;
      incompleteDetails?: unknown;
      max_output_tokens_used?: number;
      request_tuning?: unknown;
      attempts?: number;
    };
    const body: Record<string, unknown> = {
      error: e.message,
      source: "openai",
    };
    if (e.responseStatus) body.response_status = e.responseStatus;
    if (e.incompleteDetails != null) body.incomplete_details = e.incompleteDetails;
    if (typeof e.max_output_tokens_used === "number") {
      body.max_output_tokens_used = e.max_output_tokens_used;
    }
    if (e.request_tuning) body.request_tuning = e.request_tuning;
    if (typeof e.attempts === "number") body.attempts = e.attempts;
    return body;
  }
  return { error: String(err), source: "openai" };
}

export const handler: Handler = async (event: HandlerEvent) => {
  const started = Date.now();
  try {
    if (event.httpMethod !== "POST") {
      return jsonResponse(405, { error: "Разрешён только метод POST." });
    }

    let body: Record<string, unknown>;
    try {
      body = event.body ? JSON.parse(event.body) : {};
    } catch {
      return jsonResponse(400, { error: "Некорректный JSON.", source: "validation" });
    }

    const parsed = parsePromptLabCareerReadingBody(body);
    if (!parsed.ok) {
      return jsonResponse(parsed.status, { error: parsed.error, source: parsed.source });
    }
    const req = parsed.value;

    const ctx = await loadPromptLabCareerReadingContext({
      event,
      companyId: req.company_id,
      candidateId: req.candidate_id,
      layerKey: req.layer_key,
    });
    if (!ctx.ok) return ctx.response;

    const modelPolicy = resolvePromptLabCareerReadingModelPolicy({
      reasoning_effort: req.reasoning_effort,
      verbosity: req.verbosity,
      max_output_tokens: req.max_output_tokens,
    });

    const preview = buildPromptLabCareerReadingRequestPreview({
      req,
      compactInput: ctx.compactInput,
      modelPolicy,
    });

    let apiKey: string;
    try {
      apiKey = resolveOpenAiApiKey();
    } catch (err) {
      const message = err instanceof Error ? err.message : "OpenAI API key missing.";
      return jsonResponse(500, { error: message, source: "config" });
    }

    const methodologyBlocks = buildPromptLabMethodologyBlocks();

    let openAiResult: Awaited<ReturnType<typeof callOpenAiForCareerReadingLayerWithRetry>>;
    try {
      openAiResult = await callOpenAiForCareerReadingLayerWithRetry({
        apiKey,
        model: req.model,
        layerKey: req.layer_key,
        compactInput: ctx.compactInput,
        maxOutputTokens: req.max_output_tokens,
        modelPolicy,
        promptOptions: {
          include_methodology_context: req.include_methodology_context,
          methodology_prompt_block: methodologyBlocks.methodology_prompt_block,
          writing_standard_prompt_block: methodologyBlocks.writing_standard_prompt_block,
        },
      });
    } catch (err) {
      const payload = serializeOpenAiLabError(err);
      if (err && typeof err === "object" && "request_tuning" in err) {
        const exhausted = err as CareerReadingOpenAiRetryExhaustedError;
        payload.request_tuning = exhausted.request_tuning;
        payload.max_output_tokens_used = exhausted.max_output_tokens_used;
        payload.attempts = exhausted.attempts;
      }
      return jsonResponse(502, {
        ok: false,
        mode: "test",
        stage: PROMPT_LAB_STAGE,
        layer_key: req.layer_key,
        request: preview.request,
        ...payload,
      });
    }

    const layer = normalizeCareerReadingLayerForValidation({
      layer: openAiResult.layer,
      layerKey: req.layer_key,
      layerInput: ctx.compactInput.layer_input,
    });

    const validation = validateCareerReadingLayer(
      layer,
      req.layer_key,
      ctx.compactInput.layer_input,
    );

    const quality_scan = scanCareerReadingLayerQualityV1(layer);

    const usage = openAiResult.usage;
    const inputTokens = usage.input_tokens ?? 0;
    const cachedInputTokens = usage.cached_input_tokens ?? 0;
    const outputTokens = usage.output_tokens ?? 0;
    const reasoningTokens = usage.reasoning_tokens ?? 0;
    const totalTokens = usage.total_tokens ?? 0;

    const estimated_cost = computeCostSummary({
      model: req.model,
      inputTokens,
      cachedInputTokens,
      outputTokens,
      reasoningTokens,
      totalTokens,
      readyLayers: 1,
    });

    const warnings = [
      ...preview.warnings,
      ...(validation.ok ? [] : [`validation: ${validation.message}`]),
      ...(quality_scan.status === "fail" ? ["quality_scan: fail"] : []),
    ];

    return jsonResponse(200, {
      ok: true,
      mode: "test",
      stage: PROMPT_LAB_STAGE,
      layer_key: req.layer_key,
      model_policy: buildCareerReadingModelPolicySnapshot(modelPolicy),
      request: preview.request,
      output: { layer },
      validation,
      quality_scan,
      usage,
      estimated_cost,
      duration_ms: Date.now() - started,
      max_output_tokens_used: openAiResult.max_output_tokens_used,
      attempts: openAiResult.attempts,
      request_tuning: openAiResult.request_tuning,
      request_tuning_fallback: openAiResult.request_tuning_fallback,
      request_tuning_fallback_reason: openAiResult.request_tuning_fallback_reason,
      warnings,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return jsonResponse(500, {
      ok: false,
      error: message,
      source: "prompt_lab_test",
      duration_ms: Date.now() - started,
    });
  }
};
