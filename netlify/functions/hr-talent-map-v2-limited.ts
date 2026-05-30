/**
 * Limited v2 HR talent map generation (atomic layer_reports + deterministic synthesis).
 * Behind HR_TALENT_MAP_V2_LIMITED_LAYERS_ENABLED — not used in production by default.
 */

import {
  BANNED_TERMS_USER_MESSAGE,
  findBannedClientTerms,
} from "./hr-report-normalize";

export const V2_LIMITED_PROMPT_VERSION = "hr_person_talent_map_v2_limited_layers_0_1";
export const V2_SCHEMA_VERSION = "hr_person_talent_map_v2";
const SOURCE_ANALYSIS_PACKET_VERSION = "analysis_packet_v1_1";
const CONTENT_CONTRACT_VERSION = "2.0.0";
const DEFAULT_OPENAI_TIMEOUT_MS = 22_000;
const MAX_BASE_FIELD_CHARS = 280;
const OPENAI_MAX_OUTPUT_TOKENS = 2200;

/** Only these layers use OpenAI on the limited proof-of-concept stage. */
const AI_LAYER_KEYS = ["work_format", "task_entry", "decision_style"] as const;

const PLANNED_LAYER_KEYS = [
  "work_signature",
  "inner_coherence",
  "stable_zones",
  "sensitive_zones",
] as const;

type AiLayerKey = (typeof AI_LAYER_KEYS)[number];
type PlannedLayerKey = (typeof PLANNED_LAYER_KEYS)[number];

export type V2LayerKey =
  | AiLayerKey
  | PlannedLayerKey
  | "chart_passport"
  | "data_quality";

export type V2LimitedLogContext = {
  companyId?: string;
  candidateId?: string;
  reportType?: string;
  promptVersion?: string;
};

function resolveOpenAiTimeoutMs(): number {
  const raw = Number.parseInt(
    process.env.HR_TALENT_MAP_V2_OPENAI_TIMEOUT_MS ?? "",
    10,
  );
  if (Number.isFinite(raw) && raw >= 5_000 && raw <= 25_000) return raw;
  return DEFAULT_OPENAI_TIMEOUT_MS;
}

function logV2Stage(
  stage: string,
  ctx: V2LimitedLogContext,
  extra?: Record<string, unknown>,
) {
  console.info("[hr-talent-map-v2-limited]", {
    stage,
    company_id: ctx.companyId,
    candidate_id: ctx.candidateId,
    report_type: ctx.reportType,
    prompt_version: ctx.promptVersion,
    ...extra,
  });
}

function truncateText(value: string, max = MAX_BASE_FIELD_CHARS): string {
  const t = value.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

const LAYER_META: Record<
  V2LayerKey,
  { hr_title: string; group: string; ui_priority: number }
> = {
  chart_passport: {
    hr_title: "Паспорт рабочей карты",
    group: "core",
    ui_priority: 1,
  },
  work_format: {
    hr_title: "Рабочий формат",
    group: "energy_and_decision",
    ui_priority: 2,
  },
  task_entry: {
    hr_title: "Вход в задачи",
    group: "energy_and_decision",
    ui_priority: 3,
  },
  decision_style: {
    hr_title: "Принятие решений",
    group: "energy_and_decision",
    ui_priority: 4,
  },
  work_signature: {
    hr_title: "Рабочий почерк",
    group: "core",
    ui_priority: 5,
  },
  inner_coherence: {
    hr_title: "Внутренняя связность",
    group: "core",
    ui_priority: 6,
  },
  stable_zones: {
    hr_title: "Устойчивые зоны",
    group: "centers_channels_gates",
    ui_priority: 7,
  },
  sensitive_zones: {
    hr_title: "Чувствительные зоны",
    group: "centers_channels_gates",
    ui_priority: 8,
  },
  data_quality: {
    hr_title: "Надёжность данных",
    group: "evidence_and_quality",
    ui_priority: 9,
  },
};

export class V2GenerationError extends Error {
  readonly stage: string;

  constructor(stage: string, message: string) {
    super(message);
    this.name = "V2GenerationError";
    this.stage = stage;
  }
}

function asString(value: unknown, fallback = ""): string {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return fallback;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((v) => asString(v)).filter(Boolean);
}

function normalizeConfidence(raw: unknown): "high" | "medium" | "low" | "unknown" {
  const v = asString(raw).toLowerCase();
  if (v === "high" || v === "medium" || v === "low") return v;
  return "unknown";
}

function extractJsonContent(raw: string): Record<string, unknown> {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)```$/i);
  const jsonText = fenced ? fenced[1].trim() : trimmed;
  if (/^```/m.test(jsonText)) {
    throw new V2GenerationError("v2_limited_layers_parse", "Ответ содержит markdown-ограждения.");
  }
  const parsed: unknown = JSON.parse(jsonText);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new V2GenerationError("v2_limited_layers_parse", "OpenAI вернул JSON неожиданной структуры.");
  }
  return parsed as Record<string, unknown>;
}

function hasDisallowedHtml(text: string): boolean {
  if (!/<[a-z!/]/i.test(text)) return false;
  const stripped = text.replace(/<\/?(em|strong)\b[^>]*>/gi, "");
  return /<[a-z!/]/i.test(stripped);
}

function collectBaseTextFields(layer: Record<string, unknown>): string[] {
  const base = asRecord(layer.base);
  const texts: string[] = [];
  for (const key of [
    "short_summary",
    "detailed_explanation",
    "how_it_appears_at_work",
    "where_useful",
    "risks",
    "management_tips",
    "what_to_check",
  ]) {
    const v = base[key];
    if (typeof v === "string" && v.trim()) texts.push(v);
  }
  return texts;
}

