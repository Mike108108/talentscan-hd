import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { fetchCandidate, fetchCandidateVacancies, fetchTalentMap } from "../../lib/hr/api";
import type {
  HrCandidate,
  HrCandidateTalentMap,
  HrVacancy,
  TalentMapItem,
  TalentMapMetric,
  TalentMapRole,
} from "../../lib/hr/types";
import { formulaToSafeHtml } from "../../lib/safeHtml";
import "../../hr.css";

type TabId = "overview" | "profile" | "risks" | "checks" | "roles";

const TABS: Array<{ id: TabId; label: string }> = [
  { id: "overview", label: "Обзор" },
  { id: "profile", label: "Рабочий профиль" },
  { id: "risks", label: "Риски и условия" },
  { id: "checks", label: "Проверка" },
  { id: "roles", label: "Роли и вакансии" },
];

function normalizeHrCopy(text: string): string {
  const t = text.trim();
  if (!t) return t;
  return t
    .replaceAll(
      /Wait for the Invitation/gi,
      "Лучше включается в работу, когда есть ясный запрос, понятная роль и ожидаемый результат.",
    )
    .replaceAll(/Invitation/gi, "ясный запрос");
}

function normalizeHrMaybe(text: string | null | undefined): string | null {
  if (!text) return null;
  return normalizeHrCopy(text);
}

