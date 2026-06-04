/**
 * Shared HD channel facts for report generation and transit logic.
 * Source of truth for which two centers each channel connects (36 channels).
 */

/** Center pair per channel key (gate1-gate2, lower gate first). */
export const HD_CHANNEL_CENTER_MAP: Record<string, [string, string]> = {
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

export type HdChannelFact = {
  channel_key: string;
  gates: [string, string];
  centers: [string, string];
  classical_name?: string;
  circuit?: string | null;
};

function asString(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => asString(item)).filter(Boolean);
}

function parseChannelGates(channelKey: string): [string, string] | null {
  const parts = channelKey.split("-");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  return [parts[0], parts[1]];
}

/** Normalize channel key to canonical gate1-gate2 form from HD_CHANNEL_CENTER_MAP. */
export function normalizeChannelKey(value: string): string | null {
  const trimmed = asString(value);
  if (!trimmed) return null;
  if (trimmed in HD_CHANNEL_CENTER_MAP) return trimmed;
  const parts = trimmed.split("-");
  if (parts.length !== 2) return null;
  const reversed = `${parts[1]}-${parts[0]}`;
  if (reversed in HD_CHANNEL_CENTER_MAP) return reversed;
  return null;
}

export function getHdChannelFact(channelKey: string): HdChannelFact | null {
  const normalized = normalizeChannelKey(channelKey);
  if (!normalized) return null;
  const centers = HD_CHANNEL_CENTER_MAP[normalized];
  const gates = parseChannelGates(normalized);
  if (!centers || !gates) return null;
  return {
    channel_key: normalized,
    gates,
    centers,
    circuit: null,
  };
}

function extractChannelKeyFromLongEntry(entry: string): string | null {
  const trimmed = asString(entry);
  if (!trimmed) return null;

  const parenMatch = trimmed.match(/\(\s*(\d+\s*-\s*\d+)\s*\)/);
  if (parenMatch) return normalizeChannelKey(parenMatch[1]);

  const leading = trimmed.match(/^(\d+\s*-\s*\d+)/);
  if (leading) return normalizeChannelKey(leading[1]);

  return normalizeChannelKey(trimmed);
}

/** Parse classical channel name from channelsLong entry, e.g. "Curiosity (11-56)". */
export function parseClassicalNameFromChannelsLong(
  channelsLong: string[],
  channelKey: string,
): string | undefined {
  const normalized = normalizeChannelKey(channelKey);
  if (!normalized) return undefined;

  for (const entry of channelsLong) {
    const entryKey = extractChannelKeyFromLongEntry(entry);
    if (entryKey !== normalized) continue;

    const trimmed = asString(entry);
    const parenName = trimmed.match(/^(.+?)\s*\(\s*\d+\s*-\s*\d+\s*\)\s*$/i);
    if (parenName?.[1]) return parenName[1].trim();

    const suffixName = trimmed.match(/^\d+\s*-\s*\d+\s*[:\-—]\s*(.+)$/i);
    if (suffixName?.[1]) return suffixName[1].trim();

    const trailingName = trimmed.match(/^\d+\s*-\s*\d+\s+(.+)$/i);
    if (trailingName?.[1] && !trailingName[1].includes("(")) return trailingName[1].trim();
  }

  return undefined;
}

function collectOrderedChannelKeys(channelsShort: string[], channelsLong: string[]): string[] {
  const ordered: string[] = [];
  const seen = new Set<string>();

  const addKey = (raw: string) => {
    const normalized = normalizeChannelKey(raw);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    ordered.push(normalized);
  };

  for (const entry of channelsShort) addKey(entry);
  for (const entry of channelsLong) {
    const key = extractChannelKeyFromLongEntry(entry);
    if (key) addKey(key);
  }

  return ordered;
}

/** Unknown raw keys from chart that are not in HD_CHANNEL_CENTER_MAP. */
export function collectUnknownChannelKeys(input: {
  channelsShort?: unknown;
  channelsLong?: unknown;
}): string[] {
  const channelsShort = asStringArray(input.channelsShort);
  const channelsLong = asStringArray(input.channelsLong);
  const unknown: string[] = [];
  const seen = new Set<string>();

  const checkRaw = (raw: string) => {
    const trimmed = asString(raw);
    if (!trimmed || seen.has(trimmed)) return;
    seen.add(trimmed);
    if (!normalizeChannelKey(trimmed)) unknown.push(trimmed);
  };

  for (const entry of channelsShort) checkRaw(entry);
  for (const entry of channelsLong) {
    const key = extractChannelKeyFromLongEntry(entry);
    if (key) continue;
    checkRaw(entry);
  }

  return unknown;
}

/**
 * Build deterministic channel facts from chart channel lists.
 * Invalid keys are omitted — see collectUnknownChannelKeys.
 */
export function buildHdChannelFactsFromChart(input: {
  channelsShort?: unknown;
  channelsLong?: unknown;
  circuitries?: unknown;
}): HdChannelFact[] {
  const channelsShort = asStringArray(input.channelsShort);
  const channelsLong = asStringArray(input.channelsLong);
  const facts: HdChannelFact[] = [];

  for (const channelKey of collectOrderedChannelKeys(channelsShort, channelsLong)) {
    const base = getHdChannelFact(channelKey);
    if (!base) continue;
    facts.push({
      ...base,
      classical_name: parseClassicalNameFromChannelsLong(channelsLong, channelKey),
      circuit: null,
    });
  }

  return facts;
}
