/**
 * hd-normalize.ts
 *
 * Shared helper: converts a raw Human Design API response into a clean,
 * typed NormalizedChart. Imported by functions that store or display HD data
 * (e.g. talent-report, future hd_charts storage, transit screen).
 *
 * Does NOT call any external API. Has no side effects.
 */

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function asString(value: unknown, fallback = ""): string {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number") return String(value);
  return fallback;
}

// ---------------------------------------------------------------------------
// Canonical 9-center list
// "Ego" is the authoritative name used by the HD API. "Heart" is an alias.
// ---------------------------------------------------------------------------

export const ALL_CENTERS = [
  "Head",
  "Ajna",
  "Throat",
  "G",
  "Ego",
  "Sacral",
  "Solar Plexus",
  "Spleen",
  "Root",
] as const;

/**
 * Map any known alias to the canonical center name.
 * Handles differences between HD API versions and language variants.
 */
export function normalizeCenterName(raw: string): string {
  const n = raw.trim();
  const lower = n.toLowerCase();
  switch (lower) {
    case "heart":
    case "heart/ego":
    case "will":
    case "will center":
      return "Ego";
    case "g center":
    case "g-center":
    case "self":
    case "identity":
      return "G";
    case "solar plexus":
    case "emotional":
    case "sp":
      return "Solar Plexus";
    case "head":        return "Head";
    case "ajna":        return "Ajna";
    case "throat":      return "Throat";
    case "g":           return "G";
    case "ego":         return "Ego";
    case "sacral":      return "Sacral";
    case "spleen":      return "Spleen";
    case "root":        return "Root";
    default:            return n;
  }
}

// ---------------------------------------------------------------------------
// NormalizedChart type
// ---------------------------------------------------------------------------

export type NormalizedChart = {
  type: string;
  profile: string;
  strategy: string;
  authority: string;
  incarnationCross: string;
  definition?: string;
  signature?: string;
  notSelfTheme?: string;

  definedCenters: string[];
  openCenters: string[];

  channelsShort: string[];
  channelsLong: string[];

  gatesAll: string[];
  gatesPersonality: string[];
  gatesDesign: string[];
  gatesBoth: string[];

  /** Which activations (personality/design + planet) contributed each gate. */
  gateSources: Record<string, string[]>;

  activations: {
    design: Record<string, string>;
    personality: Record<string, string>;
  };

  variables?: unknown;
  cognition?: string;
  determination?: string;
  motivation?: string;
  transference?: string;
  perspective?: string;
  distraction?: string;
  environment?: string;
  circuitries?: unknown;

  birthDateUtc?: string;

  /** true when centers + gates + channels + activations are all present. */
  canRenderBodygraph: boolean;
  missingForBodygraph: string[];
};

// ---------------------------------------------------------------------------
// Activation helpers
// ---------------------------------------------------------------------------

/** Converts an activation slot to a "gate.line" string.
 *  Handles: "52.3" | 52 | {gate:52, line:3} | {value:"52.3"} */
function asActivationValue(v: unknown): string {
  if (typeof v === "string") return v.trim();
  if (typeof v === "number") return String(v);
  if (v && typeof v === "object" && !Array.isArray(v)) {
    const obj = v as Record<string, unknown>;
    const gate = obj.gate ?? obj.Gate ?? obj.number ?? obj.Number;
    const line = obj.line ?? obj.Line;
    if (gate !== undefined) {
      return line !== undefined ? `${gate}.${line}` : String(gate);
    }
    if (typeof obj.value === "string") return obj.value.trim();
  }
  return "";
}

function buildActivationMap(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const rec = raw as Record<string, unknown>;
  const result: Record<string, string> = {};
  for (const [planet, val] of Object.entries(rec)) {
    const s = asActivationValue(val);
    if (s) result[planet] = s;
  }
  return result;
}

function extractActivations(root: Record<string, unknown>) {
  const actRaw = root.activations ?? root.Activations;
  if (actRaw && typeof actRaw === "object" && !Array.isArray(actRaw)) {
    const act = actRaw as Record<string, unknown>;
    const design = buildActivationMap(act.design ?? act.Design);
    const personality = buildActivationMap(act.personality ?? act.Personality);
    if (Object.keys(design).length > 0 || Object.keys(personality).length > 0) {
      return { design, personality };
    }
  }
  return {
    design: buildActivationMap(root.design ?? root.Design),
    personality: buildActivationMap(root.personality ?? root.Personality),
  };
}

