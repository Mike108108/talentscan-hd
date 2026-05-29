import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { HrSidePanel } from "../../components/hr/HrSidePanel";
import {
  fetchCandidate,
  fetchCandidateVacancies,
  fetchLatestCandidateReport,
  fetchTalentMap,
  generateCandidateReport,
} from "../../lib/hr/api";
import { normalizeAiReportContent } from "../../lib/hr/normalizeAiReport";
import {
  extractCompletenessPercent,
  formatReportDate,
  mergeFlexibleItems,
} from "../../lib/hr/talentMapUiHelpers";
import type {
  HrCandidate,
  HrCandidateTalentMap,
  HrPersonTalentMapV1,
  HrReport,
  HrVacancy,
  TalentMapItem,
  TalentMapMetric,
  TalentMapRole,
} from "../../lib/hr/types";
import { formulaToSafeHtml } from "../../lib/safeHtml";
import {
  getPanelMeta,
  InterviewScorecards,
  OnboardingTimeline,
  renderPanelContent,
  TestTaskCards,
  type TalentMapPanelKey,
} from "./talentMapPanelContent";
import "../../hr.css";

type TabId =
  | "overview"
  | "profile"
  | "risks"
  | "checks"
  | "interview"
  | "test"
  | "onboarding"
  | "data"
  | "roles";

const TABS: Array<{ id: TabId; label: string }> = [
  { id: "overview", label: "Обзор" },
  { id: "profile", label: "Рабочий профиль" },
  { id: "risks", label: "Риски и условия" },
  { id: "checks", label: "Проверка" },
  { id: "interview", label: "Интервью" },
  { id: "test", label: "Тестовое" },
  { id: "onboarding", label: "Адаптация" },
  { id: "data", label: "Данные" },
  { id: "roles", label: "Роли и вакансии" },
];

const EXECUTIVE_CARDS: Array<{
  key: TalentMapPanelKey;
  label: string;
  preview: (ctx: ExecutivePreviewCtx) => string | null;
}> = [
  { key: "bestFormat", label: "Лучший рабочий формат", preview: (c) => c.bestWorkFormat },
  { key: "keyTalent", label: "Ключевой талант", preview: (c) => c.keyTalent },
  { key: "mainRisk", label: "Главный риск", preview: (c) => c.mainRisk },
  { key: "mainConclusion", label: "Главный вывод", preview: (c) => c.summaryText },
];

const ACTION_CARDS: Array<{
  key: TalentMapPanelKey;
  title: string;
  desc: string;
}> = [
  { key: "profile", title: "Рабочий профиль", desc: "Формула, таланты, рабочий стиль" },
  { key: "risks", title: "Риски и условия", desc: "Что мешает и какая среда нужна" },
  { key: "verification", title: "Проверка", desc: "Вопросы и что проверять" },
  { key: "testTasks", title: "Тестовое", desc: "Задания и критерии оценки" },
  { key: "roles", title: "Роли и вакансии", desc: "Подходящие и спорные направления" },
  { key: "onboarding", title: "Адаптация 7/30/90", desc: "Как вводить в роль" },
  { key: "dataQuality", title: "Точность данных", desc: "Полнота и уверенность выводов" },
  { key: "nextStep", title: "Следующий шаг HR", desc: "Что сделать после просмотра" },
];

type ExecutivePreviewCtx = {
  bestWorkFormat: string | null;
  keyTalent: string | null;
  mainRisk: string | null;
  summaryText: string | null;
};

function normalizeHrCopy(text: string): string {
  const t = text.trim();
  if (!t) return t;
  return t
    .replaceAll(
      /Wait for the Invitation/gi,
      "Лучше включается в работу, когда есть ясный запрос, понятная роль и ожидаемый результат.",
    )
    .replaceAll(/Invitation/gi, "ясный запрос");
}

function normalizeHrMaybe(text: string | null | undefined): string | null {
  if (!text) return null;
  return normalizeHrCopy(text);
}

