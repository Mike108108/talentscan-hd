import { useEffect, useState, type ReactNode } from "react";
import type {
  HrLayerCatalogEntry,
  HrLayerCatalogGroup,
  HrLayerCatalogStatus,
  HrPersonTalentMapV1,
  HrTalentMapEvidenceItem,
  HrTalentMapHypothesisCard,
  HrTalentMapLayer,
  HrTalentMapManagementPlaybook,
  HrTalentMapRiskCheck,
  HrTalentMapVerificationPlan,
  HrVacancy,
  MergedLayerCatalogItem,
  TalentMapRole,
} from "../../lib/hr/types";
import {
  coerceRolesList,
  coerceStringArray,
  confidenceLabelRu,
  ensureArray,
  getList,
  getText,
  mergeFlexibleItems,
  parseFlexibleItem,
  parseOnboardingPhase,
  parseOnboardingTimeline,
  type FlexibleSectionItem,
  type OnboardingPhase,
} from "../../lib/hr/talentMapUiHelpers";

export type ReportContentCtx = {
  aiContent: HrPersonTalentMapV1;
  rawContent?: unknown;
  vacancies: HrVacancy[];
  normalizeHrCopy: (text: unknown) => string;
  normalizeHrMaybe: (text: unknown) => string | null;
};

export type DetailPanelState =
  | { kind: "risk"; index: number }
  | { kind: "risk_check"; index: number }
  | { kind: "interview"; index: number }
  | { kind: "test"; index: number }
  | { kind: "onboarding"; phase: "7" | "30" | "90" }
  | { kind: "talent"; index: number }
  | { kind: "hypothesis"; index: number }
  | { kind: "layer"; index: number }
  | { kind: "catalog_layer"; layerKey: string }
  | { kind: "strength"; index: number }
  | { kind: "direction"; index: number }
  | { kind: "role"; index: number };

export const LAYER_GROUP_LABELS: Record<HrLayerCatalogGroup, string> = {
  core: "Базовый профиль",
  energy_and_decision: "Энергия и решения",
  centers_channels_gates: "Таланты и связи",
  main_activations: "Основные активации",
  planetary_activations: "Рабочие темы",
  environment_and_motivation: "Среда и мотивация",
  evidence_and_quality: "Качество данных",
};

export const LAYER_STATUS_LABELS: Record<HrLayerCatalogStatus, string> = {
  ready: "Готово",
  partial: "Частично",
  planned: "Запланировано",
};

