import { Component, useEffect, useMemo, useState } from "react";
import type { ErrorInfo, ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { HrSidePanel } from "../../components/hr/HrSidePanel";
import {
  fetchCandidate,
  fetchCandidateVacancies,
  fetchLatestCandidateReport,
  generateCandidateReport,
} from "../../lib/hr/api";
import {
  normalizeAiReportContent,
  parseReportContentJson,
} from "../../lib/hr/normalizeAiReport";
import {
  extractCompletenessPercent,
  formatReportDate,
} from "../../lib/hr/talentMapUiHelpers";
import type { HrCandidate, HrPersonTalentMapV1, HrReport, HrVacancy, TalentMapRole } from "../../lib/hr/types";
import { formulaToSafeHtml } from "../../lib/safeHtml";
import {
  buildReportLists,
  DataQualitySection,
  getDetailPanelTitle,
  ItemDetailPanel,
  type DetailPanelState,
  type ReportContentCtx,
} from "./talentMapPanelContent";
import type { OnboardingPhase } from "../../lib/hr/talentMapUiHelpers";
import "../../hr.css";

type SectionId =
  | "overview"
  | "profile"
  | "risks"
  | "checks"
  | "interview"
  | "test"
  | "onboarding"
  | "data"
  | "roles";

const NAV_SECTIONS: Array<{ id: SectionId; label: string; hint?: string }> = [
  { id: "overview", label: "Обзор" },
  { id: "profile", label: "Рабочий профиль", hint: "Формула и таланты" },
  { id: "risks", label: "Риски и условия" },
  { id: "checks", label: "Проверка" },
  { id: "interview", label: "Интервью" },
  { id: "test", label: "Тестовое" },
  { id: "onboarding", label: "Адаптация" },
  { id: "data", label: "Данные" },
  { id: "roles", label: "Роли и вакансии" },
];

function isReadyTalentMapReport(report: HrReport | null): boolean {
  if (!report || report.report_status !== "ready") return false;
  return parseReportContentJson(report.content_json) != null;
}

function normalizeHrCopy(text: string | null | undefined): string {
  const t = (text ?? "").trim();
  if (!t) return "";
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

function CompactRow({
  title,
  subtitle,
  onClick,
}: {
  title: string;
  subtitle?: string;
  onClick?: () => void;
}) {
  const body = (
    <>
      <span className="hr-tm-row-body">
        <span className="hr-tm-row-title">{title}</span>
        {subtitle ? <span className="hr-tm-row-sub">{subtitle}</span> : null}
      </span>
      {onClick ? <span className="hr-tm-row-chevron" aria-hidden>→</span> : null}
    </>
  );
  if (onClick) {
    return (
      <button type="button" className="hr-tm-row hr-tm-row--clickable" onClick={onClick}>
        {body}
      </button>
    );
  }
  return <div className="hr-tm-row">{body}</div>;
}

function StatPill({
  label,
  value,
  onClick,
}: {
  label: string;
  value: string;
  onClick?: () => void;
}) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      className={`hr-tm-stat-pill${onClick ? " hr-tm-stat-pill--clickable" : ""}`}
      onClick={onClick}
    >
      <span className="hr-tm-stat-pill-label">{label}</span>
      <span className="hr-tm-stat-pill-value">{value}</span>
    </Tag>
  );
}

