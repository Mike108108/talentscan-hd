import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { fetchTalentMapsForCompany, fetchVacancies, fetchVacancyCandidateLinks } from "../../lib/hr/api";
import type { HrVacancy } from "../../lib/hr/types";

type LinkRow = { vacancy_id: string; candidate_id: string };
type MapRow = { candidate_id: string };

export default function HrVacanciesPage() {
  const { companyId } = useParams<{ companyId: string }>();
  const [vacancies, setVacancies] = useState<HrVacancy[]>([]);
  const [links, setLinks] = useState<LinkRow[]>([]);
  const [maps, setMaps] = useState<Map<string, MapRow>>(new Map());
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!companyId) return;
    setLoading(true);
    const [vacList, linkRows, mapRows] = await Promise.all([
      fetchVacancies(companyId),
      fetchVacancyCandidateLinks(companyId),
      fetchTalentMapsForCompany(companyId),
    ]);
    setVacancies(vacList);
    setLinks(linkRows as unknown as LinkRow[]);
    const m = new Map<string, MapRow>();
    for (const row of mapRows as unknown as MapRow[]) {
      m.set(row.candidate_id, row);
    }
    setMaps(m);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [companyId]);

  const statsByVacancy = useMemo(() => {
    const byVacancy = new Map<
      string,
      { candidatesTotal: number; withMap: number; withoutMap: number }
    >();
    for (const l of links) {
      const cur = byVacancy.get(l.vacancy_id) ?? { candidatesTotal: 0, withMap: 0, withoutMap: 0 };
      cur.candidatesTotal += 1;
      if (maps.has(l.candidate_id)) cur.withMap += 1;
      else cur.withoutMap += 1;
      byVacancy.set(l.vacancy_id, cur);
    }
    return byVacancy;
  }, [links, maps]);

  if (!companyId) return null;

  return (
    <div>
      <div className="hr-hero">
        <h2>Вакансии</h2>
        <p>Роли и позиции компании. Здесь мы собираем кандидатов по вакансиям и открываем их карты талантов.</p>
        <Link to={`/hr/company/${companyId}/vacancies/new`} className="hr-btn" style={{ marginTop: 16 }}>
          + Создать вакансию
        </Link>
      </div>

      {loading ? (
        <p>Загрузка…</p>
      ) : vacancies.length === 0 ? (
        <div className="hr-card" style={{ textAlign: "center" }}>
          <h3>Вакансий пока нет</h3>
          <p style={{ color: "var(--hr-muted)" }}>
            Создайте первую вакансию, чтобы привязывать к ней кандидатов и собирать разборы по ролям.
          </p>
          <Link to={`/hr/company/${companyId}/vacancies/new`} className="hr-btn">
            + Создать вакансию
          </Link>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {vacancies.map((v) => {
            const s = statsByVacancy.get(v.id) ?? { candidatesTotal: 0, withMap: 0, withoutMap: 0 };
            return (
              <div key={v.id} className="hr-card">
                <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "space-between" }}>
                  <div>
                    <h3 style={{ margin: "0 0 4px" }}>{v.title}</h3>
                    <p style={{ margin: 0, color: "var(--hr-muted)" }}>
                      Статус: <strong>{v.status}</strong>
                      {v.department ? <> · Отдел: {v.department}</> : null}
                      {v.work_format ? <> · Формат: {v.work_format}</> : null}
                    </p>
                    <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 10, color: "var(--hr-muted)", fontSize: 13 }}>
                      <span>Кандидатов: <strong style={{ color: "var(--hr-text)" }}>{s.candidatesTotal}</strong></span>
                      <span>Карты есть: <strong style={{ color: "var(--hr-text)" }}>{s.withMap}</strong></span>
                      <span>Карты нет: <strong style={{ color: "var(--hr-text)" }}>{s.withoutMap}</strong></span>
                    </div>
                  </div>
                  <div className="hr-fork-actions">
                    <Link to={`/hr/company/${companyId}/vacancies/${v.id}`} className="hr-btn">
                      Открыть вакансию
                    </Link>
                    <Link to={`/hr/company/${companyId}/vacancies/${v.id}/edit`} className="hr-btn hr-btn--ghost">
                      Редактировать
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

