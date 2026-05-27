import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { fetchCandidate, fetchTalentMap } from "../../lib/hr/api";
import type {
  HrCandidate,
  HrCandidateTalentMap,
  TalentMapItem,
  TalentMapMetric,
  TalentMapRole,
} from "../../lib/hr/types";
import "../../hr.css";

const SECTIONS = [
  { id: "summary", label: "Вывод" },
  { id: "metrics", label: "Показатели" },
  { id: "talents", label: "Таланты" },
  { id: "strengths", label: "Сильные стороны" },
  { id: "risks", label: "Риски" },
  { id: "directions", label: "Направления" },
  { id: "not-fit", label: "Спорные" },
  { id: "roles", label: "Должности" },
  { id: "conditions", label: "Среда" },
  { id: "tests", label: "Проверка" },
  { id: "recommendation", label: "Рекомендация" },
];

function ItemCards({ items }: { items: TalentMapItem[] | null | undefined }) {
  if (!items?.length) return <p className="hr-muted">Нет данных</p>;
  return (
    <div className="hr-grid-2">
      {items.map((item) => (
        <div key={item.title} className="hr-card">
          <h3 style={{ marginTop: 0 }}>{item.title}</h3>
          <p style={{ margin: 0, color: "var(--hr-soft)", lineHeight: 1.55 }}>{item.body}</p>
          {item.fit && (
            <span className="hr-status hr-status--ok" style={{ marginTop: 10 }}>
              {item.fit}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

function RolesTable({ roles }: { roles: TalentMapRole[] | null | undefined }) {
  if (!roles?.length) return <p>Нет данных</p>;
  return (
    <div className="hr-card" style={{ overflow: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 480 }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left", padding: 10, borderBottom: "1px solid var(--hr-line)" }}>
              Роль
            </th>
            <th style={{ textAlign: "left", padding: 10, borderBottom: "1px solid var(--hr-line)" }}>
              Соответствие
            </th>
            <th style={{ textAlign: "left", padding: 10, borderBottom: "1px solid var(--hr-line)" }}>
              Заметка
            </th>
          </tr>
        </thead>
        <tbody>
          {roles.map((r) => (
            <tr key={r.role}>
              <td style={{ padding: 10, borderBottom: "1px solid var(--hr-line)" }}>{r.role}</td>
              <td style={{ padding: 10, borderBottom: "1px solid var(--hr-line)" }}>{r.fit}</td>
              <td style={{ padding: 10, borderBottom: "1px solid var(--hr-line)" }}>{r.note}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MetricsRow({ metrics }: { metrics: TalentMapMetric[] | null | undefined }) {
  if (!metrics?.length) return null;
  return (
    <div className="hr-tm-metric-row">
      {metrics.map((m) => (
        <div key={m.label} className="hr-tm-metric">
          <b>{m.value}</b>
          <span>
            {m.label}
            {m.hint ? ` · ${m.hint}` : ""}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function CandidateTalentMapPage() {
  const { companyId, candidateId } = useParams<{ companyId: string; candidateId: string }>();
  const [candidate, setCandidate] = useState<HrCandidate | null>(null);
  const [map, setMap] = useState<HrCandidateTalentMap | null>(null);

  useEffect(() => {
    if (!companyId || !candidateId) return;
    (async () => {
      setCandidate(await fetchCandidate(companyId, candidateId));
      setMap((await fetchTalentMap(companyId, candidateId)) as HrCandidateTalentMap | null);
    })();
  }, [companyId, candidateId]);

  if (!candidate) {
    return (
      <div className="hr-root hr-fork">
        <p>Загрузка…</p>
      </div>
    );
  }

  if (!map || map.report_status !== "ready") {
    return (
      <div className="hr-root hr-app">
        <div className="hr-card">
          <h2>Карта рассчитана, отчёт формируется</h2>
          <p style={{ color: "var(--hr-muted)" }}>
            Попробуйте обновить страницу через несколько секунд или пересчитайте карту кандидата.
          </p>
          <Link to={`/hr/company/${companyId}/candidates/${candidateId}`} className="hr-btn">
            ← К кандидату
          </Link>
        </div>
      </div>
    );
  }

  const formulaHtml = (map.formula ?? "").replace(/<em>/g, "<em>").replace(/<\/em>/g, "</em>");

  return (
    <div className="hr-root hr-tm-page">
      <div className="hr-app" style={{ maxWidth: 1180 }}>
        <p style={{ marginBottom: 12 }}>
          <Link to={`/hr/company/${companyId}/candidates/${candidateId}`} style={{ color: "var(--hr-muted)" }}>
            ← {candidate.name}
          </Link>
        </p>

        <section className="hr-tm-hero">
          <span className="hr-eyebrow">
            <span className="hr-dot" />
            TalentScan HR · карта талантов кандидата
          </span>
          <h1 style={{ margin: "16px 0 0", fontSize: "clamp(36px, 5vw, 56px)", letterSpacing: "-0.05em" }}>
            Карта талантов
          </h1>
          <div className="hr-tm-names">{candidate.name}</div>
          <p className="subtitle" style={{ color: "var(--hr-muted)", marginTop: 14, maxWidth: 780 }}>
            Предварительный разбор по рассчитанной карте: какие рабочие роли могут подойти, где
            сильные стороны, где риски и какие направления стоит проверить через реальные задачи.
          </p>

          <div className="hr-tm-identity-row">
            <div className="hr-tm-identity-card">
              <b>Лучший рабочий формат</b>
              <span>{map.best_work_format}</span>
            </div>
            <div className="hr-tm-identity-card">
              <b>Ключевой талант</b>
              <span>{map.key_talent}</span>
            </div>
            <div className="hr-tm-identity-card">
              <b>Главный риск</b>
              <span>{map.main_risk}</span>
            </div>
          </div>

          {map.formula && (
            <div
              className="hr-tm-formula"
              dangerouslySetInnerHTML={{ __html: formulaHtml }}
            />
          )}

          <p className="hr-tm-disclaimer">
            Это предварительная карта по рассчитанным данным. Без анкеты, опыта, интервью и
            конкретной вакансии выводы нужно считать сильными гипотезами, а не финальным решением о
            найме.
          </p>
        </section>

        <nav className="hr-tm-nav-strip">
          <div className="hr-tm-nav-scroll">
            {SECTIONS.map((s) => (
              <a key={s.id} href={`#${s.id}`}>
                {s.label}
              </a>
            ))}
          </div>
        </nav>

        <section id="summary" className="hr-tm-section">
          <span className="hr-tm-kicker">01</span>
          <h2>Вывод</h2>
          <div className="hr-card">
            <p style={{ margin: 0, lineHeight: 1.6 }}>{map.summary}</p>
          </div>
        </section>

        <section id="metrics" className="hr-tm-section">
          <span className="hr-tm-kicker">02</span>
          <h2>Показатели</h2>
          <MetricsRow metrics={map.metrics} />
        </section>

        <section id="talents" className="hr-tm-section">
          <span className="hr-tm-kicker">03</span>
          <h2>Таланты</h2>
          <ItemCards items={map.talents} />
        </section>

        <section id="strengths" className="hr-tm-section">
          <span className="hr-tm-kicker">04</span>
          <h2>Сильные стороны</h2>
          <ItemCards items={map.strengths} />
        </section>

        <section id="risks" className="hr-tm-section">
          <span className="hr-tm-kicker">05</span>
          <h2>Риски</h2>
          <ItemCards items={map.risks} />
        </section>

        <section id="directions" className="hr-tm-section">
          <span className="hr-tm-kicker">06</span>
          <h2>Направления</h2>
          <ItemCards items={map.directions} />
        </section>

        <section id="not-fit" className="hr-tm-section">
          <span className="hr-tm-kicker">07</span>
          <h2>Спорные</h2>
          <ItemCards items={map.not_fit_directions} />
        </section>

        <section id="roles" className="hr-tm-section">
          <span className="hr-tm-kicker">08</span>
          <h2>Должности</h2>
          <RolesTable roles={map.roles} />
        </section>

        <section id="conditions" className="hr-tm-section">
          <span className="hr-tm-kicker">09</span>
          <h2>Среда</h2>
          <ItemCards items={map.conditions} />
        </section>

        <section id="tests" className="hr-tm-section">
          <span className="hr-tm-kicker">10</span>
          <h2>Проверка</h2>
          <ItemCards items={map.tests} />
        </section>

        <section id="recommendation" className="hr-tm-section">
          <span className="hr-tm-kicker">11</span>
          <h2>Рекомендация</h2>
          <div className="hr-card">
            <p style={{ margin: 0, lineHeight: 1.6, fontSize: 17 }}>{map.final_recommendation}</p>
          </div>
        </section>
      </div>
    </div>
  );
}
