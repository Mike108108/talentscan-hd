/**
 * hd-transit-debug.ts
 *
 * Transit Debug v0 — Research endpoint only.
 *
 * Tests whether /v2/charts/coordinates can serve as a "current moment" chart
 * source for future transit logic. The HD API interprets birthdate/birthtime
 * as LOCAL time at the given coordinates, so we resolve the IANA timezone
 * from the "timezone anchor coordinates" (natal birth coords) and convert the
 * current UTC moment to local time before calling the API.
 *
 * NOTE: The coordinates are used ONLY as a timezone anchor to correctly
 * represent the current UTC moment as local time. They do NOT represent the
 * user's current physical location.
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
// No @types package exists — cast after import.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import tzlookupRaw from "tz-lookup";
const tzlookup = tzlookupRaw as unknown as (lat: number, lng: number) => string;

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

// ---------------------------------------------------------------------------
// Timezone resolution
// ---------------------------------------------------------------------------

/**
 * Resolve IANA timezone string from coordinates using tz-lookup, then
 * convert the given UTC Date to local date (YYYY-MM-DD) and time (HH:mm)
 * in that timezone using Node.js Intl API.
 */
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

  const year = get("year");
  const month = get("month");
  const day = get("day");
  // Intl can return "24" for midnight edge case — normalise to "00"
  const hour = get("hour") === "24" ? "00" : get("hour");
  const minute = get("minute");

  return {
    timezone,
    localDate: `${year}-${month}-${day}`,
    localTime: `${hour}:${minute}`,
  };
}

// ---------------------------------------------------------------------------
// Human Design API call
// ---------------------------------------------------------------------------

const HD_API_URL = "https://api.humandesignapi.nl/v2/charts/coordinates";

async function fetchCurrentMomentChart(
  localDate: string,
  localTime: string,
  lat: number,
  lng: number,
): Promise<unknown> {
  const apiKey = process.env.HD_API_KEY;
  if (!apiKey) {
    throw new Error("Ключ Human Design API не настроен (HD_API_KEY).");
  }

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
    const details = extractApiError(data, response.status);
    console.error("[hd-transit-debug] HD API error body:", JSON.stringify(data));
    throw new Error(`Human Design API (${response.status}): ${details}`);
  }

  if (!data) throw new Error("Human Design API вернул пустой ответ.");
  return data;
}

// ---------------------------------------------------------------------------
// Overlay computation
// ---------------------------------------------------------------------------

function toStringSet(arr: unknown): Set<string> {
  if (!Array.isArray(arr)) return new Set();
  return new Set(arr.map((v) => asString(v)).filter(Boolean));
}

function computeOverlay(
  natalGates: Set<string>,
  natalChannels: Set<string>,
  natalCenters: Set<string>,
  currentGates: Set<string>,
  currentChannels: Set<string>,
  currentCenters: Set<string>,
) {
  return {
    addedGates: [...currentGates].filter((g) => !natalGates.has(g)),
    sharedGates: [...currentGates].filter((g) => natalGates.has(g)),
    addedChannels: [...currentChannels].filter((c) => !natalChannels.has(c)),
    sharedChannels: [...currentChannels].filter((c) => natalChannels.has(c)),
    addedDefinedCenters: [...currentCenters].filter((c) => !natalCenters.has(c)),
    sharedDefinedCenters: [...currentCenters].filter((c) => natalCenters.has(c)),
  };
}

