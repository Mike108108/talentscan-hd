/**
 * Product Layer Adapter v0.2 (Stage 4.8-A.1).
 *
 * Maps current 12-layer runtime `layer_reports` to the v0.2 product layer view-model.
 * Structural merge only — no AI synthesis or invented HR copy.
 *
 * @see talentMapLayerArchitecture.ts
 * @see README_LAYER_ARCHITECTURE_V0_2.md
 */

import {
  AI_NARRATIVE_PRODUCT_LAYER_KEYS_V0_2,
  PRODUCT_LAYER_CATALOG_V0_2,
  PRODUCT_LAYER_KEYS_V0_2,
  PRODUCT_LAYER_TO_RUNTIME_CORE_LAYERS_V02,
  type ProductLayerKeyV02,
  type RuntimeCoreLayerKey,
  type SystemLayerKeyV02,
  type TalentMapLayerKeyV02,
} from "./talentMapLayerArchitecture";
import type {
  HrLayerCatalogGroup,
  HrPersonTalentMapV2,
  HrTalentMapDataQualityV2,
  HrTalentMapLayerBaseV2,
  HrTalentMapLayerEvidenceV2,
  HrTalentMapLayerProV2,
  HrTalentMapLayerReportV2,
  HrTalentMapMatchingSummaryV2,
} from "./types";

export const PRODUCT_LAYER_ADAPTER_VERSION = "product_layer_adapter_v0_2" as const;

export type ProductLayerStatusV02 =
  | "ready"
  | "partial"
  | "not_generated"
  | "planned"
  | "system"
  | "error";

export type ProductLayerSourceRuntimePartV02 = {
  runtime_layer_key: string;
  hr_title: string;
  status: ProductLayerStatusV02;
  base?: HrTalentMapLayerBaseV2;
  pro?: HrTalentMapLayerProV2;
  evidence?: HrTalentMapLayerEvidenceV2;
  matching_summary?: HrTalentMapMatchingSummaryV2;
  ui_priority?: number;
  group?: HrLayerCatalogGroup;
};

export type ProductLayerAdapterMetaV02 = {
  adapter_version?: typeof PRODUCT_LAYER_ADAPTER_VERSION;
  mapping_mode?: "1:1" | "merged" | "system_data_quality" | "missing";
  merge_mode?: "structural_sources_only";
  missing_reason?: "no_runtime_layer_yet" | "no_data_quality_payload";
  runtime_layers_found?: number;
  runtime_layers_expected?: number;
  [key: string]: unknown;
};

export type ProductLayerReportV02 = {
  product_layer_key: TalentMapLayerKeyV02;
  hr_title: string;
  group?: HrLayerCatalogGroup;
  status: ProductLayerStatusV02;
  ui_priority?: number;
  source_runtime_layer_keys: string[];
  source_runtime_parts: ProductLayerSourceRuntimePartV02[];
  base?: HrTalentMapLayerBaseV2;
  pro?: HrTalentMapLayerProV2;
  evidence?: HrTalentMapLayerEvidenceV2;
  matching_summary?: HrTalentMapMatchingSummaryV2;
  adapter_meta?: ProductLayerAdapterMetaV02;
};

export type ProductLayerAdapterResultV02 = {
  product_layers: ProductLayerReportV02[];
  ready_count: number;
  total_count: number;
  missing_product_layer_keys: TalentMapLayerKeyV02[];
  generated_product_layer_keys: ProductLayerKeyV02[];
  merged_product_layer_keys: ProductLayerKeyV02[];
  adapter_meta: ProductLayerAdapterMetaV02;
};

/** Minimal slice of content_json required by the adapter. */
export type ProductLayerAdapterInputV02 = {
  layer_reports?: unknown;
  data_quality?: unknown;
};

const MERGED_PRODUCT_LAYER_KEYS: readonly ProductLayerKeyV02[] = [
  "stability_and_risk_zones",
  "point_talents_and_strong_themes",
  "main_work_axis",
] as const;

