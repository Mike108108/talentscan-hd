import type { Handler, HandlerEvent, HandlerContext } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Auth helper — same pattern as hd-chart-debug.ts
// ---------------------------------------------------------------------------

function jsonResponse(statusCode: number, body: unknown) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

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
// Shared result type
// ---------------------------------------------------------------------------

export type GeocodeSuggestion = {
  id: string;
  label: string;
  city: string;
  region: string;
  country: string;
  lat: number;
  lng: number;
  source: "nominatim";
};

// ---------------------------------------------------------------------------
// Nominatim raw response (minimal typing)
// ---------------------------------------------------------------------------

type NominatimResult = {
  place_id?: number;
  display_name: string;
  lat: string;
  lon: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    hamlet?: string;
    suburb?: string;
    state?: string;
    county?: string;
    region?: string;
    country?: string;
  };
};

// ---------------------------------------------------------------------------
// MVP Provider: Nominatim / OpenStreetMap — no API key required.
// To switch provider (e.g. Google Places, MapBox, 2GIS) replace only this
// function and keep the GeocodeSuggestion output contract.
// ---------------------------------------------------------------------------

async function searchCitiesNominatim(query: string): Promise<GeocodeSuggestion[]> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", query);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "7");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("accept-language", "ru,en");

  const response = await fetch(url.toString(), {
    headers: {
      // Nominatim ToS requires a descriptive User-Agent.
      "User-Agent": "TalentScan/1.0 (scantalent.ru; contact: info@scantalent.ru)",
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Nominatim вернул статус ${response.status}`);
  }

  const results = (await response.json()) as NominatimResult[];

  const seen = new Set<string>();
  const suggestions: GeocodeSuggestion[] = [];

  for (const r of results) {
    const addr = r.address ?? {};
    const city =
      addr.city ??
      addr.town ??
      addr.village ??
      addr.municipality ??
      addr.hamlet ??
      "";
    const region = addr.state ?? addr.county ?? addr.region ?? "";
    const country = addr.country ?? "";

    const labelParts = [city, region, country].filter(Boolean);
    const label = labelParts.length > 0 ? labelParts.join(", ") : r.display_name;

    // Deduplicate by label to avoid duplicates for same settlement
    if (seen.has(label)) continue;
    seen.add(label);

    suggestions.push({
      id: r.place_id ? String(r.place_id) : `nominatim-${suggestions.length}`,
      label,
      city,
      region,
      country,
      lat: parseFloat(r.lat),
      lng: parseFloat(r.lon),
      source: "nominatim",
    });

    if (suggestions.length >= 5) break;
  }

  return suggestions;
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export const handler: Handler = async (
  event: HandlerEvent,
  _context: HandlerContext,
) => {
  if (event.httpMethod !== "GET" && event.httpMethod !== "POST") {
    return jsonResponse(405, { error: "Разрешены методы GET и POST." });
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

  // ---- Parse query ---------------------------------------------------------
  let q = "";
  if (event.httpMethod === "GET") {
    q = (event.queryStringParameters?.q ?? event.queryStringParameters?.query ?? "").trim();
  } else {
    try {
      const body = JSON.parse(event.body ?? "{}") as Record<string, unknown>;
      q = String(body.q ?? body.query ?? "").trim();
    } catch {
      return jsonResponse(400, { error: "Некорректное тело запроса." });
    }
  }

  if (q.length < 2) {
    return jsonResponse(200, { suggestions: [] });
  }

  // ---- Search --------------------------------------------------------------
  try {
    const suggestions = await searchCitiesNominatim(q);
    console.log(`[geocode-city] query="${q}" → ${suggestions.length} results`);
    return jsonResponse(200, { suggestions });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Ошибка геокодинга.";
    console.error("[geocode-city] error:", message);
    return jsonResponse(502, { error: message, source: "nominatim" });
  }
};
