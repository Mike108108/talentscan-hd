import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  calculateCandidateChart,
  fetchCandidate,
  fetchTalentMap,
} from "../../lib/hr/api";
import { CHART_STATUS_LABELS, deriveChartStatus } from "../../lib/hr/chartStatus";
import type { HrCandidate, HrCandidateTalentMap } from "../../lib/hr/types";

export default function HrCandidateDetailPage() {
  const { companyId, candidateId } = useParams<{ companyId: string; candidateId: string }>();
  const [candidate, setCandidate] = useState<HrCandidate | null>(null);
  const [talentMap, setTalentMap] = useState<HrCandidateTalentMap | null>(null);
  const [calculating, setCalculating] = useState(false);

  const load = async () => {
    if (!companyId || !candidateId) return;
    const c = await fetchCandidate(companyId, candidateId);
    setCandidate(c);
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
          <p style={{ margin: 0, color: "var(--hr-muted)" }}>Уверенность предварительной оценки</p>
          <b>{status === "calculated" ? "Средняя (MVP)" : "—"}</b>
        </div>
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
        {status === "ready_to_calculate" && (
          <button type="button" className="hr-btn" disabled={calculating} onClick={onCalculate}>
            {calculating ? "Считаем…" : "Рассчитать карту"}
          </button>
        )}
        <button type="button" className="hr-btn hr-btn--secondary" disabled title="Скоро">
          Оценить под вакансию — позже
        </button>
        <button type="button" className="hr-btn hr-btn--secondary" disabled title="Скоро">
          Сравнить — позже
        </button>
        <button type="button" className="hr-btn hr-btn--secondary" disabled title="Скоро">
          TeamScan — позже
        </button>
      </div>
    </div>
  );
}
