import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  calculateCandidateChart,
  fetchCandidate,
  fetchCandidateVacancies,
  fetchLatestHrReport,
} from "../../lib/hr/api";
import { CHART_STATUS_LABELS, deriveChartStatus } from "../../lib/hr/chartStatus";
import { isReadyTalentMapReport } from "../../lib/hr/normalizeAiReport";
import type { HrCandidate, HrReport, HrVacancy } from "../../lib/hr/types";

function technicalStatusLabel(status: ReturnType<typeof deriveChartStatus>): string {
  switch (status) {
    case "birth_data_incomplete":
    case "draft":
      return "Данные неполные";
    case "ready_to_calculate":
      return "Готово к расчёту карты";
    case "calculated":
      return "Техническая карта рассчитана";
    case "calculating":
      return "Техническая карта считается…";
    case "calculation_error":
      return "Ошибка расчёта технической карты";
    default:
      return CHART_STATUS_LABELS[status];
  }
}

function aiStatusLabel(report: HrReport | null): { label: string; ok: boolean } {
  if (!report) {
    return { label: "Подробная AI-расшифровка ещё не создана", ok: false };
  }
  if (isReadyTalentMapReport(report)) {
    return { label: "AI-расшифровка готова", ok: true };
  }
  if (report.report_status === "generating") {
    return { label: "AI-расшифровка формируется…", ok: false };
  }
  if (report.report_status === "error") {
    return {
      label: report.generation_error
        ? `Ошибка AI-расшифровки: ${report.generation_error}`
        : "Ошибка AI-расшифровки",
      ok: false,
    };
  }
  return { label: "Подробная AI-расшифровка ещё не создана", ok: false };
}

function technicalStatusHint(status: ReturnType<typeof deriveChartStatus>): string {
  switch (status) {
    case "calculated":
      return "Расчёт по данным рождения выполнен. Эти данные используются как основа карты талантов.";
    case "calculating":
      return "Идёт расчёт основы карты по данным рождения.";
    case "calculation_error":
      return "Не удалось рассчитать основу карты. Проверьте данные рождения и повторите расчёт.";
    case "ready_to_calculate":
      return "Данные готовы — можно рассчитать основу карты талантов.";
    default:
      return "Нужны дата, время и место рождения, чтобы рассчитать основу карты талантов.";
  }
}

function aiStatusHint(report: HrReport | null): string {
  if (!report) {
    return "Подробная AI-расшифровка ещё не создана.";
  }
  if (isReadyTalentMapReport(report)) {
    return "AI-расшифровка карты талантов готова.";
  }
  if (report.report_status === "generating") {
    return "Подробная AI-расшифровка формируется — обычно это занимает около минуты.";
  }
  if (report.report_status === "error") {
    return "Не удалось создать AI-расшифровку. Попробуйте перегенерировать карту.";
  }
  return "Подробная AI-расшифровка ещё не создана.";
}

const FUTURE_ACTIONS = [
  "Сформировать интервью",
  "Сформировать тестовое",
  "Сформировать план адаптации",
  "Оценить под вакансию",
  "Сравнить кандидатов",
  "TeamScan",
] as const;

