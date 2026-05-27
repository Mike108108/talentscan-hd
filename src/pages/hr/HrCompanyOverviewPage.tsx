import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { fetchCandidates, fetchHrCompany, fetchTalentMapsForCompany } from "../../lib/hr/api";
import type { HrCandidate, HrCompany } from "../../lib/hr/types";

export default function HrCompanyOverviewPage() {
  const { companyId } = useParams<{ companyId: string }>();
  const [company, setCompany] = useState<HrCompany | null>(null);
  const [candidates, setCandidates] = useState<HrCandidate[]>([]);
  const [chartsCount, setChartsCount] = useState(0);

  useEffect(() => {
    if (!companyId) return;
    (async () => {
      setCompany(await fetchHrCompany(companyId));
      const list = await fetchCandidates(companyId);
      setCandidates(list);
      const maps = await fetchTalentMapsForCompany(companyId);
      setChartsCount(maps.length);
    })();
  }, [companyId]);

  if (!companyId) return null;

  const calculated = candidates.filter((c) => c.chart_status === "calculated").length;

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
          <p style={{ margin: 0, color: "var(--hr-muted)", fontSize: 13 }}>Люди</p>
          <b style={{ fontSize: 28 }}>0</b>
        </div>
        <div className="hr-card">
          <p style={{ margin: 0, color: "var(--hr-muted)", fontSize: 13 }}>Вакансии</p>
          <b style={{ fontSize: 28 }}>0</b>
        </div>
        <div className="hr-card">
          <p style={{ margin: 0, color: "var(--hr-muted)", fontSize: 13 }}>Кандидаты</p>
          <b style={{ fontSize: 28 }}>{candidates.length}</b>
        </div>
        <div className="hr-card">
          <p style={{ margin: 0, color: "var(--hr-muted)", fontSize: 13 }}>Карты рассчитаны</p>
          <b style={{ fontSize: 28 }}>{calculated || chartsCount}</b>
        </div>
      </div>

      <div className="hr-card" style={{ marginBottom: 14 }}>
        <h3 style={{ marginTop: 0 }}>Быстрые действия</h3>
        <div className="hr-fork-actions">
          <Link to={`/hr/company/${companyId}/candidates/new`} className="hr-btn">
            + Добавить кандидата
          </Link>
          <Link to="/hr/companies" className="hr-btn hr-btn--ghost">
            + Добавить компанию
          </Link>
          <Link to={`/hr/company/${companyId}/candidates`} className="hr-btn hr-btn--secondary">
            Открыть кандидатов
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
