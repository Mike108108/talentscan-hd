/**
 * Shared Human Design API client for Netlify functions.
 * Used by hr-candidate-chart-calculate (personal hd-chart-calculate keeps its copy).
 */

const HD_API_URL = "https://api.humandesignapi.nl/v2/charts/coordinates";

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

export async function fetchHumanDesignChart(
  birthDate: string,
  birthTime: string,
  lat: number,
  lng: number,
): Promise<unknown> {
  const apiKey = process.env.HD_API_KEY;
  if (!apiKey) {
    throw new Error("Ключ Human Design API не настроен (HD_API_KEY).");
  }

  const payload = { birthdate: birthDate, birthtime: birthTime, lat, lng };
  const response = await fetch(HD_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const details = extractApiError(data, response.status);
    throw new Error(`Human Design API (${response.status}): ${details}`);
  }
  if (!data) throw new Error("Human Design API вернул пустой ответ.");
  return data;
}
