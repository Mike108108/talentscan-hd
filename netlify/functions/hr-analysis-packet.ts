/**
 * Layer-ready analysis packet v1.1 for hr_person_talent_map.
 * Single-call today; structured for future multi-layer prompts + synthesis.
 */

type Side = "personality" | "design";

const FORBIDDEN_CLIENT_TERMS = [
  "Human Design",
  "Дизайн Человека",
  "бодиграф",
  "ворота",
  "каналы",
  "центры",
  "сакрал",
  "селезёнка",
  "эмоциональный центр",
  "профиль в техническом смысле",
  "авторитет",
  "стратегия в техническом смысле",
  "Генератор",
  "Проектор",
  "Манифестор",
  "Рефлектор",
  "Генный Ключ",
  "соционика",
  "социотип",
  "ЧС",
  "БЭ",
  "БЛ",
  "ЧИ",
];

const MAIN_AXIS_MEANINGS: Record<string, string> = {
  "personality.sun": "main_conscious_work_theme",
  "personality.earth": "grounding_conscious_theme",
  "design.sun": "main_background_work_pattern",
  "design.earth": "grounding_background_pattern",
};

const PLANET_PRIORITY_GROUPS: Record<string, string> = {
  sun: "main_axis",
  earth: "main_axis",
  moon: "inner_drive",
  mercury: "communication",
  venus: "values_relationships",
  mars: "growth_tension",
  jupiter: "rules_principles",
  saturn: "responsibility_maturity",
  uranus: "originality",
  neptune: "blind_spot_check_carefully",
  pluto: "deep_transformation",
  northNode: "environment_direction",
  southNode: "environment_direction",
};

