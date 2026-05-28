import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { fetchCandidates, fetchTalentMapsForCompany } from "../../lib/hr/api";
import type { HrCandidate } from "../../lib/hr/types";

type MapRow = {
  id: string;
  candidate_id: string;
  report_status: string | null;
  best_work_format: string | null;
  key_talent: string | null;
  main_risk: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export default function HrReportsPage() {
  const { companyId } = useParams<{ companyId: string }>();
  const [candidates, setCandidates] = useState<HrCandidate[]>([]);
  const [maps, setMaps] = useState<MapRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!companyId) return;
    (async () => {
      setLoading(true);
      const [candList, mapRows] = await Promise.all([
        fetchCandidates(companyId),
        fetchTalentMapsForCompany(companyId),
      ]);
      setCandidates(candList);
      setMaps(mapRows as unknown as MapRow[]);
      setLoading(false);
    })();
  }, [companyId]);

  const candidateById = useMemo(() => {
    const m = new Map<string, HrCandidate>();
    for (const c of candidates) m.set(c.id, c);
    return m;
  }, [candidates]);

  if (!companyId) return null;

  return (
    <div>
      <div className="hr-hero">
        <h2>Разборы</h2>
        <p>На первом этапе здесь отображаются только реальные рассчитанные карты талантов.</p>
      </div>

      {loading ? (
        <p>Загрузка…</p>
      ) : maps.length === 0 ? (
        <div className="hr-card" style={{ textAlign: "center" }}>
          <h3>Разборов пока нет</h3>
          <p style={{ color: "var(--hr-muted)" }}>
            Сначала добавьте кандидата и рассчитайте ему карту талантов — после этого разбор появится здесь.
          </p>
          <Link to={`/hr/company/${companyId}/candidates`} className="hr-btn">
            Открыть кандидатов
          </Link>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {maps
            .slice()
            .sort((a, b) => String(b.updated_at ?? "").localeCompare(String(a.updated_at ?? "")))
            .map((m) => {
              const c = candidateById.get(m.candidate_id);
              return (
                <div key={m.id} className="hr-card">
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "space-between" }}>
                    <div>
                      <h3 style={{ margin: "0 0 4px" }}>{c?.name ?? "Кандидат"}</h3>
                      <p style={{ margin: 0, color: "var(--hr-muted)" }}>
                        Тип разбора: <strong>Карта талантов</strong>
                      </p>
                      <div style={{ marginTop: 10, display: "grid", gap: 6 }}>
                        <div>
                          <strong>Ключевой талант:</strong> {m.key_talent ?? "—"}
                        </div>
                        <div>
                          <strong>Главный риск:</strong> {m.main_risk ?? "—"}
                        </div>
                        <div>
                          <strong>Лучший рабочий формат:</strong> {m.best_work_format ?? "—"}
                        </div>
                        <div style={{ color: "var(--hr-muted)", fontSize: 13 }}>
                          Обновлено: {m.updated_at ? new Date(m.updated_at).toLocaleString() : "—"}
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

