/**
 * Deterministic synthesis blocks v0.1 (Stage 4.9-A).
 * Assembles six top HR blocks from product layers — no AI synthesis prompts.
 */

import {
  PRODUCT_LAYER_ADAPTER_VERSION,
  type ProductLayerReportV02,
  type ProductLayerStatusV02,
} from "./productLayerAdapter";
import {
  PRODUCT_LAYER_CATALOG_V0_2,
  SYNTHESIS_BLOCK_LAYERS_V02,
  type SynthesisBlockKeyV02,
  type TalentMapLayerKeyV02,
} from "./talentMapLayerArchitecture";
import type {
  HrTalentMapConfidence,
  HrTalentMapLayerBaseV2,
  HrTalentMapManagementPlaybook,
  HrTalentMapRiskCheck,
  HrTalentMapSectionItem,
  HrTalentMapSynthesisBlockV2,
  HrTalentMapSynthesisBlocksV2,
} from "./types";

export const SYNTHESIS_BLOCKS_VERSION_V0_1 = "synthesis_blocks_v0_1" as const;

const SYNTHESIS_BLOCK_ORDER: readonly SynthesisBlockKeyV02[] = [
  "executive_summary",
  "work_formula",
  "talents",
  "work_environment",
  "risks",
  "management",
] as const;

const BLOCK_TITLES_RU: Record<SynthesisBlockKeyV02, string> = {
  executive_summary: "Общая сводка",
  work_formula: "Рабочая формула",
  talents: "Таланты",
  work_environment: "Рабочая среда",
  risks: "Риски",
  management: "Управление",
};

const SAFE_DECISION_NOTE =
  "Используйте эту карту как набор HR-гипотез: подтвердите выводы через интервью, рабочий кейс и первые недели взаимодействия.";

const BASE_TEXT_FIELDS = [
  "short_summary",
  "detailed_explanation",
  "how_it_appears_at_work",
  "where_useful",
  "risks",
  "management_tips",
  "what_to_check",
  "good_signals",
  "warning_signals",
] as const;

type BaseTextField = (typeof BASE_TEXT_FIELDS)[number];