const LAYER_CATALOG_FALLBACK: HrLayerCatalogEntry[] = [
  {
    layer_key: "chart_passport",
    hr_title: "Паспорт рабочей карты",
    group: "core",
    short_description: "Сводный портрет рабочего стиля и базовых паттернов человека.",
    technical_sources: ["type", "profile", "strategy", "authority", "definition", "incarnationCross", "signature", "notSelfTheme"],
    status: "planned",
  },
  {
    layer_key: "work_format",
    hr_title: "Рабочий формат",
    group: "energy_and_decision",
    short_description: "Как человеку комфортно включаться в работу и держать продуктивный ритм.",
    technical_sources: ["type"],
    status: "planned",
  },
  {
    layer_key: "task_entry",
    hr_title: "Вход в задачи",
    group: "energy_and_decision",
    short_description: "Что помогает человеку начать задачу и быстро войти в рабочий поток.",
    technical_sources: ["strategy"],
    status: "planned",
  },
  {
    layer_key: "decision_style",
    hr_title: "Принятие решений",
    group: "energy_and_decision",
    short_description: "Как человек принимает решения и в каких условиях решения надёжнее.",
    technical_sources: ["authority"],
    status: "planned",
  },
  {
    layer_key: "work_signature",
    hr_title: "Рабочий почерк",
    group: "core",
    short_description: "Устойчивый стиль поведения и типичный способ проявления в работе.",
    technical_sources: ["profile"],
    status: "planned",
  },
  {
    layer_key: "inner_coherence",
    hr_title: "Внутренняя связность",
    group: "core",
    short_description: "Насколько согласованы внутренние рабочие паттерны и внешнее поведение.",
    technical_sources: ["definition"],
    status: "planned",
  },
  {
    layer_key: "stable_zones",
    hr_title: "Устойчивые зоны",
    group: "centers_channels_gates",
    short_description: "Где у человека стабильная опора и предсказуемая сила в работе.",
    technical_sources: ["definedCenters"],
    status: "planned",
  },
  {
    layer_key: "sensitive_zones",
    hr_title: "Чувствительные зоны",
    group: "centers_channels_gates",
    short_description: "Где человек сильнее реагирует на среду и чужое давление.",
    technical_sources: ["openCenters"],
    status: "planned",
  },
  {
    layer_key: "talent_links",
    hr_title: "Связки талантов",
    group: "centers_channels_gates",
    short_description: "Сочетания способностей, которые усиливают друг друга в задачах.",
    technical_sources: ["channelsShort", "channelsLong"],
    status: "planned",
  },
  {
    layer_key: "point_talents",
    hr_title: "Точечные таланты",
    group: "centers_channels_gates",
    short_description: "Отдельные сильные качества, которые проявляются точечно и заметно.",
    technical_sources: ["gatesAll", "gatesPersonality", "gatesDesign", "gateSources"],
    status: "planned",
  },
  {
    layer_key: "amplified_themes",
    hr_title: "Усиленные темы",
    group: "centers_channels_gates",
    short_description: "Темы и качества, которые у человека проявляются особенно ярко.",
    technical_sources: ["gatesBoth", "gateSources"],
    status: "planned",
  },
  {
    layer_key: "personality_activations",
    hr_title: "Сознательный слой проявления",
    group: "main_activations",
    short_description: "То, что человек осознанно приносит в работу и коммуникацию.",
    technical_sources: ["activations.personality"],
    status: "planned",
  },
  {
    layer_key: "design_activations",
    hr_title: "Фоновый слой проявления",
    group: "main_activations",
    short_description: "Фоновые паттерны, которые влияют на стиль работы изнутри.",
    technical_sources: ["activations.design"],
    status: "planned",
  },
  {
    layer_key: "conscious_axis",
    hr_title: "Сознательная рабочая ось",
    group: "main_activations",
    short_description: "Главная сознательная линия мотивации и направления в работе.",
    technical_sources: ["activations.personality.sun", "activations.personality.earth"],
    status: "planned",
  },
  {
    layer_key: "background_axis",
    hr_title: "Фоновая рабочая ось",
    group: "main_activations",
    short_description: "Глубинная линия, которая задаёт устойчивый фон поведения.",
    technical_sources: ["activations.design.sun", "activations.design.earth"],
    status: "planned",
  },
  {
    layer_key: "work_impulse",
    hr_title: "Рабочий импульс",
    group: "planetary_activations",
    short_description: "Что быстро запускает человека в действие и даёт рабочий импульс.",
    technical_sources: ["activations.personality.moon", "activations.design.moon"],
    status: "planned",
  },
  {
    layer_key: "communication_style",
    hr_title: "Коммуникация и объяснение",
    group: "planetary_activations",
    short_description: "Как человек формулирует мысли и доносит их до команды.",
    technical_sources: ["activations.personality.mercury", "activations.design.mercury"],
    status: "planned",
  },
  {
    layer_key: "values_and_culture",
    hr_title: "Ценности и культура взаимодействия",
    group: "planetary_activations",
    short_description: "Какие ценности и правила взаимодействия для человека естественны.",
    technical_sources: ["activations.personality.venus", "activations.design.venus"],
    status: "planned",
  },
  {
    layer_key: "growth_tension",
    hr_title: "Напряжение и рост",
    group: "planetary_activations",
    short_description: "Где человек растёт через вызов и как проявляется рабочее напряжение.",
    technical_sources: ["activations.personality.mars", "activations.design.mars"],
    status: "planned",
  },
  {
    layer_key: "principles_and_rules",
    hr_title: "Принципы и правила",
    group: "planetary_activations",
    short_description: "Внутренние принципы, по которым человек выстраивает рабочие решения.",
    technical_sources: ["activations.personality.jupiter", "activations.design.jupiter"],
    status: "planned",
  },
  {
    layer_key: "responsibility_maturity",
    hr_title: "Ответственность и зрелость",
    group: "planetary_activations",
    short_description: "Как человек берёт ответственность и проявляет зрелость в задачах.",
    technical_sources: ["activations.personality.saturn", "activations.design.saturn"],
    status: "planned",
  },
  {
    layer_key: "nonstandard_contribution",
    hr_title: "Нестандартный вклад",
    group: "planetary_activations",
    short_description: "Чем человек может неожиданно усилить команду и результат.",
    technical_sources: ["activations.personality.uranus", "activations.design.uranus"],
    status: "planned",
  },
  {
    layer_key: "blind_spots",
    hr_title: "Слепые зоны",
    group: "planetary_activations",
    short_description: "Где человек может недооценивать риски или терять ясность.",
    technical_sources: ["activations.personality.neptune", "activations.design.neptune"],
    status: "planned",
  },
  {
    layer_key: "deep_potential",
    hr_title: "Глубинный потенциал",
    group: "planetary_activations",
    short_description: "Скрытый ресурс, который раскрывается в правильной среде.",
    technical_sources: ["activations.personality.pluto", "activations.design.pluto"],
    status: "planned",
  },
  {
    layer_key: "environment_direction",
    hr_title: "Среда и направление",
    group: "environment_and_motivation",
    short_description: "Какая среда и траектория развития лучше поддерживают человека.",
    technical_sources: ["activations.personality.northNode", "activations.personality.southNode", "activations.design.northNode", "activations.design.southNode"],
    status: "planned",
  },
  {
    layer_key: "perception_settings",
    hr_title: "Настройка восприятия",
    group: "environment_and_motivation",
    short_description: "Как человек воспринимает информацию и контекст вокруг себя.",
    technical_sources: ["variables"],
    status: "planned",
  },
  {
    layer_key: "information_sensing",
    hr_title: "Способ считывания",
    group: "environment_and_motivation",
    short_description: "Как человек считывает детали, сигналы и рабочую информацию.",
    technical_sources: ["cognition"],
    status: "planned",
  },
  {
    layer_key: "resource_recovery",
    hr_title: "Ресурс и восстановление",
    group: "environment_and_motivation",
    short_description: "Что помогает человеку восстанавливаться и держать энергию.",
    technical_sources: ["determination"],
    status: "planned",
  },
  {
    layer_key: "driving_motivation",
    hr_title: "Движущая мотивация",
    group: "environment_and_motivation",
    short_description: "Что по-настоящему мотивирует человека в работе.",
    technical_sources: ["motivation"],
    status: "planned",
  },
  {
    layer_key: "pressure_shift",
    hr_title: "Сдвиг под давлением",
    group: "environment_and_motivation",
    short_description: "Как меняется поведение человека под давлением и дедлайнами.",
    technical_sources: ["transference"],
    status: "planned",
  },
  {
    layer_key: "focus_perspective",
    hr_title: "Фокус взгляда",
    group: "environment_and_motivation",
    short_description: "На что человек естественно направляет внимание в работе.",
    technical_sources: ["perspective"],
    status: "planned",
  },
  {
    layer_key: "focus_distraction",
    hr_title: "Что сбивает фокус",
    group: "environment_and_motivation",
    short_description: "Что чаще всего отвлекает и снижает концентрацию.",
    technical_sources: ["distraction"],
    status: "planned",
  },
  {
    layer_key: "work_environment",
    hr_title: "Рабочая среда",
    group: "environment_and_motivation",
    short_description: "Какие условия среды помогают человеку раскрыться.",
    technical_sources: ["environment"],
    status: "planned",
  },
  {
    layer_key: "team_contribution_type",
    hr_title: "Тип вклада в команду",
    group: "environment_and_motivation",
    short_description: "Какой тип вклада человек приносит в командную динамику.",
    technical_sources: ["circuitries"],
    status: "planned",
  },
  {
    layer_key: "data_quality",
    hr_title: "Надёжность данных",
    group: "evidence_and_quality",
    short_description: "Насколько можно опираться на текущие данные при выводах.",
    technical_sources: ["data_quality", "birthDateUtc", "canRenderBodygraph", "missingForBodygraph"],
    status: "planned",
  },
];

