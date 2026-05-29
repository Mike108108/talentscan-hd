import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  fetchCandidate,
  fetchCandidateVacancies,
  fetchLatestCandidateReport,
  fetchTalentMap,
  generateCandidateReport,
} from "../../lib/hr/api";
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
import { normalizeAiReportContent } from "../../lib/hr/normalizeAiReport";
import "../../hr.css";

type TabId = "overview" | "profile" | "risks" | "checks" | "roles";

const TABS: Array<{ id: TabId; label: string }> = [
  { id: "overview", label: "Обзор" },
  { id: "profile", label: "Рабочий профиль" },
  { id: "risks", label: "Риски и условия" },
  { id: "checks", label: "Проверка" },
  { id: "roles", label: "Роли и вакансии" },
];

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
  map?: HrCandidateTalentMap;
  fitScore?: number | null;
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
  map,
  fitScore,
  onGenerateAi,
  generating,
  aiError,
}: TalentMapViewProps) {
  const [tab, setTab] = useState<TabId>("overview");

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

  const formulaRaw =
    mode === "ai" ? aiContent?.working_formula?.text ?? "" : map?.formula ?? "";
  const formulaHtml = formulaRaw ? formulaToSafeHtml(formulaRaw) : "";

  const metrics =
    mode === "ai" ? aiContent?.data_quality?.metrics ?? [] : map?.metrics ?? [];
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

  const interviewQuestions = mode === "ai" ? aiContent?.interview_questions ?? [] : [];
  const testTasks = mode === "ai" ? aiContent?.test_tasks ?? [] : map?.tests ?? [];
  const risks = mode === "ai" ? aiContent?.risks ?? [] : map?.risks ?? [];
  const questionable =
    mode === "ai" ? aiContent?.questionable_directions ?? [] : map?.not_fit_directions ?? [];
  const onboarding = mode === "ai" ? aiContent?.onboarding_7_30_90 : null;

  return (
    <div className="hr-tm-page">
      <div className="hr-tm-header">
        <div className="hr-tm-header-top">
          <Link to={`/hr/company/${companyId}/candidates/${candidateId}`} className="hr-tm-back">
            ← К кандидату
          </Link>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {mode === "deterministic" && onGenerateAi && (
              <button
                type="button"
                className="hr-btn"
                disabled={generating}
                onClick={onGenerateAi}
              >
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
              {mode === "deterministic" ? " Показана базовая карта." : " Предыдущая версия AI-карты сохранена."}
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
              {candidate.vacancy_title ? <span> · {candidate.vacancy_title}</span> : null}
            </div>
          </div>
        </div>

        <p className="hr-tm-lede">
          Компактный разбор в HR-языке: сильные стороны, риски, условия раскрытия и что проверить на
          интервью. Это рабочие гипотезы — уточняются по опыту, кейсам и реальной вакансии.
        </p>

        <div className="hr-tm-summary-grid hr-tm-summary-grid--2x2">
          <div className="hr-tm-identity-card">
            <b>Лучший рабочий формат</b>
            <span>{bestWorkFormat ?? "—"}</span>
          </div>
          <div className="hr-tm-identity-card">
            <b>Ключевой талант</b>
            <span>{keyTalent ?? "—"}</span>
          </div>
          <div className="hr-tm-identity-card">
            <b>Главный риск</b>
            <span>{mainRisk ?? "—"}</span>
          </div>
          <div className="hr-tm-identity-card hr-tm-summary-card--primary">
            <b>Главный вывод</b>
            <span>{summaryText ?? "—"}</span>
          </div>
        </div>
      </div>

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
                <ItemCards items={talents.slice(0, 3)} />
              </div>

              <div className="hr-tm-block">
                <h3 className="hr-tm-block-title">Подходящие направления</h3>
                <ItemCards items={directions.slice(0, 2)} />
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
                  <h3 style={{ marginTop: 0 }}>Какие условия нужны</h3>
                  <ItemCards items={risks.slice(0, 2)} />
                </div>
              </div>

              {questionable.length > 0 && (
                <div className="hr-tm-block">
                  <h3 className="hr-tm-block-title">Спорные зоны</h3>
                  <ItemCards items={questionable} />
                </div>
              )}

              <div className="hr-tm-block">
                <h3 className="hr-tm-block-title">Среда и менеджмент</h3>
                <ItemCards items={conditions.slice(0, 4)} />
              </div>
            </section>
          )}

          {tab === "checks" && (
            <section>
              <div className="hr-grid-2">
                <div className="hr-card">
                  <h3 style={{ marginTop: 0 }}>Вопросы на интервью</h3>
                  {interviewQuestions.length > 0 ? (
                    <ItemCards items={interviewQuestions} />
                  ) : (
                    <p style={{ margin: 0, color: "var(--hr-muted)", lineHeight: 1.55 }}>
                      Уточнить примеры решений, реакции на срочность и опыт работы в команде.
                    </p>
                  )}
                </div>
                <div className="hr-card">
                  <h3 style={{ marginTop: 0 }}>Тестовые задания</h3>
                  {testTasks.length > 0 ? (
                    <ItemCards items={testTasks} />
                  ) : (
                    <p style={{ margin: 0, color: "var(--hr-muted)", lineHeight: 1.55 }}>
                      Кейс на 2–3 часа с реальной задачей роли + разбор решения.
                    </p>
                  )}
                </div>
              </div>

              {onboarding && (onboarding.day_7 || onboarding.day_30 || onboarding.day_90) && (
                <div className="hr-tm-block">
                  <h3 className="hr-tm-block-title">Онбординг 7 / 30 / 90</h3>
                  <div className="hr-grid-2">
                    {onboarding.day_7 && (
                      <div className="hr-card">
                        <h4 style={{ marginTop: 0 }}>7 дней</h4>
                        <p style={{ margin: 0, lineHeight: 1.55 }}>{normalizeHrCopy(onboarding.day_7)}</p>
                      </div>
                    )}
                    {onboarding.day_30 && (
                      <div className="hr-card">
                        <h4 style={{ marginTop: 0 }}>30 дней</h4>
                        <p style={{ margin: 0, lineHeight: 1.55 }}>{normalizeHrCopy(onboarding.day_30)}</p>
                      </div>
                    )}
                    {onboarding.day_90 && (
                      <div className="hr-card">
                        <h4 style={{ marginTop: 0 }}>90 дней</h4>
                        <p style={{ margin: 0, lineHeight: 1.55 }}>{normalizeHrCopy(onboarding.day_90)}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

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
                        <div key={v.id} className="hr-card" style={{ background: "rgba(255,255,255,0.02)" }}>
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
                    Точная оценка под конкретную вакансию будет отдельным разбором. Сейчас карта
                    показывает рабочий профиль кандидата и гипотезы для проверки на интервью.
                  </p>
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

  if (hasAi && companyId && candidateId) {
    return (
      <TalentMapView
        candidate={candidate}
        companyId={companyId}
        candidateId={candidateId}
        vacancies={vacancies}
        mode="ai"
        aiContent={normalizeAiReportContent(aiReport.content_json)}
        fitScore={aiReport.fit_score}
        onGenerateAi={() => onGenerateAi(true)}
        generating={generating}
        aiError={aiError}
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
      />
    );
  }

  return null;
}
