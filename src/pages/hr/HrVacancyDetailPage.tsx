import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  calculateCandidateChart,
  fetchCandidate,
  fetchCandidates,
  fetchTalentMapsForCompany,
  fetchVacancy,
  fetchVacancyCandidates,
  linkCandidateToVacancy,
  unlinkCandidateFromVacancy,
} from "../../lib/hr/api";
import { CHART_STATUS_LABELS, deriveChartStatus } from "../../lib/hr/chartStatus";
import type { HrCandidate, HrVacancy } from "../../lib/hr/types";

type MapSummary = {
  id: string;
  candidate_id: string;
  report_status: string | null;
  key_talent: string | null;
  main_risk: string | null;
};

export default function HrVacancyDetailPage() {
  const { companyId, vacancyId } = useParams<{ companyId: string; vacancyId: string }>();
  const [vacancy, setVacancy] = useState<HrVacancy | null>(null);
  const [rows, setRows] = useState<Array<{ id: string; candidate: HrCandidate }>>([]);
  const [maps, setMaps] = useState<Map<string, MapSummary>>(new Map());
  const [loading, setLoading] = useState(true);
  const [calcId, setCalcId] = useState<string | null>(null);

  const [allCandidates, setAllCandidates] = useState<HrCandidate[]>([]);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string>("");
  const [linking, setLinking] = useState(false);

  const load = async () => {
    if (!companyId || !vacancyId) return;
    setLoading(true);
    const [v, linked, mapRows, pool] = await Promise.all([
      fetchVacancy(companyId, vacancyId),
      fetchVacancyCandidates(companyId, vacancyId),
      fetchTalentMapsForCompany(companyId),
      fetchCandidates(companyId),
    ]);
    setVacancy(v);
    setRows(linked as unknown as Array<{ id: string; candidate: HrCandidate }>);
    const m = new Map<string, MapSummary>();
    for (const row of mapRows as unknown as MapSummary[]) {
      m.set(row.candidate_id, row);
    }
    setMaps(m);
    setAllCandidates(pool);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [companyId, vacancyId]);

  const linkedCandidateIds = useMemo(() => new Set(rows.map((r) => r.candidate.id)), [rows]);
  const linkableCandidates = useMemo(
    () => allCandidates.filter((c) => !linkedCandidateIds.has(c.id)),
    [allCandidates, linkedCandidateIds],
  );

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

  const onLink = async () => {
    if (!companyId || !vacancyId || !selectedCandidateId) return;
    setLinking(true);
    try {
      const cand = await fetchCandidate(companyId, selectedCandidateId);
      await linkCandidateToVacancy(companyId, vacancyId, selectedCandidateId, { source: "manual" });
      // legacy-совместимость: vacancy_title нужен в текущем расчёте карты талантов
      if (cand && vacancy?.title && !cand.vacancy_title) {
        // не обновляем кандидата тут, чтобы не раздувать этап; vacancy_title обновляется при создании кандидата
      }
      setSelectedCandidateId("");
      await load();
    } finally {
      setLinking(false);
    }
  };

  const onUnlink = async (candidateId: string) => {
    if (!companyId || !vacancyId) return;
    if (!confirm("Убрать кандидата из вакансии?")) return;
    await unlinkCandidateFromVacancy(companyId, vacancyId, candidateId);
    await load();
  };

  if (!companyId || !vacancyId) return null;

  return (
    <div>
      <div className="hr-hero">
        <span className="hr-eyebrow">
          <span className="hr-dot" />
          Вакансия
        </span>
        <h2 style={{ marginBottom: 6 }}>{vacancy?.title ?? "…"}</h2>
        <p style={{ marginTop: 0, color: "var(--hr-muted)" }}>
          Статус: <strong>{vacancy?.status ?? "…"}</strong>
          {vacancy?.department ? <> · Отдел: {vacancy.department}</> : null}
          {vacancy?.work_format ? <> · Формат: {vacancy.work_format}</> : null}
        </p>
        <div className="hr-fork-actions" style={{ marginTop: 16 }}>
          <Link to={`/hr/company/${companyId}/vacancies`} className="hr-btn hr-btn--ghost">
            ← К списку вакансий
          </Link>
          <Link to={`/hr/company/${companyId}/vacancies/${vacancyId}/edit`} className="hr-btn">
            Редактировать
          </Link>
        </div>
      </div>

      {loading ? (
        <p>Загрузка…</p>
      ) : (
        <>
          <div className="hr-card" style={{ marginBottom: 14 }}>
            <h3 style={{ marginTop: 0 }}>Контекст роли</h3>
            <div className="hr-grid-2">
              <div>
                <p style={{ margin: "0 0 6px", color: "var(--hr-muted)", fontSize: 13 }}>Описание</p>
                <p style={{ marginTop: 0 }}>{vacancy?.role_description || "—"}</p>
              </div>
              <div>
                <p style={{ margin: "0 0 6px", color: "var(--hr-muted)", fontSize: 13 }}>Задачи</p>
                <p style={{ marginTop: 0 }}>{vacancy?.responsibilities || "—"}</p>
              </div>
              <div>
                <p style={{ margin: "0 0 6px", color: "var(--hr-muted)", fontSize: 13 }}>KPI</p>
                <p style={{ marginTop: 0 }}>{vacancy?.kpi || "—"}</p>
              </div>
              <div>
                <p style={{ margin: "0 0 6px", color: "var(--hr-muted)", fontSize: 13 }}>Требования</p>
                <p style={{ marginTop: 0 }}>
                  <strong>Must-have:</strong> {vacancy?.must_have || "—"}
                  <br />
                  <strong>Nice-to-have:</strong> {vacancy?.nice_to_have || "—"}
                </p>
              </div>
              <div>
                <p style={{ margin: "0 0 6px", color: "var(--hr-muted)", fontSize: 13 }}>Условия</p>
                <p style={{ marginTop: 0 }}>{vacancy?.working_conditions || "—"}</p>
              </div>
              <div>
                <p style={{ margin: "0 0 6px", color: "var(--hr-muted)", fontSize: 13 }}>Руководитель / команда</p>
                <p style={{ marginTop: 0 }}>
                  <strong>Руководитель:</strong> {vacancy?.manager_context || "—"}
                  <br />
                  <strong>Команда:</strong> {vacancy?.team_context || "—"}
                </p>
              </div>
            </div>
          </div>

          <div className="hr-card" style={{ marginBottom: 14 }}>
            <h3 style={{ marginTop: 0 }}>Кандидаты на вакансию</h3>
            {rows.length === 0 ? (
              <p style={{ color: "var(--hr-muted)", margin: 0 }}>
                Пока нет привязанных кандидатов. Добавьте нового кандидата или привяжите существующего.
              </p>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {rows.map((r) => {
                  const c = r.candidate;
                  const status = deriveChartStatus(c);
                  const summary = maps.get(c.id);
                  return (
                    <div key={r.id} className="hr-card" style={{ background: "rgba(255,255,255,0.02)" }}>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "space-between" }}>
                        <div>
                          <h4 style={{ margin: "0 0 4px" }}>{c.name}</h4>
                          <span className={`hr-status ${status === "calculated" ? "hr-status--ok" : "hr-status--warn"}`}>
                            {CHART_STATUS_LABELS[status]}
                          </span>
                          {summary?.key_talent || summary?.main_risk ? (
                            <p style={{ marginTop: 10, fontSize: 14 }}>
                              {summary?.key_talent ? (
                                <>
                                  <strong>Ключевой талант:</strong> {summary.key_talent}
                                  <br />
                                </>
                              ) : null}
                              {summary?.main_risk ? (
                                <>
                                  <strong>Главный риск:</strong> {summary.main_risk}
                                </>
                              ) : null}
                            </p>
                          ) : (
                            <p style={{ marginTop: 10, color: "var(--hr-muted)", fontSize: 14 }}>
                              Карта талантов ещё не рассчитана.
                            </p>
                          )}
                        </div>
                        <div className="hr-fork-actions">
                          <Link to={`/hr/company/${companyId}/candidates/${c.id}`} className="hr-btn hr-btn--ghost">
                            Открыть кандидата
                          </Link>
                          {status === "calculated" && (
                            <Link
                              to={`/hr/company/${companyId}/candidates/${c.id}/talent-map`}
                              className="hr-btn"
                            >
                              Открыть карту талантов
                            </Link>
                          )}
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
                          <button type="button" className="hr-btn hr-btn--secondary" disabled>
                            Оценить под вакансию (следующий этап)
                          </button>
                          <button type="button" className="hr-btn hr-btn--ghost" onClick={() => onUnlink(c.id)}>
                            Убрать из вакансии
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="hr-card">
            <h3 style={{ marginTop: 0 }}>Добавление кандидата</h3>
            <div className="hr-fork-actions" style={{ marginBottom: 12 }}>
              <Link
                to={`/hr/company/${companyId}/candidates/new?vacancyId=${encodeURIComponent(vacancyId)}`}
                className="hr-btn"
              >
                + Добавить нового кандидата в вакансию
              </Link>
            </div>

            {linkableCandidates.length === 0 ? (
              <p style={{ margin: 0, color: "var(--hr-muted)" }}>
                Нет кандидатов, которых можно привязать (все кандидаты компании уже в этой вакансии).
              </p>
            ) : (
              <div className="hr-grid-2">
                <label className="hr-field">
                  <span className="hr-field-label">Привязать существующего кандидата</span>
                  <select
                    className="hr-input"
                    value={selectedCandidateId}
                    onChange={(e) => setSelectedCandidateId(e.target.value)}
                  >
                    <option value="">Выберите кандидата…</option>
                    {linkableCandidates.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="hr-field" style={{ alignSelf: "end" }}>
                  <button type="button" className="hr-btn" onClick={onLink} disabled={!selectedCandidateId || linking}>
                    {linking ? "Привязываем…" : "Привязать к вакансии"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

