import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  fetchCandidates,
  fetchHrCompany,
  fetchTalentMapsForCompany,
  fetchVacancies,
  fetchVacancyCandidateLinks,
} from "../../lib/hr/api";
import type { HrCandidate, HrCompany, HrVacancy } from "../../lib/hr/types";

export default function HrCompanyOverviewPage() {
  const { companyId } = useParams<{ companyId: string }>();
  const [company, setCompany] = useState<HrCompany | null>(null);
  const [candidates, setCandidates] = useState<HrCandidate[]>([]);
  const [chartsCount, setChartsCount] = useState(0);
  const [vacancies, setVacancies] = useState<HrVacancy[]>([]);
  const [unlinkedCount, setUnlinkedCount] = useState(0);

  useEffect(() => {
    if (!companyId) return;
    (async () => {
      setCompany(await fetchHrCompany(companyId));
      const [list, maps, vacs, links] = await Promise.all([
        fetchCandidates(companyId),
        fetchTalentMapsForCompany(companyId),
        fetchVacancies(companyId),
        fetchVacancyCandidateLinks(companyId),
      ]);
      setCandidates(list);
      setChartsCount(maps.length);
      setVacancies(vacs);
      const linkedCandidateIds = new Set((links ?? []).map((l) => (l as any).candidate_id as string));
      setUnlinkedCount(list.filter((c) => !linkedCandidateIds.has(c.id)).length);
    })();
  }, [companyId]);

  if (!companyId) return null;

  const calculated = candidates.filter((c) => c.chart_status === "calculated").length;
  const activeVacancies = vacancies.filter((v) => v.status === "active").length;

  return (
    <div>
      <div className="hr-hero">
        <span className="hr-eyebrow">
          <span className="hr-dot" />
          Обзор
        </span>
        <h2>Рабочий кабинет работодателя</h2>
        <p>
          <strong>{company?.name ?? "…"}</strong> — главный экран HR-работы: компания, люди,
          вакансии, кандидаты, рабочие связки и всё, что требует решения.
        </p>
      </div>

      <div className="hr-grid-4" style={{ marginBottom: 14 }}>
        <div className="hr-card">
          <p style={{ margin: 0, color: "var(--hr-muted)", fontSize: 13 }}>Активные вакансии</p>
          <b style={{ fontSize: 28 }}>{activeVacancies}</b>
          <p style={{ margin: "6px 0 0", color: "var(--hr-muted)", fontSize: 13 }}>
            Всего: {vacancies.length}
          </p>
        </div>
        <div className="hr-card">
          <p style={{ margin: 0, color: "var(--hr-muted)", fontSize: 13 }}>Кандидаты</p>
          <b style={{ fontSize: 28 }}>{candidates.length}</b>
          <p style={{ margin: "6px 0 0", color: "var(--hr-muted)", fontSize: 13 }}>
            Без привязки к вакансии: {unlinkedCount}
          </p>
        </div>
        <div className="hr-card">
          <p style={{ margin: 0, color: "var(--hr-muted)", fontSize: 13 }}>Карты рассчитаны</p>
          <b style={{ fontSize: 28 }}>{calculated || chartsCount}</b>
          <p style={{ margin: "6px 0 0", color: "var(--hr-muted)", fontSize: 13 }}>
            Без полной даты/времени/места:{" "}
            {candidates.filter((c) => c.chart_status === "birth_data_incomplete").length}
          </p>
        </div>
      </div>

      <div className="hr-card" style={{ marginBottom: 14 }}>
        <h3 style={{ marginTop: 0 }}>Быстрые действия</h3>
        <div className="hr-fork-actions">
          <Link to={`/hr/company/${companyId}/vacancies/new`} className="hr-btn">
            + Создать вакансию
          </Link>
          <Link to={`/hr/company/${companyId}/candidates/new`} className="hr-btn hr-btn--ghost">
            + Добавить кандидата
          </Link>
          <Link to={`/hr/company/${companyId}/reports`} className="hr-btn hr-btn--secondary">
            Открыть разборы
          </Link>
          <Link to={`/hr/company/${companyId}/company`} className="hr-btn hr-btn--secondary">
            Открыть «Моя компания»
          </Link>
        </div>
      </div>

      <div className="hr-grid-3">
        {["Оценка под вакансию", "Сравнение", "TeamScan", "Интервью", "Адаптация"].map((title) => (
          <div key={title} className="hr-card" style={{ opacity: 0.55 }}>
            <h4 style={{ margin: "0 0 8px" }}>{title}</h4>
            <p style={{ margin: 0, color: "var(--hr-muted)", fontSize: 14 }}>Скоро в продукте</p>
          </div>
        ))}
      </div>
    </div>
  );
}
