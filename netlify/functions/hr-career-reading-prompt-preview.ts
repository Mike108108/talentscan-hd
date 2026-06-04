/**
 * Prompt Lab C0 — career reading layer prompt preview (no OpenAI).
 */

import type { Handler, HandlerEvent } from "@netlify/functions";
import { HD_METHODOLOGY_BLUEPRINT_VERSION_V1 } from "../../src/lib/hr/hdMethodologyBlueprintV1";
import { CAREER_READING_WRITING_STANDARD_VERSION_V1 } from "../../src/lib/hr/careerReadingWritingStandardV1";
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

export const handler: Handler = async (event: HandlerEvent) => {
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

    const { request, warnings } = buildPromptLabCareerReadingRequestPreview({
      req,
      compactInput: ctx.compactInput,
      modelPolicy,
    });

    const methodologyBlocks = buildPromptLabMethodologyBlocks();

    return jsonResponse(200, {
      ok: true,
      mode: "preview",
      stage: PROMPT_LAB_STAGE,
      layer_key: req.layer_key,
      model_policy: buildCareerReadingModelPolicySnapshot(modelPolicy),
      request,
      compact_input: ctx.compactInput,
      methodology_blueprint: {
        version: HD_METHODOLOGY_BLUEPRINT_VERSION_V1,
        prompt_block: methodologyBlocks.methodology_prompt_block,
      },
      writing_standard: {
        version: CAREER_READING_WRITING_STANDARD_VERSION_V1,
        prompt_block: methodologyBlocks.writing_standard_prompt_block,
      },
      warnings,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return jsonResponse(500, { error: message, source: "prompt_lab_preview" });
  }
};
