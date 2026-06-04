/**
 * HD Career Reading Layers v1 contract (Stage 4.10-A).
 *
 * Eight canonical HR career-reading layers from normalized_chart_data.
 * Contract + input mapping only — not wired to production generation.
 *
 * @see README_CAREER_READING_LAYERS_V1.md
 */

export const CAREER_READING_LAYERS_VERSION_V1 = "career_reading_layers_v1" as const;

export const CAREER_READING_LAYER_KEYS_V1 = [
  "work_mode_and_decisions",
  "profile_work_style",
  "conscious_work_theme",
  "background_work_pattern",
  "talent_channels",
  "repeated_themes",
  "centers_stability_and_sensitivity",
  "environment_focus_and_motivation",
] as const;

export type CareerReadingLayerKeyV1 = (typeof CAREER_READING_LAYER_KEYS_V1)[number];

export type CareerReadingLayerStatusV1 =
  | "ready"
  | "partial"
  | "not_applicable"
  | "missing_data";

export type CareerReadingConfidenceV1 = "high" | "medium" | "low";

export type CareerReadingPointV1 = {
  title: string;
  description: string;
  source_layer_keys?: string[];
};

export type CareerReadingRiskV1 = {
  title: string;
  description: string;
  how_it_may_show_up?: string;
  mitigation?: string;
};

export type CareerReadingCheckV1 = {
  hypothesis: string;
  check_method: string;
  good_signal: string;
  warning_signal: string;
};

export type CareerReadingSectionV1 = {
  title: string;
  body?: string;
  items?: string[];
};

export type CareerReadingClassicalSourceV1 = {
  source_key: string;
  source_label: string;
  raw_path: string;
  value_summary: string;
  confidence: CareerReadingConfidenceV1;
};

export type CareerReadingChartElementV1 = {
  kind:
    | "type"
    | "strategy"
    | "authority"
    | "profile"
    | "definition"
    | "center"
    | "channel"
    | "gate"
    | "planet"
    | "activation"
    | "variable"
    | "environment"
    | "motivation"
    | "other";
  key: string;
  value: string;
  side?: "personality" | "design" | null;
  planet?: string | null;
  line?: string | null;
};

export type CareerReadingLayerBaseV1 = {
  headline: string;
  short_summary: string;
  detailed_explanation?: string;
  how_it_appears_at_work?: string;
  where_useful?: string[];
  strengths?: CareerReadingPointV1[];
  risks?: CareerReadingRiskV1[];
  management_tips?: string[];
  what_to_check?: CareerReadingCheckV1[];
  sections?: CareerReadingSectionV1[];
};

export type CareerReadingLayerProV1 = {
  technical_title?: string;
  classical_sources: CareerReadingClassicalSourceV1[];
  source_values?: Record<string, unknown>;
  connection_logic: string;
  confidence: CareerReadingConfidenceV1;
  limitations?: string[];
  human_check?: string;
};

export type CareerReadingLayerEvidenceV1 = {
  source_fields: string[];
  source_chart_elements: CareerReadingChartElementV1[];
  confidence: CareerReadingConfidenceV1;
  warnings?: string[];
};

export type CareerReadingLayerSummaryForSynthesisV1 = {
  one_sentence: string;
  strengths: string[];
  risks: string[];
  conditions: string[];
  management_focus: string[];
  what_to_check: string[];
};

export type CareerReadingLayerMatchingSummaryV1 = {
  good_for: string[];
  bad_for: string[];
  role_fit_positive_signals: string[];
  role_fit_risk_signals: string[];
  check_in_role_fit: string[];
};

export type CareerReadingChannelTalentV1 = {
  channel_key: string;
  classical_name?: string;
  gates?: string[];
  centers?: string[];
  circuit?: string;
  title: string;
  summary: string;
  where_useful: string[];
  how_it_appears_at_work: string;
  risk: string;
  management_tip: string;
  what_to_check: CareerReadingCheckV1[];
  evidence: CareerReadingLayerEvidenceV1;
};

export type CareerReadingCenterZoneV1 = {
  center_key: string;
  classical_name: string;
  defined: boolean;
  title: string;
  work_meaning: string;
  potential_strength?: string;
  risk_under_pressure?: string;
  management_tip?: string;
  what_to_check?: CareerReadingCheckV1[];
};

export type CareerReadingRepeatedGateThemeV1 = {
  gate: string;
  sources: string[];
  title: string;
  summary: string;
  talent_potential?: string;
  risk_pattern?: string;
  what_to_check?: CareerReadingCheckV1[];
};

