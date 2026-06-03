import type {
  HrPersonTalentMapV2,
  HrTalentMapLayerReportV2,
  HrTalentMapSynthesisBlocksV2,
} from "./types";

/** Layer architecture v0.2 catalogs/mappings (spec only; not wired to generation). */
export {
  LAYER_ARCHITECTURE_VERSION,
  PRODUCT_LAYER_CATALOG_VERSION,
} from "./talentMapLayerArchitecture";

/** Product layer adapter v0.2 (runtime 12 → product 16 + system). */
export {
  PRODUCT_LAYER_ADAPTER_VERSION,
  adaptRuntimeLayersToProductLayersV02,
} from "./productLayerAdapter";

export type {
  ProductLayerAdapterInputV02,
  ProductLayerAdapterMetaV02,
  ProductLayerAdapterResultV02,
  ProductLayerReportV02,
  ProductLayerSourceRuntimePartV02,
  ProductLayerStatusV02,
} from "./productLayerAdapter";

const V2_SCHEMA = "hr_person_talent_map_v2";
const REPORT_TYPE = "hr_person_talent_map";
const CORE_LAYERS_SPIKE_REPORT_TYPE = "hr_person_talent_map_core_layers_spike";

function parseContentRoot(raw: unknown): Record<string, unknown> | null {
  if (raw == null) return null;
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
      return null;
    } catch {
      return null;
    }
  }
  if (typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  return null;
}

function asString(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function hasLayerReportsArray(root: Record<string, unknown>): boolean {
  return Array.isArray(root.layer_reports);
}

function hasSynthesisBlocksObject(root: Record<string, unknown>): boolean {
  return isPlainObject(root.synthesis_blocks);
}

function isCoreLayersSpikeContent(root: Record<string, unknown>): boolean {
  return asString(root.report_type) === CORE_LAYERS_SPIKE_REPORT_TYPE;
}

/** Conservative v2 shape check on a parsed object root. */
export function isTalentMapV2(root: unknown): root is HrPersonTalentMapV2 {
  if (!isPlainObject(root)) return false;

  const schemaVersion = asString(root.schema_version);
  const reportType = asString(root.report_type);
  const hasV2Schema = schemaVersion === V2_SCHEMA;
  const hasReportType =
    reportType === REPORT_TYPE || reportType === CORE_LAYERS_SPIKE_REPORT_TYPE;
  const isSpike = isCoreLayersSpikeContent(root);

  if (!hasLayerReportsArray(root)) {
    return false;
  }

  if (isSpike && hasV2Schema) return true;
  if (isSpike && hasLayerReportsArray(root)) return true;

  if (!hasSynthesisBlocksObject(root)) {
    return false;
  }

  if (hasV2Schema) return true;
  if (hasReportType && hasLayerReportsArray(root) && hasSynthesisBlocksObject(root)) {
    return true;
  }

  return false;
}

/** Best-effort schema version from parsed content. */
export function getTalentMapSchemaVersion(root: unknown): string {
  if (!isPlainObject(root)) return "";
  const direct = asString(root.schema_version);
  if (direct) return direct;
  const parsed = parseContentRoot(root);
  if (parsed) return asString(parsed.schema_version);
  return "";
}

/** Whether v2 has enough structure for layered workspace rendering. */
export function isTalentMapV2Ready(root: unknown): boolean {
  const parsed = parseContentRoot(root);
  if (!parsed || !isTalentMapV2(parsed)) return false;
  const layerReports = parsed.layer_reports;
  if (!Array.isArray(layerReports) || layerReports.length === 0) return false;
  if (isCoreLayersSpikeContent(parsed)) return true;
  const synthesis = parsed.synthesis_blocks;
  if (!synthesis || typeof synthesis !== "object") return false;
  return true;
}

function normalizeLayerReports(raw: unknown): HrTalentMapLayerReportV2[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((item): item is HrTalentMapLayerReportV2 => {
    if (!isPlainObject(item)) return false;
    return asString(item.layer_key).length > 0;
  });
}

/** Extract v2 layer_reports from raw content_json (defensive). */
export function getV2LayerReports(root: unknown): HrTalentMapLayerReportV2[] {
  const parsed = parseContentRoot(root);
  if (!parsed) return [];
  if (!isTalentMapV2(parsed)) return [];
  return normalizeLayerReports(parsed.layer_reports);
}

/** Extract v2 synthesis_blocks from raw content_json (defensive). */
export function getV2SynthesisBlocks(root: unknown): HrTalentMapSynthesisBlocksV2 | null {
  const parsed = parseContentRoot(root);
  if (!parsed || !isTalentMapV2(parsed)) return null;
  const blocks = parsed.synthesis_blocks;
  if (!blocks || typeof blocks !== "object") return null;
  return blocks;
}

/** Parsed v2 root if content_json matches v2 contract. */
export function parseTalentMapV2(root: unknown): HrPersonTalentMapV2 | null {
  const parsed = parseContentRoot(root);
  if (!parsed || !isTalentMapV2(parsed)) return null;
  return parsed;
}