function findAiLayerForKey(
  layerKey: string,
  layerMap: HrTalentMapLayer[],
): HrTalentMapLayer | undefined {
  return layerMap.find(
    (layer) =>
      layer.source_layer_id === layerKey ||
      layer.id === layerKey ||
      layer.source_layer_id?.toLowerCase() === layerKey.toLowerCase(),
  );
}

function resolveLayerStatus(
  aiLayer: HrTalentMapLayer | undefined,
  fallbackStatus: HrLayerCatalogStatus,
): HrLayerCatalogStatus {
  if (!aiLayer) return fallbackStatus;
  const hasSummary = Boolean(aiLayer.client_summary?.trim());
  const hasDetail = Boolean(
    aiLayer.hr_meaning?.trim() ||
      aiLayer.key_signal?.trim() ||
      aiLayer.risk_signal?.trim() ||
      aiLayer.how_to_check?.trim(),
  );
  if (hasSummary && hasDetail) return "ready";
  if (hasSummary || hasDetail) return "partial";
  return fallbackStatus;
}

export function buildMergedLayerCatalog(
  layerMap: HrTalentMapLayer[],
  evidenceMap: HrTalentMapEvidenceItem[],
): MergedLayerCatalogItem[] {
  return LAYER_CATALOG_FALLBACK.map((entry) => {
    const aiLayer = findAiLayerForKey(entry.layer_key, layerMap);
    const relatedEvidence = evidenceMap.filter((item) =>
      item.source_layer_ids?.some(
        (id) => id === entry.layer_key || id === aiLayer?.id || id === aiLayer?.source_layer_id,
      ),
    );
    const resolvedStatus = resolveLayerStatus(aiLayer, entry.status);
    return {
      ...entry,
      aiLayer,
      resolvedStatus,
      relatedEvidence,
    };
  });
}

export function getCatalogLayerByKey(
  catalog: MergedLayerCatalogItem[],
  layerKey: string,
): MergedLayerCatalogItem | undefined {
  return catalog.find((item) => item.layer_key === layerKey);
}

export function groupLayerCatalog(
  catalog: MergedLayerCatalogItem[],
): Array<{ group: HrLayerCatalogGroup; label: string; items: MergedLayerCatalogItem[] }> {
  const order: HrLayerCatalogGroup[] = [
    "core",
    "energy_and_decision",
    "centers_channels_gates",
    "main_activations",
    "planetary_activations",
    "environment_and_motivation",
    "evidence_and_quality",
  ];
  return order
    .map((group) => ({
      group,
      label: LAYER_GROUP_LABELS[group],
      items: catalog.filter((item) => item.group === group),
    }))
    .filter((g) => g.items.length > 0);
}