function collectSynthesisClientTexts(blocks: Record<string, unknown>): string[] {
  const texts: string[] = [];
  for (const block of Object.values(blocks)) {
    const rec = asRecord(block);
    for (const key of [
      "text",
      "summary",
      "one_sentence",
      "best_use",
      "main_value",
      "main_risk",
      "how_to_check_first",
      "decision_note",
    ]) {
      const v = rec[key];
      if (typeof v === "string" && v.trim()) texts.push(v);
    }
    const items = Array.isArray(rec.items) ? rec.items : [];
    for (const item of items) {
      const row = asRecord(item);
      if (typeof row.body === "string" && row.body.trim()) texts.push(row.body);
      if (typeof row.title === "string" && row.title.trim()) texts.push(row.title);
    }
    const cards = Array.isArray(rec.cards) ? rec.cards : [];
    for (const card of cards) {
      const c = asRecord(card);
      if (c.client_visible === false) continue;
      for (const key of [
        "title",
        "statement",
        "why_it_matters",
        "workplace_manifestation",
        "how_to_check",
        "good_signal",
        "warning_signal",
      ]) {
        const v = c[key];
        if (typeof v === "string" && v.trim()) texts.push(v);
      }
    }
    const checks = Array.isArray(rec.checks) ? rec.checks : [];
    for (const check of checks) {
      const c = asRecord(check);
      for (const key of [
        "risk",
        "how_it_may_show_up",
        "interview_check",
        "test_task_check",
        "good_signal",
        "warning_signal",
        "management_prevention",
      ]) {
        const v = c[key];
        if (typeof v === "string" && v.trim()) texts.push(v);
      }
    }
    const playbook = asRecord(rec.playbook);
    for (const v of Object.values(playbook)) {
      if (typeof v === "string" && v.trim()) texts.push(v);
    }
  }
  return texts;
}

function scanV2BaseBannedTerms(content: Record<string, unknown>): string[] {
  const layerReports = Array.isArray(content.layer_reports) ? content.layer_reports : [];
  const baseOnly = {
    layer_reports: layerReports
      .filter((layer) => asString(asRecord(layer).status, "ready") === "ready")
      .map((layer) => {
        const rec = asRecord(layer);
        return { base: rec.base ?? {} };
      }),
    synthesis_blocks: content.synthesis_blocks ?? {},
  };
  return findBannedClientTerms(baseOnly);
}

function scanV2BaseHtml(content: Record<string, unknown>): boolean {
  const layerReports = Array.isArray(content.layer_reports) ? content.layer_reports : [];
  for (const layer of layerReports) {
    const rec = asRecord(layer);
    if (asString(rec.status, "ready") !== "ready") continue;
    for (const text of collectBaseTextFields(rec)) {
      if (hasDisallowedHtml(text)) return true;
    }
  }
  const synthesis = asRecord(content.synthesis_blocks);
  for (const text of collectSynthesisClientTexts(synthesis)) {
    if (hasDisallowedHtml(text)) return true;
  }
  return false;
}

function buildCompactAiInput(analysisPacket: Record<string, unknown>): Record<string, unknown> {
  const sourceChart = asRecord(analysisPacket.source_chart);
  const passport = asRecord(sourceChart.passport);
  const centers = asRecord(sourceChart.centers);
  const variables = asRecord(sourceChart.variables);
  const dq = asRecord(analysisPacket.data_quality);
  const candidate = asRecord(analysisPacket.candidate);
  const rules = asRecord(analysisPacket.prompt_rules);

  const analysisLayers = Array.isArray(analysisPacket.analysis_layers)
    ? analysisPacket.analysis_layers
    : [];
  const compactLayers = analysisLayers
    .filter((layer) => {
      const id = asString(asRecord(layer).id);
      return (
        id === "passport_work_format" ||
        id === "main_axes" ||
        id === "centers_stability_and_sensitivity" ||
        id === "data_quality_and_next_steps"
      );
    })
    .map((layer) => {
      const rec = asRecord(layer);
      return {
        id: rec.id,
        title: rec.title,
        priority: rec.priority,
        input_summary: rec.input_summary,
        source_refs: rec.source_refs,
      };
    });

  return {
    report_context: analysisPacket.report_context ?? null,
    candidate: {
      id: candidate.id ?? null,
      has_hr_comment: Boolean(asString(candidate.hr_comment)),
      chart_status: candidate.chart_status ?? null,
    },
    source_chart: {
      passport: {
        type: passport.type ?? null,
        strategy: passport.strategy ?? null,
        authority: passport.authority ?? null,
        profile: passport.profile ?? null,
        definition: passport.definition ?? null,
      },
      centers: {
        definedCenters: asStringArray(centers.definedCenters).slice(0, 12),
        openCenters: asStringArray(centers.openCenters).slice(0, 12),
      },
      variables: {
        environment: variables.environment ?? null,
        motivation: variables.motivation ?? null,
        canRenderBodygraph: variables.canRenderBodygraph ?? false,
        missingForBodygraph: asStringArray(variables.missingForBodygraph).slice(0, 8),
      },
    },
    data_quality: {
      report_confidence_hint: dq.report_confidence_hint ?? null,
      chart: asRecord(dq.chart),
      candidate: asRecord(dq.candidate),
    },
    analysis_layers: compactLayers,
    prompt_rules: {
      forbidden_client_terms: asStringArray(rules.forbidden_client_terms).slice(0, 12),
      interpretation_rules: asStringArray(rules.interpretation_rules).slice(0, 4),
    },
  };
}

