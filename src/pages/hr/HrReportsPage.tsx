import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { fetchCandidates, fetchReadyTalentMapReportsForCompany } from "../../lib/hr/api";
import { normalizeAiReportContent } from "../../lib/hr/normalizeAiReport";
import type { HrCandidate, HrReport } from "../../lib/hr/types";

export default function HrReportsPage() {
  const { companyId } = useParams<{ companyId: string }>();
  const [candidates, setCandidates] = useState<HrCandidate[]>([]);
  const [reports, setReports] = useState<HrReport[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!companyId) return;
    (async () => {
      setLoading(true);
      const [candList, reportRows] = await Promise.all([
        fetchCandidates(companyId),
        fetchReadyTalentMapReportsForCompany(companyId),
      ]);
      setCandidates(candList);
      setReports(reportRows as HrReport[]);
      setLoading(false);
    })();
  }, [companyId]);

  const candidateById = useMemo(() => {
    const m = new Map<string, HrCandidate>();
    for (const c of candidates) m.set(c.id, c);
    return m;
  }, [candidates]);

  const reportsByCandidate = useMemo(() => {
    const seen = new Set<string>();
    const list: HrReport[] = [];
    for (const r of reports) {
      if (!r.candidate_id || seen.has(r.candidate_id)) continue;
      seen.add(r.candidate_id);
      list.push(r);
    }
    return list;
  }, [reports]);

  if (!companyId) return null;

  return (
    <div>
      <div className="hr-hero">
        <h2>Разборы</h2>
        <p>Готовые карты талантов по кандидатам компании.</p>
      </div>

      {loading ? (
        <p>Загрузка…</p>
      ) : reportsByCandidate.length === 0 ? (
        <div className="hr-card" style={{ textAlign: "center" }}>
          <h3>Разборов пока нет</h3>
          <p style={{ color: "var(--hr-muted)" }}>
            Сгенерируйте карту талантов на странице кандидата — она появится здесь.
          </p>
          <Link to={`/hr/company/${companyId}/candidates`} className="hr-btn">
            Открыть кандидатов
          </Link>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {reportsByCandidate.map((r) => {
            const c = r.candidate_id ? candidateById.get(r.candidate_id) : undefined;
            const content = normalizeAiReportContent(r.content_json);
            const hero = content.hero;
            return (
              <div key={r.id} className="hr-card">
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 12,
                    justifyContent: "space-between",
                  }}
                >
                  <div>
                    <h3 style={{ margin: "0 0 4px" }}>{c?.name ?? "Кандидат"}</h3>
                    <p style={{ margin: 0, color: "var(--hr-muted)" }}>
                      Карта талантов ·{" "}
                      <span className="hr-status hr-status--ok">Разбор готов</span>
                    </p>
                    <div style={{ marginTop: 10, display: "grid", gap: 6 }}>
                      <div>
                        <strong>Ключевой талант:</strong> {hero.key_talent || "—"}
                      </div>
                      <div>
                        <strong>Главный риск:</strong> {hero.main_risk || "—"}
                      </div>
                      <div>
                        <strong>Лучший рабочий формат:</strong> {hero.best_work_format || "—"}
                      </div>
                      <div style={{ color: "var(--hr-muted)", fontSize: 13 }}>
                        Обновлено:{" "}
                        {r.generated_at
                          ? new Date(r.generated_at).toLocaleString()
                          : r.updated_at
                            ? new Date(r.updated_at).toLocaleString()
                            : "—"}
                      </div>
                    </div>
                  </div>
                  <div className="hr-fork-actions">
                    {c ? (
                      <Link
                        to={`/hr/company/${companyId}/candidates/${c.id}/talent-map`}
                        className="hr-btn"
                      >
                        Открыть карту
                      </Link>
                    ) : (
                      <button type="button" className="hr-btn" disabled>
                        Открыть карту
                      </button>
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
