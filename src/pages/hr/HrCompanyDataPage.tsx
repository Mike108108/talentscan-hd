import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { fetchCandidates, fetchHrCompany, fetchTalentMapsForCompany, fetchVacancies } from "../../lib/hr/api";
import type { HrCandidate, HrCompany, HrVacancy } from "../../lib/hr/types";

export default function HrCompanyDataPage() {
  const { companyId } = useParams<{ companyId: string }>();
  const [company, setCompany] = useState<HrCompany | null>(null);
  const [vacancies, setVacancies] = useState<HrVacancy[]>([]);
  const [candidates, setCandidates] = useState<HrCandidate[]>([]);
  const [mapsCount, setMapsCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!companyId) return;
    (async () => {
      setLoading(true);
      const [c, v, cand, maps] = await Promise.all([
        fetchHrCompany(companyId),
        fetchVacancies(companyId),
        fetchCandidates(companyId),
        fetchTalentMapsForCompany(companyId),
      ]);
      setCompany(c);
      setVacancies(v);
      setCandidates(cand);
      setMapsCount(maps.length);
      setLoading(false);
    })();
  }, [companyId]);

  if (!companyId) return null;

  return (
    <div>
      <div className="hr-hero">
        <h2>Моя компания</h2>
        <p>Контекст компании и полнота данных. На этом этапе без сотрудников/руководителей — только фундамент.</p>
      </div>

      {loading ? (
        <p>Загрузка…</p>
      ) : (
        <>
          <div className="hr-grid-4" style={{ marginBottom: 14 }}>
            <div className="hr-card">
              <p style={{ margin: 0, color: "var(--hr-muted)", fontSize: 13 }}>Компания</p>
              <b style={{ fontSize: 18 }}>{company?.name ?? "—"}</b>
              <p style={{ margin: "8px 0 0", color: "var(--hr-muted)", fontSize: 13 }}>
                {company?.industry ?? "Индустрия не указана"}
              </p>
            </div>
            <div className="hr-card">
              <p style={{ margin: 0, color: "var(--hr-muted)", fontSize: 13 }}>Вакансии</p>
              <b style={{ fontSize: 28 }}>{vacancies.length}</b>
            </div>
            <div className="hr-card">
              <p style={{ margin: 0, color: "var(--hr-muted)", fontSize: 13 }}>Кандидаты</p>
              <b style={{ fontSize: 28 }}>{candidates.length}</b>
            </div>
            <div className="hr-card">
              <p style={{ margin: 0, color: "var(--hr-muted)", fontSize: 13 }}>Карты талантов</p>
              <b style={{ fontSize: 28 }}>{mapsCount}</b>
            </div>
          </div>

          <div className="hr-card" style={{ marginBottom: 14 }}>
            <h3 style={{ marginTop: 0 }}>Контекст компании</h3>
            <p style={{ color: "var(--hr-muted)", marginTop: 0 }}>
              Здесь будет расширенный контекст (продукт, культура, команда, ограничения). На этапе v0.1 используем
              базовые данные компании и структуру вакансий.
            </p>
            <div className="hr-fork-actions">
              <Link to="/hr/companies" className="hr-btn hr-btn--ghost">
                Управление компаниями
              </Link>
            </div>
          </div>

          <div className="hr-card" style={{ marginBottom: 14 }}>
            <h3 style={{ marginTop: 0 }}>Вакансии и роли</h3>
            <p style={{ color: "var(--hr-muted)", marginTop: 0 }}>
              Создавайте вакансии и привязывайте к ним кандидатов. Это фундамент архитектуры “Компания → Вакансии → Кандидаты”.
            </p>
            <div className="hr-fork-actions">
              <Link to={`/hr/company/${companyId}/vacancies`} className="hr-btn">
                Открыть вакансии
              </Link>
              <Link to={`/hr/company/${companyId}/vacancies/new`} className="hr-btn hr-btn--ghost">
                + Создать вакансию
              </Link>
            </div>
          </div>

          <div className="hr-card" style={{ marginBottom: 14, opacity: 0.65 }}>
            <h3 style={{ marginTop: 0 }}>Сотрудники и руководители</h3>
            <p style={{ color: "var(--hr-muted)", marginTop: 0 }}>
              Будущий этап: структура команды, руководители, роли сотрудников. Сейчас не добавляем новые таблицы и сущности.
            </p>
          </div>

          <div className="hr-card">
            <h3 style={{ marginTop: 0 }}>Полнота данных</h3>
            <p style={{ color: "var(--hr-muted)", marginTop: 0 }}>
              Минимум для расчёта карты талантов: дата, время и место рождения кандидата. Для связки с ролью — привязка к вакансии.
            </p>
          </div>
        </>
      )}
    </div>
  );
}