function buildV2LimitedSystemPrompt(): string {
  return `TalentScan HR Layer Engine (v2 limited, 3 layers only).

Верни JSON { "layer_reports": [...] } для layer_key: work_format, task_entry, decision_style.
Короткие формулировки: каждое base-поле до 220 символов, pro.connection_logic до 120, evidence.limitations до 120.
base — HR-язык без Human Design / соционики. pro/evidence — технические ссылки допустимы.
Без fit_score, role-fit, «брать/не брать». Только compact_input. Без markdown.`;
}

function buildV2LimitedUserPrompt(compactInput: Record<string, unknown>): string {
  const keysList = AI_LAYER_KEYS.join(", ");
  return `Сгенерируй ровно 3 layer_reports: ${keysList}.
status=ready. base-поля — строки. Короткий JSON.

Шаблон элемента:
{"layer_key":"","hr_title":"","group":"energy_and_decision","status":"ready","ui_priority":2,"base":{"short_summary":"","detailed_explanation":"","how_it_appears_at_work":"","where_useful":"","risks":"","management_tips":"","what_to_check":""},"pro":{"technical_sources":[],"source_values":{},"connection_logic":"","confidence":"medium","human_check":""},"evidence":{"source_fields":[],"source_layer_keys":[],"confidence":"medium","limitations":"","warnings":[]}}

compact_input:
${JSON.stringify(compactInput)}`;
}

function buildPlannedLayer(layerKey: PlannedLayerKey): Record<string, unknown> {
  const meta = LAYER_META[layerKey];
  return {
    layer_key: layerKey,
    hr_title: meta.hr_title,
    group: meta.group,
    status: "planned",
    ui_priority: meta.ui_priority,
    base: {
      short_summary:
        "Этот слой будет раскрыт в следующем этапе послойной генерации.",
      detailed_explanation: "",
      how_it_appears_at_work: "",
      where_useful: "",
      risks: "",
      management_tips: "",
      what_to_check: "",
    },
    pro: {
      technical_sources: [],
      source_values: {},
      connection_logic: "Слой не генерировался AI на limited этапе.",
      confidence: "unknown",
      human_check: "",
    },
    evidence: {
      source_fields: [],
      source_layer_keys: [],
      confidence: "unknown",
      limitations: "Слой не генерировался AI на limited этапе.",
      warnings: ["planned_on_limited_stage"],
    },
  };
}

function buildDataQualityLayerReport(
  analysisPacket: Record<string, unknown>,
): Record<string, unknown> {
  const dq = asRecord(analysisPacket.data_quality);
  const hint = asString(dq.report_confidence_hint, "medium");
  const chart = asRecord(dq.chart);
  const candidate = asRecord(dq.candidate);
  const meta = LAYER_META.data_quality;

  const missing: string[] = [];
  if (!candidate.has_hr_comment) missing.push("комментарий HR");
  if (!candidate.has_birth_time) missing.push("время рождения");
  if (!candidate.has_birth_place) missing.push("место рождения");

  const shortSummary = chart.has_normalized_chart
    ? "Данных карты достаточно для ограниченного v2-отчёта; часть слоёв пока в статусе planned."
    : "Данные карты неполные — выводы по AI-слоям носят осторожный характер.";

  return {
    layer_key: "data_quality",
    hr_title: meta.hr_title,
    group: meta.group,
    status: "ready",
    ui_priority: meta.ui_priority,
    base: {
      short_summary: shortSummary,
      detailed_explanation: truncateText(
        `Режим layered_limited: 3 AI-слоя (work_format, task_entry, decision_style).${
          missing.length ? ` Не хватает: ${missing.join(", ")}.` : ""
        }`,
        400,
      ),
      how_it_appears_at_work: "",
      where_useful: "",
      risks: missing.length
        ? "Неполный HR-контекст может снижать точность гипотез."
        : "",
      management_tips: "Дополните комментарий HR и контекст команды перед финальным решением.",
      what_to_check: "Сверить AI-гипотезы с интервью и наблюдением в первые недели.",
    },
    pro: {
      technical_sources: ["data_quality.chart", "data_quality.candidate"],
      source_values: { chart, candidate },
      connection_logic: "Детерминированный слой data_quality для limited v2.",
      confidence: normalizeConfidence(hint),
      human_check: "Проверить полноту birth data и HR-комментарий.",
    },
    evidence: {
      source_fields: ["data_quality.report_confidence_hint"],
      source_layer_keys: ["work_format", "task_entry", "decision_style"],
      confidence: normalizeConfidence(hint),
      limitations: "Limited stage: не все 34 слоя сгенерированы.",
      warnings: missing.length ? [`missing: ${missing.join(", ")}`] : [],
    },
  };
}

function buildDeterministicLimitedLayers(
  analysisPacket: Record<string, unknown>,
  candidate: Record<string, unknown>,
): Record<string, unknown>[] {
  return [
    buildChartPassportLayer(analysisPacket, candidate),
    ...PLANNED_LAYER_KEYS.map((key) => buildPlannedLayer(key)),
    buildDataQualityLayerReport(analysisPacket),
  ];
}

