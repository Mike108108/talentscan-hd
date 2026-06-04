/**
 * Deterministic HD facts for Career Reading Layers (Stage 4.10-B.3).
 * Code owns technical chart facts; AI owns HR interpretation text.
 */

import type { CareerReadingLayerKeyV1 } from "./careerReadingLayersV1";
import {
  buildHdChannelFactsFromChart,
  collectUnknownChannelKeys,
  normalizeChannelKey,
  type HdChannelFact,
} from "./hdChannelFacts";

export type { HdChannelFact };

function asRecord(value: unknown): Record<string, unknown> {
  if (value != null && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function asString(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => asString(item)).filter(Boolean);
}

function makeClassicalSource(opts: {
  source_key: string;
  source_label: string;
  raw_path: string;
  value_summary: string;
  confidence?: "high" | "medium" | "low";
}): Record<string, unknown> {
  return {
    source_key: opts.source_key,
    source_label: opts.source_label,
    raw_path: opts.raw_path,
    value_summary: opts.value_summary,
    confidence: opts.confidence ?? "high",
  };
}

function chartValue(input: Record<string, unknown>, key: string): string {
  const value = input[key];
  return asString(value) || "—";
}

function getActivations(input: Record<string, unknown>): Record<string, unknown> {
  return asRecord(input.activations);
}

function activationValue(
  input: Record<string, unknown>,
  side: "personality" | "design",
  planet: string,
): string {
  const sideMap = asRecord(getActivations(input)[side]);
  return asString(sideMap[planet]);
}

const FAKE_CLASSICAL_SOURCE_PATTERNS = [
  /classic\s*hd\s*source/i,
  /примерное\s+описание/i,
  /kriegel/i,
  /i\s*ching\s+of\s+work/i,
  /^source\s*\d+$/i,
  /^источник\s*\d+$/i,
];

export function isFakeClassicalSource(source: unknown): boolean {
  const rec = asRecord(source);
  const label = asString(rec.source_label);
  const summary = asString(rec.value_summary);
  const rawPath = asString(rec.raw_path);
  const haystack = `${label} ${summary} ${rawPath}`;

  if (!rawPath) return true;
  if (!label && !summary) return true;

  return FAKE_CLASSICAL_SOURCE_PATTERNS.some((pattern) => pattern.test(haystack));
}

export function buildDeterministicClassicalSourcesForLayer(
  layerKey: CareerReadingLayerKeyV1,
  layerInput: unknown,
): Record<string, unknown>[] {
  const input = asRecord(layerInput);
  const sources: Record<string, unknown>[] = [];

  switch (layerKey) {
    case "work_mode_and_decisions": {
      const fields: Array<[string, string, string]> = [
        ["type", "Type", "layer_input.type"],
        ["strategy", "Strategy", "layer_input.strategy"],
        ["authority", "Authority", "layer_input.authority"],
        ["signature", "Signature", "layer_input.signature"],
        ["notSelfTheme", "Not-Self Theme", "layer_input.notSelfTheme"],
      ];
      for (const [key, label, path] of fields) {
        const value = chartValue(input, key);
        if (value === "—") continue;
        sources.push(
          makeClassicalSource({
            source_key: key,
            source_label: label,
            raw_path: path,
            value_summary: value,
          }),
        );
      }
      break;
    }
    case "profile_work_style": {
      if (asString(input.profile)) {
        sources.push(
          makeClassicalSource({
            source_key: "profile",
            source_label: "Profile",
            raw_path: "layer_input.profile",
            value_summary: chartValue(input, "profile"),
          }),
        );
      }
      if (asString(input.definition)) {
        sources.push(
          makeClassicalSource({
            source_key: "definition",
            source_label: "Definition",
            raw_path: "layer_input.definition",
            value_summary: chartValue(input, "definition"),
          }),
        );
      }
      const pSun = asString(input.personality_sun) || activationValue(input, "personality", "sun");
      if (pSun) {
        sources.push(
          makeClassicalSource({
            source_key: "personality.sun",
            source_label: "Personality Sun",
            raw_path: "layer_input.activations.personality.sun",
            value_summary: pSun,
          }),
        );
      }
      const dSun = asString(input.design_sun) || activationValue(input, "design", "sun");
      if (dSun) {
        sources.push(
          makeClassicalSource({
            source_key: "design.sun",
            source_label: "Design Sun",
            raw_path: "layer_input.activations.design.sun",
            value_summary: dSun,
          }),
        );
      }
      break;
    }
    case "conscious_work_theme": {
      const pSun = activationValue(input, "personality", "sun");
      const pEarth = activationValue(input, "personality", "earth");
      if (pSun) {
        sources.push(
          makeClassicalSource({
            source_key: "personality.sun",
            source_label: `Personality Sun ${pSun}`,
            raw_path: "layer_input.activations.personality.sun",
            value_summary: pSun,
          }),
        );
      }
      if (pEarth) {
        sources.push(
          makeClassicalSource({
            source_key: "personality.earth",
            source_label: `Personality Earth ${pEarth}`,
            raw_path: "layer_input.activations.personality.earth",
            value_summary: pEarth,
          }),
        );
      }
      break;
    }
    case "background_work_pattern": {
      const dSun = activationValue(input, "design", "sun");
      const dEarth = activationValue(input, "design", "earth");
      if (dSun) {
        sources.push(
          makeClassicalSource({
            source_key: "design.sun",
            source_label: `Design Sun ${dSun}`,
            raw_path: "layer_input.activations.design.sun",
            value_summary: dSun,
          }),
        );
      }
      if (dEarth) {
        sources.push(
          makeClassicalSource({
            source_key: "design.earth",
            source_label: `Design Earth ${dEarth}`,
            raw_path: "layer_input.activations.design.earth",
            value_summary: dEarth,
          }),
        );
      }
      break;
    }
    case "talent_channels": {
      const facts = readChannelFactsFromInput(input);
      for (const fact of facts) {
        const labelParts = [
          `Channel ${fact.channel_key}`,
          fact.classical_name ? `— ${fact.classical_name}` : "",
        ].join(" ");
        sources.push(
          makeClassicalSource({
            source_key: `channel.${fact.channel_key}`,
            source_label: labelParts.trim(),
            raw_path: "layer_input.channel_facts",
            value_summary: `Gates ${fact.gates[0]}–${fact.gates[1]}, Centers ${fact.centers[0]}–${fact.centers[1]}`,
          }),
        );
      }
      break;
    }
    case "repeated_themes": {
      const candidates = Array.isArray(input.repeated_gate_candidates)
        ? input.repeated_gate_candidates
        : [];
      for (const item of candidates.slice(0, 8)) {
        const rec = asRecord(item);
        const gate = asString(rec.gate);
        if (!gate) continue;
        const gateSources = asStringArray(rec.sources);
        sources.push(
          makeClassicalSource({
            source_key: `gate.${gate}`,
            source_label: `Gate ${gate}`,
            raw_path: "layer_input.repeated_gate_candidates",
            value_summary:
              gateSources.length > 0
                ? `Sources: ${gateSources.join(", ")}`
                : `Gate ${gate} in gatesBoth`,
            confidence: gateSources.length >= 2 ? "high" : "medium",
          }),
        );
      }
      if (sources.length === 0) {
        for (const gate of asStringArray(input.gatesBoth).slice(0, 6)) {
          sources.push(
            makeClassicalSource({
              source_key: `gate.${gate}`,
              source_label: `Gate ${gate}`,
              raw_path: "layer_input.gatesBoth",
              value_summary: `Gate ${gate} (both sides)`,
              confidence: "medium",
            }),
          );
        }
      }
      break;
    }
    case "centers_stability_and_sensitivity": {
      for (const center of asStringArray(input.definedCenters ?? input.defined_centers)) {
        sources.push(
          makeClassicalSource({
            source_key: `center.${center}.defined`,
            source_label: `Defined Center — ${center}`,
            raw_path: "layer_input.definedCenters",
            value_summary: `${center} (defined)`,
          }),
        );
      }
      for (const center of asStringArray(input.openCenters ?? input.open_centers)) {
        sources.push(
          makeClassicalSource({
            source_key: `center.${center}.open`,
            source_label: `Open Center — ${center}`,
            raw_path: "layer_input.openCenters",
            value_summary: `${center} (open / sensitive)`,
            confidence: "medium",
          }),
        );
      }
      break;
    }
    case "environment_focus_and_motivation": {
      const fields: Array<[string, string]> = [
        ["environment", "Environment"],
        ["motivation", "Motivation"],
        ["transference", "Transference"],
        ["perspective", "Perspective"],
        ["cognition", "Cognition"],
        ["determination", "Determination"],
      ];
      for (const [key, label] of fields) {
        const value = chartValue(input, key);
        if (value === "—") continue;
        sources.push(
          makeClassicalSource({
            source_key: key,
            source_label: label,
            raw_path: `layer_input.${key}`,
            value_summary: value,
          }),
        );
      }
      const variables = input.variables;
      if (variables != null && typeof variables === "object") {
        sources.push(
          makeClassicalSource({
            source_key: "variables",
            source_label: "Variables",
            raw_path: "layer_input.variables",
            value_summary: JSON.stringify(variables),
            confidence: "medium",
          }),
        );
      }
      break;
    }
    default:
      break;
  }

  return sources;
}

function readChannelFactsFromInput(input: Record<string, unknown>): HdChannelFact[] {
  const fromInput = input.channel_facts;
  if (Array.isArray(fromInput) && fromInput.length > 0) {
    const facts: HdChannelFact[] = [];
    for (const item of fromInput) {
      const rec = asRecord(item);
      const channelKey = normalizeChannelKey(asString(rec.channel_key));
      if (!channelKey) continue;
      const gatesRaw = rec.gates;
      const centersRaw = rec.centers;
      if (!Array.isArray(gatesRaw) || gatesRaw.length < 2) continue;
      if (!Array.isArray(centersRaw) || centersRaw.length < 2) continue;
      const g0 = asString(gatesRaw[0]);
      const g1 = asString(gatesRaw[1]);
      const c0 = asString(centersRaw[0]);
      const c1 = asString(centersRaw[1]);
      if (!g0 || !g1 || !c0 || !c1) continue;
      const classical = asString(rec.classical_name);
      facts.push({
        channel_key: channelKey,
        gates: [g0, g1],
        centers: [c0, c1],
        ...(classical ? { classical_name: classical } : {}),
        circuit: rec.circuit == null ? null : asString(rec.circuit) || null,
      });
    }
    if (facts.length > 0) return facts;
  }

  return buildHdChannelFactsFromChart({
    channelsShort: input.channelsShort,
    channelsLong: input.channelsLong,
    circuitries: input.circuitries,
  });
}

function buildFallbackChannelTalent(
  fact: HdChannelFact,
  layerEvidence: Record<string, unknown>,
): Record<string, unknown> {
  const evidence = {
    source_fields: asStringArray(layerEvidence.source_fields).length
      ? asStringArray(layerEvidence.source_fields)
      : ["channelsShort", "channelsLong", "channel_facts"],
    source_chart_elements: [
      {
        kind: "channel",
        key: fact.channel_key,
        value: fact.classical_name
          ? `${fact.classical_name} (${fact.channel_key})`
          : fact.channel_key,
        side: null,
        planet: null,
        line: null,
      },
    ],
    confidence: "medium",
    warnings: asStringArray(layerEvidence.warnings),
  };

  return {
    channel_key: fact.channel_key,
    classical_name: fact.classical_name ?? null,
    gates: [...fact.gates],
    centers: [...fact.centers],
    circuit: fact.circuit ?? null,
    title: fact.classical_name || `Канал ${fact.channel_key}`,
    summary: "Требует экспертной интерпретации после генерации.",
    where_useful: [],
    how_it_appears_at_work: "",
    risk: "",
    management_tip: "",
    what_to_check: [],
    evidence,
  };
}

function applyFactToChannelTalent(
  raw: Record<string, unknown>,
  fact: HdChannelFact,
): Record<string, unknown> {
  return {
    ...raw,
    channel_key: fact.channel_key,
    gates: [...fact.gates],
    centers: [...fact.centers],
    classical_name: asString(raw.classical_name) || fact.classical_name || null,
    circuit: fact.circuit ?? (raw.circuit == null ? null : asString(raw.circuit) || null),
  };
}

/** Overwrite channel_talents technical fields from channel_facts; drop unknown channels. */
export function enforceTalentChannelFacts(
  layer: Record<string, unknown>,
  layerInput: unknown,
): void {
  if (asString(layer.layer_key) !== "talent_channels") return;

  const input = asRecord(layerInput);
  const facts = readChannelFactsFromInput(input);
  const factByKey = new Map(facts.map((fact) => [fact.channel_key, fact]));

  const unknownKeys = collectUnknownChannelKeys({
    channelsShort: input.channelsShort,
    channelsLong: input.channelsLong,
  });

  const special = asRecord(layer.special_payload);
  const rawTalents = Array.isArray(special.channel_talents) ? special.channel_talents : [];
  const validated: Record<string, unknown>[] = [];
  const warnings: string[] = [];

  for (const key of unknownKeys) {
    warnings.push(`Unknown channel key: ${key}`);
  }

  for (const item of rawTalents) {
    const rec = asRecord(item);
    const normalized = normalizeChannelKey(asString(rec.channel_key));
    const fact = normalized ? factByKey.get(normalized) : null;
    if (!fact) {
      const rawKey = asString(rec.channel_key);
      if (rawKey) warnings.push(`Unknown channel key: ${rawKey}`);
      continue;
    }
    validated.push(applyFactToChannelTalent(rec, fact));
  }

  const layerEvidence = asRecord(layer.evidence);
  for (const fact of facts) {
    if (validated.some((item) => asString(asRecord(item).channel_key) === fact.channel_key)) {
      continue;
    }
    validated.push(buildFallbackChannelTalent(fact, layerEvidence));
    warnings.push(`Missing channel_talents card for ${fact.channel_key}; filled deterministic fallback`);
  }

  special.channel_talents = validated;
  special.channels_count = facts.length;
  layer.special_payload = special;

  const evidence = asRecord(layer.evidence);
  const mergedWarnings = [...asStringArray(evidence.warnings), ...warnings];
  evidence.warnings = mergedWarnings.length > 0 ? mergedWarnings : [];
  layer.evidence = evidence;
}

/** Replace fake/placeholder Pro sources with deterministic chart-based sources. */
export function enforceDeterministicProSources(
  layer: Record<string, unknown>,
  layerKey: CareerReadingLayerKeyV1,
  layerInput: unknown,
): void {
  const deterministic = buildDeterministicClassicalSourcesForLayer(layerKey, layerInput);
  const pro = asRecord(layer.pro);

  if (deterministic.length > 0) {
    pro.classical_sources = deterministic;
    layer.pro = pro;
    return;
  }

  const existing = Array.isArray(pro.classical_sources) ? pro.classical_sources : [];
  const filtered = existing.filter((item) => !isFakeClassicalSource(item));
  if (filtered.length !== existing.length) {
    pro.classical_sources = filtered;
    layer.pro = pro;
  }
}
