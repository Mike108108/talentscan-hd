/**
 * hd-transit-current.ts
 *
 * Transit Current v0 — Production-like data contract for the future "Сегодня" screen.
 *
 * Transit gates: currentMoment.activations.personality only (not gatesAll).
 * Timezone: birth coordinates as timezone anchor (not current user location).
 *
 * POST /.netlify/functions/hd-transit-current
 * Headers: Authorization: Bearer <supabase_access_token>
 * Body: {} (empty JSON object)
 */

import type { Handler, HandlerEvent, HandlerContext } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import { normalizeHdChart, type NormalizedChart } from "./hd-normalize";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import tzlookupRaw from "tz-lookup";
const tzlookup = tzlookupRaw as unknown as (lat: number, lng: number) => string;

const CHANNEL_CENTER_MAP: Record<string, [string, string]> = {
  "64-47": ["Head", "Ajna"],
  "61-24": ["Head", "Ajna"],
  "63-4": ["Head", "Ajna"],
  "17-62": ["Ajna", "Throat"],
  "43-23": ["Ajna", "Throat"],
  "11-56": ["Ajna", "Throat"],
  "16-48": ["Throat", "Spleen"],
  "20-57": ["Throat", "Spleen"],
  "20-34": ["Throat", "Sacral"],
  "45-21": ["Throat", "Ego"],
  "12-22": ["Throat", "Solar Plexus"],
  "35-36": ["Throat", "Solar Plexus"],
  "31-7": ["Throat", "G"],
  "8-1": ["Throat", "G"],
  "33-13": ["Throat", "G"],
  "10-20": ["Throat", "G"],
  "25-51": ["G", "Ego"],
  "10-57": ["G", "Spleen"],
  "10-34": ["G", "Sacral"],
  "2-14": ["G", "Sacral"],
  "5-15": ["G", "Sacral"],
  "29-46": ["G", "Sacral"],
  "40-37": ["Ego", "Solar Plexus"],
  "26-44": ["Ego", "Spleen"],
  "59-6": ["Sacral", "Solar Plexus"],
  "27-50": ["Sacral", "Spleen"],
  "34-57": ["Sacral", "Spleen"],
  "3-60": ["Sacral", "Root"],
  "42-53": ["Sacral", "Root"],
  "9-52": ["Sacral", "Root"],
  "19-49": ["Root", "Solar Plexus"],
  "39-55": ["Root", "Solar Plexus"],
  "41-30": ["Root", "Solar Plexus"],
  "18-58": ["Root", "Spleen"],
  "28-38": ["Root", "Spleen"],
  "32-54": ["Root", "Spleen"],
};

const PLANET_LABELS: Record<string, string> = {
  sun: "Солнце",
  earth: "Земля",
  moon: "Луна",
  northNode: "Сев. Узел",
  southNode: "Юж. Узел",
  mercury: "Меркурий",
  venus: "Венера",
  mars: "Марс",
  jupiter: "Юпитер",
  saturn: "Сатурн",
  uranus: "Уран",
  neptune: "Нептун",
  pluto: "Плутон",
  chiron: "Хирон",
};

const HD_API_URL = "https://api.humandesignapi.nl/v2/charts/coordinates";

type PlanetaryActivation = {
  planet: string;
  value: string;
  gate: string;
  line?: string;
};

type TransitActivationResponse = {
  planet: string;
  label: string;
  value: string;
  gate: string;
  line?: string;
};

function jsonResponse(statusCode: number, body: unknown) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

function errorResponse(
  statusCode: number,
  code: string,
  message: string,
  extra?: Record<string, unknown>,
) {
  return jsonResponse(statusCode, {
    success: false,
    error: { code, message, ...extra },
  });
}

function asString(value: unknown, fallback = ""): string {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number") return String(value);
  return fallback;
}

function toStringSet(arr: unknown): Set<string> {
  if (!Array.isArray(arr)) return new Set();
  return new Set(arr.map((v) => asString(v)).filter(Boolean));
}

function toStringArray(arr: unknown): string[] {
  if (!Array.isArray(arr)) return [];
  return arr.map((v) => asString(v)).filter(Boolean);
}