function buildChartPassportLayer(
  analysisPacket: Record<string, unknown>,
  candidate: Record<string, unknown>,
): Record<string, unknown> {
  const sourceChart = asRecord(analysisPacket.source_chart);
  const passport = asRecord(sourceChart.passport);
  const dq = asRecord(analysisPacket.data_quality);
  const chartQuality = asRecord(dq.chart);
  const candidateDq = asRecord(dq.candidate);
  const confidenceHint = asString(dq.report_confidence_hint, "medium");

  const name = asString(candidate.name, "Кандидат");
  const hasType = Boolean(asString(passport.type));
  const hasStrategy = Boolean(asString(passport.strategy));
  const hasAuthority = Boolean(asString(passport.authority));
  const hasProfile = Boolean(asString(passport.profile));
  const hasDefinition = Boolean(asString(passport.definition));

  const hasChart = chartQuality.has_normalized_chart === true;
  const birthComplete =
    candidateDq.has_birth_date === true &&
    candidateDq.has_birth_time === true &&
    candidateDq.has_birth_place === true;

  const shortSummary = hasChart
    ? `Сводный портрет рабочего стиля ${name}: опора на устойчивые паттерны карты и контекст HR-данных.`
    : `Сводный портрет ${name}: данных карты недостаточно для полной картины — выводы носят осторожный характер.`;

  const detailedParts: string[] = [];
  if (hasType) {
    detailedParts.push(
      "В паспорте зафиксирован базовый рабочий тип проявления — детали в Pro и в слоях «Рабочий формат» и «Рабочий почерк».",
    );
  }
  if (hasStrategy) {
    detailedParts.push(
      "Есть сигнал о предпочтительном способе входа в задачи — см. слои «Рабочий формат» и «Вход в задачи».",
    );
  }
  if (hasAuthority) {
    detailedParts.push(
      "Есть сигнал о стиле созревания решений — см. слой «Принятие решений».",
    );
  }
  if (hasProfile) {
    detailedParts.push("Устойчивый рабочий почерк описан в одноимённом слое.");
  }
  if (hasDefinition) {
    detailedParts.push("Внутренняя связность паттернов раскрыта в слое «Внутренняя связность».");
  }
  const detailed = detailedParts.join(" ");

  const meta = LAYER_META.chart_passport;

  return {
    layer_key: "chart_passport",
    hr_title: meta.hr_title,
    group: meta.group,
    status: "ready",
    ui_priority: meta.ui_priority,
    base: {
      short_summary: shortSummary,
      detailed_explanation:
        detailed ||
        "Паспорт собран из доступных полей карты; детализация ограничена качеством входных данных.",
      how_it_appears_at_work:
        "На старте работы человек проявляет устойчивые паттерны, которые стоит сверить с реальными кейсами из опыта.",
      where_useful:
        "Онбординг, постановка ожиданий, согласование формата работы и зоны ответственности.",
      risks: birthComplete
        ? "Риск неверной интерпретации без контекста команды и прошлого опыта."
        : "Риск поспешных выводов из-за неполных birth data.",
      management_tips:
        "Сверьте паспорт с интервью и наблюдением в первые 2–4 недели, не фиксируйте ярлыки.",
      what_to_check:
        "Примеры из прошлого опыта, где человек был наиболее продуктивен и что мешало результату.",
    },
    pro: {
      technical_sources: [
        "type",
        "profile",
        "strategy",
        "authority",
        "definition",
        "incarnationCross",
        "signature",
        "notSelfTheme",
      ],
      source_values: passport,
      connection_logic:
        "Паспорт карты агрегирует базовые поля normalized_chart_data.passport для HR-слоя chart_passport.",
      confidence: normalizeConfidence(confidenceHint),
      human_check: "Сверить ключевые формулировки с ответами кандидата на интервью.",
    },
    evidence: {
      source_fields: ["source_chart.passport", "data_quality.chart", "data_quality.candidate"],
      source_layer_keys: [],
      confidence: normalizeConfidence(confidenceHint),
      limitations: hasChart
        ? "Паспорт не заменяет проверку опыта и контекста команды."
        : "Карта неполная или отсутствует normalized_chart_data.",
      warnings: birthComplete ? [] : ["Неполные birth data снижают точность паспорта"],
    },
  };
}

function normalizeLayerReport(raw: Record<string, unknown>): Record<string, unknown> {
  const layerKey = asString(raw.layer_key);
  const meta = LAYER_META[layerKey as V2LayerKey];
  const base = asRecord(raw.base);
  const pro = asRecord(raw.pro);
  const evidence = asRecord(raw.evidence);

  return {
    layer_key: layerKey,
    hr_title: asString(raw.hr_title, meta?.hr_title ?? layerKey),
    group: asString(raw.group, meta?.group ?? "core"),
    status: asString(raw.status, "ready") || "ready",
    ui_priority:
      typeof raw.ui_priority === "number" && Number.isFinite(raw.ui_priority)
        ? raw.ui_priority
        : meta?.ui_priority ?? 99,
    base: {
      short_summary: truncateText(asString(base.short_summary)),
      detailed_explanation: truncateText(asString(base.detailed_explanation)),
      how_it_appears_at_work: truncateText(asString(base.how_it_appears_at_work)),
      where_useful: truncateText(asString(base.where_useful)),
      risks: truncateText(asString(base.risks)),
      management_tips: truncateText(asString(base.management_tips)),
      what_to_check: truncateText(asString(base.what_to_check)),
    },
    pro: {
      technical_sources: asStringArray(pro.technical_sources).slice(0, 8),
      source_values:
        pro.source_values && typeof pro.source_values === "object"
          ? pro.source_values
          : {},
      connection_logic: truncateText(asString(pro.connection_logic), 120),
      confidence: normalizeConfidence(pro.confidence),
      human_check: truncateText(asString(pro.human_check), 120),
    },
    evidence: {
      source_fields: asStringArray(evidence.source_fields).slice(0, 8),
      source_layer_keys: asStringArray(evidence.source_layer_keys).slice(0, 6),
      confidence: normalizeConfidence(evidence.confidence),
      limitations: truncateText(asString(evidence.limitations), 120),
      warnings: asStringArray(evidence.warnings).slice(0, 4),
    },
  };
}