export type CareerReadingLayerSpecialPayloadV1 = {
  channel_talents?: CareerReadingChannelTalentV1[];
  channels_count?: number;
  center_zones?: CareerReadingCenterZoneV1[];
  repeated_gate_themes?: CareerReadingRepeatedGateThemeV1[];
};

export type CareerReadingLayerReportV1 = {
  layer_key: CareerReadingLayerKeyV1;
  title: string;
  status: CareerReadingLayerStatusV1;
  ui_priority: number;
  source_facts: Record<string, unknown>;
  base: CareerReadingLayerBaseV1;
  pro: CareerReadingLayerProV1;
  evidence: CareerReadingLayerEvidenceV1;
  summary_for_synthesis: CareerReadingLayerSummaryForSynthesisV1;
  matching_summary: CareerReadingLayerMatchingSummaryV1;
  special_payload?: CareerReadingLayerSpecialPayloadV1;
  qa: {
    base_has_forbidden_hd_terms?: boolean;
    pro_has_classical_sources?: boolean;
    has_summary_for_synthesis?: boolean;
    has_matching_summary?: boolean;
    human_review_recommended?: boolean;
  };
};

export const CAREER_READING_LAYER_CATALOG_V1 = {
  work_mode_and_decisions: {
    title: "Рабочий формат и решения",
    ui_priority: 10,
    source_fields: ["type", "strategy", "authority", "signature", "notSelfTheme"],
  },
  profile_work_style: {
    title: "Рабочий почерк",
    ui_priority: 20,
    source_fields: ["profile", "definition", "activations.personality.sun", "activations.design.sun"],
  },
  conscious_work_theme: {
    title: "Сознательная рабочая тема",
    ui_priority: 30,
    source_fields: ["activations.personality.sun", "activations.personality.earth"],
  },
  background_work_pattern: {
    title: "Фоновый рабочий паттерн",
    ui_priority: 40,
    source_fields: ["activations.design.sun", "activations.design.earth"],
  },
  talent_channels: {
    title: "Устойчивые связки талантов",
    ui_priority: 50,
    source_fields: ["channelsShort", "channelsLong", "circuitries"],
  },
  repeated_themes: {
    title: "Усиленные рабочие мотивы",
    ui_priority: 60,
    source_fields: ["gatesBoth", "gateSources"],
  },
  centers_stability_and_sensitivity: {
    title: "Устойчивые и чувствительные зоны",
    ui_priority: 70,
    source_fields: ["definedCenters", "openCenters", "centers"],
  },
  environment_focus_and_motivation: {
    title: "Среда, фокус и условия раскрытия",
    ui_priority: 80,
    source_fields: [
      "environment",
      "motivation",
      "transference",
      "perspective",
      "distraction",
      "cognition",
      "determination",
      "variables",
    ],
  },
} as const;