export type BuildSynthesisBlocksFromProductLayersV01Input = {
  product_layers: ProductLayerReportV02[];
  adapter_meta?: Record<string, unknown>;
  data_quality?: unknown;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function asString(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function isUsableLayerStatus(status: ProductLayerStatusV02): boolean {
  return status === "ready" || status === "partial" || status === "system";
}

function hasUsableBase(layer: ProductLayerReportV02 | undefined): boolean {
  if (!layer || !isUsableLayerStatus(layer.status)) return false;
  if (layer.base && BASE_TEXT_FIELDS.some((field) => baseFieldToText(layer.base?.[field]))) {
    return true;
  }
  return layer.source_runtime_parts.some(
    (part) =>
      isUsableLayerStatus(part.status) &&
      part.base &&
      BASE_TEXT_FIELDS.some((field) => baseFieldToText(part.base?.[field])),
  );
}

function objectToText(record: Record<string, unknown>): string {
  const parts = [
    asString(record.title),
    asString(record.hypothesis),
    asString(record.description),
    asString(record.how_it_may_show_up),
    asString(record.mitigation),
    asString(record.check_method),
    asString(record.good_signal),
    asString(record.warning_signal),
    asString(record.body),
    asString(record.text),
    asString(record.summary),
  ].filter(Boolean);
  return parts.join(" — ");
}

export function baseFieldToText(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (Array.isArray(value)) {
    const parts = value
      .map((item) => {
        if (typeof item === "string") return item.trim();
        if (isPlainObject(item)) return objectToText(item);
        return "";
      })
      .filter(Boolean);
    return parts.join("; ");
  }
  if (isPlainObject(value)) return objectToText(value);
  return "";
}

function collectBases(layer: ProductLayerReportV02): HrTalentMapLayerBaseV2[] {
  const bases: HrTalentMapLayerBaseV2[] = [];
  if (layer.base) bases.push(layer.base);
  for (const part of layer.source_runtime_parts) {
    if (part.base) bases.push(part.base);
  }
  return bases;
}

function readBaseField(layer: ProductLayerReportV02, field: BaseTextField): string {
  for (const base of collectBases(layer)) {
    const text = baseFieldToText(base[field]);
    if (text) return text;
  }
  return "";
}

function productLayerMap(
  productLayers: ProductLayerReportV02[],
): Map<TalentMapLayerKeyV02, ProductLayerReportV02> {
  const map = new Map<TalentMapLayerKeyV02, ProductLayerReportV02>();
  for (const layer of productLayers) {
    map.set(layer.product_layer_key, layer);
  }
  return map;
}

function resolveSourceLayers(
  blockKey: SynthesisBlockKeyV02,
): readonly TalentMapLayerKeyV02[] {
  return SYNTHESIS_BLOCK_LAYERS_V02[blockKey];
}

function collectRuntimeKeys(layers: ProductLayerReportV02[]): string[] {
  const keys = new Set<string>();
  for (const layer of layers) {
    for (const key of layer.source_runtime_layer_keys) {
      if (key) keys.add(key);
    }
    for (const part of layer.source_runtime_parts) {
      if (part.runtime_layer_key) keys.add(part.runtime_layer_key);
    }
  }
  return [...keys].sort();
}

function computeConfidence(
  sourceLayers: ProductLayerReportV02[],
  expectedKeys: readonly TalentMapLayerKeyV02[],
): HrTalentMapConfidence {
  const usable = sourceLayers.filter(hasUsableBase).length;
  const expected = expectedKeys.length;
  if (expected === 0) return "low";
  const ratio = usable / expected;
  if (ratio >= 0.7) return "high";
  if (ratio >= 0.35) return "medium";
  return "low";
}

function computeBlockStatus(
  presentLayers: ProductLayerReportV02[],
  missingKeys: string[],
  hasContent: boolean,
): "ready" | "partial" | "not_generated" {
  if (!hasContent && presentLayers.length === 0) return "not_generated";
  if (!hasContent) return "not_generated";
  const readyCount = presentLayers.filter((layer) => layer.status === "ready" || layer.status === "system").length;
  if (missingKeys.length === 0 && readyCount >= Math.ceil(presentLayers.length * 0.5)) {
    return "ready";
  }
  if (presentLayers.some(hasUsableBase)) return "partial";
  return "not_generated";
}

function buildEvidence(
  sourceLayerKeys: string[],
  sourceLayers: ProductLayerReportV02[],
  expectedKeys: readonly TalentMapLayerKeyV02[],
  adapterMeta?: Record<string, unknown>,
): NonNullable<HrTalentMapSynthesisBlockV2["evidence"]> {
  const adapterVersion =
    asString(adapterMeta?.adapter_version) || PRODUCT_LAYER_ADAPTER_VERSION;
  return {
    source_layer_keys: sourceLayerKeys,
    source_runtime_layer_keys: collectRuntimeKeys(sourceLayers),
    confidence: computeConfidence(sourceLayers, expectedKeys),
    synthesis_version: SYNTHESIS_BLOCKS_VERSION_V0_1,
    adapter_version: adapterVersion,
    generation_mode: "deterministic_from_product_layers",
  };
}

function buildQaMeta(
  missingKeys: string[],
  emptyKeys: string[],
): NonNullable<HrTalentMapSynthesisBlockV2["qa"]> {
  return {
    deterministic: true,
    ai_synthesis_generated: false,
    missing_source_layers: missingKeys.length > 0 ? missingKeys : undefined,
    empty_source_layers: emptyKeys.length > 0 ? emptyKeys : undefined,
  };
}

function wrapBlock(
  blockKey: SynthesisBlockKeyV02,
  payload: HrTalentMapSynthesisBlockV2,
  sourceLayerKeys: string[],
  sourceLayers: ProductLayerReportV02[],
  missingKeys: string[],
  emptyKeys: string[],
  adapterMeta?: Record<string, unknown>,
): HrTalentMapSynthesisBlockV2 {
  const expected = resolveSourceLayers(blockKey);
  const status = computeBlockStatus(
    sourceLayers,
    missingKeys,
    Boolean(
      asString(payload.text) ||
        asString(payload.summary) ||
        asString(payload.one_sentence) ||
        (payload.items && payload.items.length > 0) ||
        (payload.checks && payload.checks.length > 0) ||
        (payload.playbook && Object.values(payload.playbook).some((v) => asString(v))),
    ),
  );
  return {
    block_key: blockKey,
    title: BLOCK_TITLES_RU[blockKey],
    status,
    source_layer_keys: sourceLayerKeys,
    ...payload,
    evidence: buildEvidence(sourceLayerKeys, sourceLayers, expected, adapterMeta),
    qa: buildQaMeta(missingKeys, emptyKeys),
  };
}

function resolveSources(
  layerByKey: Map<TalentMapLayerKeyV02, ProductLayerReportV02>,
  blockKey: SynthesisBlockKeyV02,
): {
  sourceLayerKeys: string[];
  sourceLayers: ProductLayerReportV02[];
  missingKeys: string[];
  emptyKeys: string[];
} {
  const expected = resolveSourceLayers(blockKey);
  const sourceLayers: ProductLayerReportV02[] = [];
  const sourceLayerKeys: string[] = [];
  const missingKeys: string[] = [];
  const emptyKeys: string[] = [];

  for (const key of expected) {
    const layer = layerByKey.get(key);
    if (!layer || !isUsableLayerStatus(layer.status)) {
      missingKeys.push(key);
      continue;
    }
    sourceLayerKeys.push(key);
    sourceLayers.push(layer);
    if (!hasUsableBase(layer)) emptyKeys.push(key);
  }

  return { sourceLayerKeys, sourceLayers, missingKeys, emptyKeys };
}

function synthesisItem(title: string, body: string): HrTalentMapSectionItem | null {
  const t = title.trim();
  const b = body.trim();
  if (!b) return null;
  return { title: t || "—", body: b };
}

function layerHrTitle(key: TalentMapLayerKeyV02): string {
  return PRODUCT_LAYER_CATALOG_V0_2[key]?.hr_title ?? key;
}

function joinNonEmpty(parts: string[], separator: string): string {
  return parts.map((p) => p.trim()).filter(Boolean).join(separator);
}

function buildExecutiveSummary(
  layerByKey: Map<TalentMapLayerKeyV02, ProductLayerReportV02>,
  adapterMeta?: Record<string, unknown>,
): HrTalentMapSynthesisBlockV2 {
  const blockKey: SynthesisBlockKeyV02 = "executive_summary";
  const { sourceLayerKeys, sourceLayers, missingKeys, emptyKeys } = resolveSources(
    layerByKey,
    blockKey,
  );

  const summaryLayers = [
    "work_format",
    "decision_style",
    "main_work_axis",
    "talent_links",
  ] as const;
  const oneSentence = joinNonEmpty(
    summaryLayers
      .map((key) => {
        const layer = layerByKey.get(key);
        return layer ? readBaseField(layer, "short_summary") : "";
      })
      .filter(Boolean),
    " ",
  );

  const valueLayers = ["work_format", "task_entry", "decision_style", "work_signature"] as const;
  const mainValue = joinNonEmpty(
    valueLayers
      .map((key) => {
        const layer = layerByKey.get(key);
        if (!layer) return "";
        return (
          readBaseField(layer, "short_summary") || readBaseField(layer, "where_useful")
        );
      })
      .filter(Boolean),
    " ",
  );

  const bestUse = joinNonEmpty(
    ["work_format", "task_entry", "talent_links", "point_talents_and_strong_themes"]
      .map((key) => {
        const layer = layerByKey.get(key as TalentMapLayerKeyV02);
        return layer ? readBaseField(layer, "where_useful") : "";
      })
      .filter(Boolean),
    "; ",
  );

  const riskLayers = [
    "stability_and_risk_zones",
    "growth_tension",
    "work_environment_and_recovery",
    "data_quality",
  ] as const;
  const mainRisk = joinNonEmpty(
    riskLayers
      .map((key) => {
        const layer = layerByKey.get(key);
        return layer ? readBaseField(layer, "risks") : "";
      })
      .filter(Boolean),
    "; ",
  );

  const howToCheck = joinNonEmpty(
    ["data_quality", "decision_style", "work_format"]
      .map((key) => {
        const layer = layerByKey.get(key as TalentMapLayerKeyV02);
        return layer ? readBaseField(layer, "what_to_check") : "";
      })
      .filter(Boolean),
    "; ",
  );

  const detailLayers = [
    "work_format",
    "work_signature",
    "main_work_axis",
    "stability_and_risk_zones",
  ] as const;
  const text = joinNonEmpty(
    detailLayers
      .map((key) => {
        const layer = layerByKey.get(key);
        return layer ? readBaseField(layer, "detailed_explanation") : "";
      })
      .filter(Boolean),
    " ",
  );

  return wrapBlock(
    blockKey,
    {
      one_sentence: oneSentence || mainValue,
      main_value: mainValue || oneSentence,
      best_use: bestUse,
      main_risk: mainRisk,
      how_to_check_first: howToCheck,
      decision_note: SAFE_DECISION_NOTE,
      text: text || oneSentence || mainValue,
    },
    sourceLayerKeys,
    sourceLayers,
    missingKeys,
    emptyKeys,
    adapterMeta,
  );
}

function buildWorkFormula(
  layerByKey: Map<TalentMapLayerKeyV02, ProductLayerReportV02>,
  adapterMeta?: Record<string, unknown>,
): HrTalentMapSynthesisBlockV2 {
  const blockKey: SynthesisBlockKeyV02 = "work_formula";
  const { sourceLayerKeys, sourceLayers, missingKeys, emptyKeys } = resolveSources(
    layerByKey,
    blockKey,
  );

  const flowLayers = [
    "work_format",
    "task_entry",
    "decision_style",
    "work_signature",
    "inner_coherence",
    "main_work_axis",
    "motivation_and_focus",
  ] as const;

  const flowParts = flowLayers
    .map((key) => {
      const layer = layerByKey.get(key);
      if (!layer) return "";
      return (
        readBaseField(layer, "how_it_appears_at_work") ||
        readBaseField(layer, "short_summary")
      );
    })
    .filter(Boolean);

  const items = flowLayers
    .map((key) => {
      const layer = layerByKey.get(key);
      if (!layer) return null;
      const body =
        readBaseField(layer, "how_it_appears_at_work") ||
        readBaseField(layer, "short_summary");
      return synthesisItem(layerHrTitle(key), body);
    })
    .filter((item): item is HrTalentMapSectionItem => item != null);

  const intro =
    flowParts.length > 0
      ? `Ключевая рабочая логика кандидата складывается из нескольких слоёв: ${joinNonEmpty(flowParts, " → ")}.`
      : "";

  const text = joinNonEmpty([intro, joinNonEmpty(flowParts, " → ")], " ");

  return wrapBlock(
    blockKey,
    {
      text,
      items,
    },
    sourceLayerKeys,
    sourceLayers,
    missingKeys,
    emptyKeys,
    adapterMeta,
  );
}

function buildTalents(
  layerByKey: Map<TalentMapLayerKeyV02, ProductLayerReportV02>,
  adapterMeta?: Record<string, unknown>,
): HrTalentMapSynthesisBlockV2 {
  const blockKey: SynthesisBlockKeyV02 = "talents";
  const { sourceLayerKeys, sourceLayers, missingKeys, emptyKeys } = resolveSources(
    layerByKey,
    blockKey,
  );

  const items = sourceLayerKeys
    .map((key) => {
      const layer = layerByKey.get(key as TalentMapLayerKeyV02);
      if (!layer) return null;
      const body =
        readBaseField(layer, "short_summary") ||
        readBaseField(layer, "detailed_explanation") ||
        readBaseField(layer, "where_useful");
      return synthesisItem(layerHrTitle(key as TalentMapLayerKeyV02), body);
    })
    .filter((item): item is HrTalentMapSectionItem => item != null);

  const summary = joinNonEmpty(
    items.map((item) => item.body),
    " ",
  );

  return wrapBlock(
    blockKey,
    {
      items,
      summary,
      text: summary,
    },
    sourceLayerKeys,
    sourceLayers,
    missingKeys,
    emptyKeys,
    adapterMeta,
  );
}

function buildWorkEnvironment(
  layerByKey: Map<TalentMapLayerKeyV02, ProductLayerReportV02>,
  adapterMeta?: Record<string, unknown>,
): HrTalentMapSynthesisBlockV2 {
  const blockKey: SynthesisBlockKeyV02 = "work_environment";
  const { sourceLayerKeys, sourceLayers, missingKeys, emptyKeys } = resolveSources(
    layerByKey,
    blockKey,
  );

  const items = sourceLayerKeys
    .map((key) => {
      const layer = layerByKey.get(key as TalentMapLayerKeyV02);
      if (!layer) return null;
      const body =
        readBaseField(layer, "how_it_appears_at_work") ||
        readBaseField(layer, "where_useful") ||
        readBaseField(layer, "short_summary");
      return synthesisItem(layerHrTitle(key as TalentMapLayerKeyV02), body);
    })
    .filter((item): item is HrTalentMapSectionItem => item != null);

  const summary = joinNonEmpty(items.map((item) => item.body), " ");

  return wrapBlock(
    blockKey,
    {
      items,
      summary,
      text: summary,
    },
    sourceLayerKeys,
    sourceLayers,
    missingKeys,
    emptyKeys,
    adapterMeta,
  );
}

function riskCheckFromLayer(
  layer: ProductLayerReportV02,
  index: number,
): HrTalentMapRiskCheck | null {
  const riskText = readBaseField(layer, "risks");
  if (!riskText) return null;

  const howItMayShowUp = readBaseField(layer, "how_it_appears_at_work");
  const whatToCheck = readBaseField(layer, "what_to_check");
  const goodSignal = readBaseField(layer, "good_signals");
  const warningSignal = readBaseField(layer, "warning_signals");
  const prevention = readBaseField(layer, "management_tips");

  return {
    id: `risk-v01-${layer.product_layer_key}-${index}`,
    risk: riskText,
    how_it_may_show_up: howItMayShowUp || riskText,
    interview_check: whatToCheck,
    test_task_check: whatToCheck,
    good_signal: goodSignal,
    warning_signal: warningSignal,
    management_prevention: prevention,
    related_hypothesis_ids: [],
    confidence: "medium",
  };
}

function buildRisks(
  layerByKey: Map<TalentMapLayerKeyV02, ProductLayerReportV02>,
  adapterMeta?: Record<string, unknown>,
): HrTalentMapSynthesisBlockV2 {
  const blockKey: SynthesisBlockKeyV02 = "risks";
  const { sourceLayerKeys, sourceLayers, missingKeys, emptyKeys } = resolveSources(
    layerByKey,
    blockKey,
  );

  const items = sourceLayerKeys
    .map((key) => {
      const layer = layerByKey.get(key as TalentMapLayerKeyV02);
      if (!layer) return null;
      const body = readBaseField(layer, "risks");
      return synthesisItem(layerHrTitle(key as TalentMapLayerKeyV02), body);
    })
    .filter((item): item is HrTalentMapSectionItem => item != null);

  const checks = sourceLayers
    .map((layer, index) => riskCheckFromLayer(layer, index))
    .filter((check): check is HrTalentMapRiskCheck => check != null);

  const summary = joinNonEmpty(items.map((item) => item.body), "; ");

  return wrapBlock(
    blockKey,
    {
      items,
      checks,
      summary,
      text: summary,
    },
    sourceLayerKeys,
    sourceLayers,
    missingKeys,
    emptyKeys,
    adapterMeta,
  );
}

function buildManagement(
  layerByKey: Map<TalentMapLayerKeyV02, ProductLayerReportV02>,
  adapterMeta?: Record<string, unknown>,
): HrTalentMapSynthesisBlockV2 {
  const blockKey: SynthesisBlockKeyV02 = "management";
  const { sourceLayerKeys, sourceLayers, missingKeys, emptyKeys } = resolveSources(
    layerByKey,
    blockKey,
  );

  const items = sourceLayerKeys
    .map((key) => {
      const layer = layerByKey.get(key as TalentMapLayerKeyV02);
      if (!layer) return null;
      const body =
        readBaseField(layer, "management_tips") || readBaseField(layer, "short_summary");
      return synthesisItem(layerHrTitle(key as TalentMapLayerKeyV02), body);
    })
    .filter((item): item is HrTalentMapSectionItem => item != null);

  const taskEntry = layerByKey.get("task_entry");
  const decisionStyle = layerByKey.get("decision_style");
  const workFormat = layerByKey.get("work_format");
  const workEnv = layerByKey.get("work_environment_and_recovery");
  const stability = layerByKey.get("stability_and_risk_zones");
  const dataQuality = layerByKey.get("data_quality");

  const playbook: HrTalentMapManagementPlaybook = {
    how_to_set_tasks:
      (taskEntry && readBaseField(taskEntry, "management_tips")) ||
      (taskEntry && readBaseField(taskEntry, "short_summary")) ||
      undefined,
    how_to_give_feedback:
      (decisionStyle && readBaseField(decisionStyle, "management_tips")) || undefined,
    how_to_motivate:
      (workFormat && readBaseField(workFormat, "where_useful")) ||
      (layerByKey.get("motivation_and_focus") &&
        readBaseField(layerByKey.get("motivation_and_focus")!, "short_summary")) ||
      undefined,
    what_not_to_do:
      (stability && readBaseField(stability, "risks")) ||
      (workFormat && readBaseField(workFormat, "risks")) ||
      undefined,
    best_environment:
      (workEnv && readBaseField(workEnv, "where_useful")) ||
      (workFormat && readBaseField(workFormat, "where_useful")) ||
      undefined,
    overload_signals:
      (stability && readBaseField(stability, "how_it_appears_at_work")) ||
      (workFormat && readBaseField(workFormat, "how_it_appears_at_work")) ||
      undefined,
    first_30_days_focus:
      (dataQuality && readBaseField(dataQuality, "what_to_check")) ||
      (taskEntry && readBaseField(taskEntry, "what_to_check")) ||
      undefined,
  };

  const cleanedPlaybook = Object.fromEntries(
    Object.entries(playbook).filter(([, value]) => asString(value)),
  ) as HrTalentMapManagementPlaybook;

  return wrapBlock(
    blockKey,
    {
      items,
      playbook: Object.keys(cleanedPlaybook).length > 0 ? cleanedPlaybook : undefined,
    },
    sourceLayerKeys,
    sourceLayers,
    missingKeys,
    emptyKeys,
    adapterMeta,
  );
}

const BLOCK_BUILDERS: Record<
  SynthesisBlockKeyV02,
  (
    layerByKey: Map<TalentMapLayerKeyV02, ProductLayerReportV02>,
    adapterMeta?: Record<string, unknown>,
  ) => HrTalentMapSynthesisBlockV2
> = {
  executive_summary: buildExecutiveSummary,
  work_formula: buildWorkFormula,
  talents: buildTalents,
  work_environment: buildWorkEnvironment,
  risks: buildRisks,
  management: buildManagement,
};

/**
 * Builds six deterministic synthesis blocks from product layer view-model.
 */
export function buildSynthesisBlocksFromProductLayersV01(
  input: BuildSynthesisBlocksFromProductLayersV01Input,
): HrTalentMapSynthesisBlocksV2 {
  const layerByKey = productLayerMap(input.product_layers);
  const adapterMeta = input.adapter_meta;

  const blocks: HrTalentMapSynthesisBlocksV2 = {};
  for (const blockKey of SYNTHESIS_BLOCK_ORDER) {
    blocks[blockKey] = BLOCK_BUILDERS[blockKey](layerByKey, adapterMeta);
  }
  return blocks;
}

/** True when all six synthesis blocks have non-empty source_layer_keys and are not `not_generated`. */
export function hasAllSynthesisBlocksHaveSourcesV01(
  blocks: HrTalentMapSynthesisBlocksV2,
): boolean {
  for (const blockKey of SYNTHESIS_BLOCK_ORDER) {
    const block = blocks[blockKey];
    if (!block) return false;
    if (block.status === "not_generated") return false;
    const keys = block.source_layer_keys ?? block.evidence?.source_layer_keys ?? [];
    if (!Array.isArray(keys) || keys.length === 0) return false;
  }
  return true;
}
