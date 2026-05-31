/**
 * Limited v2 HR talent map generation (atomic layer_reports + deterministic synthesis).
 * Behind HR_TALENT_MAP_V2_LIMITED_LAYERS_ENABLED — not used in production by default.
 */

import {
  BANNED_TERMS_USER_MESSAGE,
  findBannedClientTerms,
} from "./hr-report-normalize";

export const V2_LIMITED_PROMPT_VERSION = "hr_person_talent_map_v2_limited_layers_0_2";
export const V2_SCHEMA_VERSION = "hr_person_talent_map_v2";
const SOURCE_ANALYSIS_PACKET_VERSION = "analysis_packet_v1_1";
const CONTENT_CONTRACT_VERSION = "2.0.0";
const DEFAULT_OPENAI_TIMEOUT_MS = 22_000;
const MAX_BASE_FIELD_CHARS = 280;
const OPENAI_MAX_OUTPUT_TOKENS = 6000;

/** Only these layers use OpenAI on the limited proof-of-concept stage. */
const AI_LAYER_KEYS = ["work_format", "task_entry", "decision_style"] as const;

type AiLayerKey = (typeof AI_LAYER_KEYS)[number];

const PLANNED_LAYER_KEYS = [
  "work_signature",
  "inner_coherence",
  "stable_zones",
  "sensitive_zones",
] as const;

type PlannedLayerKey = (typeof PLANNED_LAYER_KEYS)[number];

export type V2LayerKey =
  | AiLayerKey
  | PlannedLayerKey
  | "chart_passport"
  | "data_quality";

const PLANNED_LAYER_PLACEHOLDER =
  "Этот слой будет раскрыт в следующем этапе послойной генерации.";

const LIMITED_SYNTHESIS_FALLBACK =
  "Этот блок собран по ограниченному набору готовых слоёв: рабочий формат, вход в задачи и стиль принятия решений. Для полной версии потребуется раскрыть дополнительные слои.";

/** Known source paths per ready AI layer — used for server-side pro/evidence fallback. */
const LIMITED_LAYER_SOURCE_MAP: Record<
  AiLayerKey,
  { passport_keys: string[]; evidence_paths: string[] }
> = {
  work_format: {
    passport_keys: ["type", "strategy", "signature", "notSelfTheme", "profile"],
    evidence_paths: [
      "source_chart.passport.type",
      "source_chart.passport.strategy",
      "source_chart.passport.signature",
      "source_chart.passport.notSelfTheme",
      "source_chart.passport.profile",
    ],
  },
  task_entry: {
    passport_keys: ["strategy", "authority", "type", "profile"],
    evidence_paths: [
      "source_chart.passport.strategy",
      "source_chart.passport.authority",
      "source_chart.passport.type",
      "source_chart.passport.profile",
    ],
  },
  decision_style: {
    passport_keys: ["authority", "strategy", "type"],
    evidence_paths: [
      "source_chart.passport.authority",
      "source_chart.passport.strategy",
      "source_chart.passport.type",
    ],
  },
};

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

function usesMaxCompletionTokens(model: string): boolean {
  const normalized = model.trim().toLowerCase();
  return (
    normalized.startsWith("gpt-5") ||
    normalized.startsWith("o1") ||
    normalized.startsWith("o3") ||
    normalized.startsWith("o4") ||
    normalized.includes("reasoning")
  );
}