export type CareerReadingLayerCatalogEntryV1 =
  (typeof CAREER_READING_LAYER_CATALOG_V1)[CareerReadingLayerKeyV1];

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function asRecord(value: unknown): Record<string, unknown> {
  return isPlainObject(value) ? value : {};
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

function getActivationPlanet(
  chart: Record<string, unknown>,
  side: "personality" | "design",
  planet: string,
): string | null {
  const activations = asRecord(chart.activations);
  const sideMap = asRecord(activations[side]);
  const value = asString(sideMap[planet]);
  return value || null;
}

function extractLineFromActivation(activation: string | null): string | null {
  if (!activation) return null;
  const parts = activation.split(".");
  if (parts.length < 2) return null;
  const line = parts[parts.length - 1].trim();
  return line || null;
}

function normalizeCircuitries(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (Array.isArray(value)) {
    const arr = asStringArray(value);
    return arr.length > 0 ? arr.join(", ") : null;
  }
  return null;
}

function buildGateSourcesSummary(gateSources: Record<string, unknown>): string[] {
  return Object.entries(gateSources)
    .map(([gate, sources]) => {
      const list = asStringArray(sources);
      return list.length > 0 ? `${gate}: ${list.join(", ")}` : `${gate}: unknown`;
    })
    .filter(Boolean)
    .slice(0, 32);
}

function buildRepeatedGateCandidates(
  gatesBoth: string[],
  gateSources: Record<string, unknown>,
): Array<{ gate: string; sources: string[]; source_count: number }> {
  const candidates: Array<{ gate: string; sources: string[]; source_count: number }> = [];

  for (const gate of gatesBoth) {
    const sources = asStringArray(gateSources[gate]);
    candidates.push({ gate, sources, source_count: sources.length });
  }

  for (const [gate, rawSources] of Object.entries(gateSources)) {
    const sources = asStringArray(rawSources);
    if (sources.length < 2) continue;
    if (candidates.some((item) => item.gate === gate)) continue;
    candidates.push({ gate, sources, source_count: sources.length });
  }

  return candidates.sort((a, b) => b.source_count - a.source_count);
}

function pickOptionalArray(chart: Record<string, unknown>, key: string): unknown[] | undefined {
  const value = chart[key];
  if (!Array.isArray(value) || value.length === 0) return undefined;
  return value;
}

function buildNodesContext(chart: Record<string, unknown>): Record<string, string | null> {
  return {
    personality_north_node: getActivationPlanet(chart, "personality", "northNode"),
    personality_south_node: getActivationPlanet(chart, "personality", "southNode"),
    design_north_node: getActivationPlanet(chart, "design", "northNode"),
    design_south_node: getActivationPlanet(chart, "design", "southNode"),
  };
}

/**
 * Splits normalized_chart_data into per-layer compact inputs for future generation.
 * No OpenAI calls; deterministic field projection only.
 */
export function buildCareerReadingLayerInputsV1(
  normalizedChartData: unknown,
): Record<CareerReadingLayerKeyV1, unknown> {
  const chart = asRecord(normalizedChartData);
  const gateSources = asRecord(chart.gateSources);
  const gatesBoth = asStringArray(chart.gatesBoth);
  const channelsShort = asStringArray(chart.channelsShort);
  const channelsLong = asStringArray(chart.channelsLong);
  const personalitySun = getActivationPlanet(chart, "personality", "sun");
  const designSun = getActivationPlanet(chart, "design", "sun");

  const work_mode_and_decisions = {
    type: chart.type ?? null,
    strategy: chart.strategy ?? null,
    authority: chart.authority ?? null,
    signature: chart.signature ?? null,
    notSelfTheme: chart.notSelfTheme ?? chart.not_self_theme ?? null,
  };

  const profile_work_style = {
    profile: chart.profile ?? null,
    definition: chart.definition ?? null,
    personality_sun: personalitySun,
    personality_sun_line: extractLineFromActivation(personalitySun),
    design_sun: designSun,
    design_sun_line: extractLineFromActivation(designSun),
    activations: {
      personality: { sun: personalitySun },
      design: { sun: designSun },
    },
  };

  const conscious_work_theme = {
    activations: {
      personality: {
        sun: getActivationPlanet(chart, "personality", "sun"),
        earth: getActivationPlanet(chart, "personality", "earth"),
      },
    },
  };

  const background_work_pattern = {
    activations: {
      design: {
        sun: getActivationPlanet(chart, "design", "sun"),
        earth: getActivationPlanet(chart, "design", "earth"),
      },
    },
  };

  const talent_channels: Record<string, unknown> = {
    channelsShort,
    channelsLong,
    circuitries: normalizeCircuitries(chart.circuitries),
    channels_count: channelsShort.length,
  };
  const channelObjects = pickOptionalArray(chart, "channelObjects");
  if (channelObjects) talent_channels.channelObjects = channelObjects;
  if (channelsShort.length === 0) {
    talent_channels.gates_both_context = gatesBoth;
  }

  const repeatedThemesCandidates = buildRepeatedGateCandidates(gatesBoth, gateSources);
  const repeated_themes: Record<string, unknown> = {
    gatesBoth,
    gateSources,
    gate_sources_summary: buildGateSourcesSummary(gateSources),
    repeated_gate_candidates: repeatedThemesCandidates,
  };
  const strongGateSignals = pickOptionalArray(chart, "strongGateSignals");
  if (strongGateSignals) repeated_themes.strongGateSignals = strongGateSignals;

  const definedCenters = asStringArray(chart.definedCenters);
  const openCenters = asStringArray(chart.openCenters);
  const centers_stability_and_sensitivity: Record<string, unknown> = {
    definedCenters,
    openCenters,
    defined_centers: definedCenters,
    open_centers: openCenters,
  };
  if (chart.centers != null) centers_stability_and_sensitivity.centers = chart.centers;

  const environment_focus_and_motivation = {
    environment: chart.environment ?? null,
    motivation: chart.motivation ?? null,
    transference: chart.transference ?? null,
    perspective: chart.perspective ?? null,
    distraction: chart.distraction ?? null,
    cognition: chart.cognition ?? null,
    determination: chart.determination ?? null,
    variables: chart.variables ?? null,
    nodes: buildNodesContext(chart),
  };

  return {
    work_mode_and_decisions,
    profile_work_style,
    conscious_work_theme,
    background_work_pattern,
    talent_channels,
    repeated_themes,
    centers_stability_and_sensitivity,
    environment_focus_and_motivation,
  };
}