function RolesTable({ roles }: { roles: TalentMapRole[] }) {
  if (!roles.length) return <p className="hr-muted">Нет данных</p>;
  return (
    <div className="hr-tm-table-wrap">
      <table className="hr-tm-roles-table">
        <thead>
          <tr>
            <th>Роль</th>
            <th>Соответствие</th>
            <th>Заметка</th>
          </tr>
        </thead>
        <tbody>
          {roles.map((r, idx) => (
            <tr key={`${r.role}-${idx}`}>
              <td>{r.role}</td>
              <td>{r.fit}</td>
              <td>{normalizeHrCopy(r.note ?? "")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type WorkspaceProps = {
  candidate: HrCandidate;
  companyId: string;
  candidateId: string;
  vacancies: HrVacancy[];
  aiContent: HrPersonTalentMapV1;
  rawAiContent: unknown;
  aiReport: HrReport;
  onRegenerate: () => void;
  generating: boolean;
  genError: string | null;
};

function TalentMapWorkspace({
  candidate,
  companyId,
  candidateId,
  vacancies,
  aiContent,
  rawAiContent,
  aiReport,
  onRegenerate,
  generating,
  genError,
}: WorkspaceProps) {
  const [section, setSection] = useState<SectionId>("overview");
  const [detail, setDetail] = useState<DetailPanelState | null>(null);

  useEffect(() => {
    if (generating) setDetail(null);
  }, [generating]);

  const ctx: ReportContentCtx = {
    aiContent,
    rawContent: rawAiContent,
    vacancies,
    normalizeHrCopy,
    normalizeHrMaybe,
  };

  const lists = useMemo(() => buildReportLists(ctx), [aiContent, rawAiContent, vacancies]);

  const hero = aiContent.hero;
  const bestWorkFormat = normalizeHrMaybe(hero?.best_work_format);
  const keyTalent = normalizeHrMaybe(hero?.key_talent);
  const mainRisk = normalizeHrMaybe(hero?.main_risk);
  const summaryText = normalizeHrMaybe(
    aiContent.executive_summary?.text ?? hero?.headline,
  );
  const finalRec = normalizeHrMaybe(aiContent.final_hr_recommendation?.text);
  const formulaText =
    typeof aiContent.working_formula?.text === "string" ? aiContent.working_formula.text : "";
  const formulaHtml = formulaText ? formulaToSafeHtml(formulaText) : "";

  const metrics = aiContent.data_quality?.metrics ?? [];
  const completenessPct = extractCompletenessPercent(
    aiContent.data_quality?.completeness,
    metrics,
  );
  const confidenceLabel = aiContent.data_quality?.confidence
    ? normalizeHrCopy(aiContent.data_quality.confidence)
    : completenessPct != null
      ? `${completenessPct}%`
      : "уточняется";

  const updatedLabel = formatReportDate(
    aiReport.generated_at ?? aiReport.updated_at,
  );
  const vacancyLabel =
    vacancies.length === 1
      ? vacancies[0].title
      : vacancies.length > 1
        ? `${vacancies.length} вакансии`
        : candidate.vacancy_title || "не привязана";

  const checkHint =
    lists.interviews.length > 0
      ? `${lists.interviews.length} вопросов`
      : lists.tests.length > 0
        ? "тестовое задание"
        : "кейс + встреча";

  const nextStep =
    finalRec ??
    (lists.interviews.length > 0
      ? "Провести интервью по вопросам из раздела «Интервью»."
      : "Уточнить опыт и мотивацию на встрече.");

  const mainConclusion = summaryText ?? finalRec ?? "Разбор готов — откройте разделы ниже для деталей.";

  const detailLists = {
    risks: lists.risks,
    interviews: lists.interviews,
    tests: lists.tests,
    talents: lists.talents,
    strengths: lists.strengths,
    directions: lists.directions,
    roles: lists.roles,
  };

  const onboardingPhaseKey = (phase: OnboardingPhase, idx: number): "7" | "30" | "90" => {
    if (phase.label.includes("7")) return "7";
    if (phase.label.includes("30")) return "30";
    if (phase.label.includes("90")) return "90";
    return (["7", "30", "90"] as const)[idx] ?? "7";
  };

  const renderSection = () => {
    switch (section) {
      case "overview":
        return (
          <div className="hr-tm-section-stack">
            {formulaHtml ? (
              <div>
                <h3 className="hr-tm-section-h">Условия раскрытия</h3>
                <div
                  className="hr-tm-overview-formula"
                  dangerouslySetInnerHTML={{ __html: formulaHtml }}
                />
              </div>
            ) : null}
            {keyTalent ? (
              <div>
                <h3 className="hr-tm-section-h">Ключевой талант</h3>
                <p className="hr-muted">{keyTalent}</p>
              </div>
            ) : null}
            {mainRisk ? (
              <div>
                <h3 className="hr-tm-section-h">Главный риск</h3>
                <p className="hr-muted">{mainRisk}</p>
              </div>
            ) : null}
          </div>
        );
      case "profile":
        return (
          <div className="hr-tm-section-stack">
            {bestWorkFormat ? (
              <p>
                <strong>Рабочий формат:</strong> {bestWorkFormat}
              </p>
            ) : null}
            {formulaHtml ? (
              <div
                className="hr-tm-overview-formula"
                dangerouslySetInnerHTML={{ __html: formulaHtml }}
              />
            ) : null}
            <h3 className="hr-tm-section-h">Таланты</h3>
            {lists.talents.length === 0 ? (
              <p className="hr-muted">Нет данных</p>
            ) : (
              lists.talents.map((t, i) => (
                <CompactRow
                  key={`${t.title}-${i}`}
                  title={t.title}
                  subtitle={t.body}
                  onClick={() => setDetail({ kind: "talent", index: i })}
                />
              ))
            )}
            <h3 className="hr-tm-section-h">Сильные стороны</h3>
            {lists.strengths.map((s, i) => (
              <CompactRow
                key={`${s.title}-${i}`}
                title={s.title}
                subtitle={s.body}
                onClick={() => setDetail({ kind: "strength", index: i })}
              />
            ))}
            <h3 className="hr-tm-section-h">Подходящие направления</h3>
            {lists.directions.map((d, i) => (
              <CompactRow
                key={`${d.title}-${i}`}
                title={d.title}
                subtitle={d.body}
                onClick={() => setDetail({ kind: "direction", index: i })}
              />
            ))}
          </div>
        );
      case "risks":
        return (
          <div className="hr-tm-section-stack">
            {mainRisk ? <p className="hr-tm-section-lead">{mainRisk}</p> : null}
            {lists.risks.map((r, i) => (
              <CompactRow
                key={`${r.title}-${i}`}
                title={r.title}
                subtitle={r.body}
                onClick={() => setDetail({ kind: "risk", index: i })}
              />
            ))}
            <h3 className="hr-tm-section-h">Среда и управление</h3>
            {[...lists.workEnv, ...lists.mgmt].map((c, i) => (
              <CompactRow key={`${c.title}-${i}`} title={c.title} subtitle={c.body} />
            ))}
            <h3 className="hr-tm-section-h">Спорные направления</h3>
            {lists.questionable.map((q, i) => (
              <CompactRow key={`${q.title}-${i}`} title={q.title} subtitle={q.body} />
            ))}
          </div>
        );
      case "checks":
        return (
          <div className="hr-tm-section-stack">
            <p className="hr-muted">
              Краткий план: интервью для проверки гипотез и короткое тестовое по роли.
            </p>
            <CompactRow
              title="Интервью"
              subtitle={`${lists.interviews.length} вопросов`}
              onClick={() => setSection("interview")}
            />
            <CompactRow
              title="Тестовое"
              subtitle={`${lists.tests.length} заданий`}
              onClick={() => setSection("test")}
            />
          </div>
        );
      case "interview":
        return lists.interviews.length === 0 ? (
          <p className="hr-muted">
            Вопросы появятся после генерации карты с достаточным контекстом.
          </p>
        ) : (
          lists.interviews.map((q, i) => (
            <CompactRow
              key={`${q.title}-${i}`}
              title={q.title}
              subtitle={q.checks || q.body}
              onClick={() => setDetail({ kind: "interview", index: i })}
            />
          ))
        );
      case "test":
        return lists.tests.length === 0 ? (
          <p className="hr-muted">Практические задания появятся в полном разборе.</p>
        ) : (
          lists.tests.map((t, i) => (
            <CompactRow
              key={`${t.title}-${i}`}
              title={t.title}
              subtitle={t.checks || t.body}
              onClick={() => setDetail({ kind: "test", index: i })}
            />
          ))
        );
      case "onboarding":
        return lists.onboardingPhases.length === 0 ? (
          <p className="hr-muted">План адаптации появится при достаточном контексте роли.</p>
        ) : (
          lists.onboardingPhases.map((phase, i) => (
            <CompactRow
              key={`${phase.label}-${i}`}
              title={phase.label}
              subtitle={phase.summary ?? phase.focus ?? "Открыть этап"}
              onClick={() =>
                setDetail({ kind: "onboarding", phase: onboardingPhaseKey(phase, i) })
              }
            />
          ))
        );
      case "data":
        return <DataQualitySection ctx={ctx} />;
      case "roles":
        return (
          <div className="hr-tm-section-stack">
            {vacancies.length === 0 ? (
              <p className="hr-muted">Вакансия не привязана — привяжите кандидата для оценки под роль.</p>
            ) : (
              vacancies.map((v) => (
                <div key={v.id} className="hr-tm-row">
                  <span className="hr-tm-row-title">{v.title}</span>
                  <span className="hr-tm-row-sub">{v.status}</span>
                  <Link
                    to={`/hr/company/${companyId}/vacancies/${v.id}`}
                    className="hr-btn hr-btn--ghost"
                    style={{ marginLeft: "auto", flexShrink: 0 }}
                  >
                    Открыть
                  </Link>
                </div>
              ))
            )}
            <h3 className="hr-tm-section-h">Подходящие роли</h3>
            {lists.roles.map((r, i) => (
              <CompactRow
                key={`${r.role}-${i}`}
                title={r.role}
                subtitle={`${r.fit ?? "—"} · ${normalizeHrCopy(r.note ?? "")}`}
                onClick={() => setDetail({ kind: "role", index: i })}
              />
            ))}
            {lists.roles.length > 3 ? (
              <RolesTable roles={lists.roles} />
            ) : null}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="hr-tm-page hr-tm-page--workspace">
      <div className="hr-tm-header">
        <div className="hr-tm-header-top">
          <Link to={`/hr/company/${companyId}/candidates/${candidateId}`} className="hr-tm-back">
            ← К кандидату
          </Link>
          <button
            type="button"
            className="hr-btn hr-btn--ghost"
            disabled={generating}
            onClick={onRegenerate}
          >
            {generating ? "Генерируем карту…" : "Перегенерировать карту"}
          </button>
        </div>

        {generating && (
          <p className="hr-tm-banner hr-tm-banner--info">Генерируем карту кандидата…</p>
        )}
        {genError && (
          <p className="hr-tm-banner hr-tm-banner--error">
            {genError}
            <button type="button" className="hr-btn hr-btn--ghost" onClick={onRegenerate}>
              Повторить генерацию
            </button>
          </p>
        )}

        <h2 className="hr-tm-title">Карта талантов</h2>
        <p className="hr-tm-subtitle">
          <b>{candidate.name}</b>
        </p>
        <p className="hr-tm-meta-line">
          <span className="hr-status hr-status--ok">Разбор готов</span>
          {updatedLabel ? <span>· обновлено {updatedLabel}</span> : null}
          <span>· вакансия {vacancyLabel}</span>
          {aiReport.fit_score != null ? (
            <span>· соответствие ~{aiReport.fit_score}%</span>
          ) : null}
        </p>

        <div className="hr-tm-conclusion">
          <h3 className="hr-tm-conclusion-title">Главный HR-вывод</h3>
          <p className="hr-tm-conclusion-text">{mainConclusion}</p>
          <p className="hr-tm-conclusion-next">
            <span className="hr-tm-conclusion-next-label">Следующий шаг:</span> {nextStep}
          </p>
          {completenessPct != null && completenessPct < 60 ? (
            <p className="hr-tm-conclusion-warn">
              Данных пока мало — выводы предварительные. Добавьте контекст вакансии и перегенерируйте
              карту.
            </p>
          ) : null}
        </div>

        <div className="hr-tm-stat-row">
          <StatPill
            label="Точность данных"
            value={confidenceLabel}
            onClick={() => setSection("data")}
          />
          <StatPill
            label="Лучший формат"
            value={bestWorkFormat ?? "—"}
            onClick={() => setSection("profile")}
          />
          <StatPill
            label="Главный риск"
            value={mainRisk ?? "—"}
            onClick={() => setSection("risks")}
          />
          <StatPill
            label="Что проверить"
            value={checkHint}
            onClick={() => setSection("checks")}
          />
        </div>
      </div>

      <div className="hr-tm-workspace">
        <nav className="hr-tm-nav" aria-label="Разделы карты">
          <div className="hr-tm-nav-chips" role="tablist">
            {NAV_SECTIONS.map((s) => (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={section === s.id}
                className={section === s.id ? "hr-tm-nav-item hr-tm-nav-item--active" : "hr-tm-nav-item"}
                onClick={() => setSection(s.id)}
              >
                {s.label}
              </button>
            ))}
          </div>
          <ul className="hr-tm-nav-list">
            {NAV_SECTIONS.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  className={
                    section === s.id ? "hr-tm-nav-item hr-tm-nav-item--active" : "hr-tm-nav-item"
                  }
                  onClick={() => setSection(s.id)}
                >
                  <span>{s.label}</span>
                  {s.hint ? <small>{s.hint}</small> : null}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <div className="hr-tm-section-panel" role="tabpanel">
          <h3 className="hr-tm-section-panel-title">
            {NAV_SECTIONS.find((s) => s.id === section)?.label}
          </h3>
          {renderSection()}
        </div>
      </div>

      <HrSidePanel
        open={detail !== null}
        onClose={() => setDetail(null)}
        title={detail ? getDetailPanelTitle(detail, detailLists) : ""}
        description="Детали для проверки на интервью"
      >
        {detail ? (
          <ItemDetailPanel
            detail={detail}
            ctx={ctx}
            risks={lists.risks}
            interviews={lists.interviews}
            tests={lists.tests}
            talents={lists.talents}
            strengths={lists.strengths}
            directions={lists.directions}
            roles={lists.roles}
          />
        ) : null}
      </HrSidePanel>
    </div>
  );
}

function BrokenReportState({
  candidate,
  companyId,
  candidateId,
  onRegenerate,
  generating,
}: {
  candidate: HrCandidate;
  companyId: string;
  candidateId: string;
  onRegenerate: () => void;
  generating: boolean;
}) {
  return (
    <div className="hr-tm-page">
      <Link to={`/hr/company/${companyId}/candidates/${candidateId}`} className="hr-tm-back">
        ← К кандидату
      </Link>
      <h2 className="hr-tm-title">Карта талантов</h2>
      <p className="hr-tm-subtitle">
        <b>{candidate.name}</b>
      </p>
      <div className="hr-card hr-tm-empty-card">
        <p className="hr-tm-empty-title">Разбор создан, но отобразить его не удалось</p>
        <p className="hr-muted" style={{ lineHeight: 1.55, maxWidth: 520 }}>
          Данные отчёта пришли в неожиданном формате. Попробуйте перегенерировать карту.
        </p>
        <button
          type="button"
          className="hr-btn"
          style={{ marginTop: 16 }}
          disabled={generating}
          onClick={onRegenerate}
        >
          {generating ? "Генерируем карту…" : "Перегенерировать карту"}
        </button>
      </div>
    </div>
  );
}

type WorkspaceErrorBoundaryProps = {
  children: ReactNode;
  fallback: ReactNode;
};

type WorkspaceErrorBoundaryState = { hasError: boolean };

class WorkspaceErrorBoundary extends Component<
  WorkspaceErrorBoundaryProps,
  WorkspaceErrorBoundaryState
> {
  state: WorkspaceErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): WorkspaceErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error("[hr] talent map workspace render failed", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

function EmptyReportState({
  candidate,
  companyId,
  candidateId,
  onGenerate,
  generating,
  error,
}: {
  candidate: HrCandidate;
  companyId: string;
  candidateId: string;
  onGenerate: () => void;
  generating: boolean;
  error: string | null;
}) {
  return (
    <div className="hr-tm-page">
      <Link to={`/hr/company/${companyId}/candidates/${candidateId}`} className="hr-tm-back">
        ← К кандидату
      </Link>
      <h2 className="hr-tm-title">Карта талантов</h2>
      <p className="hr-tm-subtitle">
        <b>{candidate.name}</b>
      </p>

      {generating ? (
        <div className="hr-card hr-tm-empty-card">
          <p className="hr-tm-empty-title">Генерируем карту кандидата…</p>
          <p className="hr-muted">Обычно это занимает 15–40 секунд.</p>
        </div>
      ) : (
        <div className="hr-card hr-tm-empty-card">
          <p className="hr-tm-empty-title">Разбор ещё не создан</p>
          <p className="hr-muted" style={{ lineHeight: 1.55, maxWidth: 520 }}>
            Сначала сгенерируйте карту кандидата, чтобы увидеть рабочий профиль, риски, вопросы
            интервью, тестовое и план адаптации.
          </p>
          {error ? (
            <p className="hr-tm-banner hr-tm-banner--error" style={{ marginTop: 12 }}>
              Не удалось сгенерировать карту. {error}
            </p>
          ) : null}
          <button
            type="button"
            className="hr-btn"
            style={{ marginTop: 16 }}
            disabled={generating}
            onClick={onGenerate}
          >
            {error ? "Повторить генерацию" : "Сгенерировать карту"}
          </button>
        </div>
      )}
    </div>
  );
}

export default function CandidateTalentMapPage() {
  const { companyId, candidateId } = useParams<{ companyId: string; candidateId: string }>();
  const [candidate, setCandidate] = useState<HrCandidate | null>(null);
  const [aiReport, setAiReport] = useState<HrReport | null>(null);
  const [vacancies, setVacancies] = useState<HrVacancy[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  const load = async (opts?: { silent?: boolean }) => {
    if (!companyId || !candidateId) return;
    if (!opts?.silent) setLoading(true);
    const [c, links, report] = await Promise.all([
      fetchCandidate(companyId, candidateId),
      fetchCandidateVacancies(companyId, candidateId),
      fetchLatestCandidateReport(companyId, candidateId, "hr_person_talent_map"),
    ]);
    setCandidate(c);
    setVacancies((links ?? []).map((l: { vacancy: HrVacancy }) => l.vacancy).filter(Boolean));
    setAiReport(report);
    if (!opts?.silent) setLoading(false);
  };

  useEffect(() => {
    load();
  }, [companyId, candidateId]);

  const onGenerate = async (forceRegenerate = false) => {
    if (!companyId || !candidateId) return;
    setGenerating(true);
    setGenError(null);
    try {
      const primaryVacancyId = vacancies.length === 1 ? vacancies[0].id : null;
      await generateCandidateReport(companyId, candidateId, {
        vacancyId: primaryVacancyId,
        reportType: "hr_person_talent_map",
        forceRegenerate,
      });
      const latest = await fetchLatestCandidateReport(
        companyId,
        candidateId,
        "hr_person_talent_map",
      );
      setAiReport(latest);
      if (!isReadyTalentMapReport(latest)) {
        await load({ silent: true });
      }
    } catch (err) {
      console.error("[hr] generate talent map failed", err);
      setGenError(err instanceof Error ? err.message : "Не удалось сгенерировать карту");
      try {
        const latest = await fetchLatestCandidateReport(
          companyId,
          candidateId,
          "hr_person_talent_map",
        );
        if (latest) setAiReport(latest);
      } catch {
        /* keep previous report state */
      }
    } finally {
      setGenerating(false);
    }
  };

  if (loading || !candidate || !companyId || !candidateId) {
    return <p>Загрузка…</p>;
  }

  const parsedContent = aiReport ? parseReportContentJson(aiReport.content_json) : null;
  const hasReadyReport = isReadyTalentMapReport(aiReport);

  let safeContent: HrPersonTalentMapV1 | null = null;
  if (hasReadyReport && parsedContent) {
    try {
      safeContent = normalizeAiReportContent(parsedContent);
    } catch (err) {
      console.error("[hr] normalize talent map content failed", err);
      safeContent = null;
    }
  }

  if (hasReadyReport && safeContent && aiReport) {
    const brokenFallback = (
      <BrokenReportState
        candidate={candidate}
        companyId={companyId}
        candidateId={candidateId}
        onRegenerate={() => onGenerate(true)}
        generating={generating}
      />
    );

    return (
      <WorkspaceErrorBoundary fallback={brokenFallback}>
        <TalentMapWorkspace
          candidate={candidate}
          companyId={companyId}
          candidateId={candidateId}
          vacancies={vacancies}
          aiContent={safeContent}
          rawAiContent={parsedContent}
          aiReport={aiReport}
          onRegenerate={() => onGenerate(true)}
          generating={generating}
          genError={genError}
        />
      </WorkspaceErrorBoundary>
    );
  }

  if (hasReadyReport && !safeContent) {
    return (
      <BrokenReportState
        candidate={candidate}
        companyId={companyId}
        candidateId={candidateId}
        onRegenerate={() => onGenerate(true)}
        generating={generating}
      />
    );
  }

  return (
    <EmptyReportState
      candidate={candidate}
      companyId={companyId}
      candidateId={candidateId}
      onGenerate={() => onGenerate(false)}
      generating={generating || aiReport?.report_status === "generating"}
      error={genError ?? (aiReport?.report_status === "error" ? aiReport.generation_error : null)}
    />
  );
}