// ---------------------------------------------------------------------------
// Handler
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
    return jsonResponse(500, {
      error: "Supabase не настроен на сервере.",
      source: "config",
    });
  }

  const authClient = createClient(supabaseUrl, supabaseAnonKey);
  const { data: authData, error: authErr } = await authClient.auth.getUser(token);
  if (authErr || !authData.user) {
    return jsonResponse(401, {
      error: "Недействительный или просроченный токен.",
      source: "auth",
    });
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
    return jsonResponse(500, {
      error: "Не удалось загрузить натальную карту.",
      source: "db",
    });
  }

  if (!chartRow) {
    return jsonResponse(404, {
      error:
        "Активная натальная карта не найдена (is_active=true, calculation_status='calculated'). " +
        "Сначала рассчитайте карту.",
      source: "natal_chart",
    });
  }

  // ── Resolve timezone anchor coordinates ───────────────────────────────────
  let lat =
    typeof chartRow.birth_latitude === "number" ? chartRow.birth_latitude : null;
  let lng =
    typeof chartRow.birth_longitude === "number" ? chartRow.birth_longitude : null;
  let coordinatesSource: "hd_charts" | "user_profiles" = "hd_charts";

  // Fallback: user_profiles if coordinates are missing from hd_charts
  if (lat === null || lng === null) {
    const { data: profileRow, error: profileErr } = await db
      .from("user_profiles")
      .select("birth_latitude, birth_longitude")
      .eq("user_id", userId)
      .maybeSingle();

    if (profileErr) {
      console.warn(
        "[hd-transit-debug] user_profiles fallback error:",
        profileErr.message,
      );
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

  // ── Resolve local time at timezone anchor coordinates ─────────────────────
  const now = new Date();
  const nowUtcIso = now.toISOString();

  let localDT: ReturnType<typeof resolveLocalDateTime>;
  try {
    localDT = resolveLocalDateTime(now, lat, lng);
  } catch (tzErr) {
    const msg = tzErr instanceof Error ? tzErr.message : String(tzErr);
    console.error("[hd-transit-debug] timezone lookup threw:", msg);
    if (tzErr instanceof Error && tzErr.stack) {
      console.error("[hd-transit-debug] tz stack:", tzErr.stack);
    }
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
      details:
        `Could not resolve timezone for timezone anchor coordinates (lat=${lat}, lng=${lng})`,
      stage: "timezone_lookup",
    });
  }

  const { timezone: resolvedTimezone, localDate, localTime } = localDT;

  console.log(
    `[hd-transit-debug] now UTC: ${nowUtcIso}`,
    `| timezone anchor: ${resolvedTimezone} (lat=${lat}, lng=${lng})`,
    `| local: ${localDate} ${localTime}`,
  );

  // ── Call Human Design API with local time ─────────────────────────────────
  let rawCurrentMomentChart: unknown;
  try {
    rawCurrentMomentChart = await fetchCurrentMomentChart(
      localDate,
      localTime,
      lat,
      lng,
    );
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Ошибка Human Design API.";
    console.error("[hd-transit-debug] hd_api_call error:", message);
    const isConfig = message.includes("не настроен");
    return jsonResponse(isConfig ? 500 : 502, {
      error: "Transit debug failed",
      source: "hd-transit-debug",
      details: message,
      stage: "hd_api_call",
    });
  }

  // ── Normalize current moment chart ────────────────────────────────────────
  const normalizedCurrentMomentChart = normalizeHdChart(rawCurrentMomentChart);

  // ── Build natal summary from stored fields ────────────────────────────────
  const natalGatesAll = toStringSet(chartRow.gates_all);
  const natalChannels = toStringSet(chartRow.channels_short);
  const natalCenters = toStringSet(chartRow.defined_centers);

  const natal = {
    type: asString(chartRow.type) || undefined,
    profile: asString(chartRow.profile) || undefined,
    authority: asString(chartRow.authority) || undefined,
    strategy: asString(chartRow.strategy) || undefined,
    gatesAll: [...natalGatesAll],
    channelsShort: [...natalChannels],
    definedCenters: [...natalCenters],
  };

  // ── Build current moment summary from normalized ──────────────────────────
  const cmGates = toStringSet(normalizedCurrentMomentChart.gatesAll);
  const cmChannels = toStringSet(normalizedCurrentMomentChart.channelsShort);
  const cmCenters = toStringSet(normalizedCurrentMomentChart.definedCenters);

  const currentMoment = {
    calculatedAt: nowUtcIso,
    inputDate: localDate,
    inputTime: localTime,
    lat,
    lng,
    type: normalizedCurrentMomentChart.type !== "—"
      ? normalizedCurrentMomentChart.type
      : undefined,
    profile: normalizedCurrentMomentChart.profile !== "—"
      ? normalizedCurrentMomentChart.profile
      : undefined,
    authority: normalizedCurrentMomentChart.authority !== "—"
      ? normalizedCurrentMomentChart.authority
      : undefined,
    strategy: normalizedCurrentMomentChart.strategy !== "—"
      ? normalizedCurrentMomentChart.strategy
      : undefined,
    gatesAll: [...cmGates],
    channelsShort: [...cmChannels],
    definedCenters: [...cmCenters],
    activations: normalizedCurrentMomentChart.activations as unknown,
  };

  // ── Compute overlay ───────────────────────────────────────────────────────
  const overlay = computeOverlay(
    natalGatesAll,
    natalChannels,
    natalCenters,
    cmGates,
    cmChannels,
    cmCenters,
  );

  // ── Time diagnostics ──────────────────────────────────────────────────────
  const apiReturnedBirthDateUtc: string | null =
    typeof normalizedCurrentMomentChart.birthDateUtc === "string" &&
    normalizedCurrentMomentChart.birthDateUtc.trim()
      ? normalizedCurrentMomentChart.birthDateUtc.trim()
      : null;

  let differenceMinutes: number | null = null;
  let possibleTimezoneShiftDetected = false;

  if (apiReturnedBirthDateUtc !== null) {
    const apiBirthMs = new Date(apiReturnedBirthDateUtc).getTime();
    const nowMs = new Date(nowUtcIso).getTime();
    if (!isNaN(apiBirthMs)) {
      differenceMinutes = Math.round((apiBirthMs - nowMs) / 60_000);
      possibleTimezoneShiftDetected = Math.abs(differenceMinutes) > 10;
    }
  }

  console.log(
    `[hd-transit-debug] timeDiagnostics: apiReturnedBirthDateUtc=${apiReturnedBirthDateUtc},`,
    `differenceMinutes=${differenceMinutes},`,
    `possibleTimezoneShiftDetected=${possibleTimezoneShiftDetected}`,
  );

  // ── Debug metadata ────────────────────────────────────────────────────────
  const debug = {
    source: "humandesignapi_v2_charts_coordinates_as_current_moment_test" as const,
    warning:
      "This is not confirmed transit API. This endpoint is being tested as a current-moment chart source." as const,
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
      reason:
        "API did not return birthDateUtc — cannot verify whether local time conversion was correct.",
    };
  } else if (possibleTimezoneShiftDetected) {
    diagnosticsSummary = {
      currentMomentLikelyAccurate: false,
      reason:
        `birthDateUtc returned by API differs from now by ${differenceMinutes} min (>10 min threshold). ` +
        `Timezone anchor: ${resolvedTimezone}. Local time sent: ${localDate} ${localTime}.`,
    };
  } else {
    diagnosticsSummary = {
      currentMomentLikelyAccurate: true,
      reason:
        `birthDateUtc returned by API is within ${differenceMinutes} min of now UTC. ` +
        `Timezone anchor ${resolvedTimezone}: local time ${localDate} ${localTime} correctly maps to UTC.`,
    };
  }

  return jsonResponse(200, {
    natal,
    currentMoment,
    overlay,
    debug,
    diagnosticsSummary,
    rawCurrentMomentChart,
    normalizedCurrentMomentChart,
  });
}