const ONE_TO_ONE_PRODUCT_LAYER_KEYS: readonly ProductLayerKeyV02[] =
  AI_NARRATIVE_PRODUCT_LAYER_KEYS_V0_2.filter(
    (key) => !MERGED_PRODUCT_LAYER_KEYS.includes(key),
  );

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function asString(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function normalizeLayerReports(raw: unknown): HrTalentMapLayerReportV2[] {
  if (!Array.isArray(raw)) return [];
  const out: HrTalentMapLayerReportV2[] = [];
  for (const item of raw) {
    if (!isPlainObject(item)) continue;
    const layerKey = asString(item.layer_key);
    if (!layerKey) continue;
    out.push(item as HrTalentMapLayerReportV2);
  }
  return out;
}

function normalizeDataQuality(raw: unknown): HrTalentMapDataQualityV2 | undefined {
  if (!isPlainObject(raw)) return undefined;
  return raw as HrTalentMapDataQualityV2;
}

function extractAdapterInput(
  input: ProductLayerAdapterInputV02 | HrPersonTalentMapV2 | unknown,
): ProductLayerAdapterInputV02 {
  if (input == null) return {};
  if (!isPlainObject(input)) return {};
  if ("layer_reports" in input || "data_quality" in input) {
    return {
      layer_reports: input.layer_reports,
      data_quality: input.data_quality,
    };
  }
  return {};
}

function runtimeStatusToProductStatus(status: unknown): ProductLayerStatusV02 {
  const normalized = asString(status);
  if (normalized === "ready") return "ready";
  if (normalized === "partial") return "partial";
  if (normalized === "planned") return "planned";
  if (normalized === "error") return "error";
  return "not_generated";
}

function buildRuntimePart(
  report: HrTalentMapLayerReportV2,
): ProductLayerSourceRuntimePartV02 {
  return {
    runtime_layer_key: asString(report.layer_key),
    hr_title: asString(report.hr_title) || asString(report.layer_key),
    status: runtimeStatusToProductStatus(report.status),
    base: report.base,
    pro: report.pro,
    evidence: report.evidence,
    matching_summary: report.matching_summary,
    ui_priority: report.ui_priority,
    group: report.group,
  };
}

function aggregateMergedStatus(
  parts: ProductLayerSourceRuntimePartV02[],
  expectedRuntimeKeys: readonly RuntimeCoreLayerKey[],
): ProductLayerStatusV02 {
  if (parts.length === 0) return "not_generated";
  if (parts.some((part) => part.status === "error")) return "error";
  const foundKeys = new Set(parts.map((part) => part.runtime_layer_key));
  const allPresent = expectedRuntimeKeys.every((key) => foundKeys.has(key));
  const statuses = parts.map((part) => part.status);
  if (allPresent && statuses.every((status) => status === "ready")) return "ready";
  if (statuses.some((status) => status === "ready" || status === "partial")) {
    return "partial";
  }
  if (statuses.every((status) => status === "planned")) return "planned";
  return "not_generated";
}

function minUiPriority(parts: ProductLayerSourceRuntimePartV02[]): number | undefined {
  const values = parts
    .map((part) => part.ui_priority)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (values.length === 0) return undefined;
  return Math.min(...values);
}

function pickGroup(parts: ProductLayerSourceRuntimePartV02[]): HrLayerCatalogGroup | undefined {
  return parts.find((part) => part.group)?.group;
}

function buildMissingProductLayer(
  productLayerKey: TalentMapLayerKeyV02,
): ProductLayerReportV02 {
  const catalog = PRODUCT_LAYER_CATALOG_V0_2[productLayerKey];
  const isPlannedCatalog = catalog.runtime_status === "planned";
  return {
    product_layer_key: productLayerKey,
    hr_title: catalog.hr_title,
    status: isPlannedCatalog ? "planned" : "not_generated",
    source_runtime_layer_keys: [],
    source_runtime_parts: [],
    adapter_meta: {
      adapter_version: PRODUCT_LAYER_ADAPTER_VERSION,
      mapping_mode: "missing",
      missing_reason: "no_runtime_layer_yet",
    },
  };
}

function buildOneToOneProductLayer(
  productLayerKey: ProductLayerKeyV02,
  runtimeByKey: Map<string, HrTalentMapLayerReportV2>,
): ProductLayerReportV02 {
  const catalog = PRODUCT_LAYER_CATALOG_V0_2[productLayerKey];
  const runtimeKeys = PRODUCT_LAYER_TO_RUNTIME_CORE_LAYERS_V02[productLayerKey];
  const runtimeKey = runtimeKeys[0];
  const runtimeReport = runtimeKey ? runtimeByKey.get(runtimeKey) : undefined;

  if (!runtimeReport) {
    return buildMissingProductLayer(productLayerKey);
  }

  const part = buildRuntimePart(runtimeReport);
  return {
    product_layer_key: productLayerKey,
    hr_title: asString(runtimeReport.hr_title) || catalog.hr_title,
    group: runtimeReport.group,
    status: part.status,
    ui_priority: runtimeReport.ui_priority,
    source_runtime_layer_keys: [runtimeKey],
    source_runtime_parts: [part],
    base: runtimeReport.base,
    pro: runtimeReport.pro,
    evidence: runtimeReport.evidence,
    matching_summary: runtimeReport.matching_summary,
    adapter_meta: {
      adapter_version: PRODUCT_LAYER_ADAPTER_VERSION,
      mapping_mode: "1:1",
    },
  };
}

function buildMergedProductLayer(
  productLayerKey: ProductLayerKeyV02,
  runtimeByKey: Map<string, HrTalentMapLayerReportV2>,
): ProductLayerReportV02 {
  const catalog = PRODUCT_LAYER_CATALOG_V0_2[productLayerKey];
  const runtimeKeys = PRODUCT_LAYER_TO_RUNTIME_CORE_LAYERS_V02[productLayerKey];
  const parts: ProductLayerSourceRuntimePartV02[] = [];

  for (const runtimeKey of runtimeKeys) {
    const runtimeReport = runtimeByKey.get(runtimeKey);
    if (runtimeReport) {
      parts.push(buildRuntimePart(runtimeReport));
    }
  }

  if (parts.length === 0) {
    return buildMissingProductLayer(productLayerKey);
  }

  return {
    product_layer_key: productLayerKey,
    hr_title: catalog.hr_title,
    group: pickGroup(parts),
    status: aggregateMergedStatus(parts, runtimeKeys),
    ui_priority: minUiPriority(parts),
    source_runtime_layer_keys: [...runtimeKeys],
    source_runtime_parts: parts,
    adapter_meta: {
      adapter_version: PRODUCT_LAYER_ADAPTER_VERSION,
      mapping_mode: "merged",
      merge_mode: "structural_sources_only",
      runtime_layers_found: parts.length,
      runtime_layers_expected: runtimeKeys.length,
    },
  };
}

function buildDataQualityProductLayer(
  runtimeByKey: Map<string, HrTalentMapLayerReportV2>,
  dataQualityBlock: HrTalentMapDataQualityV2 | undefined,
): ProductLayerReportV02 {
  const systemKey: SystemLayerKeyV02 = "data_quality";
  const catalog = PRODUCT_LAYER_CATALOG_V0_2[systemKey];
  const runtimeReport = runtimeByKey.get(systemKey);

  if (runtimeReport) {
    const part = buildRuntimePart(runtimeReport);
    return {
      product_layer_key: systemKey,
      hr_title: asString(runtimeReport.hr_title) || catalog.hr_title,
      group: runtimeReport.group ?? "evidence_and_quality",
      status: part.status === "ready" ? "ready" : part.status,
      ui_priority: runtimeReport.ui_priority,
      source_runtime_layer_keys: [systemKey],
      source_runtime_parts: [part],
      base: runtimeReport.base,
      pro: runtimeReport.pro,
      evidence: runtimeReport.evidence,
      matching_summary: runtimeReport.matching_summary,
      adapter_meta: {
        adapter_version: PRODUCT_LAYER_ADAPTER_VERSION,
        mapping_mode: "system_data_quality",
        data_quality_from: "layer_report",
      },
    };
  }

  if (dataQualityBlock) {
    return {
      product_layer_key: systemKey,
      hr_title: catalog.hr_title,
      group: "evidence_and_quality",
      status: "system",
      source_runtime_layer_keys: [],
      source_runtime_parts: [],
      adapter_meta: {
        adapter_version: PRODUCT_LAYER_ADAPTER_VERSION,
        mapping_mode: "system_data_quality",
        data_quality_from: "content_json.data_quality",
        data_quality_payload: dataQualityBlock,
      },
    };
  }

  return {
    product_layer_key: systemKey,
    hr_title: catalog.hr_title,
    group: "evidence_and_quality",
    status: "planned",
    source_runtime_layer_keys: [],
    source_runtime_parts: [],
    adapter_meta: {
      adapter_version: PRODUCT_LAYER_ADAPTER_VERSION,
      mapping_mode: "missing",
      missing_reason: "no_data_quality_payload",
    },
  };
}

function isReadyForCount(status: ProductLayerStatusV02): boolean {
  return status === "ready";
}

function isMissingProductLayer(layer: ProductLayerReportV02): boolean {
  return layer.status === "not_generated" || layer.status === "planned";
}

function isGeneratedProductLayer(layer: ProductLayerReportV02): boolean {
  return (
    layer.product_layer_key !== "data_quality" &&
    !MERGED_PRODUCT_LAYER_KEYS.includes(layer.product_layer_key as ProductLayerKeyV02) &&
    layer.source_runtime_parts.length > 0 &&
    (layer.status === "ready" || layer.status === "partial" || layer.status === "error")
  );
}

/**
 * Adapts runtime core `layer_reports` (+ optional `data_quality`) to v0.2 product layers.
 * Never throws; returns a stable catalog-ordered view-model for UI/workspace stages.
 */
export function adaptRuntimeLayersToProductLayersV02(
  input: ProductLayerAdapterInputV02 | HrPersonTalentMapV2 | unknown,
): ProductLayerAdapterResultV02 {
  const slice = extractAdapterInput(input);
  const layerReports = normalizeLayerReports(slice.layer_reports);
  const dataQualityBlock = normalizeDataQuality(slice.data_quality);

  const runtimeByKey = new Map<string, HrTalentMapLayerReportV2>();
  for (const report of layerReports) {
    const key = asString(report.layer_key);
    if (!key || runtimeByKey.has(key)) continue;
    runtimeByKey.set(key, report);
  }

  const productLayers: ProductLayerReportV02[] = [];

  for (const productLayerKey of AI_NARRATIVE_PRODUCT_LAYER_KEYS_V0_2) {
    if (MERGED_PRODUCT_LAYER_KEYS.includes(productLayerKey)) {
      productLayers.push(buildMergedProductLayer(productLayerKey, runtimeByKey));
    } else if (ONE_TO_ONE_PRODUCT_LAYER_KEYS.includes(productLayerKey)) {
      productLayers.push(buildOneToOneProductLayer(productLayerKey, runtimeByKey));
    }
  }

  productLayers.push(buildDataQualityProductLayer(runtimeByKey, dataQualityBlock));

  const readyCount = productLayers.filter((layer) => isReadyForCount(layer.status)).length;
  const missingKeys = productLayers
    .filter(isMissingProductLayer)
    .map((layer) => layer.product_layer_key);
  const generatedKeys = productLayers
    .filter(isGeneratedProductLayer)
    .map((layer) => layer.product_layer_key as ProductLayerKeyV02);
  const mergedKeys = productLayers
    .filter((layer) =>
      MERGED_PRODUCT_LAYER_KEYS.includes(layer.product_layer_key as ProductLayerKeyV02),
    )
    .map((layer) => layer.product_layer_key as ProductLayerKeyV02);

  return {
    product_layers: productLayers,
    ready_count: readyCount,
    total_count: productLayers.length,
    missing_product_layer_keys: missingKeys,
    generated_product_layer_keys: generatedKeys,
    merged_product_layer_keys: mergedKeys,
    adapter_meta: {
      adapter_version: PRODUCT_LAYER_ADAPTER_VERSION,
      catalog_layer_count: PRODUCT_LAYER_KEYS_V0_2.length,
      runtime_layer_reports_count: layerReports.length,
      has_data_quality_block: Boolean(dataQualityBlock),
    },
  };
}