function asRec(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function ConfidenceBadge({ confidence }: { confidence?: string }) {
  const label = confidenceLabelRu(confidence);
  const mod =
    confidence === "high"
      ? "hr-tm-confidence--high"
      : confidence === "low"
        ? "hr-tm-confidence--low"
        : "hr-tm-confidence--medium";
  return <span className={`hr-tm-confidence ${mod}`}>{label} уверенность</span>;
}

export function VerificationPlanBlock({
  plan,
  normalizeHrCopy,
}: {
  plan: HrTalentMapVerificationPlan | undefined;
  normalizeHrCopy: (text: unknown) => string;
}) {
  if (!plan) return null;
  const rows: Array<{ label: string; value?: string }> = [
    { label: "Первое, что проверить", value: plan.first_check },
    { label: "Фокус интервью", value: plan.interview_focus },
    { label: "Фокус тестового", value: plan.test_task_focus },
    { label: "На что смотреть", value: plan.what_to_observe },
    { label: "Решение после проверки", value: plan.decision_after_check },
  ].filter((r) => r.value);

  if (!rows.length) return null;

  return (
    <div className="hr-tm-verification-plan">
      <h4 className="hr-tm-verification-plan-title">План проверки гипотез</h4>
      {rows.map((row) => (
        <MetaRow key={row.label} label={row.label} value={normalizeHrCopy(row.value ?? "")} />
      ))}
    </div>
  );
}

export function ManagementPlaybookGrid({
  playbook,
  normalizeHrCopy,
}: {
  playbook: HrTalentMapManagementPlaybook | undefined;
  normalizeHrCopy: (text: unknown) => string;
}) {
  if (!playbook) return null;
  const blocks: Array<{ title: string; value?: string }> = [
    { title: "Как ставить задачи", value: playbook.how_to_set_tasks },
    { title: "Как давать обратную связь", value: playbook.how_to_give_feedback },
    { title: "Как мотивировать", value: playbook.how_to_motivate },
    { title: "Чего не делать", value: playbook.what_not_to_do },
    { title: "Лучшая рабочая среда", value: playbook.best_environment },
    { title: "Сигналы перегруза", value: playbook.overload_signals },
    { title: "Фокус первых 30 дней", value: playbook.first_30_days_focus },
  ].filter((b) => b.value);

  if (!blocks.length) return null;

  return (
    <div className="hr-tm-playbook-grid">
      {blocks.map((block) => (
        <div key={block.title} className="hr-tm-playbook-card">
          <h4 className="hr-tm-playbook-card-title">{block.title}</h4>
          <p>{normalizeHrCopy(block.value ?? "")}</p>
        </div>
      ))}
    </div>
  );
}

export function LayerDetailPanel({ layer }: { layer: HrTalentMapLayer }) {
  return (
    <>
      <SectionBlock title="Краткий вывод">
        <p className="hr-tm-panel-lead">{layer.client_summary}</p>
      </SectionBlock>
      <MetaRow label="Что это значит для HR" value={layer.hr_meaning} />
      <MetaRow label="Ключевой сигнал" value={layer.key_signal} />
      <MetaRow label="Риск-сигнал" value={layer.risk_signal} />
      <MetaRow label="Как проверить" value={layer.how_to_check} />
      <ConfidenceBadge confidence={layer.confidence} />
    </>
  );
}

const PRO_PLACEHOLDER =
  "Pro-основание будет доступно после обновления структуры AI-расшифровки.";
const BASE_PLACEHOLDER =
  "Подробная расшифровка этого слоя появится после обновления AI-структуры карты.";

export function CatalogLayerDetailPanel({ item }: { item: MergedLayerCatalogItem }) {
  const [mode, setMode] = useState<"base" | "pro">("base");

  useEffect(() => {
    setMode("base");
  }, [item.layer_key]);

  const hasProEvidence =
    item.relatedEvidence.length > 0 || item.technical_sources.length > 0;

  return (
    <>
      <div className="hr-layer-mode-toggle" role="tablist" aria-label="Режим просмотра слоя">
        <button
          type="button"
          role="tab"
          aria-selected={mode === "base"}
          className={`hr-layer-mode-btn${mode === "base" ? " hr-layer-mode-btn--active" : ""}`}
          onClick={() => setMode("base")}
        >
          Base
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "pro"}
          className={`hr-layer-mode-btn${mode === "pro" ? " hr-layer-mode-btn--active" : ""}`}
          onClick={() => setMode("pro")}
        >
          Pro
        </button>
      </div>

      {mode === "base" ? (
        item.aiLayer ? (
          <LayerDetailPanel layer={item.aiLayer} />
        ) : (
          <p className="hr-tm-panel-lead hr-muted">{BASE_PLACEHOLDER}</p>
        )
      ) : hasProEvidence ? (
        <>
          {item.technical_sources.length > 0 ? (
            <SectionBlock title="Технические источники">
              <ul className="hr-tm-bullets">
                {item.technical_sources.map((src) => (
                  <li key={src}>{src}</li>
                ))}
              </ul>
            </SectionBlock>
          ) : null}
          {item.relatedEvidence.map((evidence) => (
            <SectionBlock key={evidence.id} title="Основание">
              <p className="hr-tm-panel-lead">{evidence.conclusion}</p>
              {evidence.based_on?.length ? (
                <MetaRow label="На основе" value={evidence.based_on.join(", ")} />
              ) : null}
              <ConfidenceBadge confidence={evidence.confidence} />
            </SectionBlock>
          ))}
          {item.aiLayer?.confidence ? (
            <ConfidenceBadge confidence={item.aiLayer.confidence} />
          ) : null}
        </>
      ) : (
        <p className="hr-tm-panel-lead hr-muted">{PRO_PLACEHOLDER}</p>
      )}
    </>
  );
}

