/**
 * hd-transit-debug.ts
 *
 * Transit Debug v0.2 — Research endpoint only. Transit-only semantics.
 *
 * KEY INSIGHT: The HD API interprets birthdate/birthtime as LOCAL time at the
 * given coordinates. We resolve the IANA timezone from the "timezone anchor
 * coordinates" (natal birth coords) and convert the current UTC moment to
 * local time before calling the API.
 *
 * KEY CHANGE (v0.2): Transit gates are now derived from
 * currentMoment.activations.PERSONALITY only — not from gatesAll.
 * In Human Design, transits are planetary activations (personality layer).
 *
 * NOTE: Coordinates are used ONLY as a timezone anchor. They do NOT represent
 * the user's current physical location.
 *
 * This is NOT a production transit feature, does NOT call OpenAI, and does
 * NOT write to Supabase.
 *
 * POST /.netlify/functions/hd-transit-debug
 * Headers: Authorization: Bearer <supabase_access_token>
 * Body: {} (empty JSON object, no user input required)
 */

import type { Handler, HandlerEvent, HandlerContext } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import { normalizeHdChart } from "./hd-normalize";
// Static import so esbuild bundles tz-lookup into the Lambda output.
// tz-lookup uses `module.exports = fn`; esbuild maps that to the default export.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import tzlookupRaw from "tz-lookup";
const tzlookup = tzlookupRaw as unknown as (lat: number, lng: number) => string;

// ---------------------------------------------------------------------------
// Human Design channel map (approximate — used only for debug transit analysis)
// Each pair [g1, g2] represents one channel between two HD centers.
// Gate 20 appears in three channels (Throat connects to G, Sacral, Spleen).
// ---------------------------------------------------------------------------

const HD_CHANNELS: Array<[string, string]> = [
  ["1", "8"],   ["2", "14"],  ["3", "60"],  ["4", "63"],
  ["5", "15"],  ["6", "59"],  ["7", "31"],  ["9", "52"],
  ["10", "20"], ["11", "56"], ["12", "22"], ["13", "33"],
  ["16", "48"], ["17", "62"], ["18", "58"], ["19", "49"],
  ["20", "34"], ["20", "57"], ["21", "45"], ["23", "43"],
  ["24", "61"], ["25", "51"], ["26", "44"], ["27", "50"],
  ["28", "38"], ["29", "46"], ["30", "41"], ["32", "54"],
  ["34", "57"], ["35", "36"], ["37", "40"], ["39", "55"],
  ["42", "53"], ["47", "64"],
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function jsonResponse(statusCode: number, body: unknown) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

function asString(value: unknown, fallback = ""): string {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number") return String(value);
  return fallback;
}

function extractApiError(data: unknown, status: number): string {
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const rec = data as Record<string, unknown>;
    const message = asString(
      rec.message ?? rec.error ?? rec.detail ?? rec.title ??
        (Array.isArray(rec.errors) ? rec.errors[0] : ""),
    );
    if (message) return message;
  }
  return `HTTP ${status}`;
}

function toStringSet(arr: unknown): Set<string> {
  if (!Array.isArray(arr)) return new Set();
  return new Set(arr.map((v) => asString(v)).filter(Boolean));
}

// ---------------------------------------------------------------------------
// Transit extraction — personality layer only
// ---------------------------------------------------------------------------

type PlanetaryActivation = {
  planet: string;
  value: string;
  gate: string;
  line?: string;
};

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

// ---------------------------------------------------------------------------
// Channel analysis
// ---------------------------------------------------------------------------

function computeTransitChannelAnalysis(
  transitGates: Set<string>,
  natalGates: Set<string>,
  natalChannelCodes: Set<string>,
) {
  const combinedGates = new Set([...transitGates, ...natalGates]);

  const transitOnlyChannels: string[] = [];
  const completedByTransitChannels: string[] = [];
  const natalChannelsTouchedByTransit: string[] = [];

  for (const [g1, g2] of HD_CHANNELS) {
    const code = `${g1}-${g2}`;
    const codeAlt = `${g2}-${g1}`;
    const isNatalCh = natalChannelCodes.has(code) || natalChannelCodes.has(codeAlt);

    const tHas1 = transitGates.has(g1);
    const tHas2 = transitGates.has(g2);

    // Both gates come from transit alone
    if (tHas1 && tHas2) {
      transitOnlyChannels.push(code);
    }

    // Channel not natal, completed by natal+transit (at least one gate from transit)
    if (!isNatalCh && combinedGates.has(g1) && combinedGates.has(g2)) {
      if (tHas1 || tHas2) {
        completedByTransitChannels.push(code);
      }
    }

    // Natal channel that transit also activates
    if (isNatalCh && (tHas1 || tHas2)) {
      natalChannelsTouchedByTransit.push(code);
    }
  }

  return {
    transitOnlyChannels,
    completedByTransitChannels,
    natalChannelsTouchedByTransit,
    // Centers require a complete channel→center map that isn't included here.
    temporaryDefinedCenters: [] as string[],
    temporaryDefinedCentersStatus:
      "not_calculated_no_channel_center_map" as const,
  };
}