export default function HrCandidateDetailPage() {
  const { companyId, candidateId } = useParams<{ companyId: string; candidateId: string }>();
  const navigate = useNavigate();
  const [candidate, setCandidate] = useState<HrCandidate | null>(null);
  const [vacancies, setVacancies] = useState<HrVacancy[]>([]);
  const [aiReport, setAiReport] = useState<HrReport | null>(null);
  const [calculating, setCalculating] = useState(false);

  const load = async () => {
    if (!companyId || !candidateId) return;
    const [c, links, aiResult] = await Promise.all([
      fetchCandidate(companyId, candidateId),
      fetchCandidateVacancies(companyId, candidateId),
      fetchLatestHrReport(companyId, candidateId, "hr_person_talent_map"),
    ]);
    setCandidate(c);
    setVacancies((links ?? []).map((l: { vacancy: HrVacancy }) => l.vacancy).filter(Boolean));
    setAiReport(aiResult.report);
  };

  useEffect(() => {
    load();
  }, [companyId, candidateId]);

  const onCalculateAndOpen = async () => {
    if (!companyId || !candidateId) return;
    setCalculating(true);
    try {
      await calculateCandidateChart(companyId, candidateId);
      navigate(`/hr/company/${companyId}/candidates/${candidateId}/talent-map`);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setCalculating(false);
    }
  };

  if (!candidate || !companyId || !candidateId) return <p>Загрузка…</p>;

  const chartStatus = deriveChartStatus(candidate);
  const techLabel = technicalStatusLabel(chartStatus);
  const ai = aiStatusLabel(aiReport);
  const talentMapHref = `/hr/company/${companyId}/candidates/${candidateId}/talent-map`;
  const canOpenMap = chartStatus === "calculated" || ai.ok;
  const canCalculate = chartStatus === "ready_to_calculate";

  return (
    <div className="hr-candidate-detail">
      <header className="hr-candidate-detail-header">
        <div>
          <h2>{candidate.name}</h2>
          <p className="hr-candidate-detail-subtitle">
            {ai.ok ? "Карта талантов готова" : techLabel}
          </p>
        </div>
        <Link
          to={`/hr/company/${companyId}/candidates/${candidateId}/edit`}
          className="hr-btn hr-btn--ghost"
        >
          Редактировать данные
        </Link>
      </header>

      <section className="hr-detail-section hr-card">
        <h3 className="hr-detail-section-title">Данные кандидата</h3>
        <dl className="hr-detail-dl">
          <div className="hr-detail-dl-row">
            <dt>Имя</dt>
            <dd>{candidate.name}</dd>
          </div>
          <div className="hr-detail-dl-row">
            <dt>Email</dt>
            <dd>{candidate.email || "—"}</dd>
          </div>
          <div className="hr-detail-dl-row">
            <dt>Телефон</dt>
            <dd>{candidate.phone || "—"}</dd>
          </div>
          <div className="hr-detail-dl-row">
            <dt>Дата рождения</dt>
            <dd>{candidate.birth_date || "—"}</dd>
          </div>
          <div className="hr-detail-dl-row">
            <dt>Время рождения</dt>
            <dd>
              {candidate.birth_time ? String(candidate.birth_time).slice(0, 5) : "—"}
            </dd>
          </div>
          <div className="hr-detail-dl-row">
            <dt>Место рождения</dt>
            <dd>{candidate.birth_place_text || "—"}</dd>
          </div>
          {(candidate.hr_comment || candidate.vacancy_title) && (
            <div className="hr-detail-dl-row">
              <dt>HR-комментарий</dt>
              <dd>
                {candidate.hr_comment ||
                  (candidate.vacancy_title ? candidate.vacancy_title : "—")}
              </dd>
            </div>
          )}
          <div className="hr-detail-dl-row">
            <dt>Связанные вакансии</dt>
            <dd>
              {vacancies.length === 0 ? (
                "Не привязан к вакансии"
              ) : (
                <div className="hr-candidate-card-chips">
                  {vacancies.map((v) => (
                    <span key={v.id} className="hr-chip">
                      {v.title}
                    </span>
                  ))}
                </div>
              )}
            </dd>
          </div>
        </dl>
      </section>

      <section className="hr-detail-section hr-card">
        <h3 className="hr-detail-section-title">Статус карты</h3>
        <div className="hr-map-status-grid">
          <div className="hr-map-status-item">
            <span className="hr-map-status-label">Техническая карта</span>
            <span
              className={`hr-status ${chartStatus === "calculated" ? "hr-status--ok" : "hr-status--warn"}`}
            >
              {techLabel}
            </span>
            <p className="hr-map-status-hint">{technicalStatusHint(chartStatus)}</p>
          </div>
          <div className="hr-map-status-item">
            <span className="hr-map-status-label">AI-расшифровка</span>
            <span className={`hr-status ${ai.ok ? "hr-status--ok" : "hr-status--warn"}`}>
              {ai.label}
            </span>
            <p className="hr-map-status-hint">{aiStatusHint(aiReport)}</p>
          </div>
        </div>
      </section>

      <section className="hr-detail-section">
        <h3 className="hr-detail-section-title">Быстрые действия</h3>
        <div className="hr-quick-actions">
          {canOpenMap ? (
            <Link to={talentMapHref} className="hr-quick-action hr-quick-action--active">
              <span className="hr-quick-action-title">Открыть карту талантов</span>
              <span className="hr-quick-action-desc">HR-разбор кандидата и слои карты</span>
            </Link>
          ) : canCalculate ? (
            <button
              type="button"
              className="hr-quick-action hr-quick-action--active"
              disabled={calculating}
              onClick={onCalculateAndOpen}
            >
              <span className="hr-quick-action-title">
                {calculating ? "Считаем карту…" : "Рассчитать карту талантов"}
              </span>
              <span className="hr-quick-action-desc">
                Рассчитать основу карты и перейти к AI-расшифровке
              </span>
            </button>
          ) : (
            <div className="hr-quick-action hr-quick-action--active hr-quick-action--disabled">
              <span className="hr-quick-action-title">Рассчитать карту талантов</span>
              <span className="hr-quick-action-desc">
                Дополните данные рождения, чтобы рассчитать карту
              </span>
            </div>
          )}

          {FUTURE_ACTIONS.map((label) => (
            <div key={label} className="hr-quick-action hr-quick-action--soon" aria-disabled="true">
              <span className="hr-quick-action-title">{label}</span>
              <span className="hr-quick-action-badge">скоро</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