function asString(value: unknown, fallback = ""): string {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return fallback;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asStringArray(value: unknown): string[] {
  return asArray(value).map((v) => asString(v)).filter(Boolean);
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

export function parseGateLine(value: unknown): { gate: string | null; line: string | null } {
  if (value == null) return { gate: null, line: null };

  let text: string;
  if (typeof value === "number" && Number.isFinite(value)) {
    text = String(value);
  } else if (typeof value === "string") {
    text = value.trim();
  } else {
    return { gate: null, line: null };
  }

  if (!text) return { gate: null, line: null };

  const dotMatch = text.match(/^(\d+)\.(\d+)$/);
  if (dotMatch) {
    return { gate: dotMatch[1], line: dotMatch[2] };
  }

  const gateOnly = text.match(/^(\d+)$/);
  if (gateOnly) {
    return { gate: gateOnly[1], line: null };
  }

  return { gate: null, line: null };
}

function buildMainAxes(
  activations: { personality: Record<string, string>; design: Record<string, string> },
): Record<string, unknown>[] {
  const axes: Array<{ side: Side; planet: "sun" | "earth"; priority: number }> = [
    { side: "personality", planet: "sun", priority: 1 },
    { side: "personality", planet: "earth", priority: 2 },
    { side: "design", planet: "sun", priority: 3 },
    { side: "design", planet: "earth", priority: 4 },
  ];

  return axes.map(({ side, planet, priority }) => {
    const value = activations[side]?.[planet] ?? "";
    const { gate, line } = parseGateLine(value);
    const key = `${side}.${planet}`;
    return {
      value: value || null,
      gate,
      line,
      side,
      planet,
      priority,
      meaning_for_ai: MAIN_AXIS_MEANINGS[key] ?? "main_axis_signal",
    };
  });
}

function buildPlanetaryActivationsList(
  activations: { personality: Record<string, string>; design: Record<string, string> },
): Record<string, unknown>[] {
  const result: Record<string, unknown>[] = [];

  for (const side of ["personality", "design"] as const) {
    const sideMap = activations[side] ?? {};
    for (const [planet, value] of Object.entries(sideMap)) {
      const { gate, line } = parseGateLine(value);
      result.push({
        side,
        planet,
        value: value || null,
        gate,
        line,
        priority_group: PLANET_PRIORITY_GROUPS[planet] ?? "secondary_signal",
      });
    }
  }

  return result;
}

function buildStrongGateSignals(
  gateSources: Record<string, string[]>,
  gatesBoth: string[],
): Record<string, unknown>[] {
  const bothSet = new Set(gatesBoth);
  const allGates = new Set<string>([
    ...Object.keys(gateSources),
    ...gatesBoth,
  ]);

  const signals = Array.from(allGates).map((gate) => {
    const rawSources = gateSources[gate];
    const sources = Array.isArray(rawSources)
      ? rawSources.filter((s) => typeof s === "string")
      : [];
    const isInBothSides = bothSet.has(gate);
    const strength = sources.length + (isInBothSides ? 1 : 0);

    return {
      gate,
      sources,
      strength,
      is_in_both_sides: isInBothSides,
      priority_hint: strength >= 2 ? "strong_repeated_theme" : "single_activation_theme",
    };
  });

  return signals.sort((a, b) => (b.strength as number) - (a.strength as number));
}

function parseChannelEntry(
  entry: string,
  source: "channelsLong" | "channelsShort",
): { key: string; name: string | null; gates: string[] } | null {
  const trimmed = entry.trim();
  if (!trimmed) return null;

  const match = trimmed.match(/^(\d+)\s*-\s*(\d+)(?:\s+(.+))?$/);
  if (!match) return null;

  const gate1 = match[1];
  const gate2 = match[2];
  const key = `${gate1}-${gate2}`;
  const nameRaw = match[3]?.trim();
  const name = nameRaw || null;

  return { key, name, gates: [gate1, gate2], source };
}

function buildChannelObjects(
  channelsLong: string[],
  channelsShort: string[],
): Record<string, unknown>[] {
  const byKey = new Map<string, Record<string, unknown>>();

  for (const entry of channelsLong) {
    const parsed = parseChannelEntry(entry, "channelsLong");
    if (!parsed) continue;
    const existing = byKey.get(parsed.key);
    if (!existing) {
      byKey.set(parsed.key, {
        key: parsed.key,
        name: parsed.name,
        gates: parsed.gates,
        source: "channelsLong",
        priority_hint: "stable_talent_link",
      });
    } else if (!existing.name && parsed.name) {
      existing.name = parsed.name;
    }
  }

  for (const entry of channelsShort) {
    const parsed = parseChannelEntry(entry, "channelsShort");
    if (!parsed) continue;
    if (!byKey.has(parsed.key)) {
      byKey.set(parsed.key, {
        key: parsed.key,
        name: parsed.name,
        gates: parsed.gates,
        source: "channelsShort",
        priority_hint: "stable_talent_link",
      });
    }
  }

  return Array.from(byKey.values());
}

function buildCenterObjects(
  definedCenters: string[],
  openCenters: string[],
): Record<string, unknown>[] {
  const definedSet = new Set(definedCenters);
  const allNames = Array.from(new Set([...definedCenters, ...openCenters]));

  return allNames.map((name) => ({
    name,
    defined: definedSet.has(name),
    group: definedSet.has(name) ? "stable_zone" : "sensitive_zone",
  }));
}

function buildSourceChart(normalizedChart: Record<string, unknown> | null) {
  const chart = normalizedChart ?? {};
  const activationsRaw = asRecord(chart.activations);
  const personality = asRecord(activationsRaw.personality) as Record<string, string>;
  const design = asRecord(activationsRaw.design) as Record<string, string>;

  const gateSourcesRaw = asRecord(chart.gateSources);
  const gateSources: Record<string, string[]> = {};
  for (const [gate, sources] of Object.entries(gateSourcesRaw)) {
    gateSources[gate] = Array.isArray(sources)
      ? sources.filter((s): s is string => typeof s === "string")
      : [];
  }

  return {
    has_normalized_chart: normalizedChart != null,
    passport: {
      type: chart.type ?? null,
      profile: chart.profile ?? null,
      strategy: chart.strategy ?? null,
      authority: chart.authority ?? null,
      signature: chart.signature ?? null,
      notSelfTheme: chart.notSelfTheme ?? null,
      definition: chart.definition ?? null,
      incarnationCross: chart.incarnationCross ?? null,
    },
    centers: {
      definedCenters: asStringArray(chart.definedCenters),
      openCenters: asStringArray(chart.openCenters),
    },
    channels: {
      channelsShort: asStringArray(chart.channelsShort),
      channelsLong: asStringArray(chart.channelsLong),
    },
    gates: {
      gatesAll: asStringArray(chart.gatesAll),
      gatesPersonality: asStringArray(chart.gatesPersonality),
      gatesDesign: asStringArray(chart.gatesDesign),
      gatesBoth: asStringArray(chart.gatesBoth),
      gateSources,
    },
    activations: { personality, design },
    variables: {
      variables: chart.variables ?? null,
      cognition: chart.cognition ?? null,
      determination: chart.determination ?? null,
      motivation: chart.motivation ?? null,
      transference: chart.transference ?? null,
      perspective: chart.perspective ?? null,
      distraction: chart.distraction ?? null,
      environment: chart.environment ?? null,
      circuitries: chart.circuitries ?? null,
      birthDateUtc: chart.birthDateUtc ?? null,
      canRenderBodygraph: chart.canRenderBodygraph ?? false,
      missingForBodygraph: asStringArray(chart.missingForBodygraph),
    },
    raw_normalized_chart: normalizedChart,
  };
}

function buildVacancyContext(vacancy: Record<string, unknown> | null) {
  return {
    is_present: vacancy != null,
    usage: "context_only_not_scoring",
    should_score_role_fit: false,
    vacancy: vacancy
      ? {
          id: vacancy.id,
          title: vacancy.title,
          status: vacancy.status,
          department: vacancy.department ?? null,
          employment_format: vacancy.employment_format ?? null,
          work_format: vacancy.work_format ?? null,
          location: vacancy.location ?? null,
          schedule: vacancy.schedule ?? null,
          role_description: vacancy.role_description ?? null,
          responsibilities: vacancy.responsibilities ?? null,
          kpi: vacancy.kpi ?? null,
          must_have: vacancy.must_have ?? null,
          nice_to_have: vacancy.nice_to_have ?? null,
          working_conditions: vacancy.working_conditions ?? null,
          manager_context: vacancy.manager_context ?? null,
          team_context: vacancy.team_context ?? null,
          hiring_priorities: vacancy.hiring_priorities ?? null,
          risks_to_check: vacancy.risks_to_check ?? null,
        }
      : null,
  };
}

function computeReportConfidenceHint(
  sourceChart: ReturnType<typeof buildSourceChart>,
  candidate: Record<string, unknown>,
): string {
  const hasChart = sourceChart.has_normalized_chart;
  const hasActivations =
    Object.keys(sourceChart.activations.personality).length > 0 ||
    Object.keys(sourceChart.activations.design).length > 0;
  const hasChannels =
    sourceChart.channels.channelsLong.length > 0 ||
    sourceChart.channels.channelsShort.length > 0;
  const hasCenters =
    sourceChart.centers.definedCenters.length > 0 ||
    sourceChart.centers.openCenters.length > 0;
  const hasBirthDate = Boolean(asString(candidate.birth_date));
  const hasBirthTime = Boolean(asString(candidate.birth_time));
  const hasBirthPlace = Boolean(asString(candidate.birth_place_text));
  const hasHrComment = Boolean(asString(candidate.hr_comment));

  if (
    hasChart &&
    hasActivations &&
    hasChannels &&
    hasCenters &&
    hasBirthDate &&
    hasBirthTime &&
    hasBirthPlace
  ) {
    return "high";
  }

  if (hasChart && hasActivations && hasCenters && !hasHrComment) {
    return "medium_high";
  }

  if (hasChart && (hasActivations || hasCenters || hasChannels)) {
    return "medium";
  }

  return "low";
}

function buildAnalysisLayers(args: {
  sourceChart: ReturnType<typeof buildSourceChart>;
  mainAxes: Record<string, unknown>[];
  channelObjects: Record<string, unknown>[];
  centerObjects: Record<string, unknown>[];
  strongGateSignals: Record<string, unknown>[];
  planetaryActivationsList: Record<string, unknown>[];
  candidate: Record<string, unknown>;
  vacancyContext: ReturnType<typeof buildVacancyContext>;
}): Record<string, unknown>[] {
  const { sourceChart, mainAxes, channelObjects, centerObjects, strongGateSignals, planetaryActivationsList, candidate, vacancyContext } = args;
  const passport = sourceChart.passport;

  return [
    {
      id: "passport_work_format",
      title: "Рабочий формат и вход в задачи",
      priority: 1,
      can_be_processed_independently: true,
      future_prompt_type: "layer_prompt",
      input_summary: {
        type: passport.type,
        strategy: passport.strategy,
        authority: passport.authority,
        profile: passport.profile,
        definition: passport.definition,
        signature: passport.signature,
        notSelfTheme: passport.notSelfTheme,
      },
      source_refs: ["source_chart.passport"],
      target_sections: [
        "executive_summary",
        "working_formula",
        "management_style",
        "onboarding_7_30_90",
      ],
    },
    {
      id: "main_axes",
      title: "Главные оси рабочей темы",
      priority: 2,
      can_be_processed_independently: true,
      future_prompt_type: "layer_prompt",
      input_summary: { main_axes: mainAxes },
      source_refs: [
        "source_chart.activations.personality.sun",
        "source_chart.activations.personality.earth",
        "source_chart.activations.design.sun",
        "source_chart.activations.design.earth",
      ],
      target_sections: [
        "executive_summary",
        "talents",
        "strengths",
        "risks",
        "final_hr_recommendation",
      ],
    },
    {
      id: "channels_talent_links",
      title: "Стабильные связки талантов",
      priority: 3,
      can_be_processed_independently: true,
      future_prompt_type: "layer_prompt",
      input_summary: {
        channel_objects: channelObjects,
        channelsLong: sourceChart.channels.channelsLong,
        channelsShort: sourceChart.channels.channelsShort,
      },
      source_refs: ["derived.channel_objects", "source_chart.channels"],
      target_sections: [
        "talents",
        "strengths",
        "suitable_directions",
        "test_tasks",
        "interview_questions",
      ],
    },
    {
      id: "centers_stability_and_sensitivity",
      title: "Стабильные и чувствительные зоны",
      priority: 4,
      can_be_processed_independently: true,
      future_prompt_type: "layer_prompt",
      input_summary: {
        center_objects: centerObjects,
        definedCenters: sourceChart.centers.definedCenters,
        openCenters: sourceChart.centers.openCenters,
      },
      source_refs: ["derived.center_objects", "source_chart.centers"],
      target_sections: [
        "work_environment",
        "management_style",
        "risks",
        "onboarding_7_30_90",
      ],
    },
    {
      id: "strong_gate_themes",
      title: "Повторяющиеся темы активаций",
      priority: 5,
      can_be_processed_independently: true,
      future_prompt_type: "layer_prompt",
      input_summary: {
        strong_gate_signals: strongGateSignals,
        gatesBoth: sourceChart.gates.gatesBoth,
        gateSources: sourceChart.gates.gateSources,
      },
      source_refs: ["derived.strong_gate_signals", "source_chart.gates"],
      target_sections: [
        "talents",
        "risks",
        "interview_questions",
        "test_tasks",
      ],
    },
    {
      id: "planetary_work_roles",
      title: "Роли планетарных активаций в работе",
      priority: 6,
      can_be_processed_independently: true,
      future_prompt_type: "layer_prompt",
      input_summary: { planetary_activations_list: planetaryActivationsList },
      source_refs: ["derived.planetary_activations_list"],
      target_sections: [
        "communication",
        "interview_questions",
        "risks",
        "management_style",
        "onboarding_7_30_90",
      ],
    },
    {
      id: "variables_environment_motivation",
      title: "Среда, мотивация и переменные",
      priority: 7,
      can_be_processed_independently: true,
      future_prompt_type: "layer_prompt",
      input_summary: sourceChart.variables,
      source_refs: ["source_chart.variables"],
      target_sections: [
        "work_environment",
        "management_style",
        "risks",
        "onboarding_7_30_90",
      ],
      caution: "Use cautiously; no medical, dietary or deterministic recommendations.",
    },
    {
      id: "data_quality_and_next_steps",
      title: "Качество данных и следующие шаги",
      priority: 8,
      can_be_processed_independently: true,
      future_prompt_type: "layer_prompt",
      input_summary: {
        candidate_name: candidate.name ?? null,
        has_hr_comment: Boolean(asString(candidate.hr_comment)),
        has_vacancy_context: vacancyContext.is_present,
        chart_quality: {
          has_normalized_chart: sourceChart.has_normalized_chart,
          can_render_bodygraph: sourceChart.variables.canRenderBodygraph,
          missing_for_bodygraph: sourceChart.variables.missingForBodygraph,
        },
      },
      source_refs: ["candidate", "vacancy_context", "source_chart", "data_quality"],
      target_sections: [
        "data_quality",
        "final_hr_recommendation",
        "interview_questions",
        "test_tasks",
      ],
    },
  ];
}

export function buildHrPersonTalentMapAnalysisPacketV11(args: {
  company: Record<string, unknown>;
  candidate: Record<string, unknown>;
  vacancy: Record<string, unknown> | null;
  normalizedChart: Record<string, unknown> | null;
  promptVersion: string;
}): Record<string, unknown> {
  const { company, candidate, vacancy, normalizedChart, promptVersion } = args;

  const sourceChart = buildSourceChart(normalizedChart);
  const activations = sourceChart.activations as {
    personality: Record<string, string>;
    design: Record<string, string>;
  };

  const mainAxes = buildMainAxes(activations);
  const planetaryActivationsList = buildPlanetaryActivationsList(activations);
  const strongGateSignals = buildStrongGateSignals(
    sourceChart.gates.gateSources as Record<string, string[]>,
    sourceChart.gates.gatesBoth as string[],
  );
  const channelObjects = buildChannelObjects(
    sourceChart.channels.channelsLong as string[],
    sourceChart.channels.channelsShort as string[],
  );
  const centerObjects = buildCenterObjects(
    sourceChart.centers.definedCenters as string[],
    sourceChart.centers.openCenters as string[],
  );

  const vacancyContext = buildVacancyContext(vacancy);

  const hasActivations =
    Object.keys(activations.personality).length > 0 ||
    Object.keys(activations.design).length > 0;
  const hasChannels =
    (sourceChart.channels.channelsLong as string[]).length > 0 ||
    (sourceChart.channels.channelsShort as string[]).length > 0;
  const hasCenters =
    (sourceChart.centers.definedCenters as string[]).length > 0 ||
    (sourceChart.centers.openCenters as string[]).length > 0;

  const reportConfidenceHint = computeReportConfidenceHint(sourceChart, candidate);

  const analysisLayers = buildAnalysisLayers({
    sourceChart,
    mainAxes,
    channelObjects,
    centerObjects,
    strongGateSignals,
    planetaryActivationsList,
    candidate,
    vacancyContext,
  });

  return {
    report_context: {
      report_type: "hr_person_talent_map",
      prompt_version: promptVersion,
      language: "ru",
      client_mode: "hr_plain_language",
      architecture: "layer_ready_single_call",
      is_role_fit_report: false,
      current_execution_mode: "single_openai_call",
      future_execution_mode: "multi_layer_prompts_plus_synthesis",
    },

    company: {
      id: company.id,
      name: company.name,
      industry: company.industry ?? null,
    },

    candidate: {
      id: candidate.id,
      name: candidate.name,
      email: candidate.email ?? null,
      phone: candidate.phone ?? null,
      vacancy_title: candidate.vacancy_title ?? null,
      status: candidate.status ?? null,
      hr_comment: candidate.hr_comment ?? null,
      birth_date: candidate.birth_date ?? null,
      birth_time: candidate.birth_time ?? null,
      birth_place_text: candidate.birth_place_text ?? null,
      birth_timezone: candidate.birth_timezone ?? null,
      chart_status: candidate.chart_status ?? null,
    },

    vacancy_context: vacancyContext,

    source_chart: sourceChart,

    analysis_layers: analysisLayers,

    synthesis_plan: {
      final_report_type: "hr_person_talent_map",
      current_mode: "single_call",
      future_mode: "multi_layer_outputs_plus_synthesis",
      principles: [
        "Do not mechanically list layers.",
        "First read analysis_layers in priority order, then synthesize a coherent HR report.",
        "Combine repeated signals into stronger conclusions.",
        "Separate talents, risks, conditions, interview checks and onboarding advice.",
        "Do not calculate role-fit percentage in a general talent map.",
        "Every major risk must include a practical check.",
        "Do not show technical chart language to the HR user.",
      ],
      future_pipeline_hint: {
        layer_outputs_can_be_stored_later: true,
        synthesis_prompt_can_merge_layer_outputs_later: true,
        current_implementation_must_remain_single_call: true,
      },
    },

    data_quality: {
      chart: {
        has_normalized_chart: sourceChart.has_normalized_chart,
        can_render_bodygraph: sourceChart.variables.canRenderBodygraph,
        missing_for_bodygraph: sourceChart.variables.missingForBodygraph,
        has_activations: hasActivations,
        has_channels: hasChannels,
        has_centers: hasCenters,
        has_birth_utc: Boolean(sourceChart.variables.birthDateUtc),
      },
      candidate: {
        has_name: Boolean(asString(candidate.name)),
        has_birth_date: Boolean(asString(candidate.birth_date)),
        has_birth_time: Boolean(asString(candidate.birth_time)),
        has_birth_place: Boolean(asString(candidate.birth_place_text)),
        has_birth_timezone: Boolean(asString(candidate.birth_timezone)),
        has_hr_comment: Boolean(asString(candidate.hr_comment)),
      },
      vacancy: {
        has_vacancy_context: vacancyContext.is_present,
        should_score_role_fit: false,
        usage: "context_only_not_scoring",
      },
      report_confidence_hint: reportConfidenceHint,
      limitations_for_ai: [
        "This is a general candidate talent map, not a role-fit assessment.",
        "Do not calculate percentage fit for a vacancy.",
        "If vacancy context is missing, recommend adding it for a separate role-fit report.",
      ],
    },

    prompt_rules: {
      client_language: "plain_hr_russian",
      forbidden_client_terms: FORBIDDEN_CLIENT_TERMS,
      interpretation_rules: [
        "Use all conclusions as HR hypotheses, not final hiring decisions.",
        "Translate technical map data into practical work language.",
        "Every important risk must include how to check it.",
        "Do not invent biography, experience or achievements.",
        "Do not mix general talent map with vacancy fit scoring.",
        "Do not give medical, dietary or deterministic recommendations.",
        "Do not expose technical Human Design, Gene Keys or socionics terminology to the HR user.",
      ],
      priority_rules: [
        "Use analysis_layers in priority order.",
        "Use main_axes first for central interpretation.",
        "Use channel_objects as stable talent links.",
        "Use strong_gate_signals as repeated themes.",
        "Use center_objects for stable and sensitive work zones.",
        "Use variables and environment cautiously.",
      ],
    },
  };
}
