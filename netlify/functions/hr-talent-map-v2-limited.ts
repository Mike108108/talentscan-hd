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

const AI_LAYER_KEYS = [
  "work_format",
  "task_entry",
  "decision_style",
  "work_signature",
  "inner_coherence",
  "stable_zones",
  "sensitive_zones",
  "data_quality",
] as const;

type AiLayerKey = (typeof AI_LAYER_KEYS)[number];

export type V2LayerKey = AiLayerKey | "chart_passport";

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
    layer_reports: layerReports.map((layer) => {
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
    for (const text of collectBaseTextFields(asRecord(layer))) {
      if (hasDisallowedHtml(text)) return true;
    }
  }
  const synthesis = asRecord(content.synthesis_blocks);
  for (const text of collectSynthesisClientTexts(synthesis)) {
    if (hasDisallowedHtml(text)) return true;
  }
  return false;
}

function buildV2LimitedSystemPrompt(): string {
  return `Ты — TalentScan HR Layer Engine (ограниченный v2 режим).

Задача: по analysis_packet сформировать независимые atomic layer_reports для указанных layer_key.

Правила:
- Пиши только на русском языке.
- В полях base — только прикладной HR-язык для работодателя. Без технических терминов Human Design, соционики и внутренней методологии.
- В полях pro и evidence — можно ссылаться на технические источники карты (type, authority, gates, centers и т.д.).
- Каждый слой — самостоятельная HR-гипотеза, не финальное решение о найме.
- Не пиши «брать / не брать», fit_score, проценты соответствия вакансии, role-fit.
- Не придумывай опыт, факты и должности — только analysis_packet.
- Каждый ready layer_report обязан иметь base, pro и evidence.
- В base для рисков укажи, что проверить; в pro/evidence зафиксируй confidence и limitations при нехватке данных.
- Следуй prompt_rules из analysis_packet.
- Верни ТОЛЬКО валидный JSON без markdown и без текста вне JSON.`;
}

function buildV2LimitedUserPrompt(analysisPacket: Record<string, unknown>): string {
  const keysList = AI_LAYER_KEYS.join(", ");
  return `Сгенерируй layer_reports для layer_key: ${keysList}.

Для каждого layer_key верни объект:
{
  "layer_key": "<key>",
  "hr_title": "русское название",
  "group": "energy_and_decision|core|centers_channels_gates|evidence_and_quality",
  "status": "ready",
  "ui_priority": число,
  "base": {
    "short_summary": "",
    "detailed_explanation": "",
    "how_it_appears_at_work": "",
    "where_useful": "",
    "risks": "",
    "management_tips": "",
    "what_to_check": ""
  },
  "pro": {
    "technical_sources": [],
    "source_values": {},
    "connection_logic": "",
    "confidence": "high|medium|low|unknown",
    "human_check": ""
  },
  "evidence": {
    "source_fields": [],
    "source_layer_keys": [],
    "confidence": "high|medium|low|unknown",
    "limitations": "",
    "warnings": []
  }
}

Все перечисленные layer_key обязательны. Поля base — строки (не массивы).

analysis_packet:
${JSON.stringify(analysisPacket, null, 2)}

Верни JSON: { "layer_reports": [ ... ] }`;
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
      short_summary: asString(base.short_summary),
      detailed_explanation: asString(base.detailed_explanation),
      how_it_appears_at_work: asString(base.how_it_appears_at_work),
      where_useful: asString(base.where_useful),
      risks: asString(base.risks),
      management_tips: asString(base.management_tips),
      what_to_check: asString(base.what_to_check),
    },
    pro: {
      technical_sources: asStringArray(pro.technical_sources),
      source_values:
        pro.source_values && typeof pro.source_values === "object"
          ? pro.source_values
          : {},
      connection_logic: asString(pro.connection_logic),
      confidence: normalizeConfidence(pro.confidence),
      human_check: asString(pro.human_check),
    },
    evidence: {
      source_fields: asStringArray(evidence.source_fields),
      source_layer_keys: asStringArray(evidence.source_layer_keys),
      confidence: normalizeConfidence(evidence.confidence),
      limitations: asString(evidence.limitations),
      warnings: asStringArray(evidence.warnings),
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

  const riskSummary = baseField(sensitiveZones, "risks") || baseField(dataQuality, "risks");

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
        stableZones && {
          title: "Устойчивые зоны",
          body: baseField(stableZones, "short_summary") || baseField(stableZones, "detailed_explanation"),
        },
        dataQuality && {
          title: "Опора на данные",
          body: baseField(dataQuality, "short_summary"),
        },
      ].filter(Boolean),
    },
    work_environment: {
      items: [
        stableZones && {
          title: "Устойчивость",
          body: baseField(stableZones, "how_it_appears_at_work"),
        },
        sensitiveZones && {
          title: "Чувствительность к среде",
          body: baseField(sensitiveZones, "how_it_appears_at_work"),
        },
        innerCoherence && {
          title: "Связность",
          body: baseField(innerCoherence, "how_it_appears_at_work"),
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
      checks: sensitiveZones
        ? [
            {
              id: "risk-limited-sensitive",
              risk: baseField(sensitiveZones, "risks") || "Чувствительность к среде и нагрузке",
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
    key_talent: baseField(byKey.get("stable_zones"), "short_summary") || baseField(byKey.get("work_signature"), "short_summary"),
    main_risk: baseField(byKey.get("sensitive_zones"), "risks") || baseField(byKey.get("sensitive_zones"), "short_summary"),
    headline:
      baseField(byKey.get("work_signature"), "short_summary") ||
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
): Promise<Record<string, unknown>[]> {
  const openAiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.5,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: buildV2LimitedSystemPrompt() },
        { role: "user", content: buildV2LimitedUserPrompt(analysisPacket) },
      ],
    }),
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

export async function buildHrTalentMapV2LimitedContent(args: {
  apiKey: string;
  model: string;
  analysisPacket: Record<string, unknown>;
  candidate: Record<string, unknown>;
  chart: Record<string, unknown>;
  inputHash: string;
  generatedAt: string;
}): Promise<Record<string, unknown>> {
  const { apiKey, model, analysisPacket, candidate, chart, inputHash, generatedAt } = args;

  let aiLayers: Record<string, unknown>[];
  try {
    aiLayers = await callOpenAiForLimitedLayers(apiKey, model, analysisPacket);
  } catch (err) {
    if (err instanceof V2GenerationError) throw err;
    throw new V2GenerationError(
      "v2_limited_layers_prompt",
      err instanceof Error ? err.message : "Ошибка генерации слоёв.",
    );
  }

  const chartPassport = buildChartPassportLayer(analysisPacket, candidate);
  const layerReports = [chartPassport, ...aiLayers].sort(
    (a, b) =>
      (typeof a.ui_priority === "number" ? a.ui_priority : 99) -
      (typeof b.ui_priority === "number" ? b.ui_priority : 99),
  );

  let synthesis_blocks: Record<string, unknown>;
  try {
    synthesis_blocks = buildSynthesisBlocks(layerReports);
  } catch (err) {
    throw new V2GenerationError(
      "v2_content_build",
      err instanceof Error ? err.message : "Ошибка сборки synthesis_blocks.",
    );
  }

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