function ItemCards({ items }: { items: TalentMapItem[] | null | undefined }) {
  if (!items?.length) return <p className="hr-muted">Нет данных</p>;
  return (
    <div className="hr-grid-2">
      {items.map((item, idx) => (
        <div key={`${item.title}-${idx}`} className="hr-card">
          <h3 style={{ marginTop: 0 }}>{item.title}</h3>
          <p style={{ margin: 0, color: "var(--hr-soft)", lineHeight: 1.55 }}>
            {normalizeHrCopy(item.body)}
          </p>
          {item.fit && normalizeHrMaybe(item.fit) && (
            <span className="hr-status hr-status--ok" style={{ marginTop: 10 }}>
              {normalizeHrCopy(item.fit)}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

function RolesTable({ roles }: { roles: TalentMapRole[] | null | undefined }) {
  if (!roles?.length) return <p>Нет данных</p>;
  return (
    <div className="hr-card" style={{ overflow: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 480 }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left", padding: 10, borderBottom: "1px solid var(--hr-line)" }}>
              Роль
            </th>
            <th style={{ textAlign: "left", padding: 10, borderBottom: "1px solid var(--hr-line)" }}>
              Соответствие
            </th>
            <th style={{ textAlign: "left", padding: 10, borderBottom: "1px solid var(--hr-line)" }}>
              Заметка
            </th>
          </tr>
        </thead>
        <tbody>
          {roles.map((r, idx) => (
            <tr key={`${r.role}-${idx}`}>
              <td style={{ padding: 10, borderBottom: "1px solid var(--hr-line)" }}>{r.role}</td>
              <td style={{ padding: 10, borderBottom: "1px solid var(--hr-line)" }}>{r.fit}</td>
              <td style={{ padding: 10, borderBottom: "1px solid var(--hr-line)" }}>
                {normalizeHrCopy(r.note)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MetricsList({ metrics }: { metrics: TalentMapMetric[] | null | undefined }) {
  if (!metrics?.length) return <p className="hr-muted">Нет данных</p>;
  return (
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
  );
}

type TalentMapViewProps = {
  candidate: HrCandidate;
  companyId: string;
  candidateId: string;
  vacancies: HrVacancy[];
  mode: "ai" | "deterministic";
  aiContent?: HrPersonTalentMapV1;
  rawAiContent?: unknown;
  map?: HrCandidateTalentMap;
  fitScore?: number | null;
  reportUpdatedAt?: string | null;
  reportStatus?: string;
  onGenerateAi?: () => void;
  generating?: boolean;
  aiError?: string | null;
};

function TalentMapView({
  candidate,
  companyId,
  candidateId,
  vacancies,
  mode,
  aiContent,
  rawAiContent,
  map,
  fitScore,
  reportUpdatedAt,
  reportStatus,
  onGenerateAi,
  generating,
  aiError,
}: TalentMapViewProps) {
  const [tab, setTab] = useState<TabId>("overview");
  const [panelKey, setPanelKey] = useState<TalentMapPanelKey | null>(null);

  const hero = mode === "ai" ? aiContent?.hero : null;
  const bestWorkFormat =
    mode === "ai"
      ? normalizeHrMaybe(hero?.best_work_format)
      : normalizeHrMaybe(map?.best_work_format);
  const keyTalent =
    mode === "ai" ? normalizeHrMaybe(hero?.key_talent) : normalizeHrMaybe(map?.key_talent);
  const mainRisk =
    mode === "ai" ? normalizeHrMaybe(hero?.main_risk) : normalizeHrMaybe(map?.main_risk);
  const summaryText =
    mode === "ai"
      ? normalizeHrMaybe(aiContent?.executive_summary?.text ?? hero?.headline)
      : normalizeHrMaybe(map?.summary);

  const previewCtx: ExecutivePreviewCtx = {
    bestWorkFormat,
    keyTalent,
    mainRisk,
    summaryText,
  };

  const formulaRaw =
    mode === "ai" ? aiContent?.working_formula?.text ?? "" : map?.formula ?? "";
  const formulaHtml = formulaRaw ? formulaToSafeHtml(formulaRaw) : "";

  const metrics =
    mode === "ai" ? aiContent?.data_quality?.metrics ?? [] : map?.metrics ?? [];
  const completenessPct = extractCompletenessPercent(
    mode === "ai" ? aiContent?.data_quality?.completeness : undefined,
    metrics,
  );
  const confidenceLabel =
    mode === "ai" ? aiContent?.data_quality?.confidence : undefined;

  const talents = mode === "ai" ? aiContent?.talents ?? [] : map?.talents ?? [];
  const directions =
    mode === "ai" ? aiContent?.suitable_directions ?? [] : map?.directions ?? [];
  const conditions =
    mode === "ai"
      ? [...(aiContent?.work_environment ?? []), ...(aiContent?.management_style ?? [])]
      : map?.conditions ?? [];
  const roles = mode === "ai" ? aiContent?.roles ?? [] : map?.roles ?? [];
  const finalRecommendation =
    mode === "ai"
      ? normalizeHrMaybe(aiContent?.final_hr_recommendation?.text)
      : normalizeHrMaybe(map?.final_recommendation);

  const raw = rawAiContent as Record<string, unknown> | undefined;
  const interviewQuestions =
    mode === "ai"
      ? mergeFlexibleItems(aiContent?.interview_questions ?? [], raw?.interview_questions)
      : [];
  const testTasks =
    mode === "ai"
      ? mergeFlexibleItems(aiContent?.test_tasks ?? [], raw?.test_tasks)
      : mergeFlexibleItems(map?.tests ?? [], undefined);
  const risks = mode === "ai" ? aiContent?.risks ?? [] : map?.risks ?? [];
  const questionable =
    mode === "ai" ? aiContent?.questionable_directions ?? [] : map?.not_fit_directions ?? [];
  const onboarding = mode === "ai" ? aiContent?.onboarding_7_30_90 : null;

  const panelCtx = {
    mode,
    aiContent,
    rawContent: rawAiContent,
    map,
    vacancies,
    normalizeHrCopy,
    normalizeHrMaybe,
  };

  const updatedLabel = formatReportDate(reportUpdatedAt ?? undefined);
  const vacancyLabel =
    vacancies.length === 1
      ? vacancies[0].title
      : vacancies.length > 1
        ? `${vacancies.length} вакансии`
        : candidate.vacancy_title || null;

  const reportBadge = generating
    ? "Генерируется"
    : aiError
      ? "Ошибка AI"
      : mode === "ai"
        ? "Отчёт: готов"
        : "Базовая карта";

  const openPanel = (key: TalentMapPanelKey) => setPanelKey(key);
  const closePanel = () => setPanelKey(null);
  const panelMeta = panelKey ? getPanelMeta(panelKey) : null;

  return (
    <div className="hr-tm-page">
      <div className="hr-tm-header">
        <div className="hr-tm-header-top">
          <Link to={`/hr/company/${companyId}/candidates/${candidateId}`} className="hr-tm-back">
            ← К кандидату
          </Link>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginLeft: "auto" }}>
            {mode === "deterministic" && onGenerateAi && (
              <button type="button" className="hr-btn" disabled={generating} onClick={onGenerateAi}>
                {generating ? "Генерируем AI-карту…" : "Сгенерировать AI-карту"}
              </button>
            )}
            {mode === "ai" && onGenerateAi && (
              <button
                type="button"
                className="hr-btn hr-btn--ghost"
                disabled={generating}
                onClick={onGenerateAi}
              >
                {generating ? "Обновляем…" : "Перегенерировать"}
              </button>
            )}
          </div>
        </div>

        {generating && (
          <div className="hr-card" style={{ marginBottom: 12, borderColor: "rgba(120,180,255,0.35)" }}>
            <p style={{ margin: 0, color: "var(--hr-muted)" }}>
              Генерируем AI-карту… Обычно это занимает 15–40 секунд. Базовая карта остаётся доступной.
            </p>
          </div>
        )}

        {aiError && (
          <div className="hr-card" style={{ marginBottom: 12, borderColor: "rgba(255,120,120,0.35)" }}>
            <p style={{ margin: 0, color: "var(--hr-muted)" }}>
              {aiError}
              {mode === "deterministic"
                ? " Показана базовая карта."
                : " Предыдущая версия AI-карты сохранена."}
            </p>
          </div>
        )}

        <div className="hr-tm-title-row">
          <div>
            <div className="hr-tm-title-line">
              <h2 className="hr-tm-title">Карта талантов</h2>
              <span className={`hr-status ${mode === "ai" ? "hr-status--ok" : "hr-status--warn"}`}>
                {mode === "ai" ? "AI-карта" : "Базовая карта"}
              </span>
              {mode === "ai" && fitScore != null && (
                <span className="hr-status hr-status--ok">Соответствие ~{fitScore}%</span>
              )}
            </div>
            <div className="hr-tm-subtitle">
              <b>{candidate.name}</b>
            </div>
            <div className="hr-tm-badges">
              {completenessPct != null && (
                <span className="hr-status">Данные: {completenessPct}%</span>
              )}
              {confidenceLabel && (
                <span className="hr-status">Точность: {normalizeHrCopy(confidenceLabel)}</span>
              )}
              <span
                className={`hr-status ${aiError ? "hr-status--warn" : generating ? "" : mode === "ai" ? "hr-status--ok" : "hr-status--warn"}`}
              >
                {reportBadge}
              </span>
              <span className="hr-status">
                Источник: {mode === "ai" ? "AI" : "базовый разбор"}
              </span>
              {updatedLabel && <span className="hr-status">Обновлено: {updatedLabel}</span>}
              <span className="hr-status">
                Вакансия: {vacancyLabel ?? "не привязана"}
              </span>
              {reportStatus === "generating" && (
                <span className="hr-status hr-status--warn">Статус отчёта: в работе</span>
              )}
            </div>
          </div>
        </div>

        <p className="hr-tm-lede">
          Рабочее пространство HR: главные выводы, риски, проверка на интервью и адаптация. Гипотезы
          уточняются по опыту, кейсам и реальной вакансии.
        </p>

        <div className="hr-tm-summary-grid hr-tm-summary-grid--2x2">
          {EXECUTIVE_CARDS.map((card) => {
            const preview = card.preview(previewCtx) ?? "—";
            const isPrimary = card.key === "mainConclusion";
            return (
              <button
                key={card.key}
                type="button"
                className={`hr-tm-identity-card hr-tm-identity-card--clickable${isPrimary ? " hr-tm-summary-card--primary" : ""}`}
                onClick={() => openPanel(card.key)}
              >
                <b>{card.label}</b>
                <span>{preview}</span>
                <span className="hr-tm-card-more">
                  Подробнее <span className="hr-tm-card-chevron" aria-hidden>→</span>
                </span>
              </button>
            );
          })}
        </div>

        <section className="hr-tm-actions-section" aria-label="Разборы и действия">
          <h3 className="hr-tm-actions-heading">Разборы и действия</h3>
          <p className="hr-tm-actions-sub">
            Откройте нужный блок, чтобы быстро перейти от общей карты к HR-действию.
          </p>
          <div className="hr-tm-action-grid">
            {ACTION_CARDS.map((card) => (
              <button
                key={card.key}
                type="button"
                className="hr-tm-action-card"
                onClick={() => openPanel(card.key)}
              >
                <span className="hr-tm-action-card-title">{card.title}</span>
                <span className="hr-tm-action-card-desc">{card.desc}</span>
                <span className="hr-tm-card-more">
                  Открыть <span className="hr-tm-card-chevron" aria-hidden>→</span>
                </span>
              </button>
            ))}
          </div>
        </section>
      </div>

      <HrSidePanel
        open={panelKey !== null}
        onClose={closePanel}
        title={panelMeta?.title ?? ""}
        eyebrow={panelMeta?.eyebrow}
        description={panelMeta?.description}
      >
        {panelKey ? renderPanelContent(panelKey, panelCtx) : null}
      </HrSidePanel>

      <div className="hr-tm-tab-dock">
        <div className="hr-tm-tabs" role="tablist" aria-label="Вкладки карты талантов">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={tab === t.id ? "hr-tm-tab hr-tm-tab--active" : "hr-tm-tab"}
              onClick={() => setTab(t.id)}
              role="tab"
              aria-selected={tab === t.id}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="hr-tm-panel">
          {tab === "overview" && (
            <section>
              <div className="hr-grid-2">
                <div className="hr-card">
                  <h3 style={{ marginTop: 0 }}>Показатели</h3>
                  <MetricsList metrics={metrics} />
                  <button
                    type="button"
                    className="hr-btn hr-btn--ghost"
                    style={{ marginTop: 10 }}
                    onClick={() => openPanel("dataQuality")}
                  >
                    Точность данных →
                  </button>
                </div>
                <div className="hr-card">
                  <h3 style={{ marginTop: 0 }}>Условия раскрытия</h3>
                  {formulaHtml ? (
                    <div
                      className="hr-tm-overview-formula"
                      dangerouslySetInnerHTML={{ __html: formulaHtml }}
                    />
                  ) : (
                    <p style={{ margin: 0, color: "var(--hr-muted)", lineHeight: 1.55 }}>
                      Нет данных для формулировки условий раскрытия.
                    </p>
                  )}
                </div>
              </div>

              {finalRecommendation && (
                <div className="hr-card" style={{ marginTop: 12 }}>
                  <h3 style={{ marginTop: 0 }}>Рекомендация HR</h3>
                  <p style={{ margin: 0, lineHeight: 1.6 }}>{finalRecommendation}</p>
                  <button
                    type="button"
                    className="hr-btn hr-btn--ghost"
                    style={{ marginTop: 10 }}
                    onClick={() => openPanel("nextStep")}
                  >
                    Следующий шаг →
                  </button>
                </div>
              )}
            </section>
          )}

          {tab === "profile" && (
            <section>
              <div className="hr-grid-2">
                <div className="hr-card">
                  <h3 style={{ marginTop: 0 }}>Рабочий формат</h3>
                  <p style={{ margin: 0, lineHeight: 1.6 }}>{bestWorkFormat ?? "—"}</p>
                </div>
                <div className="hr-card">
                  <h3 style={{ marginTop: 0 }}>Где раскрывается</h3>
                  {formulaHtml ? (
                    <div
                      className="hr-tm-overview-formula"
                      dangerouslySetInnerHTML={{ __html: formulaHtml }}
                    />
                  ) : (
                    <p style={{ margin: 0, color: "var(--hr-muted)", lineHeight: 1.55 }}>
                      Лучше всего проявляет себя в задачах с понятным результатом, прозрачными
                      ожиданиями и регулярной обратной связью.
                    </p>
                  )}
                </div>
              </div>

              <div className="hr-tm-block">
                <h3 className="hr-tm-block-title">Ключевые таланты</h3>
                <ItemCards items={talents.slice(0, 6)} />
              </div>

              <div className="hr-tm-block">
                <h3 className="hr-tm-block-title">Подходящие направления</h3>
                <ItemCards items={directions.slice(0, 4)} />
              </div>
            </section>
          )}

          {tab === "risks" && (
            <section>
              <div className="hr-grid-2">
                <div className="hr-card">
                  <h3 style={{ marginTop: 0 }}>Что может мешать</h3>
                  <p style={{ margin: 0, lineHeight: 1.6 }}>{mainRisk ?? "—"}</p>
                </div>
                <div className="hr-card">
                  <h3 style={{ marginTop: 0 }}>Риски в работе</h3>
                  <ItemCards items={risks.slice(0, 4)} />
                </div>
              </div>

              {questionable.length > 0 && (
                <div className="hr-tm-block">
                  <h3 className="hr-tm-block-title">Спорные зоны</h3>
                  <ItemCards items={questionable} />
                </div>
              )}

              <div className="hr-tm-block">
                <h3 className="hr-tm-block-title">Среда и управление</h3>
                <ItemCards items={conditions.slice(0, 6)} />
              </div>
            </section>
          )}

          {tab === "checks" && (
            <section>
              <p className="hr-muted" style={{ marginTop: 0 }}>
                Краткий план проверки. Подробные карточки — во вкладках «Интервью» и «Тестовое» или в
                блоке «Проверка» в разделе действий.
              </p>
              <div className="hr-grid-2">
                <div className="hr-card">
                  <h3 style={{ marginTop: 0 }}>Интервью</h3>
                  {interviewQuestions.length > 0 ? (
                    <ItemCards
                      items={interviewQuestions.slice(0, 3).map((q) => ({
                        title: q.title,
                        body: q.checks || q.body,
                        fit: q.fit,
                      }))}
                    />
                  ) : (
                    <p style={{ margin: 0, color: "var(--hr-muted)", lineHeight: 1.55 }}>
                      Уточнить примеры решений, реакции на срочность и опыт работы в команде.
                    </p>
                  )}
                </div>
                <div className="hr-card">
                  <h3 style={{ marginTop: 0 }}>Тестовое</h3>
                  {testTasks.length > 0 ? (
                    <ItemCards
                      items={testTasks.slice(0, 2).map((t) => ({
                        title: t.title,
                        body: t.body,
                        fit: t.fit,
                      }))}
                    />
                  ) : (
                    <p style={{ margin: 0, color: "var(--hr-muted)", lineHeight: 1.55 }}>
                      Кейс на 2–3 часа с реальной задачей роли + разбор решения.
                    </p>
                  )}
                </div>
              </div>

              {mode === "deterministic" && (
                <div className="hr-tm-block">
                  <h3 className="hr-tm-block-title">План проверки</h3>
                  <div className="hr-grid-2">
                    <div className="hr-card hr-tm-step">
                      <p className="hr-tm-step-kicker">Шаг 1</p>
                      <h4 style={{ margin: "0 0 6px" }}>Интервью</h4>
                      <p style={{ margin: 0, color: "var(--hr-muted)", lineHeight: 1.55 }}>
                        Уточнить примеры решений, реакции на срочность и опыт работы в команде.
                      </p>
                    </div>
                    <div className="hr-card hr-tm-step">
                      <p className="hr-tm-step-kicker">Шаг 2</p>
                      <h4 style={{ margin: "0 0 6px" }}>Рабочий кейс</h4>
                      <p style={{ margin: 0, color: "var(--hr-muted)", lineHeight: 1.55 }}>
                        Кейс на 2–3 часа с реальной задачей роли + короткий разбор решения.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </section>
          )}

          {tab === "interview" && (
            <section>
              <InterviewScorecards items={interviewQuestions} />
            </section>
          )}

          {tab === "test" && (
            <section>
              <TestTaskCards items={testTasks} />
            </section>
          )}

          {tab === "onboarding" && (
            <section>
              {onboarding || mode === "ai" ? (
                <OnboardingTimeline aiContent={aiContent} rawContent={rawAiContent} />
              ) : (
                <p className="hr-muted">
                  План адаптации появится в AI-карте. Можно сгенерировать отчёт или открыть блок
                  «Адаптация» в действиях.
                </p>
              )}
            </section>
          )}

          {tab === "data" && (
            <section>
              {panelKey !== "dataQuality" && (
                <button
                  type="button"
                  className="hr-btn"
                  onClick={() => openPanel("dataQuality")}
                >
                  Открыть панель точности данных
                </button>
              )}
              <div style={{ marginTop: 12 }}>
                {renderPanelContent("dataQuality", panelCtx)}
              </div>
            </section>
          )}

          {tab === "roles" && (
            <section>
              <div className="hr-grid-2">
                <div className="hr-card">
                  <h3 style={{ marginTop: 0 }}>Связанные вакансии</h3>
                  {vacancies.length === 0 ? (
                    <p style={{ margin: 0, color: "var(--hr-muted)" }}>
                      Кандидат пока не привязан к вакансии.
                    </p>
                  ) : (
                    <div style={{ display: "grid", gap: 10 }}>
                      {vacancies.map((v) => (
                        <div
                          key={v.id}
                          className="hr-card"
                          style={{ background: "rgba(255,255,255,0.02)" }}
                        >
                          <div
                            style={{
                              display: "flex",
                              flexWrap: "wrap",
                              gap: 12,
                              justifyContent: "space-between",
                            }}
                          >
                            <div>
                              <h4 style={{ margin: "0 0 4px" }}>{v.title}</h4>
                              <p style={{ margin: 0, color: "var(--hr-muted)" }}>
                                Статус: <strong>{v.status}</strong>
                              </p>
                            </div>
                            <div className="hr-fork-actions">
                              <Link
                                to={`/hr/company/${companyId}/vacancies/${v.id}`}
                                className="hr-btn"
                              >
                                Открыть вакансию
                              </Link>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="hr-card">
                  <h3 style={{ marginTop: 0 }}>Следующий этап</h3>
                  <p style={{ margin: 0, color: "var(--hr-muted)", lineHeight: 1.55 }}>
                    Точная оценка под конкретную вакансию — отдельный разбор. Сейчас карта показывает
                    рабочий профиль и гипотезы для проверки.
                  </p>
                  <button
                    type="button"
                    className="hr-btn hr-btn--ghost"
                    style={{ marginTop: 10 }}
                    onClick={() => openPanel("nextStep")}
                  >
                    Следующий шаг HR →
                  </button>
                </div>
              </div>

              <div className="hr-tm-block">
                <h3 className="hr-tm-block-title">Предварительно подходящие роли</h3>
                <RolesTable roles={roles} />
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CandidateTalentMapPage() {
  const { companyId, candidateId } = useParams<{ companyId: string; candidateId: string }>();
  const [candidate, setCandidate] = useState<HrCandidate | null>(null);
  const [map, setMap] = useState<HrCandidateTalentMap | null>(null);
  const [aiReport, setAiReport] = useState<HrReport | null>(null);
  const [vacancies, setVacancies] = useState<HrVacancy[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const load = async () => {
    if (!companyId || !candidateId) return;
    setLoading(true);
    const [c, m, links, report] = await Promise.all([
      fetchCandidate(companyId, candidateId),
      fetchTalentMap(companyId, candidateId),
      fetchCandidateVacancies(companyId, candidateId),
      fetchLatestCandidateReport(companyId, candidateId, "hr_person_talent_map"),
    ]);
    setCandidate(c);
    setMap(m as HrCandidateTalentMap | null);
    setVacancies((links ?? []).map((l: { vacancy: HrVacancy }) => l.vacancy).filter(Boolean));
    setAiReport(report);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [companyId, candidateId]);

  const onGenerateAi = async (forceRegenerate = false) => {
    if (!companyId || !candidateId) return;
    setGenerating(true);
    setAiError(null);
    try {
      const primaryVacancyId = vacancies.length === 1 ? vacancies[0].id : null;
      const report = await generateCandidateReport(companyId, candidateId, {
        vacancyId: primaryVacancyId,
        reportType: "hr_person_talent_map",
        forceRegenerate,
      });
      setAiReport(report);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "Не удалось сгенерировать AI-карту");
    } finally {
      setGenerating(false);
    }
  };

  if (loading || !candidate) {
    return <p>Загрузка…</p>;
  }

  const hasDeterministic = map && map.report_status === "ready";
  const hasAi =
    aiReport &&
    aiReport.report_status === "ready" &&
    aiReport.content_json &&
    typeof aiReport.content_json === "object";

  if (!hasAi && !hasDeterministic && !generating) {
    return (
      <div className="hr-card">
        <h2 style={{ marginTop: 0 }}>Карта рассчитана, отчёт формируется</h2>
        <p style={{ color: "var(--hr-muted)" }}>
          Попробуйте обновить страницу через несколько секунд или пересчитайте карту кандидата.
        </p>
        <Link to={`/hr/company/${companyId}/candidates/${candidateId}`} className="hr-btn">
          ← К кандидату
        </Link>
      </div>
    );
  }

  const reportMeta = {
    reportUpdatedAt: aiReport?.generated_at ?? aiReport?.updated_at ?? map?.updated_at,
    reportStatus: aiReport?.report_status ?? map?.report_status,
  };

  if (hasAi && companyId && candidateId) {
    return (
      <TalentMapView
        candidate={candidate}
        companyId={companyId}
        candidateId={candidateId}
        vacancies={vacancies}
        mode="ai"
        aiContent={normalizeAiReportContent(aiReport.content_json)}
        rawAiContent={aiReport.content_json}
        fitScore={aiReport.fit_score}
        onGenerateAi={() => onGenerateAi(true)}
        generating={generating}
        aiError={aiError}
        {...reportMeta}
      />
    );
  }

  if ((hasDeterministic || generating) && companyId && candidateId && map) {
    return (
      <TalentMapView
        candidate={candidate}
        companyId={companyId}
        candidateId={candidateId}
        vacancies={vacancies}
        mode="deterministic"
        map={map}
        onGenerateAi={() => onGenerateAi(false)}
        generating={generating}
        aiError={aiError}
        reportUpdatedAt={map.updated_at}
        reportStatus={map.report_status}
      />
    );
  }

  return null;
}
