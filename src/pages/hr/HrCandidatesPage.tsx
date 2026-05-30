import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { fetchCandidates, fetchVacancies, fetchVacancyCandidateLinks } from "../../lib/hr/api";
import { CHART_STATUS_LABELS, deriveChartStatus } from "../../lib/hr/chartStatus";
import type { HrCandidate, HrVacancy } from "../../lib/hr/types";

type LinkRow = { candidate_id: string; vacancy_id: string };

function formatBirthMeta(c: HrCandidate): string | null {
  const parts: string[] = [];
  if (c.birth_date) parts.push(`Дата: ${c.birth_date}`);
  if (c.birth_time) parts.push(`Время: ${String(c.birth_time).slice(0, 5)}`);
  if (c.birth_place_text) parts.push(`Место: ${c.birth_place_text}`);
  return parts.length > 0 ? parts.join(" · ") : null;
}

function formatContacts(c: HrCandidate): string | null {
  const parts: string[] = [];
  if (c.email) parts.push(c.email);
  if (c.phone) parts.push(c.phone);
  return parts.length > 0 ? parts.join(" · ") : null;
}

export default function HrCandidatesPage() {
  const { companyId } = useParams<{ companyId: string }>();
  const navigate = useNavigate();
  const [candidates, setCandidates] = useState<HrCandidate[]>([]);
  const [vacancyTitlesByCandidate, setVacancyTitlesByCandidate] = useState<Map<string, string[]>>(
    new Map(),
  );
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!companyId) return;
    setLoading(true);
    const [list, links, vacancies] = await Promise.all([
      fetchCandidates(companyId),
      fetchVacancyCandidateLinks(companyId),
      fetchVacancies(companyId),
    ]);
    setCandidates(list);
    const vacancyById = new Map<string, HrVacancy>();
    for (const v of vacancies) vacancyById.set(v.id, v);
    const titlesByCandidate = new Map<string, string[]>();
    for (const l of (links ?? []) as unknown as LinkRow[]) {
      const title = vacancyById.get(l.vacancy_id)?.title;
      if (!title) continue;
      const cur = titlesByCandidate.get(l.candidate_id) ?? [];
      cur.push(title);
      titlesByCandidate.set(l.candidate_id, cur);
    }
    setVacancyTitlesByCandidate(titlesByCandidate);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [companyId]);

  if (!companyId) return null;

  const addHref = `/hr/company/${companyId}/candidates/new`;

  return (
    <div className="hr-candidates-page">
      <div className="hr-page-header">
        <div>
          <h2>Кандидаты</h2>
          <p className="hr-page-header-desc">
            Общий пул кандидатов компании. Карты талантов считаются без оценки под вакансию.
          </p>
        </div>
        {candidates.length > 0 ? (
          <Link to={addHref} className="hr-btn hr-btn--compact">
            + Добавить кандидата
          </Link>
        ) : null}
      </div>

      {loading ? (
        <p>Загрузка…</p>
      ) : candidates.length === 0 ? (
        <div className="hr-empty-state">
          <h3>Кандидатов пока нет</h3>
          <p>
            Добавьте первого кандидата, чтобы рассчитать карту талантов и использовать её для
            будущих HR-действий.
          </p>
          <Link to={addHref} className="hr-btn">
            + Добавить кандидата
          </Link>
        </div>
      ) : (
        <div className="hr-candidate-list">
          {candidates.map((c) => {
            const status = deriveChartStatus(c);
            const linkedVacancies = vacancyTitlesByCandidate.get(c.id) ?? [];
            const contacts = formatContacts(c);
            const birthMeta = formatBirthMeta(c);
            const detailHref = `/hr/company/${companyId}/candidates/${c.id}`;

            return (
              <div
                key={c.id}
                className="hr-candidate-card hr-candidate-card--clickable"
                role="link"
                tabIndex={0}
                onClick={() => navigate(detailHref)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    navigate(detailHref);
                  }
                }}
              >
                <div className="hr-candidate-card-main">
                  <h3 className="hr-candidate-card-name">{c.name}</h3>
                  {contacts ? (
                    <p className="hr-candidate-card-meta">{contacts}</p>
                  ) : null}
                  {linkedVacancies.length > 0 ? (
                    <div className="hr-candidate-card-chips" aria-label="Связанные вакансии">
                      {linkedVacancies.map((title) => (
                        <span key={title} className="hr-chip">
                          {title}
                        </span>
                      ))}
                    </div>
                  ) : c.vacancy_title ? (
                    <p className="hr-candidate-card-meta">
                      <span className="hr-chip">{c.vacancy_title}</span>
                    </p>
                  ) : null}
                  <span
                    className={`hr-status ${status === "calculated" ? "hr-status--ok" : "hr-status--warn"}`}
                  >
                    {CHART_STATUS_LABELS[status]}
                  </span>
                  {birthMeta ? <p className="hr-candidate-card-meta">{birthMeta}</p> : null}
                  {c.hr_comment ? (
                    <p className="hr-candidate-card-comment">{c.hr_comment}</p>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
