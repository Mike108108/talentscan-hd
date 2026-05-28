import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  calculateCandidateChart,
  fetchCandidate,
  fetchCandidateVacancies,
  fetchTalentMap,
} from "../../lib/hr/api";
import { CHART_STATUS_LABELS, deriveChartStatus } from "../../lib/hr/chartStatus";
import type { HrCandidate, HrCandidateTalentMap, HrVacancy } from "../../lib/hr/types";

export default function HrCandidateDetailPage() {
  const { companyId, candidateId } = useParams<{ companyId: string; candidateId: string }>();
  const [candidate, setCandidate] = useState<HrCandidate | null>(null);
  const [talentMap, setTalentMap] = useState<HrCandidateTalentMap | null>(null);
  const [vacancies, setVacancies] = useState<HrVacancy[]>([]);
  const [calculating, setCalculating] = useState(false);

  const load = async () => {
    if (!companyId || !candidateId) return;
    const [c, links] = await Promise.all([
      fetchCandidate(companyId, candidateId),
      fetchCandidateVacancies(companyId, candidateId),
    ]);
    setCandidate(c);
    setVacancies((links ?? []).map((l: any) => l.vacancy).filter(Boolean) as HrVacancy[]);
    if (c?.chart_status === "calculated") {
      setTalentMap((await fetchTalentMap(companyId, candidateId)) as HrCandidateTalentMap | null);
    }
  };

  useEffect(() => {
    load();
  }, [companyId, candidateId]);

  const onCalculate = async () => {
    if (!companyId || !candidateId) return;
    setCalculating(true);
    try {
      await calculateCandidateChart(companyId, candidateId);
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setCalculating(false);
    }
  };

  if (!candidate) return <p>Загрузка…</p>;

  const status = deriveChartStatus(candidate);
  const primaryVacancy = vacancies.length === 1 ? vacancies[0] : null;

  return (
    <div>
      <div className="hr-hero">
        <h2>{candidate.name}</h2>
        <p>
          Кандидат · {candidate.vacancy_title || "роль не указана"}
        </p>
        <span className={`hr-status ${status === "calculated" ? "hr-status--ok" : "hr-status--warn"}`}>
          {status === "calculated" ? "Карта талантов рассчитана" : CHART_STATUS_LABELS[status]}
        </span>
      </div>

      {talentMap && (
        <div className="hr-grid-3" style={{ marginBottom: 14 }}>
          <div className="hr-card">
            <p style={{ margin: 0, color: "var(--hr-muted)", fontSize: 13 }}>Лучший рабочий формат</p>
            <b>{talentMap.best_work_format}</b>
          </div>
          <div className="hr-card">
            <p style={{ margin: 0, color: "var(--hr-muted)", fontSize: 13 }}>Ключевой талант</p>
            <b>{talentMap.key_talent}</b>
          </div>
          <div className="hr-card">
            <p style={{ margin: 0, color: "var(--hr-muted)", fontSize: 13 }}>Главный риск</p>
            <b>{talentMap.main_risk}</b>
          </div>
        </div>
      )}

      <div className="hr-grid-2" style={{ marginBottom: 14 }}>
        <div className="hr-card">
          <p style={{ margin: 0, color: "var(--hr-muted)" }}>Полнота данных</p>
          <b>{status === "calculated" ? "Достаточно для карты" : "Требуется уточнение"}</b>
        </div>
        <div className="hr-card">
          <p style={{ margin: 0, color: "var(--hr-muted)" }}>Вакансии кандидата</p>
          {vacancies.length === 0 ? (
            <b>Кандидат пока не привязан к вакансии</b>
          ) : (
            <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 8 }}>
              {vacancies.map((v) => (
                <Link
                  key={v.id}
                  to={`/hr/company/${companyId}/vacancies/${v.id}`}
                  className="hr-btn hr-btn--ghost"
                >
                  {v.title}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="hr-card" style={{ marginBottom: 14 }}>
        <h3 style={{ marginTop: 0 }}>Вакансии кандидата</h3>
        {vacancies.length === 0 ? (
          <p style={{ margin: 0, color: "var(--hr-muted)" }}>Кандидат пока не привязан к вакансии.</p>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {vacancies.map((v) => (
              <div key={v.id} className="hr-card" style={{ background: "rgba(255,255,255,0.02)" }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "space-between" }}>
                  <div>
                    <h4 style={{ margin: "0 0 4px" }}>{v.title}</h4>
                    <p style={{ margin: 0, color: "var(--hr-muted)" }}>
                      Статус: <strong>{v.status}</strong>
                      {v.department ? <> · Отдел: {v.department}</> : null}
                      {v.work_format ? <> · Формат: {v.work_format}</> : null}
                    </p>
                  </div>
                  <div className="hr-fork-actions">
                    <Link to={`/hr/company/${companyId}/vacancies/${v.id}`} className="hr-btn">
                      Открыть вакансию
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="hr-fork-actions">
        {status === "calculated" && companyId && candidateId && (
          <Link
            to={`/hr/company/${companyId}/candidates/${candidateId}/talent-map`}
            className="hr-btn"
          >
            Открыть карту талантов
          </Link>
        )}
        <Link
          to={`/hr/company/${companyId}/candidates/${candidateId}/edit`}
          className="hr-btn hr-btn--ghost"
        >
          Дополнить данные
        </Link>
        {primaryVacancy && (
          <Link to={`/hr/company/${companyId}/vacancies/${primaryVacancy.id}`} className="hr-btn hr-btn--ghost">
            К вакансии
          </Link>
        )}
        {status === "ready_to_calculate" && (
          <button type="button" className="hr-btn" disabled={calculating} onClick={onCalculate}>
            {calculating ? "Считаем…" : "Рассчитать карту"}
          </button>
        )}
      </div>

      <div className="hr-card" style={{ marginTop: 14 }}>
        <h3 style={{ marginTop: 0 }}>Следующие этапы</h3>
        <p style={{ margin: "6px 0 0", color: "var(--hr-muted)" }}>
          Эти функции появятся позже — сейчас фокус на карте талантов, данных кандидата и контексте вакансии.
        </p>
        <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
          <div className="hr-pill" style={{ justifyContent: "space-between" }}>
            <span>Оценка под вакансию</span>
            <span style={{ color: "var(--hr-muted)" }}>скоро</span>
          </div>
          <div className="hr-pill" style={{ justifyContent: "space-between" }}>
            <span>Сравнение кандидатов</span>
            <span style={{ color: "var(--hr-muted)" }}>скоро</span>
          </div>
          <div className="hr-pill" style={{ justifyContent: "space-between" }}>
            <span>TeamScan</span>
            <span style={{ color: "var(--hr-muted)" }}>скоро</span>
          </div>
        </div>
      </div>
    </div>
  );
}
