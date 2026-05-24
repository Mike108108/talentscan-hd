import type { Handler, HandlerEvent, HandlerContext } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Shared helpers (minimal copy — does NOT import from talent-report to avoid
// any risk of side-effects on the production function)
// ---------------------------------------------------------------------------

const HD_CHARTS_COORDINATES_URL =
  "https://api.humandesignapi.nl/v2/charts/coordinates";

const DEFAULT_COORDINATES = { lat: 55.7558, lng: 37.6173 };

const CITY_COORDINATES: Record<string, { lat: number; lng: number }> = {
  москва: { lat: 55.7558, lng: 37.6173 },
  moscow: { lat: 55.7558, lng: 37.6173 },
  "санкт-петербург": { lat: 59.9311, lng: 30.3609 },
  "saint petersburg": { lat: 59.9311, lng: 30.3609 },
  spb: { lat: 59.9311, lng: 30.3609 },
  киев: { lat: 50.4501, lng: 30.5234 },
  kyiv: { lat: 50.4501, lng: 30.5234 },
  минск: { lat: 53.9006, lng: 27.559 },
  алматы: { lat: 43.222, lng: 76.8512 },
  астана: { lat: 51.1694, lng: 71.4491 },
  ташкент: { lat: 41.2995, lng: 69.2401 },
  екатеринбург: { lat: 56.8389, lng: 60.6057 },
  новосибирск: { lat: 55.0084, lng: 82.9357 },
  красноярск: { lat: 56.0153, lng: 92.8932 },
  владивосток: { lat: 43.1155, lng: 131.8855 },
};

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

function resolveCoordinates(city: string): { lat: number; lng: number } {
  const normalized = city.trim().toLowerCase();
  const coords = CITY_COORDINATES[normalized];
  if (coords) return coords;
  console.log(`[hd-chart-debug] city "${city}" not in map, using Moscow defaults`);
  return DEFAULT_COORDINATES;
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
// Detection helpers
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

function detectFields(hdRaw: unknown): {
  hasCenters: boolean;
  hasGates: boolean;
  hasChannels: boolean;
  hasActivations: boolean;
  hasVariables: boolean;
  hasProfile: boolean;
  hasType: boolean;
  hasAuthority: boolean;
  hasStrategy: boolean;
  hasIncarnationCross: boolean;
} {
  const outer = asRecord(hdRaw);
  const root = asRecord(outer.data ?? outer.chart ?? outer.bodygraph ?? outer);

  return {
    hasCenters: hasKey(root, "centers", "Centers"),
    hasGates: hasNonEmptyArray(root, "gates", "Gates", "active_gates", "activeGates"),
    hasChannels: hasNonEmptyArray(root, "channels", "Channels", "channels_short", "channelsShort"),
    hasActivations: hasKey(root, "activations", "Activations", "design", "personality"),
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

  // Try common nested roots: data / chart / bodygraph / root
  for (const k of ["data", "chart", "bodygraph", "root"]) {
    if (outer[k] && typeof outer[k] === "object" && !Array.isArray(outer[k])) {
      return Object.keys(outer[k] as object);
    }
  }

  return [];
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

  // ---- Auth -----------------------------------------------------------------
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
      return jsonResponse(500, { error: "Supabase не настроен на сервере.", source: "config" });
    }
    return jsonResponse(401, { error: "Требуется вход в личный кабинет.", source: "auth" });
  }

  // ---- HD API key check -----------------------------------------------------
  const hdApiKey = process.env.HD_API_KEY;
  if (!hdApiKey) {
    return jsonResponse(500, {
      error: "Ключ Human Design API не настроен (HD_API_KEY).",
      source: "config",
    });
  }

  // ---- Parse body -----------------------------------------------------------
  let birthDate: string;
  let birthTime: string;
  let birthCity: string;

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
  } catch (err) {
    const message = err instanceof Error ? err.message : "Некорректные данные.";
    return jsonResponse(400, { error: message, source: "validation" });
  }

  // ---- Resolve coordinates --------------------------------------------------
  const coordinates = resolveCoordinates(birthCity);

  // ---- Call Human Design API ------------------------------------------------
  const hdPayload = {
    birthdate: birthDate,
    birthtime: birthTime,
    lat: coordinates.lat,
    lng: coordinates.lng,
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

  // ---- Build audit response -------------------------------------------------
  const hdTopLevelKeys = Object.keys(asRecord(hdRaw));
  const hdDataKeys = getNestedDataKeys(hdRaw);
  const detected = detectFields(hdRaw);

  return jsonResponse(200, {
    input: { birthDate, birthTime, birthCity },
    coordinates,
    hdRaw,
    hdTopLevelKeys,
    hdDataKeys,
    detected,
  });
};
