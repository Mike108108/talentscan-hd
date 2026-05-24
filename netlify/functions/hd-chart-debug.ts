import type { Handler, HandlerEvent, HandlerContext } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const HD_CHARTS_COORDINATES_URL =
  "https://api.humandesignapi.nl/v2/charts/coordinates";

function jsonResponse(statusCode: number, body: unknown) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

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

function normalizeBirthTime(time: string): string {
  const match = time.match(/^(\d{1,2}):(\d{2})/);
  if (!match) throw new Error("Неверный формат времени. Ожидается HH:MM.");
  return `${match[1].padStart(2, "0")}:${match[2]}`;
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

async function verifySupabaseToken(token: string): Promise<boolean> {
  const supabaseUrl =
    process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "";
  const supabaseAnonKey =
    process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY ?? "";
  if (!supabaseUrl.trim() || !supabaseAnonKey.trim()) {
    throw new Error("supabase_not_configured");
  }
  const client = createClient(supabaseUrl, supabaseAnonKey);
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return false;
  return true;
}

// ---------------------------------------------------------------------------
// Detection helpers (audit flags)
// ---------------------------------------------------------------------------

function hasKey(obj: Record<string, unknown>, ...keys: string[]): boolean {
  return keys.some((k) => obj[k] !== undefined && obj[k] !== null);
}

function hasNonEmptyArray(obj: Record<string, unknown>, ...keys: string[]): boolean {
  for (const k of keys) {
    const v = obj[k];
    if (Array.isArray(v) && v.length > 0) return true;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      if (Object.keys(v as object).length > 0) return true;
    }
  }
  return false;
}

function detectFields(hdRaw: unknown) {
  const outer = asRecord(hdRaw);
  const root = asRecord(outer.data ?? outer.chart ?? outer.bodygraph ?? outer);
  return {
    hasCenters: hasKey(root, "centers", "Centers"),
    hasGates: hasNonEmptyArray(root, "gates", "Gates", "active_gates", "activeGates"),
    hasChannels: hasNonEmptyArray(
      root,
      "channels",
      "Channels",
      "channels_short",
      "channelsShort",
    ),
    hasActivations: hasKey(
      root,
      "activations",
      "Activations",
      "design",
      "personality",
    ),
    hasVariables: hasKey(root, "variables", "Variables", "variable"),
    hasProfile: hasKey(root, "profile", "Profile"),
    hasType: hasKey(root, "type", "Type"),
    hasAuthority: hasKey(root, "authority", "Authority"),
    hasStrategy: hasKey(root, "strategy", "Strategy"),
    hasIncarnationCross: hasKey(
      root,
      "incarnationCross",
      "incarnation_cross",
      "IncarnationCross",
      "cross",
    ),
  };
}

function getNestedDataKeys(hdRaw: unknown): string[] {
  const outer = asRecord(hdRaw);
  for (const k of ["data", "chart", "bodygraph", "root"]) {
    if (outer[k] && typeof outer[k] === "object" && !Array.isArray(outer[k])) {
      return Object.keys(outer[k] as object);
    }
  }
  return [];
}

// ---------------------------------------------------------------------------
// normalizeHdChart — converts raw HD API response to a clean, typed structure
// ready for BodyGraphViewer and transit screens.
// ---------------------------------------------------------------------------

// Canonical 9-center list. "Ego" is the authoritative name used by the HD API.
// "Heart" is an alias — see normalizeCenterName below.
const ALL_CENTERS = [
  "Head",
  "Ajna",
  "Throat",
  "G",
  "Ego",
  "Sacral",
  "Solar Plexus",
  "Spleen",
  "Root",
];

// Map known aliases to the canonical center name.
function normalizeCenterName(raw: string): string {
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
    case "head":       return "Head";
    case "ajna":       return "Ajna";
    case "throat":     return "Throat";
    case "g":          return "G";
    case "ego":        return "Ego";
    case "sacral":     return "Sacral";
    case "spleen":     return "Spleen";
    case "root":       return "Root";
    default:           return n;
  }
}