function gatesFromActivationMap(map: Record<string, string>): string[] {
  const gates = new Set<string>();
  for (const val of Object.values(map)) {
    const gate = val.split(".")[0].trim();
    if (gate && !isNaN(parseInt(gate))) gates.add(gate);
  }
  return Array.from(gates).sort((a, b) => parseInt(a) - parseInt(b));
}

// ---------------------------------------------------------------------------
// Center helpers
// ---------------------------------------------------------------------------

function normalizeCenters(root: Record<string, unknown>): {
  definedCenters: string[];
  openCenters: string[];
} {
  const centers = root.centers ?? root.Centers;
  let definedCenters: string[] = [];

  if (Array.isArray(centers)) {
    definedCenters = centers
      .map((c) => normalizeCenterName(asString(c)))
      .filter(Boolean);
  } else {
    const centersObj = asRecord(centers);
    const definedRaw =
      centersObj.defined ??
      centersObj.definedCenters ??
      centersObj.defined_centers ??
      root.definedCenters ??
      root.defined_centers;

    if (Array.isArray(definedRaw)) {
      definedCenters = definedRaw
        .map((c) => normalizeCenterName(asString(c)))
        .filter(Boolean);
    } else if (Object.keys(centersObj).length > 0) {
      for (const [name, val] of Object.entries(centersObj)) {
        if (typeof val === "boolean" && val) {
          definedCenters.push(normalizeCenterName(name));
        } else if (val && typeof val === "object") {
          const cv = val as Record<string, unknown>;
          if (cv.defined === true || cv.active === true || cv.is_defined === true) {
            definedCenters.push(normalizeCenterName(name));
          }
        }
      }
    }
  }

  // Deduplicate after normalization (API might send both "Heart" and "Ego")
  definedCenters = Array.from(new Set(definedCenters));

  const definedSet = new Set(definedCenters.map((c) => c.toLowerCase()));
  const openCenters = ALL_CENTERS.filter((c) => !definedSet.has(c.toLowerCase()));
  return { definedCenters, openCenters };
}

// ---------------------------------------------------------------------------
// Channel helpers
// ---------------------------------------------------------------------------