export function LayerCatalogList({
  catalog,
  onSelectLayer,
}: {
  catalog: MergedLayerCatalogItem[];
  onSelectLayer: (layerKey: string) => void;
}) {
  const groups = groupLayerCatalog(catalog);

  return (
    <div className="hr-layer-catalog">
      {groups.map((group) => (
        <div key={group.group} className="hr-layer-catalog-group">
          <h4 className="hr-layer-catalog-group-title">{group.label}</h4>
          <div className="hr-layer-catalog-list">
            {group.items.map((item) => (
              <button
                key={item.layer_key}
                type="button"
                className="hr-layer-catalog-item"
                onClick={() => onSelectLayer(item.layer_key)}
              >
                <div className="hr-layer-catalog-item-head">
                  <span className="hr-layer-catalog-item-title">{item.hr_title}</span>
                  <span
                    className={`hr-layer-status hr-layer-status--${item.resolvedStatus}`}
                  >
                    {LAYER_STATUS_LABELS[item.resolvedStatus]}
                  </span>
                </div>
                <p className="hr-layer-catalog-item-desc">{item.short_description}</p>
                <span className="hr-tm-row-chevron" aria-hidden>
                  →
                </span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function HypothesisDetailPanel({ card }: { card: HrTalentMapHypothesisCard }) {
  return (
    <>
      <SectionBlock title="Гипотеза">
        <p className="hr-tm-panel-lead">{card.statement || card.title}</p>
      </SectionBlock>
      <MetaRow label="Где проявится в работе" value={card.workplace_manifestation} />
      <MetaRow label="Почему это важно" value={card.why_it_matters} />
      <MetaRow label="Как проверить" value={card.how_to_check} />
      <MetaRow label="Хороший сигнал" value={card.good_signal} />
      <MetaRow label="Тревожный сигнал" value={card.warning_signal} />
      <ConfidenceBadge confidence={card.confidence} />
    </>
  );
}

export function RiskCheckDetailPanel({ check }: { check: HrTalentMapRiskCheck }) {
  return (
    <>
      <SectionBlock title="Риск">
        <p className="hr-tm-panel-lead">{check.risk}</p>
      </SectionBlock>
      <MetaRow label="Как может проявиться" value={check.how_it_may_show_up} />
      <MetaRow label="Чем проверить на интервью" value={check.interview_check} />
      <MetaRow label="Чем проверить в тестовом" value={check.test_task_check} />
      <MetaRow label="Хороший сигнал" value={check.good_signal} />
      <MetaRow label="Тревожный сигнал" value={check.warning_signal} />
      <MetaRow label="Как руководителю предупредить" value={check.management_prevention} />
      <ConfidenceBadge confidence={check.confidence} />
    </>
  );
}

function SectionBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="hr-tm-panel-section">
      <h3 className="hr-tm-panel-section-title">{title}</h3>
      {children}
    </section>
  );
}

function BulletList({ items }: { items: string[] }) {
  if (!items.length) return null;
  return (
    <ul className="hr-tm-bullets">
      {items.map((item, i) => (
        <li key={`${item.slice(0, 24)}-${i}`}>{item}</li>
      ))}
    </ul>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="hr-tm-meta-row">
      <span className="hr-tm-meta-label">{label}</span>
      <p className="hr-tm-meta-value">{value}</p>
    </div>
  );
}

export function formatDataQuality(value?: string | null): string {
  switch ((value ?? "").trim().toLowerCase()) {
    case "high":
      return "высокая";
    case "medium":
      return "средняя";
    case "low":
      return "низкая";
    default:
      return "не указана";
  }
}

function formatDataQualityDisplay(
  value: string | undefined,
  normalizeHrCopy: (text: unknown) => string,
): string {
  if (!value?.trim()) return "не указана";
  const key = value.trim().toLowerCase();
  if (key === "high" || key === "medium" || key === "low") {
    return formatDataQuality(value);
  }
  return normalizeHrCopy(value);
}

const DATA_QUALITY_FALLBACK = `Данных пока недостаточно для детальной оценки точности.

Сейчас карта строится на доступных данных кандидата и компании. Чтобы повысить точность, добавьте:
- вакансию;
- опыт кандидата;
- комментарий HR;
- требования роли;
- контекст команды и руководителя.`;

export function DataQualitySection({ ctx }: { ctx: ReportContentCtx }) {
  const { aiContent, rawContent, normalizeHrCopy } = ctx;
  const dq = aiContent.data_quality;
  const raw = asRec(rawContent);
  const dqRaw = asRec(raw.data_quality);
  const metrics = ensureArray<{ label: string; value: string; hint?: string }>(dq?.metrics);
  const missing = getList(dqRaw.missing);
  const reduces = getText(dqRaw.reduces_accuracy);
  const toAdd = getList(dqRaw.add_data ?? dqRaw.suggested_data);

  const hasStructured =
    dq?.completeness ||
    dq?.confidence ||
    dq?.notes ||
    metrics.length > 0 ||
    missing.length > 0 ||
    reduces ||
    toAdd.length > 0;

  if (!hasStructured) {
    return (
      <div className="hr-tm-empty">
        <p className="hr-tm-empty-text" style={{ whiteSpace: "pre-line" }}>
          {DATA_QUALITY_FALLBACK}
        </p>
      </div>
    );
  }

  return (
    <>
      {dq?.completeness ? (
        <SectionBlock title="Полнота данных">
          <p className="hr-tm-panel-lead">{normalizeHrCopy(dq.completeness)}</p>
        </SectionBlock>
      ) : null}
      {dq?.confidence ? (
        <SectionBlock title="Уверенность выводов">
          <p className="hr-tm-panel-lead">
            {formatDataQualityDisplay(dq.confidence, normalizeHrCopy)}
          </p>
        </SectionBlock>
      ) : null}
      {metrics.length > 0 ? (
        <SectionBlock title="Показатели">
          <div className="hr-tm-metrics-list">
            {metrics.map((m, idx) => (
              <div key={`${m.label}-${idx}`} className="hr-tm-metrics-item">
                <span className="hr-tm-metrics-label">
                  {m.label}
                  {m.hint ? <span className="hr-tm-metrics-hint"> · {m.hint}</span> : null}
                </span>
                <b className="hr-tm-metrics-value">{m.value}</b>
              </div>
            ))}
          </div>
        </SectionBlock>
      ) : null}
      {dq?.notes ? (
        <SectionBlock title="Комментарий">
          <p>{normalizeHrCopy(dq.notes)}</p>
        </SectionBlock>
      ) : null}
      {missing.length > 0 ? (
        <SectionBlock title="Чего не хватает">
          <BulletList items={missing} />
        </SectionBlock>
      ) : null}
      {toAdd.length > 0 ? (
        <SectionBlock title="Какие данные добавить">
          <BulletList items={toAdd} />
        </SectionBlock>
      ) : null}
      {reduces ? (
        <SectionBlock title="Что снижает точность">
          <p>{reduces}</p>
        </SectionBlock>
      ) : null}
      {aiContent.qa_meta?.hypothesis_level ? (
        <SectionBlock title="Уровень гипотез">
          <p>{normalizeHrCopy(aiContent.qa_meta.hypothesis_level)}</p>
        </SectionBlock>
      ) : null}
      {(() => {
        const disclaimers = coerceStringArray(aiContent.qa_meta?.disclaimers);
        return disclaimers.length > 0 ? (
          <SectionBlock title="Предварительные выводы">
            <BulletList items={disclaimers.map(normalizeHrCopy)} />
          </SectionBlock>
        ) : null;
      })()}
    </>
  );
}

export function ItemDetailPanel({
  detail,
  ctx,
  risks,
  riskChecks,
  interviews,
  tests,
  talents,
  hypothesisCards,
  layers,
  strengths,
  directions,
  roles,
}: {
  detail: DetailPanelState;
  ctx: ReportContentCtx;
  risks: FlexibleSectionItem[];
  riskChecks: HrTalentMapRiskCheck[];
  interviews: FlexibleSectionItem[];
  tests: FlexibleSectionItem[];
  talents: FlexibleSectionItem[];
  hypothesisCards: HrTalentMapHypothesisCard[];
  layers: HrTalentMapLayer[];
  strengths: FlexibleSectionItem[];
  directions: FlexibleSectionItem[];
  roles: TalentMapRole[];
}) {
  const { aiContent, rawContent, normalizeHrCopy } = ctx;
  const raw = rawContent;

  if (detail.kind === "catalog_layer") {
    return null;
  }

  if (detail.kind === "layer") {
    const layer = layers[detail.index];
    if (!layer) return null;
    return <LayerDetailPanel layer={layer} />;
  }

  if (detail.kind === "hypothesis") {
    const card = hypothesisCards[detail.index];
    if (!card) return null;
    return <HypothesisDetailPanel card={card} />;
  }

  if (detail.kind === "risk_check") {
    const check = riskChecks[detail.index];
    if (!check) return null;
    return <RiskCheckDetailPanel check={check} />;
  }

  if (detail.kind === "risk") {
    const item = risks[detail.index];
    if (!item) return null;
    return (
      <>
        <SectionBlock title="Риск">
          <p className="hr-tm-panel-lead">{item.title}</p>
          <p>{item.body}</p>
        </SectionBlock>
        {item.fit ? <SectionBlock title="Как снизить"><p>{item.fit}</p></SectionBlock> : null}
      </>
    );
  }

  if (detail.kind === "interview") {
    const q = interviews[detail.index];
    if (!q) return null;
    return (
      <>
        <SectionBlock title="Вопрос">
          <p className="hr-tm-panel-lead">{q.title}</p>
        </SectionBlock>
        <MetaRow label="Что проверяет" value={q.checks || q.body} />
        <MetaRow label="Хороший ответ" value={q.goodAnswer ?? ""} />
        <MetaRow label="Тревожный сигнал" value={q.warningSign ?? ""} />
        <MetaRow label="Как оценивать" value={q.howToEvaluate ?? q.fit ?? ""} />
        <div className="hr-tm-hr-note" aria-label="Заметка HR (не сохраняется)">
          <span className="hr-tm-hr-note-label">Заметка HR</span>
          <div className="hr-tm-hr-note-field" contentEditable suppressContentEditableWarning />
        </div>
      </>
    );
  }

  if (detail.kind === "test") {
    const t = tests[detail.index];
    if (!t) return null;
    return (
      <>
        <SectionBlock title="Задание">
          <p className="hr-tm-panel-lead">{t.title}</p>
        </SectionBlock>
        <MetaRow label="Что проверяет" value={t.checks || t.body} />
        <MetaRow label="Сколько времени дать" value={t.timeEstimate ?? ""} />
        <MetaRow label="Критерии хорошего результата" value={t.criteria ?? t.goodAnswer ?? ""} />
        <MetaRow label="Тревожные сигналы" value={t.warningSign ?? ""} />
        <MetaRow label="Следующий шаг" value={t.nextStep ?? t.fit ?? ""} />
      </>
    );
  }

  if (detail.kind === "onboarding") {
    const ob = aiContent.onboarding_7_30_90;
    const rawOb = asRec(asRec(raw).onboarding_7_30_90);
    const phaseMap = {
      "7": parseOnboardingPhase(rawOb.day_7 ?? ob.day_7, "Первые 7 дней"),
      "30": parseOnboardingPhase(rawOb.day_30 ?? ob.day_30, "Первые 30 дней"),
      "90": parseOnboardingPhase(rawOb.day_90 ?? ob.day_90, "Первые 90 дней"),
    };
    const phase = phaseMap[detail.phase];
    if (!phase) return <p className="hr-muted">Нет данных для этого этапа.</p>;
    return <OnboardingPhaseDetail phase={phase} />;
  }

  if (detail.kind === "talent") {
    const hypothesis = hypothesisCards.filter((c) => c.type === "talent" && c.client_visible)[
      detail.index
    ];
    if (hypothesis) return <HypothesisDetailPanel card={hypothesis} />;
    const item = talents[detail.index];
    if (!item) return null;
    return (
      <>
        <SectionBlock title="Талант">
          <p className="hr-tm-panel-lead">{item.title}</p>
          <p>{item.body}</p>
        </SectionBlock>
        {item.fit ? <SectionBlock title="Где особенно полезен"><p>{item.fit}</p></SectionBlock> : null}
        {item.checks ? <MetaRow label="Как проверить" value={item.checks} /> : null}
        {item.goodAnswer ? <MetaRow label="Хороший сигнал" value={item.goodAnswer} /> : null}
        {item.warningSign ? <MetaRow label="Тревожный сигнал" value={item.warningSign} /> : null}
      </>
    );
  }

  if (detail.kind === "strength") {
    const item = strengths[detail.index];
    if (!item) return null;
    return (
      <>
        <SectionBlock title="Сильная сторона">
          <p className="hr-tm-panel-lead">{item.title}</p>
          <p>{item.body}</p>
        </SectionBlock>
      </>
    );
  }

  if (detail.kind === "direction") {
    const item = directions[detail.index];
    if (!item) return null;
    return (
      <>
        <SectionBlock title="Направление">
          <p className="hr-tm-panel-lead">{item.title}</p>
          <p>{item.body}</p>
        </SectionBlock>
        {item.fit ? <SectionBlock title="Заметка"><p>{item.fit}</p></SectionBlock> : null}
      </>
    );
  }

  if (detail.kind === "role") {
    const r = roles[detail.index];
    if (!r) return null;
    return (
      <>
        <SectionBlock title="Роль">
          <p className="hr-tm-panel-lead">{r.role}</p>
        </SectionBlock>
        <MetaRow label="Соответствие" value={r.fit} />
        <MetaRow label="Заметка" value={normalizeHrCopy(r.note ?? "")} />
      </>
    );
  }

  return null;
}

function OnboardingPhaseDetail({ phase }: { phase: OnboardingPhase }) {
  return (
    <>
      {phase.summary ? <p className="hr-tm-panel-lead">{phase.summary}</p> : null}
      <MetaRow label="Фокус" value={phase.focus ?? ""} />
      <MetaRow label="Что дать" value={phase.give ?? ""} />
      <MetaRow label="Что проверить" value={phase.verify ?? ""} />
      <MetaRow label="Сигнал успеха" value={phase.successSignal ?? ""} />
      <MetaRow label="Риск" value={phase.risk ?? ""} />
    </>
  );
}

export function getDetailPanelTitle(
  detail: DetailPanelState,
  items: {
    risks: FlexibleSectionItem[];
    riskChecks: HrTalentMapRiskCheck[];
    interviews: FlexibleSectionItem[];
    tests: FlexibleSectionItem[];
    talents: FlexibleSectionItem[];
    hypothesisCards: HrTalentMapHypothesisCard[];
    layers: HrTalentMapLayer[];
    strengths: FlexibleSectionItem[];
    directions: FlexibleSectionItem[];
    roles: TalentMapRole[];
  },
): string {
  switch (detail.kind) {
    case "catalog_layer":
      return "Слой карты";
    case "layer":
      return items.layers[detail.index]?.title ?? "Слой карты";
    case "hypothesis":
      return items.hypothesisCards[detail.index]?.title ?? "HR-гипотеза";
    case "risk_check":
      return items.riskChecks[detail.index]?.risk ?? "Риск и проверка";
    case "risk":
      return items.risks[detail.index]?.title ?? "Риск";
    case "interview":
      return "Вопрос интервью";
    case "test":
      return items.tests[detail.index]?.title ?? "Тестовое задание";
    case "onboarding":
      return detail.phase === "7"
        ? "Первые 7 дней"
        : detail.phase === "30"
          ? "Первые 30 дней"
          : "Первые 90 дней";
    case "talent": {
      const hyp = items.hypothesisCards.filter(
        (c) => c.type === "talent" && c.client_visible,
      )[detail.index];
      return hyp?.title ?? items.talents[detail.index]?.title ?? "Талант";
    }
    case "strength":
      return items.strengths[detail.index]?.title ?? "Сильная сторона";
    case "direction":
      return items.directions[detail.index]?.title ?? "Направление";
    case "role":
      return items.roles[detail.index]?.role ?? "Роль";
    default:
      return "Подробности";
  }
}

export function buildReportLists(ctx: ReportContentCtx) {
  const { aiContent, rawContent } = ctx;
  const raw = asRec(rawContent);
  const layers = ensureArray<HrTalentMapLayer>(aiContent.layer_map);
  const hypothesisCards = ensureArray<HrTalentMapHypothesisCard>(
    aiContent.hypothesis_cards,
  ).filter((c) => c.client_visible !== false);
  const riskChecks = ensureArray<HrTalentMapRiskCheck>(aiContent.risk_checks);
  const talentHypotheses = hypothesisCards.filter((c) => c.type === "talent");

  return {
    layers,
    hypothesisCards,
    talentHypotheses,
    riskChecks,
    risks: mergeFlexibleItems(ensureArray(aiContent.risks), raw.risks),
    interviews: mergeFlexibleItems(ensureArray(aiContent.interview_questions), raw.interview_questions),
    tests: mergeFlexibleItems(ensureArray(aiContent.test_tasks), raw.test_tasks),
    talents: mergeFlexibleItems(ensureArray(aiContent.talents), raw.talents),
    strengths: mergeFlexibleItems(ensureArray(aiContent.strengths), raw.strengths),
    directions: mergeFlexibleItems(ensureArray(aiContent.suitable_directions), raw.suitable_directions),
    questionable: mergeFlexibleItems(
      ensureArray(aiContent.questionable_directions),
      raw.questionable_directions,
    ),
    workEnv: mergeFlexibleItems(ensureArray(aiContent.work_environment), raw.work_environment),
    mgmt: mergeFlexibleItems(ensureArray(aiContent.management_style), raw.management_style),
    roles: coerceRolesList(aiContent.roles ?? raw.roles),
    onboardingPhases: parseOnboardingTimeline(aiContent.onboarding_7_30_90, rawContent),
    managementPlaybook: aiContent.management_playbook,
    verificationPlan: aiContent.verification_plan,
    executiveSnapshot: aiContent.executive_snapshot,
    evidenceMap: ensureArray<HrTalentMapEvidenceItem>(aiContent.evidence_map).filter(
      (e) => e.client_visible === true,
    ),
  };
}

/** @deprecated use parseFlexibleItem */
export { parseFlexibleItem };