function ItemCards({ items }: { items: TalentMapItem[] | null | undefined }) {
  if (!items?.length) return <p className="hr-muted">Нет данных</p>;
  return (
    <div className="hr-grid-2">
      {items.map((item) => (
        <div key={item.title} className="hr-card">
          <h3 style={{ marginTop: 0 }}>{item.title}</h3>
          <p style={{ margin: 0, color: "var(--hr-soft)", lineHeight: 1.55 }}>
            {normalizeHrCopy(item.body)}
          </p>
          {item.fit && normalizeHrMaybe(item.fit) && (
            <span className="hr-status hr-status--ok" style={{ marginTop: 10 }}>
              {normalizeHrCopy(item.fit)}
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
              <td style={{ padding: 10, borderBottom: "1px solid var(--hr-line)" }}>
                {normalizeHrCopy(r.note)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MetricsList({ metrics }: { metrics: TalentMapMetric[] | null | undefined }) {
  if (!metrics?.length) return <p className="hr-muted">Нет данных</p>;
  return (
    <div className="hr-tm-metrics-list">
      {metrics.map((m) => (
        <div key={m.label} className="hr-tm-metrics-item">
          <span className="hr-tm-metrics-label">
            {m.label}
            {m.hint ? <span className="hr-tm-metrics-hint"> · {m.hint}</span> : null}
          </span>
          <b className="hr-tm-metrics-value">{m.value}</b>
        </div>
      ))}
    </div>
  );
}

export default function CandidateTalentMapPage() {
  const { companyId, candidateId } = useParams<{ companyId: string; candidateId: string }>();
  const [candidate, setCandidate] = useState<HrCandidate | null>(null);
  const [map, setMap] = useState<HrCandidateTalentMap | null>(null);
  const [vacancies, setVacancies] = useState<HrVacancy[]>([]);
  const [tab, setTab] = useState<TabId>("overview");

  useEffect(() => {
    if (!companyId || !candidateId) return;
    (async () => {
      const [c, m, links] = await Promise.all([
        fetchCandidate(companyId, candidateId),
        fetchTalentMap(companyId, candidateId),
        fetchCandidateVacancies(companyId, candidateId),
      ]);
      setCandidate(c);
      setVacancies((links ?? []).map((l: any) => l.vacancy).filter(Boolean) as HrVacancy[]);
      setMap(m as HrCandidateTalentMap | null);
    })();
  }, [companyId, candidateId]);

  if (!candidate) {
    return (
      <p>Загрузка…</p>
    );
  }

  if (!map || map.report_status !== "ready") {
    return (
      <div className="hr-card">
        <h2 style={{ marginTop: 0 }}>Карта рассчитана, отчёт формируется</h2>
        <p style={{ color: "var(--hr-muted)" }}>
          Попробуйте обновить страницу через несколько секунд или пересчитайте карту кандидата.
        </p>
        <Link to={`/hr/company/${companyId}/candidates/${candidateId}`} className="hr-btn">
          ← К кандидату
        </Link>
      </div>
    );
  }

  const formulaHtml = map.formula ? formulaToSafeHtml(map.formula) : "";

  return (
    <div className="hr-tm-page">
      <div className="hr-tm-header">
        <div className="hr-tm-header-top">
          <Link to={`/hr/company/${companyId}/candidates/${candidateId}`} className="hr-tm-back">
            ← К кандидату
          </Link>
        </div>

        <div className="hr-tm-title-row">
          <div>
            <div className="hr-tm-title-line">
              <h2 className="hr-tm-title">Карта талантов</h2>
              <span className="hr-status hr-status--ok">Карта рассчитана</span>
            </div>
            <div className="hr-tm-subtitle">
              <b>{candidate.name}</b>
              {candidate.vacancy_title ? <span> · {candidate.vacancy_title}</span> : null}
            </div>
          </div>
        </div>

        <p className="hr-tm-lede">
          Компактный разбор в HR-языке: сильные стороны, риски, условия раскрытия и что проверить на
          интервью. Это рабочие гипотезы — уточняются по опыту, кейсам и реальной вакансии.
        </p>

        <div className="hr-tm-summary-grid hr-tm-summary-grid--2x2">
          <div className="hr-tm-identity-card">
            <b>Лучший рабочий формат</b>
            <span>{normalizeHrMaybe(map.best_work_format) ?? "—"}</span>
          </div>
          <div className="hr-tm-identity-card">
            <b>Ключевой талант</b>
            <span>{normalizeHrMaybe(map.key_talent) ?? "—"}</span>
          </div>
          <div className="hr-tm-identity-card">
            <b>Главный риск</b>
            <span>{normalizeHrMaybe(map.main_risk) ?? "—"}</span>
          </div>
          <div className="hr-tm-identity-card hr-tm-summary-card--primary">
            <div className="hr-tm-summary-card-badge">Главное</div>
            <b>Главный вывод</b>
            <span>{normalizeHrMaybe(map.summary) ?? "—"}</span>
          </div>
        </div>
      </div>

      <div className="hr-tm-tab-dock">
        <div className="hr-tm-tabs" role="tablist" aria-label="Вкладки карты талантов">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={tab === t.id ? "hr-tm-tab hr-tm-tab--active" : "hr-tm-tab"}
              onClick={() => setTab(t.id)}
              role="tab"
              aria-selected={tab === t.id}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="hr-tm-panel">
        {tab === "overview" && (
          <section>
            <div className="hr-grid-2">
              <div className="hr-card">
                <h3 style={{ marginTop: 0 }}>Показатели</h3>
                <MetricsList metrics={map.metrics} />
              </div>
              <div className="hr-card">
                <h3 style={{ marginTop: 0 }}>Условия раскрытия</h3>
                {map.formula ? (
                  <div
                    className="hr-tm-overview-formula"
                    dangerouslySetInnerHTML={{ __html: formulaHtml }}
                  />
                ) : (
                  <p style={{ margin: 0, color: "var(--hr-muted)", lineHeight: 1.55 }}>
                    Нет данных для формулировки условий раскрытия.
                  </p>
                )}
              </div>
            </div>

            {map.final_recommendation && (
              <div className="hr-card" style={{ marginTop: 12 }}>
                <h3 style={{ marginTop: 0 }}>Рекомендация HR</h3>
                <p style={{ margin: 0, lineHeight: 1.6 }}>
                  {normalizeHrCopy(map.final_recommendation)}
                </p>
              </div>
            )}
          </section>
        )}

        {tab === "profile" && (
          <section>
            <div className="hr-grid-2">
              <div className="hr-card">
                <h3 style={{ marginTop: 0 }}>Рабочий формат</h3>
                <p style={{ margin: 0, lineHeight: 1.6 }}>{normalizeHrMaybe(map.best_work_format) ?? "—"}</p>
              </div>
              <div className="hr-card">
                <h3 style={{ marginTop: 0 }}>Где раскрывается</h3>
                {map.formula ? (
                  <div
                    className="hr-tm-overview-formula"
                    dangerouslySetInnerHTML={{ __html: formulaHtml }}
                  />
                ) : (
                  <p style={{ margin: 0, color: "var(--hr-muted)", lineHeight: 1.55 }}>
                    Лучше всего проявляет себя в задачах с понятным результатом, прозрачными ожиданиями
                    и регулярной обратной связью.
                  </p>
                )}
              </div>
            </div>

            <div className="hr-tm-block">
              <h3 className="hr-tm-block-title">Ключевые таланты</h3>
              <ItemCards items={(map.talents ?? []).slice(0, 3)} />
            </div>

            <div className="hr-tm-block">
              <h3 className="hr-tm-block-title">Подходящие направления</h3>
              <ItemCards items={(map.directions ?? []).slice(0, 2)} />
            </div>
          </section>
        )}

        {tab === "risks" && (
          <section>
            <div className="hr-grid-2">
              <div className="hr-card">
                <h3 style={{ marginTop: 0 }}>Что может мешать</h3>
                <p style={{ margin: 0, lineHeight: 1.6 }}>{normalizeHrMaybe(map.main_risk) ?? "—"}</p>
              </div>
              <div className="hr-card">
                <h3 style={{ marginTop: 0 }}>Какие условия нужны</h3>
                <p style={{ margin: 0, color: "var(--hr-muted)", lineHeight: 1.55 }}>
                  Снизить риск помогают: ясные ожидания, договорённости письменно, предсказуемый ритм встреч
                  и регулярная обратная связь по фактам.
                </p>
              </div>
            </div>

            <div className="hr-grid-2" style={{ marginTop: 12 }}>
              <div className="hr-card">
                <h3 style={{ marginTop: 0 }}>Как управлять</h3>
                <ul className="hr-tm-bullets">
                  <li>Фиксировать цель, критерии и сроки заранее.</li>
                  <li>Снижать хаос: приоритеты, “одна главная задача” на спринт/неделю.</li>
                  <li>Обратная связь короткими циклами: что ок / что улучшить / следующий шаг.</li>
                </ul>
              </div>
              <div className="hr-card">
                <h3 style={{ marginTop: 0 }}>Красные флаги на стажировке</h3>
                <ul className="hr-tm-bullets">
                  <li>Резкое падение качества на фоне срочности и многозадачности.</li>
                  <li>Перегруз встречами без пауз на фокусную работу.</li>
                  <li>Сильная реакция на давление ожиданий и “пожары”.</li>
                </ul>
              </div>
            </div>

            <div className="hr-tm-block">
              <h3 className="hr-tm-block-title">Среда и менеджмент</h3>
              <ItemCards items={(map.conditions ?? []).slice(0, 2)} />
            </div>
          </section>
        )}

        {tab === "checks" && (
          <section>
            <div className="hr-grid-2">
              <div className="hr-card">
                <h3 style={{ marginTop: 0 }}>Что проверить</h3>
                <p style={{ margin: 0, color: "var(--hr-muted)", lineHeight: 1.55 }}>
                  Качество решений в рабочих сценариях: как уточняет задачу, выбирает приоритеты, держит темп
                  и коммуницирует ожидания.
                </p>
              </div>
              <div className="hr-card">
                <h3 style={{ marginTop: 0 }}>Формат проверки</h3>
                <p style={{ margin: 0, color: "var(--hr-muted)", lineHeight: 1.55 }}>
                  Интервью + короткий кейс (2–3 часа) + разбор решения. При сомнениях в данных — уточнить входные параметры.
                </p>
              </div>
            </div>

            <div className="hr-tm-block">
              <h3 className="hr-tm-block-title">План проверки</h3>
              <div className="hr-grid-2">
                <div className="hr-card hr-tm-step">
                  <p className="hr-tm-step-kicker">Шаг 1</p>
                  <h4 style={{ margin: "0 0 6px" }}>Интервью</h4>
                  <p style={{ margin: 0, color: "var(--hr-muted)", lineHeight: 1.55 }}>
                    Уточнить примеры решений, реакции на срочность и опыт работы в команде/под давлением.
                  </p>
                </div>
                <div className="hr-card hr-tm-step">
                  <p className="hr-tm-step-kicker">Шаг 2</p>
                  <h4 style={{ margin: "0 0 6px" }}>Рабочий кейс</h4>
                  <p style={{ margin: 0, color: "var(--hr-muted)", lineHeight: 1.55 }}>
                    Кейс на 2–3 часа с реальной задачей роли + короткий разбор решения.
                  </p>
                </div>
                <div className="hr-card hr-tm-step">
                  <p className="hr-tm-step-kicker">Шаг 3</p>
                  <h4 style={{ margin: "0 0 6px" }}>Наблюдение</h4>
                  <p style={{ margin: 0, color: "var(--hr-muted)", lineHeight: 1.55 }}>
                    Как реагирует на шум, ожидания, многозадачность и быстрые переключения.
                  </p>
                </div>
                <div className="hr-card hr-tm-step">
                  <p className="hr-tm-step-kicker">Шаг 4</p>
                  <h4 style={{ margin: "0 0 6px" }}>Уточнение данных</h4>
                  <p style={{ margin: 0, color: "var(--hr-muted)", lineHeight: 1.55 }}>
                    Референсы и уточнение входных данных, если есть сомнения в точности.
                  </p>
                </div>
              </div>
            </div>
          </section>
        )}

        {tab === "roles" && (
          <section>
            <div className="hr-grid-2">
              <div className="hr-card">
                <h3 style={{ marginTop: 0 }}>Связанные вакансии</h3>
                {vacancies.length === 0 ? (
                  <p style={{ margin: 0, color: "var(--hr-muted)" }}>Кандидат пока не привязан к вакансии.</p>
                ) : (
                  <div style={{ display: "grid", gap: 10 }}>
                    {vacancies.map((v) => (
                      <div key={v.id} className="hr-card" style={{ background: "rgba(255,255,255,0.02)" }}>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "space-between" }}>
                          <div>
                            <h4 style={{ margin: "0 0 4px" }}>{v.title}</h4>
                            <p style={{ margin: 0, color: "var(--hr-muted)" }}>
                              Статус: <strong>{v.status}</strong>
                            </p>
                          </div>
                          <div className="hr-fork-actions">
                            <Link to={`/hr/company/${companyId}/vacancies/${v.id}`} className="hr-btn">
                              Открыть вакансию
                            </Link>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="hr-card">
                <h3 style={{ marginTop: 0 }}>Следующий этап</h3>
                <p style={{ margin: 0, color: "var(--hr-muted)", lineHeight: 1.55 }}>
                  Точная оценка под конкретную вакансию будет отдельным разбором. Сейчас карта показывает рабочий
                  профиль кандидата и гипотезы, которые важно проверить на интервью и кейсе.
                </p>
              </div>
            </div>

            <div className="hr-tm-block">
              <h3 className="hr-tm-block-title">Предварительно подходящие роли</h3>
              <RolesTable roles={map.roles} />
            </div>
          </section>
        )}
      </div>
      </div>
    </div>
  );
}