// ---------------------------------------------------------------------------
// Timezone resolution
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Human Design API
// ---------------------------------------------------------------------------

const HD_API_URL = "https://api.humandesignapi.nl/v2/charts/coordinates";

async function fetchCurrentMomentChart(
  localDate: string,
  localTime: string,
  lat: number,
  lng: number,
): Promise<unknown> {
  const apiKey = process.env.HD_API_KEY;
  if (!apiKey) throw new Error("Ключ Human Design API не настроен (HD_API_KEY).");

  const payload = { birthdate: localDate, birthtime: localTime, lat, lng };
  console.log("[hd-transit-debug] HD API request payload:", JSON.stringify(payload));

  const response = await fetch(HD_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  const data: unknown = await response.json().catch(() => null);
  console.log("[hd-transit-debug] HD API response status:", response.status);

  if (!response.ok) {
    console.error("[hd-transit-debug] HD API error body:", JSON.stringify(data));
    throw new Error(`Human Design API (${response.status}): ${extractApiError(data, response.status)}`);
  }

  if (!data) throw new Error("Human Design API вернул пустой ответ.");
  return data;
}

// ---------------------------------------------------------------------------
// Handler shell — catches all unhandled exceptions as structured JSON
// ---------------------------------------------------------------------------

export const handler: Handler = async (
  event: HandlerEvent,
  _context: HandlerContext,
) => {
  try {
    return await transitDebugHandler(event);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    console.error("[hd-transit-debug] unhandled exception:", message);
    if (stack) console.error("[hd-transit-debug] stack:", stack);
    return jsonResponse(500, {
      error: "Transit debug failed",
      source: "hd-transit-debug",
      details: message,
      stage: "unhandled",
    });
  }
};

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

async function transitDebugHandler(event: HandlerEvent) {
  if (event.httpMethod !== "POST") {
    return jsonResponse(405, { error: "Разрешён только метод POST." });
  }

  // ── Auth ──────────────────────────────────────────────────────────────────
  const authHeader =
    event.headers["authorization"] ?? event.headers["Authorization"] ?? "";
  const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!bearerMatch) {
    return jsonResponse(401, {
      error: "Требуется Authorization: Bearer <token>.",
      source: "auth",
    });
  }
  const token = bearerMatch[1];

  const supabaseUrl =
    process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "";
  const supabaseAnonKey =
    process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY ?? "";

  if (!supabaseUrl.trim() || !supabaseAnonKey.trim()) {
    return jsonResponse(500, { error: "Supabase не настроен на сервере.", source: "config" });
  }

  const authClient = createClient(supabaseUrl, supabaseAnonKey);
  const { data: authData, error: authErr } = await authClient.auth.getUser(token);
  if (authErr || !authData.user) {
    return jsonResponse(401, { error: "Недействительный или просроченный токен.", source: "auth" });
  }
  const userId = authData.user.id;

  const db = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  // ── Load active natal chart ───────────────────────────────────────────────
  const { data: chartRow, error: chartErr } = await db
    .from("hd_charts")
    .select(
      "id, type, profile, authority, strategy, gates_all, channels_short, defined_centers, normalized_chart_json, birth_latitude, birth_longitude",
    )
    .eq("user_id", userId)
    .eq("is_active", true)
    .eq("calculation_status", "calculated")
    .maybeSingle();

  if (chartErr) {
    console.error("[hd-transit-debug] hd_charts load error:", chartErr.message);
    return jsonResponse(500, { error: "Не удалось загрузить натальную карту.", source: "db" });
  }
  if (!chartRow) {
    return jsonResponse(404, {
      error:
        "Активная натальная карта не найдена (is_active=true, calculation_status='calculated'). " +
        "Сначала рассчитайте карту.",
      source: "natal_chart",
    });
  }

  // ── Timezone anchor coordinates ───────────────────────────────────────────
  let lat =
    typeof chartRow.birth_latitude === "number" ? chartRow.birth_latitude : null;
  let lng =
    typeof chartRow.birth_longitude === "number" ? chartRow.birth_longitude : null;
  let coordinatesSource: "hd_charts" | "user_profiles" = "hd_charts";

  if (lat === null || lng === null) {
    const { data: profileRow, error: profileErr } = await db
      .from("user_profiles")
      .select("birth_latitude, birth_longitude")
      .eq("user_id", userId)
      .maybeSingle();
    if (profileErr) {
      console.warn("[hd-transit-debug] user_profiles fallback error:", profileErr.message);
    }
    if (profileRow) {
      if (lat === null && typeof profileRow.birth_latitude === "number") {
        lat = profileRow.birth_latitude;
        coordinatesSource = "user_profiles";
      }
      if (lng === null && typeof profileRow.birth_longitude === "number") {
        lng = profileRow.birth_longitude;
        coordinatesSource = "user_profiles";
      }
    }
  }

  if (lat === null || lng === null) {
    return jsonResponse(400, {
      error:
        "Координаты рождения не найдены ни в hd_charts, ни в user_profiles. " +
        "Обновите профиль и пересчитайте карту.",
      source: "coordinates",
    });
  }

  // ── Resolve local time ────────────────────────────────────────────────────
  const now = new Date();
  const nowUtcIso = now.toISOString();

  let localDT: ReturnType<typeof resolveLocalDateTime>;
  try {
    localDT = resolveLocalDateTime(now, lat, lng);
  } catch (tzErr) {
    const msg = tzErr instanceof Error ? tzErr.message : String(tzErr);
    console.error("[hd-transit-debug] timezone lookup threw:", msg);
    return jsonResponse(500, {
      error: "Transit debug failed",
      source: "hd-transit-debug",
      details: msg,
      stage: "timezone_lookup",
    });
  }

  if (!localDT) {
    return jsonResponse(500, {
      error: "Transit debug failed",
      source: "hd-transit-debug",
      details: `Could not resolve timezone for timezone anchor coordinates (lat=${lat}, lng=${lng})`,
      stage: "timezone_lookup",
    });
  }

  const { timezone: resolvedTimezone, localDate, localTime } = localDT;
  console.log(
    `[hd-transit-debug] UTC: ${nowUtcIso} | TZ: ${resolvedTimezone} | local: ${localDate} ${localTime}`,
  );

  // ── Call Human Design API ─────────────────────────────────────────────────
  let rawCurrentMomentChart: unknown;
  try {
    rawCurrentMomentChart = await fetchCurrentMomentChart(localDate, localTime, lat, lng);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Ошибка Human Design API.";
    console.error("[hd-transit-debug] hd_api_call error:", message);
    return jsonResponse(message.includes("не настроен") ? 500 : 502, {
      error: "Transit debug failed",
      source: "hd-transit-debug",
      details: message,
      stage: "hd_api_call",
    });
  }

  // ── Normalize ─────────────────────────────────────────────────────────────
  const normalizedCurrentMomentChart = normalizeHdChart(rawCurrentMomentChart);

  // ── Natal data from stored fields ─────────────────────────────────────────
  const natalGates = toStringSet(chartRow.gates_all);
  const natalChannelCodes = toStringSet(chartRow.channels_short);
  const natalCenters = toStringSet(chartRow.defined_centers);

  const natal = {
    type: asString(chartRow.type) || undefined,
    profile: asString(chartRow.profile) || undefined,
    authority: asString(chartRow.authority) || undefined,
    strategy: asString(chartRow.strategy) || undefined,
    gatesAll: [...natalGates],
    channelsShort: [...natalChannelCodes],
    definedCenters: [...natalCenters],
  };

  // ── Transit-only: personality activations of current moment ───────────────
  const cmPersonality = normalizedCurrentMomentChart.activations.personality ?? {};
  const planetaryActivations = extractPlanetaryActivations(cmPersonality);
  const transitGatesList = gatesFromActivations(planetaryActivations);
  const transitGates = new Set(transitGatesList);

  const transitOnly = {
    source: "current_moment_personality_activations_only" as const,
    planetaryActivations,
    gates: transitGatesList,
    gatesCount: transitGatesList.length,
  };

  // ── Transit-only overlay ──────────────────────────────────────────────────
  const addedTransitGates = transitGatesList.filter((g) => !natalGates.has(g));
  const sharedTransitGates = transitGatesList.filter((g) => natalGates.has(g));

  const channelAnalysis = computeTransitChannelAnalysis(
    transitGates,
    natalGates,
    natalChannelCodes,
  );

  const transitOnlyOverlay = {
    addedTransitGates,
    sharedTransitGates,
    ...channelAnalysis,
  };

  // ── Full current moment chart (diagnostic only — not transit source) ───────
  const fullCurrentMomentChartDiagnostic = {
    warning:
      "Do not use gatesAll/channelsShort/definedCenters of full current moment chart " +
      "for transit interpretation because it may include design-layer activations.",
    gatesAllCount: normalizedCurrentMomentChart.gatesAll.length,
    channelsShortCount: normalizedCurrentMomentChart.channelsShort.length,
    definedCentersCount: normalizedCurrentMomentChart.definedCenters.length,
  };

  // ── Deprecated overlay (v0 — kept for comparison only) ───────────────────
  const legacyOverlay = {
    _deprecated: true,
    _warning:
      "This overlay was computed from gatesAll (both personality + design). " +
      "It is NOT the correct source for HD transit analysis. " +
      "Use transitOnlyOverlay instead.",
    addedGates: [...new Set(normalizedCurrentMomentChart.gatesAll)]
      .filter((g) => !natalGates.has(g)),
    sharedGates: [...new Set(normalizedCurrentMomentChart.gatesAll)]
      .filter((g) => natalGates.has(g)),
  };

  // ── Time diagnostics ──────────────────────────────────────────────────────
  const apiReturnedBirthDateUtc: string | null =
    typeof normalizedCurrentMomentChart.birthDateUtc === "string" &&
    normalizedCurrentMomentChart.birthDateUtc.trim()
      ? normalizedCurrentMomentChart.birthDateUtc.trim()
      : null;

  let differenceMinutes: number | null = null;
  let possibleTimezoneShiftDetected = false;

  if (apiReturnedBirthDateUtc !== null) {
    const diff = new Date(apiReturnedBirthDateUtc).getTime() - new Date(nowUtcIso).getTime();
    if (!isNaN(diff)) {
      differenceMinutes = Math.round(diff / 60_000);
      possibleTimezoneShiftDetected = Math.abs(differenceMinutes) > 10;
    }
  }

  console.log(
    `[hd-transit-debug] birthDateUtc=${apiReturnedBirthDateUtc}, ` +
      `diff=${differenceMinutes}min, tzShift=${possibleTimezoneShiftDetected}`,
  );

  // ── Debug block ───────────────────────────────────────────────────────────
  const debug = {
    source: "humandesignapi_v2_charts_coordinates_as_current_moment_test" as const,
    warning:
      "This is not an official transit endpoint. Current moment chart is generated through " +
      "/v2/charts/coordinates; transit-only semantics are derived from personality activations only." as const,
    savedToDatabase: false as const,
    openAiUsed: false as const,
    timeDiagnostics: {
      nowUtcIso,
      inputDate: localDate,
      inputTime: localTime,
      inputTimeBasis: "local_time_at_timezone_anchor_coordinates" as const,
      coordinatesPurpose: "timezone_anchor_not_current_location" as const,
      resolvedTimezone,
      coordinatesSource,
      lat,
      lng,
      apiReturnedBirthDateUtc,
      differenceMinutesBetweenNowUtcAndApiBirthDateUtc: differenceMinutes,
      possibleTimezoneShiftDetected,
    },
  };

  // ── Diagnostics summary ───────────────────────────────────────────────────
  let diagnosticsSummary: { currentMomentLikelyAccurate: boolean; reason: string };
  if (apiReturnedBirthDateUtc === null) {
    diagnosticsSummary = {
      currentMomentLikelyAccurate: false,
      reason: "API did not return birthDateUtc — cannot verify local time conversion.",
    };
  } else if (possibleTimezoneShiftDetected) {
    diagnosticsSummary = {
      currentMomentLikelyAccurate: false,
      reason:
        `birthDateUtc differs from now by ${differenceMinutes} min (>10 min threshold). ` +
        `Timezone anchor: ${resolvedTimezone}. Local time sent: ${localDate} ${localTime}.`,
    };
  } else {
    diagnosticsSummary = {
      currentMomentLikelyAccurate: true,
      reason:
        `birthDateUtc within ${differenceMinutes} min of now UTC. ` +
        `Timezone anchor ${resolvedTimezone}: local time ${localDate} ${localTime} correctly maps to UTC.`,
    };
  }

  // ── Accuracy status ───────────────────────────────────────────────────────
  const accuracyStatus = {
    timeMappingConfirmed: diagnosticsSummary.currentMomentLikelyAccurate,
    transitSemantics: "personality_activations_only" as const,
    currentProviderHasDedicatedTransitEndpointInDocs: false as const,
    requiresCrossProviderValidation: true as const,
    note:
      "Current provider is used via /v2/charts/coordinates as current-moment chart source. " +
      "Transit-only gates are extracted from current moment personality activations only." as const,
  };

  return jsonResponse(200, {
    natal,
    transitOnly,
    transitOnlyOverlay,
    fullCurrentMomentChartDiagnostic,
    legacyOverlay,
    debug,
    diagnosticsSummary,
    accuracyStatus,
    rawCurrentMomentChart,
    normalizedCurrentMomentChart,
  });
}
