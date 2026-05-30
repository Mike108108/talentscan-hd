import type { ReactNode } from "react";
import type {
  HrPersonTalentMapV1,
  HrTalentMapEvidenceItem,
  HrTalentMapHypothesisCard,
  HrTalentMapLayer,
  HrTalentMapManagementPlaybook,
  HrTalentMapRiskCheck,
  HrTalentMapVerificationPlan,
  HrVacancy,
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
  | { kind: "strength"; index: number }
  | { kind: "direction"; index: number }
  | { kind: "role"; index: number };

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
          <p className="hr-tm-panel-lead">{normalizeHrCopy(dq.confidence)}</p>
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