function normalizeChannelKey(channel: string): string | null {
  const trimmed = channel.trim();
  if (!trimmed) return null;
  if (trimmed in CHANNEL_CENTER_MAP) return trimmed;
  const parts = trimmed.split("-");
  if (parts.length !== 2) return null;
  const reversed = `${parts[1]}-${parts[0]}`;
  if (reversed in CHANNEL_CENTER_MAP) return reversed;
  return null;
}

function parseChannelGates(channelKey: string): [string, string] | null {
  const parts = channelKey.split("-");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  return [parts[0], parts[1]];
}

function centersForChannel(channelKey: string): [string, string] | null {
  const normalized = normalizeChannelKey(channelKey);
  if (!normalized) return null;
  return CHANNEL_CENTER_MAP[normalized] ?? null;
}

function extractPlanetaryActivations(
  personalityMap: Record<string, string>,
): PlanetaryActivation[] {
  return Object.entries(personalityMap).map(([planet, value]) => {
    const [gate, line] = value.split(".");
    return { planet, value, gate: gate ?? value, ...(line ? { line } : {}) };
  });
}

function gatesFromActivations(activations: PlanetaryActivation[]): string[] {
  return Array.from(new Set(activations.map((a) => a.gate)))
    .filter((g) => g && !isNaN(parseInt(g)))
    .sort((a, b) => parseInt(a) - parseInt(b));
}

function toTransitActivations(
  activations: PlanetaryActivation[],
): TransitActivationResponse[] {
  return activations.map((a) => ({
    planet: a.planet,
    label: PLANET_LABELS[a.planet] ?? a.planet,
    value: a.value,
    gate: a.gate,
    ...(a.line ? { line: a.line } : {}),
  }));
}

function isNatalChannel(
  channelKey: string,
  natalGates: Set<string>,
  natalChannelCodes: Set<string>,
): boolean {
  const normalized = normalizeChannelKey(channelKey);
  if (!normalized) return false;
  const gates = parseChannelGates(normalized);
  if (!gates) return false;
  const [g1, g2] = gates;
  const reversed = `${g2}-${g1}`;
  if (natalChannelCodes.has(normalized) || natalChannelCodes.has(reversed)) {
    return true;
  }
  return natalGates.has(g1) && natalGates.has(g2);
}

function computeOverlay(
  transitGates: Set<string>,
  natalGates: Set<string>,
  natalChannelCodes: Set<string>,
  natalDefinedCenters: Set<string>,
) {
  const transitOnlyChannels: string[] = [];
  const completedByTransitChannels: string[] = [];
  const natalChannelsTouchedByTransit: string[] = [];

  for (const channelKey of Object.keys(CHANNEL_CENTER_MAP)) {
    const gates = parseChannelGates(channelKey);
    if (!gates) continue;
    const [g1, g2] = gates;

    const natalHasA = natalGates.has(g1);
    const natalHasB = natalGates.has(g2);
    const transitHasA = transitGates.has(g1);
    const transitHasB = transitGates.has(g2);
    const isNatalCh = isNatalChannel(channelKey, natalGates, natalChannelCodes);

    if (isNatalCh && (transitHasA || transitHasB)) {
      natalChannelsTouchedByTransit.push(channelKey);
    } else if (
      !isNatalCh &&
      !natalHasA &&
      !natalHasB &&
      transitHasA &&
      transitHasB
    ) {
      transitOnlyChannels.push(channelKey);
    } else if (
      !isNatalCh &&
      ((natalHasA && !natalHasB && transitHasB) ||
        (natalHasB && !natalHasA && transitHasA))
    ) {
      completedByTransitChannels.push(channelKey);
    }
  }

  const duplicatedBetweenTransitOnlyAndCompleted = transitOnlyChannels.filter(
    (channel) => completedByTransitChannels.includes(channel),
  );

  const temporaryChannelKeys = [
    ...transitOnlyChannels,
    ...completedByTransitChannels,
  ];

  const temporaryChannelCentersAllSet = new Set<string>();
  let channelMapComplete = true;

  for (const ch of temporaryChannelKeys) {
    const centers = centersForChannel(ch);
    if (!centers) {
      channelMapComplete = false;
      continue;
    }
    temporaryChannelCentersAllSet.add(centers[0]);
    temporaryChannelCentersAllSet.add(centers[1]);
  }

  const temporaryChannelCentersAll = [...temporaryChannelCentersAllSet].sort();
  const temporaryDefinedCenters = temporaryChannelCentersAll
    .filter((c) => !natalDefinedCenters.has(c))
    .sort();

  const temporaryDefinedCentersStatus = channelMapComplete
    ? ("calculated_with_channel_center_map" as const)
    : ("error_channel_center_map_incomplete" as const);

  const transitGatesList = [...transitGates].sort(
    (a, b) => parseInt(a) - parseInt(b),
  );

  return {
    addedTransitGates: transitGatesList.filter((g) => !natalGates.has(g)),
    sharedTransitGates: transitGatesList.filter((g) => natalGates.has(g)),
    transitOnlyChannels,
    completedByTransitChannels,
    natalChannelsTouchedByTransit,
    temporaryChannelCentersAll,
    temporaryDefinedCenters,
    temporaryDefinedCentersStatus,
    duplicatedBetweenTransitOnlyAndCompleted,
  };
}

