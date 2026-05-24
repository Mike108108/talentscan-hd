import type { Handler, HandlerEvent, HandlerContext } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
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
// input_hash — deterministic fingerprint of the birth inputs
// ---------------------------------------------------------------------------

function computeInputHash(
  userId: string,
  birthDate: string,
  birthTime: string,
  birthTimeAccuracy: string,
  birthPlaceLabel: string,
  lat: number,
  lng: number,
): string {
  const raw = [
    userId,
    birthDate,
    birthTime,
    birthTimeAccuracy,
    birthPlaceLabel.trim().toLowerCase(),
    lat.toFixed(6),
    lng.toFixed(6),
  ].join("|");
  return createHash("sha256").update(raw).digest("hex");
}

// ---------------------------------------------------------------------------
// Human Design API
// ---------------------------------------------------------------------------

const HD_API_URL = "https://api.humandesignapi.nl/v2/charts/coordinates";

async function fetchHumanDesignChart(
  birthDate: string,
  birthTime: string,
  lat: number,
  lng: number,
): Promise<unknown> {
  const apiKey = process.env.HD_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Ключ Human Design API не настроен (HD_API_KEY).",
    );
  }

  const payload = { birthdate: birthDate, birthtime: birthTime, lat, lng };
  console.log("[hd-chart-calculate] HD API request:", JSON.stringify(payload));

  const response = await fetch(HD_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  const data: unknown = await response.json().catch(() => null);
  console.log("[hd-chart-calculate] HD API status:", response.status);

  if (!response.ok) {
    const details = extractApiError(data, response.status);
    console.error("[hd-chart-calculate] HD API error:", JSON.stringify(data));
    throw new Error(`Human Design API (${response.status}): ${details}`);
  }

  if (!data) throw new Error("Human Design API вернул пустой ответ.");
  return data;
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
    return jsonResponse(401, { error: "Требуется вход в личный кабинет.", source: "auth" });
  }
  const token = bearerMatch[1];

  const supabaseUrl =
    process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "";
  const supabaseAnonKey =
    process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY ?? "";

  if (!supabaseUrl.trim() || !supabaseAnonKey.trim()) {
    return jsonResponse(500, { error: "Supabase не настроен на сервере.", source: "config" });
  }

  // Verify token and get user
  const authClient = createClient(supabaseUrl, supabaseAnonKey);
  const { data: authData, error: authErr } = await authClient.auth.getUser(token);
  if (authErr || !authData.user) {
    return jsonResponse(401, { error: "Требуется вход в личный кабинет.", source: "auth" });
  }
  const userId = authData.user.id;

  // Authenticated DB client — respects RLS (auth.uid() = user_id)
  const db = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  // ── Load profile ──────────────────────────────────────────────────────────
  const { data: profileRow, error: profileErr } = await db
    .from("user_profiles")
    .select(
      "id, birth_date, birth_time, birth_time_accuracy, birth_place_label, birth_latitude, birth_longitude",
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (profileErr) {
    console.error("[hd-chart-calculate] profile load error:", profileErr.message);
    return jsonResponse(500, { error: "Не удалось загрузить профиль.", source: "db" });
  }

  if (!profileRow) {
    return jsonResponse(404, {
      error: "Профиль не найден. Заполните вкладку «Данные» и сохраните профиль.",
      source: "profile",
    });
  }

  // ── Validate required birth fields ────────────────────────────────────────
  const birthDate = asString(profileRow.birth_date);
  const birthTime = asString(profileRow.birth_time);
  const birthTimeAccuracy = asString(profileRow.birth_time_accuracy);
  const birthPlaceLabel = asString(profileRow.birth_place_label);
  const lat = typeof profileRow.birth_latitude === "number" ? profileRow.birth_latitude : null;
  const lng = typeof profileRow.birth_longitude === "number" ? profileRow.birth_longitude : null;

  if (!birthDate) {
    return jsonResponse(400, { error: "Укажите дату рождения в профиле.", source: "validation" });
  }
  if (!birthTime) {
    return jsonResponse(400, { error: "Укажите время рождения в профиле.", source: "validation" });
  }
  if (!birthPlaceLabel || lat === null || lng === null) {
    return jsonResponse(400, {
      error:
        "Город рождения не выбран из подсказки геокодера. Откройте вкладку «Данные», введите город и выберите его из списка.",
      source: "validation",
    });
  }

  const profileId: string | null = asString(profileRow.id) || null;

  // ── Input hash ────────────────────────────────────────────────────────────
  const inputHash = computeInputHash(
    userId,
    birthDate,
    birthTime,
    birthTimeAccuracy,
    birthPlaceLabel,
    lat,
    lng,
  );

  // ── Call Human Design API ─────────────────────────────────────────────────
  let rawChart: unknown;
  try {
    rawChart = await fetchHumanDesignChart(birthDate, birthTime, lat, lng);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Ошибка Human Design API.";
    const isConfig = message.includes("не настроен");
    return jsonResponse(isConfig ? 500 : 502, {
      error: message,
      source: "humandesign-api",
    });
  }

  // ── Normalize ─────────────────────────────────────────────────────────────
  const normalized = normalizeHdChart(rawChart);

  // ── Deactivate previous active charts ─────────────────────────────────────
  const { error: deactivateErr } = await db
    .from("hd_charts")
    .update({ is_active: false })
    .eq("user_id", userId)
    .eq("is_active", true);

  if (deactivateErr) {
    console.warn("[hd-chart-calculate] deactivate error:", deactivateErr.message);
    // Non-fatal — continue
  }

  // ── Insert new chart ──────────────────────────────────────────────────────
  const newRow = {
    user_id: userId,
    profile_id: profileId,
    birth_date: birthDate,
    birth_time: birthTime,
    birth_time_accuracy: birthTimeAccuracy || null,
    birth_place_label: birthPlaceLabel,
    birth_latitude: lat,
    birth_longitude: lng,
    input_hash: inputHash,
    raw_chart_json: rawChart as object,
    normalized_chart_json: normalized as object,
    // Top-level convenience fields from normalized
    type: normalized.type !== "—" ? normalized.type : null,
    profile: normalized.profile !== "—" ? normalized.profile : null,
    strategy: normalized.strategy !== "—" ? normalized.strategy : null,
    authority: normalized.authority !== "—" ? normalized.authority : null,
    incarnation_cross: normalized.incarnationCross !== "—" ? normalized.incarnationCross : null,
    definition: normalized.definition ?? null,
    signature: normalized.signature ?? null,
    not_self_theme: normalized.notSelfTheme ?? null,
    defined_centers: normalized.definedCenters,
    open_centers: normalized.openCenters,
    gates_all: normalized.gatesAll,
    gates_personality: normalized.gatesPersonality,
    gates_design: normalized.gatesDesign,
    gates_both: normalized.gatesBoth,
    channels_short: normalized.channelsShort,
    channels_long: normalized.channelsLong,
    activations: normalized.activations as object,
    variables: normalized.variables !== undefined ? (normalized.variables as object) : null,
    cognition: normalized.cognition ?? null,
    determination: normalized.determination ?? null,
    motivation: normalized.motivation ?? null,
    transference: normalized.transference ?? null,
    perspective: normalized.perspective ?? null,
    distraction: normalized.distraction ?? null,
    environment: normalized.environment ?? null,
    can_render_bodygraph: normalized.canRenderBodygraph,
    missing_for_bodygraph: normalized.missingForBodygraph,
    calculation_status: "calculated",
    is_active: true,
    provider: "human-design-api",
    normalizer_version: "v0.1",
  };

  const { data: insertedRows, error: insertErr } = await db
    .from("hd_charts")
    .insert(newRow)
    .select();

  if (insertErr) {
    console.error("[hd-chart-calculate] insert error:", insertErr.message);
    return jsonResponse(500, {
      error: `Не удалось сохранить карту: ${insertErr.message}`,
      source: "db",
    });
  }

  const savedChart = insertedRows?.[0] ?? null;
  console.log("[hd-chart-calculate] chart saved, id:", savedChart?.id);

  return jsonResponse(200, {
    chart: savedChart,
    normalized: {
      type: normalized.type,
      profile: normalized.profile,
      strategy: normalized.strategy,
      authority: normalized.authority,
      incarnationCross: normalized.incarnationCross,
      definition: normalized.definition,
      definedCenters: normalized.definedCenters,
      openCenters: normalized.openCenters,
      channelsShort: normalized.channelsShort,
      canRenderBodygraph: normalized.canRenderBodygraph,
    },
  });
};
