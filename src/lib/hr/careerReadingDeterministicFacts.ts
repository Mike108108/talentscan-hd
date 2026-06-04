/**
 * Deterministic HD facts for Career Reading Layers (Stage 4.10-B.3).
 * Code owns technical chart facts; AI owns HR interpretation text.
 */

import type { CareerReadingLayerKeyV1 } from "./careerReadingLayersV1";
import {
  buildDeterministicProConnectionLogic,
  formatActivationForPro,
  formatChannelProLabel,
  isWeakProConnectionLogic,
  replaceHdTermForBase,
  translateHdTermForPro,
} from "./hdTermLabels";
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
      const fields: Array<[string, string, string, string]> = [
        ["type", "type", "Тип", "normalized_chart_data.type"],
        ["strategy", "strategy", "Стратегия", "normalized_chart_data.strategy"],
        ["authority", "authority", "Авторитет", "normalized_chart_data.authority"],
        ["signature", "signature", "Подпись", "normalized_chart_data.signature"],
        ["notSelfTheme", "notSelfTheme", "Тема не-я", "normalized_chart_data.notSelfTheme"],
      ];
      for (const [key, sourceKey, labelRu, path] of fields) {
        const value = chartValue(input, key);
        if (value === "—") continue;
        const translated = translateHdTermForPro(value);
        sources.push(
          makeClassicalSource({
            source_key: sourceKey,
            source_label: `${labelRu}: ${translated}`,
            raw_path: path,
            value_summary: translated,
          }),
        );
      }
      break;
    }
    case "profile_work_style": {
      const profile = chartValue(input, "profile");
      if (profile !== "—") {
        sources.push(
          makeClassicalSource({
            source_key: "profile",
            source_label: `Профиль: ${profile}`,
            raw_path: "normalized_chart_data.profile",
            value_summary: profile,
          }),
        );
      }
      const definition = chartValue(input, "definition");
      if (definition !== "—") {
        sources.push(
          makeClassicalSource({
            source_key: "definition",
            source_label: `Определение: ${definition}`,
            raw_path: "normalized_chart_data.definition",
            value_summary: definition,
          }),
        );
      }
      const pSun = asString(input.personality_sun) || activationValue(input, "personality", "sun");
      if (pSun) {
        sources.push(
          makeClassicalSource({
            source_key: "personality.sun",
            source_label: formatActivationForPro("personality", "sun", pSun),
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
            source_label: formatActivationForPro("design", "sun", dSun),
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
            source_label: formatActivationForPro("personality", "sun", pSun),
            raw_path: "layer_input.activations.personality.sun",
            value_summary: pSun,
          }),
        );
      }
      if (pEarth) {
        sources.push(
          makeClassicalSource({
            source_key: "personality.earth",
            source_label: formatActivationForPro("personality", "earth", pEarth),
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
            source_label: formatActivationForPro("design", "sun", dSun),
            raw_path: "layer_input.activations.design.sun",
            value_summary: dSun,
          }),
        );
      }
      if (dEarth) {
        sources.push(
          makeClassicalSource({
            source_key: "design.earth",
            source_label: formatActivationForPro("design", "earth", dEarth),
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
        const formatted = formatChannelProLabel(fact);
        sources.push(
          makeClassicalSource({
            source_key: `channel.${fact.channel_key}`,
            source_label: formatted.source_label,
            raw_path: "normalized_chart_data.channelsLong",
            value_summary: formatted.value_summary,
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
            source_label: `Ворота ${gate}`,
            raw_path: "layer_input.repeated_gate_candidates",
            value_summary:
              gateSources.length > 0
                ? `Источники: ${gateSources.join(", ")}`
                : `Ворота ${gate} (gatesBoth)`,
            confidence: gateSources.length >= 2 ? "high" : "medium",
          }),
        );
      }
      if (sources.length === 0) {
        for (const gate of asStringArray(input.gatesBoth).slice(0, 6)) {
          sources.push(
            makeClassicalSource({
              source_key: `gate.${gate}`,
              source_label: `Ворота ${gate}`,
              raw_path: "layer_input.gatesBoth",
              value_summary: `Ворота ${gate} (обе стороны)`,
              confidence: "medium",
            }),
          );
        }
      }
      break;
    }
    case "centers_stability_and_sensitivity": {
      for (const center of asStringArray(input.definedCenters ?? input.defined_centers)) {
        const centerRu = translateHdTermForPro(center);
        sources.push(
          makeClassicalSource({
            source_key: `center.${center}.defined`,
            source_label: `Определённый центр — ${centerRu}`,
            raw_path: "layer_input.definedCenters",
            value_summary: `${centerRu} (определён)`,
          }),
        );
      }
      for (const center of asStringArray(input.openCenters ?? input.open_centers)) {
        const centerRu = translateHdTermForPro(center);
        sources.push(
          makeClassicalSource({
            source_key: `center.${center}.open`,
            source_label: `Открытый центр — ${centerRu}`,
            raw_path: "layer_input.openCenters",
            value_summary: `${centerRu} (открытый / чувствительный)`,
            confidence: "medium",
          }),
        );
      }
      break;
    }
    case "environment_focus_and_motivation": {
      const fields: Array<[string, string, string]> = [
        ["environment", "Среда", "normalized_chart_data.environment"],
        ["motivation", "Мотивация", "normalized_chart_data.motivation"],
        ["transference", "Трансференция", "normalized_chart_data.transference"],
        ["perspective", "Перспектива", "normalized_chart_data.perspective"],
        ["cognition", "Познание", "normalized_chart_data.cognition"],
        ["determination", "Определение (Determination)", "normalized_chart_data.determination"],
      ];
      for (const [key, labelRu, path] of fields) {
        const value = chartValue(input, key);
        if (value === "—") continue;
        const translated = translateHdTermForPro(value);
        sources.push(
          makeClassicalSource({
            source_key: key,
            source_label: `${labelRu}: ${translated}`,
            raw_path: path,
            value_summary: value,
          }),
        );
      }
      const variables = input.variables;
      if (variables != null && typeof variables === "object") {
        sources.push(
          makeClassicalSource({
            source_key: "variables",
            source_label: "Переменные (Variables)",
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
  } else {
    const existing = Array.isArray(pro.classical_sources) ? pro.classical_sources : [];
    pro.classical_sources = existing.filter((item) => !isFakeClassicalSource(item));
  }

  const connectionLogic = buildDeterministicProConnectionLogic(layerKey, layerInput);
  if (connectionLogic && isWeakProConnectionLogic(asString(pro.connection_logic))) {
    pro.connection_logic = connectionLogic;
  }

  layer.pro = pro;
}

function sanitizeBaseText(value: unknown): string {
  const text = asString(value);
  if (!text) return text;
  return replaceHdTermForBase(text);
}

function sanitizeSpecialPayloadHumanFields(special: Record<string, unknown>): void {
  const channelTalents = Array.isArray(special.channel_talents) ? special.channel_talents : [];
  special.channel_talents = channelTalents.map((item) => {
    const rec = asRecord(item);
    return {
      ...rec,
      title: sanitizeBaseText(rec.title),
      summary: sanitizeBaseText(rec.summary),
      risk: sanitizeBaseText(rec.risk),
      management_tip: sanitizeBaseText(rec.management_tip),
      what_to_check: sanitizeBaseText(rec.what_to_check),
    };
  });

  const centerZones = Array.isArray(special.center_zones) ? special.center_zones : [];
  special.center_zones = centerZones.map((item) => {
    const rec = asRecord(item);
    return {
      ...rec,
      title: sanitizeBaseText(rec.title),
      work_meaning: sanitizeBaseText(rec.work_meaning),
      potential_strength: sanitizeBaseText(rec.potential_strength),
      risk_under_pressure: sanitizeBaseText(rec.risk_under_pressure),
      management_tip: sanitizeBaseText(rec.management_tip),
    };
  });

  const repeatedThemes = Array.isArray(special.repeated_gate_themes)
    ? special.repeated_gate_themes
    : [];
  special.repeated_gate_themes = repeatedThemes.map((item) => {
    const rec = asRecord(item);
    return {
      ...rec,
      title: sanitizeBaseText(rec.title),
      summary: sanitizeBaseText(rec.summary),
      talent_potential: sanitizeBaseText(rec.talent_potential),
      risk_pattern: sanitizeBaseText(rec.risk_pattern),
    };
  });
}

/** Safe standalone HD term replacement for client-facing fields only (not Pro/evidence). */
export function sanitizeCareerReadingBaseHdLanguage(layer: Record<string, unknown>): void {
  const base = asRecord(layer.base);

  for (const key of [
    "headline",
    "short_summary",
    "detailed_explanation",
    "how_it_appears_at_work",
  ]) {
    if (base[key] != null) base[key] = sanitizeBaseText(base[key]);
  }

  base.where_useful = asStringArray(base.where_useful).map((item) => sanitizeBaseText(item));
  base.management_tips = asStringArray(base.management_tips).map((item) => sanitizeBaseText(item));

  const strengths = Array.isArray(base.strengths) ? base.strengths : [];
  base.strengths = strengths.map((item) => {
    const rec = asRecord(item);
    return {
      ...rec,
      title: sanitizeBaseText(rec.title),
      description: sanitizeBaseText(rec.description),
    };
  });

  const risks = Array.isArray(base.risks) ? base.risks : [];
  base.risks = risks.map((item) => {
    const rec = asRecord(item);
    return {
      ...rec,
      title: sanitizeBaseText(rec.title),
      description: sanitizeBaseText(rec.description),
      how_it_may_show_up: rec.how_it_may_show_up == null ? null : sanitizeBaseText(rec.how_it_may_show_up),
      mitigation: rec.mitigation == null ? null : sanitizeBaseText(rec.mitigation),
    };
  });

  const checks = Array.isArray(base.what_to_check) ? base.what_to_check : [];
  base.what_to_check = checks.map((item) => {
    const rec = asRecord(item);
    return {
      ...rec,
      hypothesis: sanitizeBaseText(rec.hypothesis),
      check_method: sanitizeBaseText(rec.check_method),
      good_signal: sanitizeBaseText(rec.good_signal),
      warning_signal: sanitizeBaseText(rec.warning_signal),
    };
  });

  const sections = Array.isArray(base.sections) ? base.sections : [];
  base.sections = sections.map((item) => {
    const rec = asRecord(item);
    return {
      ...rec,
      title: sanitizeBaseText(rec.title),
      body: rec.body == null ? null : sanitizeBaseText(rec.body),
      items: asStringArray(rec.items).map((entry) => sanitizeBaseText(entry)),
    };
  });

  layer.base = base;

  const synthesis = asRecord(layer.summary_for_synthesis);
  if (synthesis.one_sentence != null) {
    synthesis.one_sentence = sanitizeBaseText(synthesis.one_sentence);
  }
  for (const key of ["strengths", "risks", "conditions", "management_focus", "what_to_check"]) {
    synthesis[key] = asStringArray(synthesis[key]).map((item) => sanitizeBaseText(item));
  }
  layer.summary_for_synthesis = synthesis;

  const matching = asRecord(layer.matching_summary);
  for (const key of [
    "good_for",
    "bad_for",
    "role_fit_positive_signals",
    "role_fit_risk_signals",
    "check_in_role_fit",
  ]) {
    matching[key] = asStringArray(matching[key]).map((item) => sanitizeBaseText(item));
  }
  layer.matching_summary = matching;

  const special = asRecord(layer.special_payload);
  sanitizeSpecialPayloadHumanFields(special);
  layer.special_payload = special;
}

type CareerReadingHdFieldFallbacks = {
  short_summary: string;
  detailed_explanation: string;
  how_it_appears_at_work: string;
  synthesis_one_sentence: string;
};

const GENERIC_CAREER_READING_HD_FALLBACKS: CareerReadingHdFieldFallbacks = {
  short_summary:
    "Кандидат лучше раскрывается в задачах, где его вклад явно нужен, роль понятна, а решение можно проверить через рабочий контекст и согласованные ожидания.",
  detailed_explanation:
    "Кандидат лучше входит в задачу, когда его вклад явно запрошен, роль понятна, а ожидания согласованы заранее. В работе важно дать контекст, критерии результата и пространство для точной оценки ситуации. Если задача приходит хаотично или без понятной роли, может появляться задержка старта и лишнее напряжение.",
  how_it_appears_at_work:
    "На практике это проявляется через запрос ясности по роли, темпу и критериям результата перед активным включением в задачу.",
  synthesis_one_sentence:
    "Кандидат эффективнее входит в работу через ясный запрос, понятную роль и согласованные ожидания по результату.",
};

const CAREER_READING_HD_FIELD_FALLBACKS: Partial<
  Record<CareerReadingLayerKeyV1, CareerReadingHdFieldFallbacks>
> = {
  work_mode_and_decisions: {
    short_summary:
      "Кандидат лучше раскрывается в задачах, где его вклад явно нужен, роль понятна, а решение можно проверить через внутреннюю ясность и рабочий контекст.",
    detailed_explanation:
      "Кандидат лучше входит в задачу, когда его вклад явно запрошен, роль понятна, а ожидания согласованы заранее. В работе важно дать ему контекст, критерии результата и пространство для точной оценки ситуации. Если задача приходит хаотично или без понятной роли, может появляться задержка старта и лишнее напряжение.",
    how_it_appears_at_work:
      "На практике кандидат точнее включается, когда заранее понятны роль, запрос на участие и критерии результата.",
    synthesis_one_sentence:
      "Кандидат эффективнее входит в работу через ясный запрос, понятную роль и согласованные ожидания по результату.",
  },
};

function clientFieldGroupKey(path: string): string {
  const withoutIndex = path.replace(/\[\d+\]/g, "[]");
  if (withoutIndex.startsWith("base.risks")) return "base.risks";
  if (withoutIndex.startsWith("base.strengths")) return "base.strengths";
  if (withoutIndex.startsWith("base.what_to_check")) return "base.what_to_check";
  if (withoutIndex.startsWith("base.sections")) return "base.sections";
  if (withoutIndex.startsWith("base.where_useful")) return "base.where_useful";
  if (withoutIndex.startsWith("base.management_tips")) return "base.management_tips";
  if (withoutIndex.startsWith("special_payload.channel_talents")) {
    return "special_payload.channel_talents";
  }
  if (withoutIndex.startsWith("special_payload.center_zones")) return "special_payload.center_zones";
  if (withoutIndex.startsWith("special_payload.repeated_gate_themes")) {
    return "special_payload.repeated_gate_themes";
  }
  if (withoutIndex.startsWith("summary_for_synthesis.")) {
    const field = path.split(".")[1]?.replace(/\[\d+\]/, "") ?? path;
    return `summary_for_synthesis.${field}`;
  }
  if (withoutIndex.startsWith("matching_summary.")) {
    const field = path.split(".")[1]?.replace(/\[\d+\]/, "") ?? path;
    return `matching_summary.${field}`;
  }
  const parts = path.split(".");
  return parts.length >= 2 ? `${parts[0]}.${parts[1]}` : path;
}

/** Replace whole client-facing fields with deterministic HR text (no word surgery). */
export function applyCareerReadingDeterministicHdFallbacks(
  layer: Record<string, unknown>,
  layerKey: CareerReadingLayerKeyV1,
  offendingPaths: string[],
): void {
  const fallbacks = CAREER_READING_HD_FIELD_FALLBACKS[layerKey] ?? GENERIC_CAREER_READING_HD_FALLBACKS;
  const groups = new Set(offendingPaths.map(clientFieldGroupKey));
  const base = asRecord(layer.base);
  const synthesis = asRecord(layer.summary_for_synthesis);
  const matching = asRecord(layer.matching_summary);
  const special = asRecord(layer.special_payload);

  for (const group of groups) {
    switch (group) {
      case "base.headline":
      case "base.short_summary":
        base.short_summary = fallbacks.short_summary;
        base.headline = fallbacks.short_summary.split(/[.!?…]/u)[0]?.trim() || fallbacks.short_summary;
        break;
      case "base.detailed_explanation":
        base.detailed_explanation = fallbacks.detailed_explanation;
        break;
      case "base.how_it_appears_at_work":
        base.how_it_appears_at_work = fallbacks.how_it_appears_at_work;
        break;
      case "base.where_useful":
        base.where_useful = [
          "Роли и задачи, где вклад кандидата можно проверить через ясный запрос, роль и критерии результата.",
        ];
        break;
      case "base.management_tips":
        base.management_tips = [
          "Заранее согласовать роль, ожидания и критерии результата; давать контекст до старта задачи.",
        ];
        break;
      case "base.strengths":
        base.strengths = [
          {
            title: "Точное включение в задачу",
            description: fallbacks.short_summary,
            source_layer_keys: [layerKey],
          },
        ];
        break;
      case "base.risks":
        base.risks = [
          {
            title: "Риск некорректного входа",
            description:
              "Если роль и запрос на участие неясны, кандидат может дольше входить в задачу или испытывать лишнее напряжение.",
            how_it_may_show_up: "Задержка старта, уточняющие вопросы без перехода к действию.",
            mitigation: "Проверить через кейс: как кандидат действует при ясном запросе и критериях.",
          },
        ];
        break;
      case "base.what_to_check":
        base.what_to_check = [
          {
            hypothesis: "Проверить, как кандидат включается при ясной роли и запросе.",
            check_method: "Дать короткий кейс с понятной ролью и критериями результата.",
            good_signal: "Кандидат уточняет контекст и предлагает конкретный следующий шаг.",
            warning_signal: "Ответ остаётся общим или без связи с задачей.",
          },
        ];
        break;
      case "summary_for_synthesis.one_sentence":
        synthesis.one_sentence = fallbacks.synthesis_one_sentence;
        break;
      case "summary_for_synthesis.strengths":
        synthesis.strengths = [fallbacks.short_summary];
        break;
      case "summary_for_synthesis.risks":
        synthesis.risks = [
          "Риск задержки старта, если роль и запрос на участие не согласованы заранее.",
        ];
        break;
      case "summary_for_synthesis.conditions":
        synthesis.conditions = [
          "Ясная постановка задачи, понятный запрос на участие и согласованные ожидания по результату.",
        ];
        break;
      case "summary_for_synthesis.management_focus":
        synthesis.management_focus = [
          "Согласовать роль и критерии результата до старта; проверять реакцию на практическом кейсе.",
        ];
        break;
      case "summary_for_synthesis.what_to_check":
        synthesis.what_to_check = [
          "Проверить через интервью и короткий рабочий кейс с ясной ролью и критериями.",
        ];
        break;
      case "matching_summary.good_for":
        matching.good_for = [fallbacks.short_summary];
        break;
      case "matching_summary.bad_for":
        matching.bad_for = ["Роли без ясного контекста, роли и критериев результата."];
        break;
      case "matching_summary.role_fit_positive_signals":
        matching.role_fit_positive_signals = [fallbacks.short_summary];
        break;
      case "matching_summary.role_fit_risk_signals":
        matching.role_fit_risk_signals = [
          "Задержка включения при неясной роли или хаотичном входе в задачу.",
        ];
        break;
      case "matching_summary.check_in_role_fit":
        matching.check_in_role_fit = [
          "Проверить на интервью: как кандидат входит в задачу при ясном запросе и ожиданиях.",
        ];
        break;
      case "special_payload.channel_talents":
        special.channel_talents = Array.isArray(special.channel_talents)
          ? special.channel_talents.map((item) => {
              const rec = asRecord(item);
              return {
                ...rec,
                title: "Устойчивая связка талантов",
                summary:
                  "У кандидата есть устойчивая связка таланта, которую важно проверить через рабочий кейс и критерии результата.",
                risk: "Риск проявляется, если связка используется вне подходящего контекста задачи.",
                management_tip: "Дать ясный контекст и проверить вклад на практическом кейсе.",
                what_to_check: "Проверить через кейс, где эта связка даёт измеримый результат.",
              };
            })
          : special.channel_talents;
        break;
      case "special_payload.center_zones":
        special.center_zones = Array.isArray(special.center_zones)
          ? special.center_zones.map((item) => {
              const rec = asRecord(item);
              return {
                ...rec,
                title: "Рабочая зона",
                work_meaning:
                  "Зона влияет на то, как кандидат держит темп, фокус и реакцию на нагрузку в задаче.",
                potential_strength:
                  "При подходящих условиях даёт устойчивую опору для результата.",
                risk_under_pressure:
                  "Под давлением может усиливаться чувствительность к хаотичному контексту.",
                management_tip: "Согласовать ожидания, темп и критерии результата заранее.",
              };
            })
          : special.center_zones;
        break;
      case "special_payload.repeated_gate_themes":
        special.repeated_gate_themes = Array.isArray(special.repeated_gate_themes)
          ? special.repeated_gate_themes.map((item) => {
              const rec = asRecord(item);
              return {
                ...rec,
                title: "Повторяющаяся рабочая тема",
                summary:
                  "Одна из повторяющихся рабочих тем связана с устойчивым мотивом, который стоит проверить через кейс.",
                talent_potential:
                  "Может усиливать результат, когда тема совпадает с задачей и контекстом роли.",
                risk_pattern:
                  "Может создавать напряжение, если тема навязана средой без связи с задачей.",
              };
            })
          : special.repeated_gate_themes;
        break;
      default:
        break;
    }
  }

  layer.base = base;
  layer.summary_for_synthesis = synthesis;
  layer.matching_summary = matching;
  layer.special_payload = special;
}