function buildOpenAiTokenLimitParam(
  model: string,
): { max_completion_tokens: number } | { max_tokens: number } {
  return usesMaxCompletionTokens(model)
    ? { max_completion_tokens: OPENAI_MAX_OUTPUT_TOKENS }
    : { max_tokens: OPENAI_MAX_OUTPUT_TOKENS };
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

function getValueByPath(root: Record<string, unknown>, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = root;
  for (const part of parts) {
    if (!current || typeof current !== "object" || Array.isArray(current)) return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function hasMeaningfulSourceValue(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0 && value.trim() !== "—";
  if (typeof value === "number" && Number.isFinite(value)) return true;
  if (typeof value === "boolean") return true;
  return false;
}

function isLayerReady(layer: Record<string, unknown> | undefined): boolean {
  if (!layer) return false;
  return asString(layer.status, "ready") === "ready";
}

function isPlannedLayerText(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  return (
    t.includes("Этот слой будет раскрыт") ||
    t.includes("Слой не генерировался AI на limited этапе")
  );
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
        signature: passport.signature ?? null,
        notSelfTheme: passport.notSelfTheme ?? null,
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
  return `TalentScan HR Layer Engine (v2 limited, 3 AI-слоя).

Верни JSON { "layer_reports": [...] } ровно для layer_key: work_format, task_entry, decision_style.
status=ready для всех трёх. Короткий JSON, без markdown.

Лимиты: каждое base-поле до 220 символов; pro.connection_logic до 120; evidence.limitations до 120.

=== Продуктовый контекст ===
Это общая карта кандидата (hr_person_talent_map), НЕ оценка под вакансию.
Запрещено: fit_score, проценты соответствия, role-fit, «брать/не брать», «подходит на XX%».

=== Base: HR-гипотезы, не пересказ карты ===
Base описывает рабочее поведение и управленческие гипотезы. Не пересказывай технические поля карты.

Base должен отвечать на практические вопросы HR:
- как человек включается в работу;
- где приносит пользу;
- какой формат постановки задач помогает;
- как проверить гипотезу на интервью/тестовом;
- какие условия усиливают результат;
- какие условия создают риск;
- как руководителю с этим работать.

Base НЕ должен использовать как основной язык:
Human Design, бодиграф, ворота, каналы, центры, профиль, авторитет, стратегия,
Генератор, Проектор, Projector, Splenic, Wait for Invitation, signature, not-self,
соционика, социотип и похожие термины методологии.
Технические термины допустимы ТОЛЬКО в pro/evidence.

=== Pro/evidence: техническое основание ===
Сохраняй source trace для каждого слоя:
- pro.technical_sources — ключи из compact_input.source_chart.passport
- pro.source_values — реальные значения (не выдумывать)
- pro.connection_logic — почему эти поля дают такой HR-вывод
- pro.confidence — high/medium/low/unknown
- pro.human_check — что сверить с человеком
- evidence.source_fields — пути вида source_chart.passport.*
- evidence.source_chart_elements — центры/переменные при релевантности
- evidence.confidence, evidence.limitations — что ограничивает уверенность
Если поля нет — confidence medium/low, limitations с причиной.

=== Источники данных ===
Приоритет: compact_input.source_chart + LIMITED_LAYER_SOURCE_MAP по слоям.
Дополнительно используй compact_input.analysis_layers[].input_summary и source_refs, если они есть —
как контекст интерпретации, но не подменяй ими passport-поля.

=== Три слоя — три разных HR-фокуса ===

work_format — «Рабочий формат»
Вопрос: в каком рабочем режиме человек приносит пользу и как с ним строить взаимодействие?
Base раскрывает: оптимальный формат участия; где полезен; тип задач/контекста; что снижает эффективность;
как руководителю включать без давления.
НЕ сводить только к «нужно приглашение/признание».

task_entry — «Вход в задачи»
Вопрос: как человеку лучше получать задачи, стартовать и входить в рабочий процесс?
Base раскрывает: как формулировать задачу; какой контекст дать перед стартом; что считать ясным входом;
что будет плохим входом; как проверить на интервью умение входить в задачи.
НЕ повторять work_format — фокус на старте задачи, а не на общем формате работы.

decision_style — «Принятие решений»
Вопрос: как человек выбирает, уточняет и принимает рабочие решения?
Base раскрывает: как считывает решение; какие данные/сигналы нужны; где решения сильные;
где риск поспешности или необъяснённости; как руководителю давать рамку; как проверить на интервью/кейсе.
НЕ упрощать до «интуиция против рациональности» — пиши про управляемую проверку решений.

=== Анти-повторы ===
- short_summary трёх слоёв должны звучать по-разному;
- не повторять формулу «приглашение и признание» во всех слоях;
- не дублировать management_tips, what_to_check, risks между слоями;
- каждый слой — свой HR-фокус и свои формулировки.

Только compact_input. Без markdown.`;
}

function buildV2LimitedUserPrompt(compactInput: Record<string, unknown>): string {
  const keysList = AI_LAYER_KEYS.join(", ");
  const hasAnalysisLayers =
    Array.isArray(compactInput.analysis_layers) &&
    (compactInput.analysis_layers as unknown[]).length > 0;

  return `Сгенерируй ровно 3 layer_reports: ${keysList}.
status=ready. Все base-поля — строки (не массивы). Короткий JSON.

Источники по слоям (только если есть в compact_input.source_chart.passport):
- work_format: type, strategy, signature, notSelfTheme, profile
- task_entry: strategy, authority, type, profile
- decision_style: authority, strategy, type

${
  hasAnalysisLayers
    ? `В compact_input.analysis_layers есть input_summary и source_refs — используй их как дополнительный контекст интерпретации, но passport-поля остаются главным источником.`
    : ""
}

=== Качество каждого base-поля ===
short_summary — одна короткая HR-гипотеза своего слоя; без технических терминов; не повторять другие слои.
detailed_explanation — практическое объяснение: как паттерн проявляется в работе, с примерами ситуаций.
how_it_appears_at_work — наблюдаемое поведение: что HR/руководитель увидит в первые недели.
where_useful — конкретные зоны задач/команды, где паттерн усиливает результат.
risks — конкретное рабочее искажение (не абстрактный «риск выгорания»); свой для каждого слоя.
management_tips — одно конкретное действие руководителя (не общий совет «давать обратную связь»).
what_to_check — проверяемая гипотеза: что спросить/проверить; хороший сигнал; тревожный сигнал (в одной строке).

=== Качество pro/evidence ===
pro.connection_logic — почему именно эти passport-поля дают такой HR-вывод (технический язык допустим).
pro.human_check — что сверить с кандидатом на интервью.
evidence.limitations — что ограничивает уверенность (неполные данные, слабая связь полей и вывода).

ui_priority: work_format=2, task_entry=3, decision_style=4.
group: energy_and_decision.

Шаблон элемента:
{"layer_key":"","hr_title":"","group":"energy_and_decision","status":"ready","ui_priority":2,"base":{"short_summary":"","detailed_explanation":"","how_it_appears_at_work":"","where_useful":"","risks":"","management_tips":"","what_to_check":""},"pro":{"technical_sources":[],"source_values":{},"connection_logic":"","confidence":"medium","human_check":""},"evidence":{"source_fields":[],"source_layer_keys":[],"source_chart_elements":[],"confidence":"medium","limitations":"","warnings":[]}}

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
        PLANNED_LAYER_PLACEHOLDER,
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
      source_chart_elements: asStringArray(evidence.source_chart_elements).slice(0, 8),
      confidence: normalizeConfidence(evidence.confidence),
      limitations: truncateText(asString(evidence.limitations), 120),
      warnings: asStringArray(evidence.warnings).slice(0, 4),
    },
  };
}

function postProcessAiLayerReports(
  layers: Record<string, unknown>[],
  analysisPacket: Record<string, unknown>,
): Record<string, unknown>[] {
  const sourceChart = asRecord(analysisPacket.source_chart);
  const passport = asRecord(sourceChart.passport);
  const centers = asRecord(sourceChart.centers);
  const variables = asRecord(sourceChart.variables);

  return layers.map((layer) => {
    const layerKey = asString(layer.layer_key) as AiLayerKey;
    if (!AI_LAYER_KEYS.includes(layerKey)) return layer;

    const sourceMap = LIMITED_LAYER_SOURCE_MAP[layerKey];
    const pro = asRecord(layer.pro);
    const evidence = asRecord(layer.evidence);

    const existingSources = new Set(asStringArray(pro.technical_sources));
    const sourceValues = asRecord(pro.source_values);
    const filledValues: Record<string, unknown> = { ...sourceValues };

    for (const key of sourceMap.passport_keys) {
      const value = passport[key];
      if (hasMeaningfulSourceValue(value)) {
        existingSources.add(key);
        if (!(key in filledValues)) filledValues[key] = value;
      }
    }

    const existingFields = new Set(asStringArray(evidence.source_fields));
    for (const path of sourceMap.evidence_paths) {
      const value = getValueByPath(analysisPacket, path);
      if (hasMeaningfulSourceValue(value)) {
        existingFields.add(path);
      }
    }

    const chartElements = new Set(asStringArray(evidence.source_chart_elements));
    const definedCenters = asStringArray(centers.definedCenters);
    const openCenters = asStringArray(centers.openCenters);
    if (definedCenters.length > 0) {
      chartElements.add(`definedCenters:${definedCenters.slice(0, 4).join(",")}`);
    }
    if (openCenters.length > 0) {
      chartElements.add(`openCenters:${openCenters.slice(0, 4).join(",")}`);
    }
    if (layerKey === "decision_style" && hasMeaningfulSourceValue(variables.environment)) {
      chartElements.add(`variables.environment:${asString(variables.environment)}`);
    }

    const hasProTrace = existingSources.size > 0 || Object.keys(filledValues).length > 0;
    const hasEvidenceTrace = existingFields.size > 0 || chartElements.size > 0;

    let confidence = normalizeConfidence(pro.confidence);
    let limitations = asString(evidence.limitations);
    let humanCheck = asString(pro.human_check);
    let connectionLogic = asString(pro.connection_logic);

    const availableKeys = [...existingSources];
    if (!connectionLogic && availableKeys.length > 0) {
      connectionLogic = `Связь выведена из полей passport: ${availableKeys.join(", ")}.`;
    }

    if (!hasProTrace && !hasEvidenceTrace) {
      confidence = confidence === "high" ? "medium" : confidence === "unknown" ? "low" : confidence;
      if (!limitations) {
        limitations = `В analysis_packet нет значений для ${sourceMap.passport_keys.join(", ")} — вывод ограничен.`;
      }
      if (!humanCheck) {
        humanCheck = "На интервью проверить соответствие описанного паттерна реальному опыту кандидата.";
      }
    } else if (!limitations && availableKeys.length < sourceMap.passport_keys.length) {
      const missing = sourceMap.passport_keys.filter((k) => !existingSources.has(k));
      limitations = `Часть полей passport отсутствует: ${missing.join(", ")}.`;
      if (confidence === "high") confidence = "medium";
    }

    if (!humanCheck) {
      humanCheck = "Сверить описание с примерами из прошлого опыта на интервью.";
    }

    return {
      ...layer,
      pro: {
        ...pro,
        technical_sources: [...existingSources].slice(0, 8),
        source_values: filledValues,
        connection_logic: truncateText(connectionLogic, 120),
        confidence,
        human_check: truncateText(humanCheck, 120),
      },
      evidence: {
        ...evidence,
        source_fields: [...existingFields].slice(0, 8),
        source_chart_elements: [...chartElements].slice(0, 8),
        confidence: normalizeConfidence(evidence.confidence) === "unknown" ? confidence : normalizeConfidence(evidence.confidence),
        limitations: truncateText(limitations, 120),
      },
    };
  });
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

function readyBaseField(
  layer: Record<string, unknown> | undefined,
  field: string,
): string {
  if (!isLayerReady(layer)) return "";
  const value = baseField(layer, field);
  return isPlannedLayerText(value) ? "" : value;
}

function synthesisItem(title: string, body: string): { title: string; body: string } | null {
  const trimmedBody = body.trim();
  if (!trimmedBody || isPlannedLayerText(trimmedBody)) return null;
  return { title, body: trimmedBody };
}

/** Derive risk-check signals from layer base fields; fall back to layer-specific defaults. */
function buildRiskCheckSignals(
  layer: Record<string, unknown> | undefined,
  defaults: { good: string; warning: string },
): { good_signal: string; warning_signal: string } {
  const whatToCheck = readyBaseField(layer, "what_to_check");
  const howItAppears = readyBaseField(layer, "how_it_appears_at_work");
  const managementTips = readyBaseField(layer, "management_tips");
  const risks = readyBaseField(layer, "risks");

  const good =
    managementTips ||
    howItAppears ||
    whatToCheck ||
    defaults.good;

  const warning = risks
    ? truncateText(`Тревожный сигнал: ${risks}`, 120)
    : defaults.warning;

  return {
    good_signal: truncateText(good, 120),
    warning_signal: truncateText(warning, 120),
  };
}

function buildSynthesisBlocks(
  reports: Record<string, unknown>[],
): Record<string, unknown> {
  const byKey = layerMap(reports);

  const workFormat = byKey.get("work_format");
  const taskEntry = byKey.get("task_entry");
  const decisionStyle = byKey.get("decision_style");
  const dataQuality = byKey.get("data_quality");

  const execSentence = [
    readyBaseField(workFormat, "short_summary"),
    readyBaseField(decisionStyle, "short_summary"),
  ]
    .filter(Boolean)
    .join(" ");

  const mainValueParts = [
    readyBaseField(workFormat, "short_summary"),
    readyBaseField(taskEntry, "short_summary"),
    readyBaseField(decisionStyle, "short_summary"),
  ].filter(Boolean);

  const riskSummary =
    readyBaseField(workFormat, "risks") ||
    readyBaseField(decisionStyle, "risks") ||
    readyBaseField(dataQuality, "risks");

  const workFormulaParts = [
    readyBaseField(workFormat, "how_it_appears_at_work"),
    readyBaseField(taskEntry, "how_it_appears_at_work"),
    readyBaseField(decisionStyle, "how_it_appears_at_work"),
  ].filter(Boolean);

  const rawBlocks = {
    executive_summary: {
      one_sentence: execSentence || LIMITED_SYNTHESIS_FALLBACK,
      best_use:
        readyBaseField(workFormat, "where_useful") ||
        readyBaseField(taskEntry, "where_useful") ||
        readyBaseField(decisionStyle, "where_useful"),
      main_value:
        mainValueParts.length > 0
          ? mainValueParts.join(" ")
          : LIMITED_SYNTHESIS_FALLBACK,
      main_risk: riskSummary,
      how_to_check_first:
        readyBaseField(dataQuality, "what_to_check") ||
        readyBaseField(workFormat, "what_to_check") ||
        readyBaseField(decisionStyle, "what_to_check"),
      decision_note:
        "Сводка собрана из ограниченного набора слоёв v2; перед решением о найме проверьте гипотезы на интервью.",
      text:
        [
          readyBaseField(workFormat, "detailed_explanation"),
          readyBaseField(decisionStyle, "detailed_explanation"),
        ]
          .filter(Boolean)
          .join(" ") ||
        execSentence ||
        LIMITED_SYNTHESIS_FALLBACK,
    },
    work_formula: {
      text: workFormulaParts.join(" → "),
    },
    talents: {
      items: [
        synthesisItem(
          "Рабочий формат",
          readyBaseField(workFormat, "short_summary") ||
            readyBaseField(workFormat, "detailed_explanation"),
        ),
        synthesisItem(
          "Вход в задачи",
          readyBaseField(taskEntry, "short_summary") ||
            readyBaseField(taskEntry, "detailed_explanation"),
        ),
        synthesisItem(
          "Принятие решений",
          readyBaseField(decisionStyle, "short_summary") ||
            readyBaseField(decisionStyle, "detailed_explanation"),
        ),
        synthesisItem("Опора на данные", readyBaseField(dataQuality, "short_summary")),
      ].filter(Boolean),
    },
    work_environment: {
      items: [
        synthesisItem(
          "Рабочий формат",
          readyBaseField(workFormat, "how_it_appears_at_work") ||
            readyBaseField(workFormat, "where_useful"),
        ),
        synthesisItem(
          "Вход в задачи",
          readyBaseField(taskEntry, "how_it_appears_at_work") ||
            readyBaseField(taskEntry, "where_useful"),
        ),
        synthesisItem(
          "Качество данных",
          readyBaseField(dataQuality, "detailed_explanation") ||
            readyBaseField(dataQuality, "short_summary"),
        ),
      ].filter(Boolean),
    },
    risks: {
      items: [
        synthesisItem(
          "Рабочий формат",
          readyBaseField(workFormat, "risks"),
        ),
        synthesisItem(
          "Принятие решений",
          readyBaseField(decisionStyle, "risks"),
        ),
        synthesisItem("Ограничения данных", readyBaseField(dataQuality, "risks")),
      ].filter(Boolean),
      checks: [] as Record<string, unknown>[],
    },
    management: {
      items: [
        synthesisItem(
          "Постановка задач",
          readyBaseField(taskEntry, "management_tips") ||
            readyBaseField(taskEntry, "short_summary"),
        ),
        synthesisItem(
          "Решения",
          readyBaseField(decisionStyle, "management_tips") ||
            readyBaseField(decisionStyle, "short_summary"),
        ),
        synthesisItem(
          "Рабочий формат",
          readyBaseField(workFormat, "management_tips"),
        ),
      ].filter(Boolean),
      playbook: {
        how_to_set_tasks: readyBaseField(taskEntry, "management_tips"),
        how_to_give_feedback: readyBaseField(decisionStyle, "management_tips"),
        how_to_motivate: readyBaseField(workFormat, "where_useful"),
        what_not_to_do: readyBaseField(workFormat, "risks") || readyBaseField(decisionStyle, "risks"),
        best_environment: readyBaseField(workFormat, "where_useful"),
        overload_signals: readyBaseField(workFormat, "how_it_appears_at_work"),
        first_30_days_focus: readyBaseField(dataQuality, "what_to_check"),
      },
    },
  };

  const risksBlock = asRecord(rawBlocks.risks);
  if (readyBaseField(workFormat, "risks")) {
    const signals = buildRiskCheckSignals(workFormat, {
      good: "Называет условия, в которых стабильно включается в работу.",
      warning: "Теряет темп при неясной роли или частых внеплановых переключениях.",
    });
    risksBlock.checks = [
      {
        id: "risk-limited-work-format",
        risk: readyBaseField(workFormat, "risks"),
        how_it_may_show_up: readyBaseField(workFormat, "how_it_appears_at_work"),
        interview_check: readyBaseField(workFormat, "what_to_check"),
        test_task_check: readyBaseField(taskEntry, "what_to_check"),
        good_signal: signals.good_signal,
        warning_signal: signals.warning_signal,
        management_prevention: readyBaseField(workFormat, "management_tips"),
        related_hypothesis_ids: [],
        confidence: "medium",
      },
    ];
  } else if (readyBaseField(decisionStyle, "risks")) {
    const signals = buildRiskCheckSignals(decisionStyle, {
      good: "Объясняет, какие данные и рамка нужны перед решением.",
      warning: "Принимает решение без критериев и не может пересказать логику выбора.",
    });
    risksBlock.checks = [
      {
        id: "risk-limited-decision-style",
        risk: readyBaseField(decisionStyle, "risks"),
        how_it_may_show_up: readyBaseField(decisionStyle, "how_it_appears_at_work"),
        interview_check: readyBaseField(decisionStyle, "what_to_check"),
        test_task_check: readyBaseField(taskEntry, "what_to_check"),
        good_signal: signals.good_signal,
        warning_signal: signals.warning_signal,
        management_prevention: readyBaseField(decisionStyle, "management_tips"),
        related_hypothesis_ids: [],
        confidence: "medium",
      },
    ];
  }
  rawBlocks.risks = risksBlock;

  return cleanSynthesisBlocks(rawBlocks);
}

function cleanSynthesisBlocks(
  blocks: Record<string, unknown>,
): Record<string, unknown> {
  const cleaned: Record<string, unknown> = { ...blocks };

  const exec = asRecord(cleaned.executive_summary);
  for (const key of [
    "one_sentence",
    "best_use",
    "main_value",
    "main_risk",
    "how_to_check_first",
    "text",
  ]) {
    const value = asString(exec[key]);
    if (isPlannedLayerText(value)) exec[key] = "";
  }
  if (!asString(exec.main_value)) {
    exec.main_value = LIMITED_SYNTHESIS_FALLBACK;
  }
  if (!asString(exec.one_sentence) && !asString(exec.text)) {
    exec.one_sentence = LIMITED_SYNTHESIS_FALLBACK;
  }
  cleaned.executive_summary = exec;

  const wf = asRecord(cleaned.work_formula);
  const wfText = asString(wf.text);
  if (isPlannedLayerText(wfText)) wf.text = "";
  cleaned.work_formula = wf;

  for (const blockKey of ["talents", "work_environment", "management", "risks"] as const) {
    const block = asRecord(cleaned[blockKey]);

    if (Array.isArray(block.items)) {
      block.items = block.items
        .map((item) => asRecord(item))
        .filter((item) => {
          const body = asString(item.body);
          return body.length > 0 && !isPlannedLayerText(body);
        });
    }

    if (blockKey === "risks" && Array.isArray(block.checks)) {
      block.checks = block.checks.filter((check) => {
        const c = asRecord(check);
        const risk = asString(c.risk);
        return risk.length > 0 && !isPlannedLayerText(risk);
      });
    }

    if (blockKey === "management" && block.playbook) {
      const playbook = asRecord(block.playbook);
      const cleanedPlaybook: Record<string, string> = {};
      for (const [k, v] of Object.entries(playbook)) {
        if (typeof v === "string" && v.trim() && !isPlannedLayerText(v)) {
          cleanedPlaybook[k] = v.trim();
        }
      }
      block.playbook = cleanedPlaybook;
    }

    cleaned[blockKey] = block;
  }

  return cleaned;
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

function collectSynthesisItemsWithEmptyBody(blocks: Record<string, unknown>): string[] {
  const problems: string[] = [];
  for (const [blockKey, block] of Object.entries(blocks)) {
    const rec = asRecord(block);
    const items = Array.isArray(rec.items) ? rec.items : [];
    for (const item of items) {
      const row = asRecord(item);
      const body = asString(row.body);
      const title = asString(row.title, blockKey);
      if (!body.trim()) {
        problems.push(`${blockKey}: пустой body у «${title}»`);
      }
    }
  }
  return problems;
}

function synthesisContainsPlannedText(blocks: Record<string, unknown>): boolean {
  return collectSynthesisClientTexts(blocks).some((text) => isPlannedLayerText(text));
}

function aiLayerHasSourceTrace(layer: Record<string, unknown>): boolean {
  const pro = asRecord(layer.pro);
  const evidence = asRecord(layer.evidence);
  const hasProTrace =
    asStringArray(pro.technical_sources).length > 0 ||
    Object.keys(asRecord(pro.source_values)).some((k) =>
      hasMeaningfulSourceValue(asRecord(pro.source_values)[k]),
    );
  const hasEvidenceTrace =
    asStringArray(evidence.source_fields).length > 0 ||
    asStringArray(evidence.source_chart_elements).length > 0;
  const hasLimitation = Boolean(asString(evidence.limitations));
  return hasProTrace || hasEvidenceTrace || hasLimitation;
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
        "v2_limited_quality_validate",
        `Слой ${asString(rec.layer_key)} без base.`,
      );
    }
    if (!rec.pro || typeof rec.pro !== "object") {
      throw new V2GenerationError(
        "v2_limited_quality_validate",
        `Слой ${asString(rec.layer_key)} без pro.`,
      );
    }
    if (!rec.evidence || typeof rec.evidence !== "object") {
      throw new V2GenerationError(
        "v2_limited_quality_validate",
        `Слой ${asString(rec.layer_key)} без evidence.`,
      );
    }
    if (!asString(asRecord(rec.base).short_summary)) {
      throw new V2GenerationError(
        "v2_limited_quality_validate",
        `Слой ${asString(rec.layer_key)} без short_summary.`,
      );
    }
  }

  for (const key of AI_LAYER_KEYS) {
    const aiLayer = layerReports.find((l) => asString(asRecord(l).layer_key) === key);
    if (!aiLayer) {
      throw new V2GenerationError(
        "v2_limited_quality_validate",
        `Отсутствует AI-слой: ${key}.`,
      );
    }
    const rec = asRecord(aiLayer);
    if (asString(rec.status) !== "ready") {
      throw new V2GenerationError(
        "v2_limited_quality_validate",
        `AI-слой ${key} не в статусе ready.`,
      );
    }
    if (!aiLayerHasSourceTrace(rec)) {
      throw new V2GenerationError(
        "v2_limited_quality_validate",
        `AI-слой ${key} без source trace и без limitation.`,
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
      throw new V2GenerationError("v2_limited_quality_validate", `Нет synthesis_blocks.${key}.`);
    }
  }

  if (synthesisContainsPlannedText(synthesis)) {
    throw new V2GenerationError(
      "v2_limited_quality_validate",
      "synthesis_blocks содержит planned-текст слоёв.",
    );
  }

  const emptyItems = collectSynthesisItemsWithEmptyBody(synthesis);
  if (emptyItems.length > 0) {
    throw new V2GenerationError(
      "v2_limited_quality_validate",
      `synthesis_blocks содержит пустые items: ${emptyItems.join("; ")}`,
    );
  }

  const banned = scanV2BaseBannedTerms(content);
  if (banned.length > 0) {
    throw new V2GenerationError(
      "v2_limited_quality_validate",
      `${BANNED_TERMS_USER_MESSAGE}: ${banned.join(", ")}`,
    );
  }

  if (scanV2BaseHtml(content)) {
    throw new V2GenerationError("v2_limited_quality_validate", "Base-текст содержит недопустимый HTML.");
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
  const tokenLimitParam = buildOpenAiTokenLimitParam(model);
  const tokenLimitParamName = usesMaxCompletionTokens(model)
    ? "max_completion_tokens"
    : "max_tokens";

  logV2Stage("v2_limited_openai_start", logCtx, {
    model,
    token_limit_param: tokenLimitParamName,
    max_output_tokens: OPENAI_MAX_OUTPUT_TOKENS,
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
        response_format: { type: "json_object" },
        ...tokenLimitParam,
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

  try {
    aiLayers = postProcessAiLayerReports(aiLayers, analysisPacket);
    logV2Stage("v2_limited_quality_postprocess", logCtx, {
      ai_layer_keys: AI_LAYER_KEYS,
    });
  } catch (err) {
    throw new V2GenerationError(
      "v2_limited_quality_postprocess",
      err instanceof Error ? err.message : "Ошибка post-processing AI-слоёв.",
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
    logV2Stage("v2_limited_synthesis_clean", logCtx, {
      synthesis_block_keys: Object.keys(synthesis_blocks),
    });
  } catch (err) {
    throw new V2GenerationError(
      "v2_limited_synthesis_clean",
      err instanceof Error ? err.message : "Ошибка сборки synthesis_blocks.",
    );
  }

  logV2Stage("v2_limited_quality_validate", logCtx, {
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
      "v2_limited_quality_validate",
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