function normalizeChannels(root: Record<string, unknown>): {
  channelsShort: string[];
  channelsLong: string[];
} {
  // channelsLong is a separate field in the HD API response.
  // Read it first as the authoritative long-name source.
  const channelsLongRaw =
    root.channelsLong ?? root.channels_long ?? root.ChannelsLong;
  const apiLong: string[] = Array.isArray(channelsLongRaw)
    ? channelsLongRaw.map((c) => asString(c)).filter(Boolean)
    : [];

  const channelsRaw =
    root.channels ??
    root.Channels ??
    root.channels_short ??
    root.channelsShort ??
    root.channel_list ??
    root.channelList;

  const channelsShort: string[] = [];
  const channelsLong: string[] = apiLong.length > 0 ? [...apiLong] : [];

  if (Array.isArray(channelsRaw)) {
    for (const c of channelsRaw) {
      if (typeof c === "string") {
        channelsShort.push(c);
      } else if (c && typeof c === "object") {
        const cv = c as Record<string, unknown>;
        const code = asString(cv.code ?? cv.id ?? cv.key ?? cv.channel);
        const name = asString(cv.name ?? cv.Name ?? cv.label);
        if (code) {
          channelsShort.push(code);
          if (name && apiLong.length === 0) channelsLong.push(`${code}: ${name}`);
        }
      }
    }
  } else if (channelsRaw && typeof channelsRaw === "object") {
    for (const [key, val] of Object.entries(channelsRaw as Record<string, unknown>)) {
      if (typeof val === "boolean") {
        if (val) channelsShort.push(key);
      } else if (val && typeof val === "object") {
        const cv = val as Record<string, unknown>;
        if (cv.defined !== false) {
          channelsShort.push(key);
          const name = asString(cv.name ?? cv.Name);
          if (name && apiLong.length === 0) channelsLong.push(`${key}: ${name}`);
        }
      } else {
        channelsShort.push(key);
      }
    }
  }

  return { channelsShort, channelsLong };
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * normalizeHdChart
 *
 * Converts the raw response from Human Design API /v2/charts/coordinates
 * into a clean NormalizedChart ready for storage, display, or bodygraph
 * rendering. Handles structural variations across API versions.
 */
export function normalizeHdChart(hdRaw: unknown): NormalizedChart {
  const outer = asRecord(hdRaw);
  const root = asRecord(outer.data ?? outer.chart ?? outer.bodygraph ?? outer);

  const type = asString(root.type ?? root.Type, "—");
  const profile = asString(root.profile ?? root.Profile, "—");
  const strategy = asString(root.strategy ?? root.Strategy, "—");
  const authority = asString(root.authority ?? root.Authority, "—");
  const incarnationCross = asString(
    root.incarnationCross ??
      root.incarnation_cross ??
      root.IncarnationCross ??
      root.cross,
    "—",
  );
  const definition = asString(root.definition ?? root.Definition) || undefined;
  const signature = asString(root.signature ?? root.Signature) || undefined;
  const notSelfTheme =
    asString(root.notSelfTheme ?? root.not_self_theme ?? root.notSelf) || undefined;

  const { definedCenters, openCenters } = normalizeCenters(root);
  const { channelsShort, channelsLong } = normalizeChannels(root);
  const activations = extractActivations(root);

  const gatesPersonality = gatesFromActivationMap(activations.personality);
  const gatesDesign = gatesFromActivationMap(activations.design);
  const designSet = new Set(gatesDesign);
  const gatesBoth = gatesPersonality.filter((g) => designSet.has(g));
  const gatesAll = Array.from(new Set([...gatesPersonality, ...gatesDesign])).sort(
    (a, b) => parseInt(a) - parseInt(b),
  );

  const gateSources: Record<string, string[]> = {};
  for (const [planet, val] of Object.entries(activations.personality)) {
    const gate = val.split(".")[0];
    if (!gate || isNaN(parseInt(gate))) continue;
    if (!gateSources[gate]) gateSources[gate] = [];
    gateSources[gate].push(`personality.${planet}`);
  }
  for (const [planet, val] of Object.entries(activations.design)) {
    const gate = val.split(".")[0];
    if (!gate || isNaN(parseInt(gate))) continue;
    if (!gateSources[gate]) gateSources[gate] = [];
    gateSources[gate].push(`design.${planet}`);
  }

  const variables = root.variables ?? root.Variables ?? undefined;
  const cognition = asString(root.cognition ?? root.Cognition) || undefined;
  const determination =
    asString(root.determination ?? root.Determination) || undefined;
  const motivation = asString(root.motivation ?? root.Motivation) || undefined;
  const transference = asString(root.transference ?? root.Transference) || undefined;
  const perspective = asString(root.perspective ?? root.Perspective) || undefined;
  const distraction = asString(root.distraction ?? root.Distraction) || undefined;
  const environment = asString(root.environment ?? root.Environment) || undefined;
  const circuitries = root.circuitries ?? root.Circuitries ?? undefined;
  const birthDateUtc =
    asString(root.birthDateUtc ?? root.birth_date_utc ?? root.birthdate_utc) ||
    undefined;

  const missing: string[] = [];
  if (definedCenters.length === 0 && gatesAll.length === 0) missing.push("centers");
  if (gatesAll.length === 0) missing.push("gates");
  if (channelsShort.length === 0) missing.push("channels");
  const hasActs =
    Object.keys(activations.design).length > 0 ||
    Object.keys(activations.personality).length > 0;
  if (!hasActs) missing.push("activations");

  return {
    type,
    profile,
    strategy,
    authority,
    incarnationCross,
    ...(definition !== undefined && { definition }),
    ...(signature !== undefined && { signature }),
    ...(notSelfTheme !== undefined && { notSelfTheme }),
    definedCenters,
    openCenters,
    channelsShort,
    channelsLong,
    gatesAll,
    gatesPersonality,
    gatesDesign,
    gatesBoth,
    gateSources,
    activations,
    ...(variables !== undefined && { variables }),
    ...(cognition !== undefined && { cognition }),
    ...(determination !== undefined && { determination }),
    ...(motivation !== undefined && { motivation }),
    ...(transference !== undefined && { transference }),
    ...(perspective !== undefined && { perspective }),
    ...(distraction !== undefined && { distraction }),
    ...(environment !== undefined && { environment }),
    ...(circuitries !== undefined && { circuitries }),
    ...(birthDateUtc !== undefined && { birthDateUtc }),
    canRenderBodygraph: missing.length === 0,
    missingForBodygraph: missing,
  };
}