function layerMap(
  reports: Record<string, unknown>[],
): Map<string, Record<string, unknown>> {
  const map = new Map<string, Record<string, unknown>>();
  for (const report of reports) {
    const key = asString(report.layer_key);
    if (key) map.set(key, report);
  }
  return map;
}

function baseField(layer: Record<string, unknown> | undefined, field: string): string {
  if (!layer) return "";
  return asString(asRecord(layer.base)[field]);
}

function buildSynthesisBlocks(
  reports: Record<string, unknown>[],
): Record<string, unknown> {
  const byKey = layerMap(reports);

  const workFormat = byKey.get("work_format");
  const taskEntry = byKey.get("task_entry");
  const decisionStyle = byKey.get("decision_style");
  const workSignature = byKey.get("work_signature");
  const innerCoherence = byKey.get("inner_coherence");
  const stableZones = byKey.get("stable_zones");
  const sensitiveZones = byKey.get("sensitive_zones");
  const dataQuality = byKey.get("data_quality");

  const execSentence = [
    baseField(workFormat, "short_summary"),
    baseField(decisionStyle, "short_summary"),
  ]
    .filter(Boolean)
    .join(" ");

  const riskSummary =
    baseField(sensitiveZones, "risks") ||
    baseField(workFormat, "risks") ||
    baseField(decisionStyle, "risks") ||
    baseField(dataQuality, "risks");

  return {
    executive_summary: {
      one_sentence: execSentence || baseField(workSignature, "short_summary"),
      best_use: baseField(workFormat, "where_useful") || baseField(stableZones, "where_useful"),
      main_value: baseField(workSignature, "short_summary") || baseField(innerCoherence, "short_summary"),
      main_risk: riskSummary,
      how_to_check_first:
        baseField(dataQuality, "what_to_check") || baseField(sensitiveZones, "what_to_check"),
      decision_note:
        "Сводка собрана из ограниченного набора слоёв v2; перед решением о найме проверьте гипотезы на интервью.",
      text:
        [
          baseField(workFormat, "detailed_explanation"),
          baseField(decisionStyle, "detailed_explanation"),
        ]
          .filter(Boolean)
          .join(" ") ||
        execSentence,
    },
    work_formula: {
      text: [
        baseField(workFormat, "how_it_appears_at_work"),
        baseField(taskEntry, "how_it_appears_at_work"),
        baseField(decisionStyle, "how_it_appears_at_work"),
        baseField(workSignature, "how_it_appears_at_work"),
        baseField(innerCoherence, "how_it_appears_at_work"),
      ]
        .filter(Boolean)
        .join(" → "),
    },
    talents: {
      items: [
        workFormat && {
          title: "Рабочий формат",
          body: baseField(workFormat, "short_summary") || baseField(workFormat, "detailed_explanation"),
        },
        stableZones &&
          baseField(stableZones, "short_summary") && {
            title: "Устойчивые зоны",
            body: baseField(stableZones, "short_summary"),
          },
        dataQuality && {
          title: "Опора на данные",
          body: baseField(dataQuality, "short_summary"),
        },
      ].filter(Boolean),
    },
    work_environment: {
      items: [
        stableZones &&
          (baseField(stableZones, "how_it_appears_at_work") ||
            baseField(stableZones, "short_summary")) && {
            title: "Устойчивость",
            body:
              baseField(stableZones, "how_it_appears_at_work") ||
              baseField(stableZones, "short_summary"),
          },
        sensitiveZones &&
          (baseField(sensitiveZones, "how_it_appears_at_work") ||
            baseField(sensitiveZones, "short_summary")) && {
            title: "Чувствительность к среде",
            body:
              baseField(sensitiveZones, "how_it_appears_at_work") ||
              baseField(sensitiveZones, "short_summary"),
          },
        innerCoherence &&
          (baseField(innerCoherence, "how_it_appears_at_work") ||
            baseField(innerCoherence, "short_summary")) && {
            title: "Связность",
            body:
              baseField(innerCoherence, "how_it_appears_at_work") ||
              baseField(innerCoherence, "short_summary"),
          },
        dataQuality && {
          title: "Качество данных",
          body: baseField(dataQuality, "detailed_explanation"),
        },
      ].filter(Boolean),
    },
    risks: {
      items: [
        sensitiveZones && {
          title: "Чувствительные зоны",
          body: baseField(sensitiveZones, "risks") || baseField(sensitiveZones, "short_summary"),
        },
        dataQuality && baseField(dataQuality, "risks")
          ? { title: "Ограничения данных", body: baseField(dataQuality, "risks") }
          : null,
      ].filter(Boolean),
      checks:
        asString(asRecord(sensitiveZones).status) === "ready" &&
        baseField(sensitiveZones, "risks")
          ? [
              {
                id: "risk-limited-sensitive",
                risk: baseField(sensitiveZones, "risks"),
                how_it_may_show_up: baseField(sensitiveZones, "how_it_appears_at_work"),
                interview_check: baseField(sensitiveZones, "what_to_check"),
                test_task_check: baseField(taskEntry, "what_to_check"),
                good_signal: "Человек называет условия, в которых сохраняет продуктивность.",
                warning_signal: "Игнорирует вопросы о нагрузке или среде.",
                management_prevention: baseField(sensitiveZones, "management_tips"),
                related_hypothesis_ids: [],
                confidence: "medium",
              },
            ]
          : baseField(workFormat, "risks")
            ? [
                {
                  id: "risk-limited-work-format",
                  risk: baseField(workFormat, "risks"),
                  how_it_may_show_up: baseField(workFormat, "how_it_appears_at_work"),
                  interview_check: baseField(workFormat, "what_to_check"),
                  test_task_check: baseField(taskEntry, "what_to_check"),
                  good_signal: "Описывает рабочие условия, в которых держит темп.",
                  warning_signal: "Не может назвать критерии приоритизации.",
                  management_prevention: baseField(workFormat, "management_tips"),
                  related_hypothesis_ids: [],
                  confidence: "medium",
                },
              ]
            : [],
    },
    management: {
      items: [
        taskEntry && {
          title: "Постановка задач",
          body: baseField(taskEntry, "management_tips") || baseField(taskEntry, "short_summary"),
        },
        decisionStyle && {
          title: "Решения",
          body: baseField(decisionStyle, "management_tips"),
        },
        workSignature && {
          title: "Стиль работы",
          body: baseField(workSignature, "management_tips"),
        },
      ].filter(Boolean),
      playbook: {
        how_to_set_tasks: baseField(taskEntry, "management_tips"),
        how_to_give_feedback: baseField(decisionStyle, "management_tips"),
        how_to_motivate: baseField(stableZones, "where_useful"),
        what_not_to_do: baseField(sensitiveZones, "risks"),
        best_environment: baseField(stableZones, "where_useful"),
        overload_signals: baseField(sensitiveZones, "how_it_appears_at_work"),
        first_30_days_focus: baseField(dataQuality, "what_to_check"),
      },
    },
  };
}