function resolveLocalDateTime(
  utcDate: Date,
  lat: number,
  lng: number,
): { timezone: string; localDate: string; localTime: string } | null {
  let timezone: string;
  try {
    timezone = tzlookup(lat, lng);
  } catch {
    return null;
  }
  if (!timezone) return null;

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(utcDate);

  const get = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? "00";
  const hour = get("hour") === "24" ? "00" : get("hour");

  return {
    timezone,
    localDate: `${get("year")}-${get("month")}-${get("day")}`,
    localTime: `${hour}:${get("minute")}`,
  };
}

function extractProviderError(data: unknown, status: number) {
  let providerMessage = `HTTP ${status}`;
  let providerErrorCode: string | undefined;

  if (data && typeof data === "object" && !Array.isArray(data)) {
    const rec = data as Record<string, unknown>;
    providerMessage = asString(
      rec.message ?? rec.error ?? rec.detail ?? rec.title ??
        (Array.isArray(rec.errors) ? rec.errors[0] : ""),
      providerMessage,
    );
    providerErrorCode = asString(rec.code ?? rec.errorCode ?? rec.status, "") || undefined;
  }

  return { providerMessage, providerErrorCode };
}

async function fetchCurrentMomentChart(
  localDate: string,
  localTime: string,
  lat: number,
  lng: number,
): Promise<{ data: unknown; httpStatus: number }> {
  const apiKey = process.env.HD_API_KEY;
  if (!apiKey) {
    throw Object.assign(new Error("HD_API_KEY is not configured."), { code: "CONFIG" });
  }

  const response = await fetch(HD_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ birthdate: localDate, birthtime: localTime, lat, lng }),
  });

  const data: unknown = await response.json().catch(() => null);
  return { data, httpStatus: response.status };
}

function resolveNatalFromChart(
  chartId: string,
  normalized: NormalizedChart | null,
  rowGates: unknown,
  rowChannels: unknown,
  rowCenters: unknown,
) {
  if (normalized) {
    return {
      chartId,
      definedCenters: normalized.definedCenters ?? [],
      gates: normalized.gatesAll ?? [],
      channels: normalized.channelsShort ?? [],
    };
  }
  return {
    chartId,
    definedCenters: toStringArray(rowCenters),
    gates: toStringArray(rowGates),
    channels: toStringArray(rowChannels),
  };
}

function currentMomentLikelyAccurate(
  nowUtcIso: string,
  apiReturnedBirthDateUtc: string | null,
): boolean {
  if (!apiReturnedBirthDateUtc) return false;
  const diff = new Date(apiReturnedBirthDateUtc).getTime() - new Date(nowUtcIso).getTime();
  if (isNaN(diff)) return false;
  return Math.abs(Math.round(diff / 60_000)) <= 10;
}

export const handler: Handler = async (
  event: HandlerEvent,
  _context: HandlerContext,
) => {
  try {
    return await transitCurrentHandler(event);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[hd-transit-current] unhandled exception:", message);
    return errorResponse(500, "INTERNAL_ERROR", "Transit current calculation failed.");
  }
};

