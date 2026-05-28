import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { fetchHrCompanies } from "../../lib/hr/api";
import type { HrCompany } from "../../lib/hr/types";
import "../../hr.css";

export default function HrCabinetRedirect() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [companies, setCompanies] = useState<HrCompany[]>([]);

  const activeCompanyId = useMemo(() => {
    return localStorage.getItem("talentscan-hr-active-company-id") || "";
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const list = await fetchHrCompanies();
      if (cancelled) return;
      setCompanies(list);
      setLoading(false);

      if (list.length === 0) return;

      const match = activeCompanyId && list.some((c) => c.id === activeCompanyId);
      const nextId = match ? activeCompanyId : list[0].id;
      localStorage.setItem("talentscan-hr-active-company-id", nextId);
      navigate(`/hr/company/${nextId}`, { replace: true });
    })();
    return () => {
      cancelled = true;
    };
  }, [activeCompanyId, navigate]);

  if (loading) {
    return (
      <div className="hr-root hr-fork">
        <p>Загрузка кабинета…</p>
      </div>
    );
  }

  if (companies.length === 0) {
    return (
      <div className="hr-root">
        <div className="hr-shell">
          <aside className="hr-sidebar" aria-label="HR-меню">
            <div className="hr-sidebar-brand">
              <div className="hr-sidebar-brand-row">
                <span className="hr-sidebar-logo">TalentScan</span>
                <div className="ts-cabinet-switch" aria-label="Переключение кабинета">
                  <Link to="/app" className="ts-cabinet-switch-btn" aria-label="Перейти в личный кабинет">
                    ЛК
                  </Link>
                  <span className="ts-cabinet-switch-btn ts-cabinet-switch-btn--active" aria-current="true">
                    HR
                  </span>
                </div>
              </div>
              <span className="hr-sidebar-tagline">HR-кабинет</span>
            </div>

            <div className="hr-sidebar-main">
              <nav className="hr-nav">
                <span className="hr-nav--disabled">
                  <span>
                    Обзор
                    <small>Главный экран</small>
                  </span>
                </span>
                <span className="hr-nav--disabled">
                  <span>
                    Вакансии
                    <small>Роли и позиции</small>
                  </span>
                </span>
                <span className="hr-nav--disabled">
                  <span>
                    Кандидаты
                    <small>Пул кандидатов</small>
                  </span>
                </span>
                <span className="hr-nav--disabled">
                  <span>
                    Разборы
                    <small>Карты талантов</small>
                  </span>
                </span>
                <span className="hr-nav--disabled">
                  <span>
                    Моя компания
                    <small>Контекст и данные</small>
                  </span>
                </span>
              </nav>
            </div>
          </aside>

          <div className="hr-app-area">
            <header className="hr-topbar">
              <div className="hr-topbar-actions">
                <Link to="/hr/company/new" className="hr-btn">
                  + Компания
                </Link>
                <div className="hr-company-dropdown" aria-label="Компания">
                  <button type="button" className="hr-company-btn" aria-haspopup="listbox" aria-expanded="false">
                    Нет компании <span aria-hidden="true">▾</span>
                  </button>
                </div>
              </div>
            </header>

            <main className="hr-workspace">
              <div className="hr-card" style={{ maxWidth: 880 }}>
                <h2 style={{ marginTop: 0 }}>Добавьте первую компанию</h2>
                <p style={{ marginTop: 8, color: "var(--hr-muted)", lineHeight: 1.5 }}>
                  Компания нужна, чтобы создавать вакансии, кандидатов и карты талантов в одном рабочем контексте.
                </p>
                <p style={{ marginTop: 18 }}>
                  <Link to="/hr/company/new" className="hr-btn">
                    + Компания
                  </Link>
                </p>
              </div>
            </main>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