function buildDataQualityBlock(
  analysisPacket: Record<string, unknown>,
): Record<string, unknown> {
  const dq = asRecord(analysisPacket.data_quality);
  const hint = asString(dq.report_confidence_hint, "medium");
  const chart = asRecord(dq.chart);
  const candidate = asRecord(dq.candidate);

  const missing: string[] = [];
  if (!candidate.has_hr_comment) missing.push("комментарий HR");
  if (!candidate.has_birth_time) missing.push("время рождения");
  if (!candidate.has_birth_place) missing.push("место рождения");

  return {
    completeness: chart.has_normalized_chart
      ? "Достаточно данных карты для ограниченного v2-набора слоёв"
      : "Данные карты неполные",
    confidence: hint,
    notes:
      "Отчёт v2 (layered_limited): синтез верхних блоков собран из atomic layer_reports без отдельного curated synthesis.",
    metrics: [
      {
        label: "Режим генерации",
        value: "layered_limited",
        hint: V2_LIMITED_PROMPT_VERSION,
      },
      {
        label: "Слоёв в отчёте",
        value: String(Object.keys(LAYER_META).length),
      },
    ],
    missing,
    reduces_accuracy: missing.length
      ? `Не хватает: ${missing.join(", ")}`
      : undefined,
    add_data: missing,
  };
}

function buildCandidateSnapshot(
  candidate: Record<string, unknown>,
  reports: Record<string, unknown>[],
): Record<string, unknown> {
  const byKey = layerMap(reports);
  const name = asString(candidate.name);
  return {
    name,
    subtitle: candidate.vacancy_title
      ? `${asString(candidate.vacancy_title)} · карта талантов`
      : "Карта талантов",
    status_label: "Готово",
    best_work_format: baseField(byKey.get("work_format"), "short_summary"),
    key_talent:
      baseField(byKey.get("work_format"), "short_summary") ||
      baseField(byKey.get("decision_style"), "short_summary"),
    main_risk:
      baseField(byKey.get("decision_style"), "risks") ||
      baseField(byKey.get("work_format"), "risks"),
    headline:
      baseField(byKey.get("work_format"), "short_summary") ||
      (name ? `Карта талантов — ${name}` : "Карта талантов"),
  };
}

export function validateV2LimitedContent(content: Record<string, unknown>): void {
  if (asString(content.schema_version) !== V2_SCHEMA_VERSION) {
    throw new V2GenerationError("v2_limited_layers_validate", "Неверный schema_version.");
  }
  if (asString(content.report_type) !== "hr_person_talent_map") {
    throw new V2GenerationError("v2_limited_layers_validate", "Неверный report_type.");
  }
  if (content.fit_score !== undefined && content.fit_score !== null) {
    throw new V2GenerationError("v2_limited_layers_validate", "content_json не должен содержать fit_score.");
  }

  const layerReports = Array.isArray(content.layer_reports) ? content.layer_reports : [];
  if (layerReports.length === 0) {
    throw new V2GenerationError("v2_limited_layers_validate", "layer_reports пуст.");
  }

  for (const layer of layerReports) {
    const rec = asRecord(layer);
    const status = asString(rec.status, "ready");
    if (status !== "ready") continue;
    if (!rec.base || typeof rec.base !== "object") {
      throw new V2GenerationError(
        "v2_limited_layers_validate",
        `Слой ${asString(rec.layer_key)} без base.`,
      );
    }
    if (!rec.pro || typeof rec.pro !== "object") {
      throw new V2GenerationError(
        "v2_limited_layers_validate",
        `Слой ${asString(rec.layer_key)} без pro.`,
      );
    }
    if (!rec.evidence || typeof rec.evidence !== "object") {
      throw new V2GenerationError(
        "v2_limited_layers_validate",
        `Слой ${asString(rec.layer_key)} без evidence.`,
      );
    }
    if (!asString(asRecord(rec.base).short_summary)) {
      throw new V2GenerationError(
        "v2_limited_layers_validate",
        `Слой ${asString(rec.layer_key)} без short_summary.`,
      );
    }
  }

  const synthesis = asRecord(content.synthesis_blocks);
  const requiredBlocks = [
    "executive_summary",
    "work_formula",
    "talents",
    "work_environment",
    "risks",
    "management",
  ];
  for (const key of requiredBlocks) {
    if (!synthesis[key] || typeof synthesis[key] !== "object") {
      throw new V2GenerationError("v2_limited_layers_validate", `Нет synthesis_blocks.${key}.`);
    }
  }

  const banned = scanV2BaseBannedTerms(content);
  if (banned.length > 0) {
    throw new V2GenerationError(
      "v2_limited_layers_validate",
      `${BANNED_TERMS_USER_MESSAGE}: ${banned.join(", ")}`,
    );
  }

  if (scanV2BaseHtml(content)) {
    throw new V2GenerationError("v2_limited_layers_validate", "Base-текст содержит недопустимый HTML.");
  }
}

