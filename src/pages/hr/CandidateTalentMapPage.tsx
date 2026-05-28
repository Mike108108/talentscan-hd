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
    <div className="hr-tm-page hr-tm-page--compact">
      <div className="hr-tm-header">
        <div className="hr-tm-header-top">
          <Link to={`/hr/company/${companyId}/candidates/${candidateId}`} className="hr-tm-back">
            ← К кандидату
          </Link>
          <span className="hr-status hr-status--ok">Карта рассчитана</span>
        </div>

        <div className="hr-tm-title-row">
          <div>
            <h2 className="hr-tm-title">Карта талантов</h2>
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

        <div className="hr-tm-summary-grid">
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
        </div>

        <div className="hr-card hr-tm-main-takeaway">
          <p style={{ margin: 0, lineHeight: 1.6 }}>
            <b>Главный вывод.</b> {normalizeHrMaybe(map.summary) ?? "—"}
          </p>
        </div>
      </div>

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
                <MetricsRow metrics={map.metrics} />
              </div>
              <div className="hr-card">
                <h3 style={{ marginTop: 0 }}>Что делать дальше</h3>
                <p style={{ margin: 0, color: "var(--hr-muted)", lineHeight: 1.55 }}>
                  Проведите структурированное интервью и короткий кейс на реальные задачи роли. Ниже
                  — список гипотез и что важно проверить до решения.
                </p>
              </div>
            </div>

            {map.formula && (
              <div className="hr-tm-formula" dangerouslySetInnerHTML={{ __html: formulaHtml }} />
            )}

            {map.final_recommendation && (
              <div className="hr-card" style={{ marginTop: 12 }}>
                <h3 style={{ marginTop: 0 }}>Короткая рекомендация</h3>
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
                <p style={{ margin: 0, color: "var(--hr-muted)", lineHeight: 1.55 }}>
                  Лучше всего проявляет себя в задачах с понятным результатом, прозрачными ожиданиями
                  и регулярной обратной связью. Условия ниже — гипотезы, их важно подтвердить в работе.
                </p>
              </div>
            </div>

            <h3 style={{ margin: "14px 0 10px" }}>Таланты</h3>
            <ItemCards items={map.talents} />

            <h3 style={{ margin: "14px 0 10px" }}>Сильные стороны</h3>
            <ItemCards items={map.strengths} />

            <h3 style={{ margin: "14px 0 10px" }}>Подходящие направления</h3>
            <ItemCards items={map.directions} />
          </section>
        )}

        {tab === "risks" && (
          <section>
            <div className="hr-grid-2">
              <div className="hr-card">
                <h3 style={{ marginTop: 0 }}>Главный риск</h3>
                <p style={{ margin: 0, lineHeight: 1.6 }}>{normalizeHrMaybe(map.main_risk) ?? "—"}</p>
              </div>
              <div className="hr-card">
                <h3 style={{ marginTop: 0 }}>Условия раскрытия</h3>
                <p style={{ margin: 0, color: "var(--hr-muted)", lineHeight: 1.55 }}>
                  Это блок про среду, стиль управления и ограничения. Цель — снизить риски и заранее
                  настроить формат взаимодействия.
                </p>
              </div>
            </div>

            <h3 style={{ margin: "14px 0 10px" }}>Риски</h3>
            <ItemCards items={map.risks} />

            <h3 style={{ margin: "14px 0 10px" }}>Спорные зоны</h3>
            <ItemCards items={map.not_fit_directions} />

            <h3 style={{ margin: "14px 0 10px" }}>Среда и менеджмент</h3>
            <ItemCards items={map.conditions} />
          </section>
        )}

        {tab === "checks" && (
          <section>
            <div className="hr-grid-2">
              <div className="hr-card">
                <h3 style={{ marginTop: 0 }}>Что проверить</h3>
                <p style={{ margin: 0, color: "var(--hr-muted)", lineHeight: 1.55 }}>
                  Фокус — наблюдаемые поведенческие признаки и качество решений в рабочих сценариях,
                  а не “общие впечатления”.
                </p>
              </div>
              <div className="hr-card">
                <h3 style={{ marginTop: 0 }}>Формат</h3>
                <p style={{ margin: 0, color: "var(--hr-muted)", lineHeight: 1.55 }}>
                  Оптимально: структурированное интервью + короткий кейс + разбор решения. Если есть
                  сомнения в данных — уточнить входные параметры.
                </p>
              </div>
            </div>

            <h3 style={{ margin: "14px 0 10px" }}>Проверка на интервью и задачах</h3>
            <ItemCards items={map.tests} />
          </section>
        )}

        {tab === "roles" && (
          <section>
            <div className="hr-grid-2">
              <div className="hr-card">
                <h3 style={{ marginTop: 0 }}>Предварительно подходящие роли</h3>
                <RolesTable roles={map.roles} />
              </div>
              <div className="hr-card">
                <h3 style={{ marginTop: 0 }}>Вакансии кандидата</h3>
                {vacancies.length === 0 ? (
                  <p style={{ margin: 0, color: "var(--hr-muted)" }}>
                    Кандидат пока не привязан к вакансии. Точная оценка под конкретную вакансию —
                    следующий этап.
                  </p>
                ) : (
                  <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {vacancies.map((v) => (
                      <Link
                        key={v.id}
                        to={`/hr/company/${companyId}/vacancies/${v.id}`}
                        className="hr-btn hr-btn--ghost"
                      >
                        {v.title}
                      </Link>
                    ))}
                  </div>
                )}

                <div className="hr-tm-next-steps">
                  <p className="hr-tm-next-steps-title">Важно</p>
                  <p style={{ margin: 0, color: "var(--hr-muted)", lineHeight: 1.55 }}>
                    Сейчас карта даёт общий профиль и гипотезы. Оценка “под вакансию” (с учётом требований,
                    команды и KPI) будет следующим этапом продукта.
                  </p>
                </div>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
