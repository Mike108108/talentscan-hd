import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  calculateCandidateChart,
  fetchCandidates,
  fetchTalentMapsForCompany,
  fetchVacancies,
  fetchVacancyCandidateLinks,
} from "../../lib/hr/api";
import { CHART_STATUS_LABELS, deriveChartStatus } from "../../lib/hr/chartStatus";
import type { HrCandidate, HrVacancy } from "../../lib/hr/types";

type MapSummary = {
  candidate_id: string;
  best_work_format: string | null;
  key_talent: string | null;
  main_risk: string | null;
};

type LinkRow = { candidate_id: string; vacancy_id: string };

export default function HrCandidatesPage() {
  const { companyId } = useParams<{ companyId: string }>();
  const [candidates, setCandidates] = useState<HrCandidate[]>([]);
  const [maps, setMaps] = useState<Map<string, MapSummary>>(new Map());
  const [vacancyTitlesByCandidate, setVacancyTitlesByCandidate] = useState<Map<string, string[]>>(
    new Map(),
  );
  const [loading, setLoading] = useState(true);
  const [calcId, setCalcId] = useState<string | null>(null);

  const load = async () => {
    if (!companyId) return;
    setLoading(true);
    const [list, mapRows, links, vacancies] = await Promise.all([
      fetchCandidates(companyId),
      fetchTalentMapsForCompany(companyId),
      fetchVacancyCandidateLinks(companyId),
      fetchVacancies(companyId),
    ]);
    setCandidates(list);
    const m = new Map<string, MapSummary>();
    for (const row of mapRows) {
      m.set(row.candidate_id as string, row as MapSummary);
    }
    setMaps(m);
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

  const onCalculate = async (c: HrCandidate) => {
    if (!companyId) return;
    setCalcId(c.id);
    try {
      await calculateCandidateChart(companyId, c.id);
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Ошибка расчёта");
    } finally {
      setCalcId(null);
    }
  };

  if (!companyId) return null;

  return (
    <div>
      <div className="hr-hero">
        <h2>Кандидаты</h2>
        <p>Общий пул кандидатов компании. Карты талантов считаются без AI-оценки под вакансию на этом этапе.</p>
        <Link to={`/hr/company/${companyId}/candidates/new`} className="hr-btn" style={{ marginTop: 16 }}>
          + Добавить кандидата
        </Link>
      </div>

      {loading ? (
        <p>Загрузка…</p>
      ) : candidates.length === 0 ? (
        <div className="hr-card" style={{ textAlign: "center" }}>
          <h3>Кандидатов пока нет</h3>
          <p style={{ color: "var(--hr-muted)" }}>
            Добавьте первого кандидата и рассчитайте его карту талантов. Это станет основой для
            дальнейшей оценки под роль, сравнения и TeamScan.
          </p>
          <Link to={`/hr/company/${companyId}/candidates/new`} className="hr-btn">
            + Добавить кандидата
          </Link>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {candidates.map((c) => {
            const status = deriveChartStatus(c);
            const summary = maps.get(c.id);
            const linkedVacancies = vacancyTitlesByCandidate.get(c.id) ?? [];
            return (
              <div key={c.id} className="hr-card">
                <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "space-between" }}>
                  <div>
                    <h3 style={{ margin: "0 0 4px" }}>{c.name}</h3>
                    <p style={{ margin: 0, color: "var(--hr-muted)" }}>
                      {linkedVacancies.length > 0 ? (
                        <>
                          Вакансии: <strong>{linkedVacancies.join(", ")}</strong>
                        </>
                      ) : (
                        <>
                          <strong>Не привязан к вакансии</strong>
                          {c.vacancy_title ? (
                            <>
                              {" "}
                              <span style={{ color: "var(--hr-muted)" }}>
                                (legacy: {c.vacancy_title})
                              </span>
                            </>
                          ) : null}
                        </>
                      )}
                    </p>
                    <span className={`hr-status ${status === "calculated" ? "hr-status--ok" : "hr-status--warn"}`}>
                      {CHART_STATUS_LABELS[status]}
                    </span>
                    <p style={{ fontSize: 13, color: "var(--hr-muted)", marginTop: 8 }}>
                      {c.birth_date && <>Дата: {c.birth_date} · </>}
                      {c.birth_place_text && <>Город: {c.birth_place_text} · </>}
                      {c.birth_time && <>Время: {String(c.birth_time).slice(0, 5)}</>}
                    </p>
                    {summary && (
                      <p style={{ fontSize: 14, marginTop: 8 }}>
                        <strong>Формат:</strong> {summary.best_work_format?.slice(0, 60)}…
                      </p>
                    )}
                  </div>
                  <div className="hr-fork-actions">
                    <Link to={`/hr/company/${companyId}/candidates/${c.id}`} className="hr-btn hr-btn--ghost">
                      Открыть кандидата
                    </Link>
                    {status === "ready_to_calculate" && (
                      <button
                        type="button"
                        className="hr-btn"
                        disabled={calcId === c.id}
                        onClick={() => onCalculate(c)}
                      >
                        {calcId === c.id ? "Считаем…" : "Рассчитать карту"}
                      </button>
                    )}
                    {status === "calculated" && (
                      <Link
                        to={`/hr/company/${companyId}/candidates/${c.id}/talent-map`}
                        className="hr-btn"
                      >
                        Открыть карту талантов
                      </Link>
                    )}
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