export async function callOpenAiForLimitedLayers(
  apiKey: string,
  model: string,
  analysisPacket: Record<string, unknown>,
  logCtx: V2LimitedLogContext,
): Promise<Record<string, unknown>[]> {
  const compactInput = buildCompactAiInput(analysisPacket);
  const timeoutMs = resolveOpenAiTimeoutMs();
  const startedAt = Date.now();

  logV2Stage("v2_limited_openai_start", logCtx, {
    timeout_ms: timeoutMs,
    compact_input_bytes: JSON.stringify(compactInput).length,
    ai_layer_count: AI_LAYER_KEYS.length,
  });

  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

  let openAiResponse: Response;
  try {
    openAiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        temperature: 0.35,
        max_tokens: OPENAI_MAX_OUTPUT_TOKENS,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: buildV2LimitedSystemPrompt() },
          { role: "user", content: buildV2LimitedUserPrompt(compactInput) },
        ],
      }),
    });
  } catch (err) {
    const durationMs = Date.now() - startedAt;
    if (err instanceof Error && err.name === "AbortError") {
      console.error("[hr-talent-map-v2-limited] OpenAI timeout", {
        stage: "v2_limited_layers_prompt_timeout",
        duration_ms: durationMs,
        timeout_ms: timeoutMs,
        ...logCtx,
      });
      throw new V2GenerationError(
        "v2_limited_layers_prompt_timeout",
        "V2 limited generation timed out",
      );
    }
    console.error("[hr-talent-map-v2-limited] OpenAI fetch failed", {
      stage: "v2_limited_layers_prompt",
      duration_ms: durationMs,
      err,
      ...logCtx,
    });
    throw new V2GenerationError(
      "v2_limited_layers_prompt",
      err instanceof Error ? err.message : "Ошибка вызова OpenAI.",
    );
  } finally {
    clearTimeout(timeoutHandle);
  }

  logV2Stage("v2_limited_openai_done", logCtx, {
    duration_ms: Date.now() - startedAt,
    http_status: openAiResponse.status,
  });

  if (!openAiResponse.ok) {
    const errText = await openAiResponse.text();
    console.error("[hr-talent-map-v2-limited] OpenAI API error:", openAiResponse.status, errText);
    throw new V2GenerationError(
      "v2_limited_layers_prompt",
      `OpenAI API вернул ошибку (${openAiResponse.status}).`,
    );
  }

  const data = (await openAiResponse.json()) as {
    choices?: { message?: { content?: string | null } }[];
  };
  const rawContent = data.choices?.[0]?.message?.content?.trim();
  if (!rawContent) {
    throw new V2GenerationError("v2_limited_layers_prompt", "OpenAI вернул пустой ответ.");
  }

  logV2Stage("v2_limited_parse_start", logCtx, {
    raw_content_chars: rawContent.length,
  });

  let parsed: Record<string, unknown>;
  try {
    parsed = extractJsonContent(rawContent);
  } catch (err) {
    if (err instanceof V2GenerationError) throw err;
    throw new V2GenerationError(
      "v2_limited_layers_parse",
      err instanceof Error ? err.message : "Ошибка разбора JSON.",
    );
  }

  const layerReports = Array.isArray(parsed.layer_reports) ? parsed.layer_reports : [];
  if (layerReports.length === 0) {
    throw new V2GenerationError("v2_limited_layers_parse", "Ответ не содержит layer_reports.");
  }

  const normalized = layerReports.map((layer) => normalizeLayerReport(asRecord(layer)));
  const byKey = layerMap(normalized);

  for (const key of AI_LAYER_KEYS) {
    if (!byKey.has(key)) {
      throw new V2GenerationError("v2_limited_layers_parse", `Отсутствует обязательный слой: ${key}.`);
    }
  }

  return normalized;
}

const ALL_LIMITED_LAYER_KEYS: V2LayerKey[] = [
  "chart_passport",
  ...AI_LAYER_KEYS,
  ...PLANNED_LAYER_KEYS,
  "data_quality",
];

