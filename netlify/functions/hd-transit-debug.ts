/**
 * hd-transit-debug.ts
 *
 * Transit Debug v0 — Research endpoint only.
 *
 * Tests whether /v2/charts/coordinates can serve as a "current moment" chart
 * source for future transit logic. This is NOT a production transit feature,
 * does NOT call OpenAI, and does NOT write to Supabase.
 *
 * POST /.netlify/functions/hd-transit-debug
 * Headers: Authorization: Bearer <supabase_access_token>
 * Body: {} (empty JSON object, no user input required)
 */

import type { Handler, HandlerEvent, HandlerContext } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import { normalizeHdChart } from "./hd-normalize";

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
// Human Design API call
// ---------------------------------------------------------------------------

const HD_API_URL = "https://api.humandesignapi.nl/v2/charts/coordinates";

async function fetchCurrentMomentChart(
  currentDate: string,
  currentTime: string,
  lat: number,
  lng: number,
): Promise<unknown> {
  const apiKey = process.env.HD_API_KEY;
  if (!apiKey) {
    throw new Error("Ключ Human Design API не настроен (HD_API_KEY).");
  }

  const payload = {
    birthdate: currentDate,
    birthtime: currentTime,
    lat,
    lng,
  };

  // Log input only — key never logged
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

  // ── Resolve coordinates ───────────────────────────────────────────────────
  let lat =
    typeof chartRow.birth_latitude === "number" ? chartRow.birth_latitude : null;
  let lng =
    typeof chartRow.birth_longitude === "number" ? chartRow.birth_longitude : null;

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
      }
      if (lng === null && typeof profileRow.birth_longitude === "number") {
        lng = profileRow.birth_longitude;
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

  // ── Current moment UTC ────────────────────────────────────────────────────
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const currentDate = `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(now.getUTCDate())}`;
  const currentTime = `${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}`;
  const calculatedAt = now.toISOString();

  console.log(
    `[hd-transit-debug] current moment UTC: ${currentDate} ${currentTime}, lat=${lat}, lng=${lng}`,
  );

  // ── Call Human Design API for current moment ──────────────────────────────
  let rawCurrentMomentChart: unknown;
  try {
    rawCurrentMomentChart = await fetchCurrentMomentChart(
      currentDate,
      currentTime,
      lat,
      lng,
    );
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Ошибка Human Design API.";
    const isConfig = message.includes("не настроен");
    return jsonResponse(isConfig ? 500 : 502, {
      error: message,
      source: "humandesign-api",
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
    calculatedAt,
    inputDate: currentDate,
    inputTime: currentTime,
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

  // ── Debug metadata ────────────────────────────────────────────────────────
  const debug = {
    source: "humandesignapi_v2_charts_coordinates_as_current_moment_test" as const,
    warning:
      "This is not confirmed transit API. This endpoint is being tested as a current-moment chart source." as const,
    savedToDatabase: false as const,
    openAiUsed: false as const,
  };

  return jsonResponse(200, {
    natal,
    currentMoment,
    overlay,
    debug,
    rawCurrentMomentChart,
    normalizedCurrentMomentChart,
  });
};