async function transitCurrentHandler(event: HandlerEvent) {
  if (event.httpMethod !== "POST") {
    return jsonResponse(405, { success: false, error: { code: "METHOD_NOT_ALLOWED", message: "Only POST is allowed." } });
  }

  const authHeader =
    event.headers["authorization"] ?? event.headers["Authorization"] ?? "";
  const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!bearerMatch) {
    return errorResponse(401, "UNAUTHORIZED", "Authorization is required.");
  }
  const token = bearerMatch[1];

  const supabaseUrl =
    process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "";
  const supabaseAnonKey =
    process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY ?? "";

  if (!supabaseUrl.trim() || !supabaseAnonKey.trim()) {
    return errorResponse(500, "CONFIG_ERROR", "Supabase is not configured on the server.");
  }

  const authClient = createClient(supabaseUrl, supabaseAnonKey);
  const { data: authData, error: authErr } = await authClient.auth.getUser(token);
  if (authErr || !authData.user) {
    return errorResponse(401, "UNAUTHORIZED", "Invalid or expired authorization token.");
  }
  const userId = authData.user.id;

  const db = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: chartRow, error: chartErr } = await db
    .from("hd_charts")
    .select(
      "id, gates_all, channels_short, defined_centers, normalized_chart_json, birth_latitude, birth_longitude",
    )
    .eq("user_id", userId)
    .eq("is_active", true)
    .eq("calculation_status", "calculated")
    .maybeSingle();

  if (chartErr) {
    console.error("[hd-transit-current] hd_charts load error:", chartErr.message);
    return errorResponse(500, "DB_ERROR", "Failed to load active Human Design chart.");
  }
  if (!chartRow) {
    return errorResponse(
      404,
      "NO_ACTIVE_HD_CHART",
      "Active Human Design chart was not found.",
    );
  }

  let lat =
    typeof chartRow.birth_latitude === "number" ? chartRow.birth_latitude : null;
  let lng =
    typeof chartRow.birth_longitude === "number" ? chartRow.birth_longitude : null;

  if (lat === null || lng === null) {
    const { data: profileRow } = await db
      .from("user_profiles")
      .select("birth_latitude, birth_longitude")
      .eq("user_id", userId)
      .maybeSingle();
    if (profileRow) {
      if (lat === null && typeof profileRow.birth_latitude === "number") {
        lat = profileRow.birth_latitude;
      }
      if (lng === null && typeof profileRow.birth_longitude === "number") {
        lng = profileRow.birth_longitude;
      }
    }
  }

  if (lat === null || lng === null) {
    return errorResponse(
      400,
      "MISSING_BIRTH_COORDINATES",
      "Birth coordinates are required to calculate current transit.",
    );
  }

  const now = new Date();
  const nowUtcIso = now.toISOString();
  const calculatedAt = nowUtcIso;

  let localDT: ReturnType<typeof resolveLocalDateTime>;
  try {
    localDT = resolveLocalDateTime(now, lat, lng);
  } catch {
    return errorResponse(
      500,
      "TIMEZONE_LOOKUP_FAILED",
      "Could not resolve timezone from chart coordinates.",
    );
  }

  if (!localDT) {
    return errorResponse(
      500,
      "TIMEZONE_LOOKUP_FAILED",
      "Could not resolve timezone from chart coordinates.",
    );
  }

  const { timezone: resolvedTimezone, localDate, localTime } = localDT;

  let hdResult: { data: unknown; httpStatus: number };
  try {
    hdResult = await fetchCurrentMomentChart(localDate, localTime, lat, lng);
  } catch (err) {
    const code =
      err && typeof err === "object" && "code" in err && err.code === "CONFIG"
        ? "CONFIG_ERROR"
        : "HD_API_ERROR";
    return errorResponse(
      code === "CONFIG_ERROR" ? 500 : 502,
      code,
      code === "CONFIG_ERROR"
        ? "Human Design API key is not configured."
        : "Human Design API request failed.",
    );
  }

  if (hdResult.httpStatus < 200 || hdResult.httpStatus >= 300) {
    const { providerMessage, providerErrorCode } = extractProviderError(
      hdResult.data,
      hdResult.httpStatus,
    );
    return errorResponse(502, "HD_API_ERROR", "Human Design API request failed.", {
      providerErrorCode: providerErrorCode ?? String(hdResult.httpStatus),
      providerMessage,
    });
  }

  if (!hdResult.data) {
    return errorResponse(502, "HD_API_ERROR", "Human Design API returned an empty response.");
  }

  const normalizedCurrentMoment = normalizeHdChart(hdResult.data);

  const storedNormalized =
    chartRow.normalized_chart_json &&
    typeof chartRow.normalized_chart_json === "object" &&
    !Array.isArray(chartRow.normalized_chart_json)
      ? (chartRow.normalized_chart_json as NormalizedChart)
      : null;

  const natal = resolveNatalFromChart(
    asString(chartRow.id),
    storedNormalized,
    chartRow.gates_all,
    chartRow.channels_short,
    chartRow.defined_centers,
  );

  const natalGates = toStringSet(natal.gates);
  const natalChannelCodes = toStringSet(natal.channels);
  const natalCenters = toStringSet(natal.definedCenters);

  const cmPersonality = normalizedCurrentMoment.activations.personality ?? {};
  const planetaryActivations = extractPlanetaryActivations(cmPersonality);
  const transitGatesList = gatesFromActivations(planetaryActivations);
  const transitGates = new Set(transitGatesList);

  const overlay = computeOverlay(
    transitGates,
    natalGates,
    natalChannelCodes,
    natalCenters,
  );

  const apiReturnedBirthDateUtc: string | null =
    typeof normalizedCurrentMoment.birthDateUtc === "string" &&
    normalizedCurrentMoment.birthDateUtc.trim()
      ? normalizedCurrentMoment.birthDateUtc.trim()
      : null;

  let differenceMinutes: number | null = null;
  if (apiReturnedBirthDateUtc !== null) {
    const diff =
      new Date(apiReturnedBirthDateUtc).getTime() - new Date(nowUtcIso).getTime();
    if (!isNaN(diff)) differenceMinutes = Math.round(diff / 60_000);
  }

  const momentAccurate = currentMomentLikelyAccurate(nowUtcIso, apiReturnedBirthDateUtc);
  const channelClassificationClean =
    overlay.duplicatedBetweenTransitOnlyAndCompleted.length === 0;
  const temporaryCentersCalculated =
    overlay.temporaryDefinedCentersStatus === "calculated_with_channel_center_map";

  return jsonResponse(200, {
    success: true,
    mode: "transit-current-v0",
    calculatedAt,
    provider: {
      name: "humandesignapi.nl",
      endpoint: "/v2/charts/coordinates",
      mode: "current_moment_chart_approximation",
      hasDedicatedTransitEndpointInDocs: false,
      requiresCrossProviderValidation: true,
    },
    time: {
      nowUtcIso,
      inputDate: localDate,
      inputTime: localTime,
      inputTimeBasis: "local_time_at_timezone_anchor_coordinates",
      coordinatesPurpose: "timezone_anchor_not_current_location",
      resolvedTimezone,
      apiReturnedBirthDateUtc,
      differenceMinutesBetweenNowUtcAndApiBirthDateUtc: differenceMinutes,
      currentMomentLikelyAccurate: momentAccurate,
    },
    natal,
    transit: {
      source: "current_moment_personality_activations_only",
      gates: transitGatesList,
      gatesCount: transitGatesList.length,
      planetaryActivations: toTransitActivations(planetaryActivations),
    },
    overlay,
    qualityFlags: {
      timeMappingConfirmed: momentAccurate,
      transitSemantics: "personality_activations_only",
      channelClassificationClean,
      temporaryCentersCalculated,
      providerHasDedicatedTransitEndpointInDocs: false,
      requiresCrossProviderValidation: true,
    },
    rules: {
      doNotUseGatesAllAsTransitSource: true,
      doNotUseCurrentMomentTypeAsUserType: true,
      doNotUseCurrentLocation: true,
      categoriesMutuallyExclusive: true,
    },
  });
}