export async function buildHrTalentMapV2LimitedContent(args: {
  apiKey: string;
  model: string;
  analysisPacket: Record<string, unknown>;
  candidate: Record<string, unknown>;
  chart: Record<string, unknown>;
  inputHash: string;
  generatedAt: string;
  companyId?: string;
  candidateId?: string;
}): Promise<Record<string, unknown>> {
  const {
    apiKey,
    model,
    analysisPacket,
    candidate,
    chart,
    inputHash,
    generatedAt,
    companyId,
    candidateId,
  } = args;

  const logCtx: V2LimitedLogContext = {
    companyId,
    candidateId,
    reportType: "hr_person_talent_map",
    promptVersion: V2_LIMITED_PROMPT_VERSION,
  };

  const pipelineStartedAt = Date.now();
  logV2Stage("v2_limited_start", logCtx, {
    ai_layers: AI_LAYER_KEYS.length,
    planned_layers: PLANNED_LAYER_KEYS.length,
  });

  let aiLayers: Record<string, unknown>[];
  try {
    aiLayers = await callOpenAiForLimitedLayers(apiKey, model, analysisPacket, logCtx);
  } catch (err) {
    if (err instanceof V2GenerationError) throw err;
    throw new V2GenerationError(
      "v2_limited_layers_prompt",
      err instanceof Error ? err.message : "Ошибка генерации слоёв.",
    );
  }

  const deterministicLayers = buildDeterministicLimitedLayers(analysisPacket, candidate);
  const layerReports = [...deterministicLayers, ...aiLayers].sort(
    (a, b) =>
      (typeof a.ui_priority === "number" ? a.ui_priority : 99) -
      (typeof b.ui_priority === "number" ? b.ui_priority : 99),
  );

  const layerKeys = new Set(layerReports.map((l) => asString(l.layer_key)));
  for (const key of ALL_LIMITED_LAYER_KEYS) {
    if (!layerKeys.has(key)) {
      throw new V2GenerationError(
        "v2_content_build",
        `Отсутствует слой в итоговом отчёте: ${key}.`,
      );
    }
  }

  let synthesis_blocks: Record<string, unknown>;
  try {
    synthesis_blocks = buildSynthesisBlocks(layerReports);
  } catch (err) {
    throw new V2GenerationError(
      "v2_content_build",
      err instanceof Error ? err.message : "Ошибка сборки synthesis_blocks.",
    );
  }

  logV2Stage("v2_limited_validate_start", logCtx, {
    layer_report_count: layerReports.length,
    duration_ms: Date.now() - pipelineStartedAt,
  });

  const normalizedChart =
    chart.normalized_chart_data && typeof chart.normalized_chart_data === "object"
      ? (chart.normalized_chart_data as Record<string, unknown>)
      : null;

  const content: Record<string, unknown> = {
    schema_version: V2_SCHEMA_VERSION,
    report_type: "hr_person_talent_map",
    generation_meta: {
      prompt_version: V2_LIMITED_PROMPT_VERSION,
      schema_version: V2_SCHEMA_VERSION,
      language: "ru",
      generation_mode: "layered_limited",
      generated_at: generatedAt,
      model,
      source_analysis_packet_version: SOURCE_ANALYSIS_PACKET_VERSION,
      content_contract_version: CONTENT_CONTRACT_VERSION,
      input_hash: inputHash,
      pipeline_stage: "limited_layers_complete",
      ai_layer_keys: [...AI_LAYER_KEYS],
      planned_layer_keys: [...PLANNED_LAYER_KEYS],
    },
    candidate_snapshot: buildCandidateSnapshot(candidate, layerReports),
    source_snapshot: {
      candidate_chart_id: asString(chart.id),
      normalized_chart_hash: asString(chart.input_hash ?? chart.chart_hash),
      birth_data_complete: Boolean(
        asString(candidate.birth_date) &&
          asString(candidate.birth_time) &&
          asString(candidate.birth_place_text),
      ),
      analysis_packet_version: SOURCE_ANALYSIS_PACKET_VERSION,
    },
    technical_chart_status: {
      status: asString(chart.calculation_status, "calculated"),
      calculated_at: chart.calculated_at ?? null,
      can_render_bodygraph: normalizedChart?.canRenderBodygraph === true,
      missing_fields: asStringArray(normalizedChart?.missingForBodygraph),
    },
    data_quality: buildDataQualityBlock(analysisPacket),
    layer_reports: layerReports,
    synthesis_blocks,
    derived_action_sources: {
      layer_keys: layerReports.map((l) => asString(l.layer_key)).filter(Boolean),
      synthesis_keys: [
        "executive_summary",
        "work_formula",
        "talents",
        "work_environment",
        "risks",
        "management",
      ],
      notes: "Deterministic synthesis from limited layer_reports (no curated synthesis prompt).",
    },
    ui: {
      default_section: "overview",
      show_layer_catalog: true,
      layer_catalog_version: "2026-05-v2-limited",
    },
    qa_meta: {
      hypothesis_level: "HR-гипотезы по ограниченному набору слоёв v2",
      report_type_note: "general_candidate_talent_map",
      next_best_report: "hr_candidate_role_fit",
      disclaimers: [
        "Карта описывает рабочий стиль, а не пригодность к конкретной вакансии.",
        "Limited v2: 3 AI-слоя (work_format, task_entry, decision_style); остальные слои planned или детерминированы.",
        "Верхние блоки собраны из atomic layer_reports без полного curated synthesis.",
      ],
    },
  };

  try {
    validateV2LimitedContent(content);
  } catch (err) {
    if (err instanceof V2GenerationError) throw err;
    throw new V2GenerationError(
      "v2_limited_layers_validate",
      err instanceof Error ? err.message : "Ошибка валидации v2.",
    );
  }

  logV2Stage("v2_limited_done", logCtx, {
    duration_ms: Date.now() - pipelineStartedAt,
    layer_report_count: layerReports.length,
  });

  return content;
}

export function buildV2LimitedReportTitle(
  content: Record<string, unknown>,
  candidateName: string,
): string {
  const snapshot = asRecord(content.candidate_snapshot);
  const headline = asString(snapshot.headline);
  const name = asString(snapshot.name, candidateName);
  return headline || (name ? `Карта талантов — ${name}` : `Карта талантов — ${candidateName}`);
}

export function buildV2LimitedReportSummary(content: Record<string, unknown>): string | null {
  const synthesis = asRecord(content.synthesis_blocks);
  const exec = asRecord(synthesis.executive_summary);
  return (
    asString(exec.one_sentence) ||
    asString(exec.text) ||
    asString(asRecord(content.candidate_snapshot).headline) ||
    null
  );
}