type NormalizedChart = {
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

  canRenderBodygraph: boolean;
  missingForBodygraph: string[];
};

// Converts an activation map value to a "gate.line" string.
// Handles: "52.3" | 52 | {gate:52, line:3} | {value:"52.3"} | etc.
function asActivationValue(v: unknown): string {
  if (typeof v === "string") return v.trim();
  if (typeof v === "number") return String(v);
  if (v && typeof v === "object" && !Array.isArray(v)) {
    const obj = v as Record<string, unknown>;
    // {gate, line} format
    const gate = obj.gate ?? obj.Gate ?? obj.number ?? obj.Number;
    const line = obj.line ?? obj.Line;
    if (gate !== undefined) {
      return line !== undefined ? `${gate}.${line}` : String(gate);
    }
    // {value: "52.3"} format
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
  // Try activations.design / activations.personality (nested)
  const actRaw = root.activations ?? root.Activations;
  if (actRaw && typeof actRaw === "object" && !Array.isArray(actRaw)) {
    const act = actRaw as Record<string, unknown>;
    const design = buildActivationMap(act.design ?? act.Design);
    const personality = buildActivationMap(act.personality ?? act.Personality);
    if (Object.keys(design).length > 0 || Object.keys(personality).length > 0) {
      return { design, personality };
    }
  }
  // Try root-level design / personality
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
      // {Head: true/false} or {Head: {defined: true}}
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

  // Deduplicate after normalization (e.g. API sent both "Heart" and "Ego")
  definedCenters = Array.from(new Set(definedCenters));

  const definedSet = new Set(definedCenters.map((c) => c.toLowerCase()));
  const openCenters = ALL_CENTERS.filter((c) => !definedSet.has(c.toLowerCase()));
  return { definedCenters, openCenters };
}

function normalizeChannels(root: Record<string, unknown>): {
  channelsShort: string[];
  channelsLong: string[];
} {
  // The HD API returns channelsLong as a separate array field alongside channels.
  // Read it first so we can use it as the authoritative long-name source.
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
  // Start with the API-provided long names; augment from object-format if absent.
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
          // Only augment channelsLong if not already populated from apiLong
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

function normalizeHdChart(hdRaw: unknown): NormalizedChart {
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
  const personalitySet = new Set(gatesPersonality);
  const gatesBoth = gatesPersonality.filter((g) => designSet.has(g));
  const gatesAll = Array.from(new Set([...gatesPersonality, ...gatesDesign])).sort(
    (a, b) => parseInt(a) - parseInt(b),
  );

  // Build gateSources
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

  // canRenderBodygraph check
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

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export const handler: Handler = async (
  event: HandlerEvent,
  _context: HandlerContext,
) => {
  if (event.httpMethod !== "POST") {
    return jsonResponse(405, { error: "Разрешён только метод POST." });
  }

  // ---- Auth ----------------------------------------------------------------
  const authHeader =
    event.headers["authorization"] ?? event.headers["Authorization"] ?? "";
  const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!bearerMatch) {
    return jsonResponse(401, { error: "Требуется вход в личный кабинет.", source: "auth" });
  }
  const token = bearerMatch[1];
  try {
    const valid = await verifySupabaseToken(token);
    if (!valid) {
      return jsonResponse(401, { error: "Требуется вход в личный кабинет.", source: "auth" });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg === "supabase_not_configured") {
      return jsonResponse(500, { error: "Supabase не настроен.", source: "config" });
    }
    return jsonResponse(401, { error: "Требуется вход в личный кабинет.", source: "auth" });
  }

  // ---- HD API key check ----------------------------------------------------
  const hdApiKey = process.env.HD_API_KEY;
  if (!hdApiKey) {
    return jsonResponse(500, {
      error: "Ключ Human Design API не настроен (HD_API_KEY).",
      source: "config",
    });
  }

  // ---- Parse body ----------------------------------------------------------
  let birthDate: string;
  let birthTime: string;
  let birthCity: string;
  let birthLatitude: number | undefined;
  let birthLongitude: number | undefined;

  try {
    const parsed: unknown = JSON.parse(event.body ?? "{}");
    const rec = asRecord(parsed);

    birthDate = asString(rec.birthDate ?? rec.birthdate);
    birthTime = asString(rec.birthTime ?? rec.birthtime);
    birthCity = asString(rec.birthCity ?? rec.birthcity ?? rec.birthplace ?? rec.city);

    if (!birthDate || !birthTime || !birthCity) {
      throw new Error("Укажите дату рождения, время рождения и город рождения.");
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) {
      throw new Error("Неверный формат даты. Ожидается YYYY-MM-DD.");
    }
    birthTime = normalizeBirthTime(birthTime);

    const rawLat = rec.birthLatitude ?? rec.lat ?? rec.latitude;
    const rawLng = rec.birthLongitude ?? rec.lng ?? rec.longitude;
    if (rawLat !== undefined && rawLng !== undefined) {
      birthLatitude = typeof rawLat === "number" ? rawLat : parseFloat(String(rawLat));
      birthLongitude = typeof rawLng === "number" ? rawLng : parseFloat(String(rawLng));
      if (isNaN(birthLatitude) || isNaN(birthLongitude)) {
        birthLatitude = undefined;
        birthLongitude = undefined;
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Некорректные данные.";
    return jsonResponse(400, { error: message, source: "validation" });
  }

  // ---- Coordinate resolution: NO silent fallback ---------------------------
  // If coordinates were not provided via autocomplete, require them explicitly.
  if (birthLatitude === undefined || birthLongitude === undefined) {
    return jsonResponse(400, {
      error:
        "Birth coordinates are required. Select the birth city from the autocomplete to get an accurate calculation.",
      source: "coordinates",
      hint: "Выберите город рождения из выпадающего списка для точного расчёта.",
    });
  }

  const coordinateStatus = {
    requestedCity: birthCity,
    resolvedLabel: birthCity,
    lat: birthLatitude,
    lng: birthLongitude,
    coordinateSource: "autocomplete",
    isFallback: false,
    warning: undefined as string | undefined,
  };

  // ---- Call Human Design API -----------------------------------------------
  const hdPayload = {
    birthdate: birthDate,
    birthtime: birthTime,
    lat: birthLatitude,
    lng: birthLongitude,
  };

  console.log("[hd-chart-debug] payload:", JSON.stringify(hdPayload));

  let hdRaw: unknown;
  try {
    const hdResponse = await fetch(HD_CHARTS_COORDINATES_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${hdApiKey}`,
      },
      body: JSON.stringify(hdPayload),
    });

    hdRaw = await hdResponse.json().catch(() => null);
    console.log("[hd-chart-debug] HD API status:", hdResponse.status);

    if (!hdResponse.ok) {
      const rec = asRecord(hdRaw);
      const details =
        asString(rec.message ?? rec.error ?? rec.detail ?? rec.title) ||
        `HTTP ${hdResponse.status}`;
      console.error("[hd-chart-debug] HD API error:", JSON.stringify(hdRaw, null, 2));
      return jsonResponse(502, {
        error: `Human Design API (${hdResponse.status}): ${details}`,
        source: "humandesign-api",
      });
    }

    if (!hdRaw) {
      return jsonResponse(502, {
        error: "Human Design API вернул пустой ответ.",
        source: "humandesign-api",
      });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Ошибка сети при обращении к HD API.";
    console.error("[hd-chart-debug] fetch error:", message);
    return jsonResponse(502, { error: message, source: "humandesign-api" });
  }

  // ---- Build audit response ------------------------------------------------
  const hdTopLevelKeys = Object.keys(asRecord(hdRaw));
  const hdDataKeys = getNestedDataKeys(hdRaw);
  const detected = detectFields(hdRaw);
  const normalizedChart = normalizeHdChart(hdRaw);

  return jsonResponse(200, {
    input: { birthDate, birthTime, birthCity },
    coordinates: { lat: birthLatitude, lng: birthLongitude },
    coordinateStatus,
    hdRaw,
    hdTopLevelKeys,
    hdDataKeys,
    detected,
    normalizedChart,
  });
};
