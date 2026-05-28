import { Link, Outlet, useLocation, useNavigate, useParams } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import "../../hr.css";
import ThemeToggleSwitch from "../shell/ThemeToggleSwitch";

const NAV = [
  { path: "", label: "Обзор", hint: "Главный экран", enabled: true },
  { path: "vacancies", label: "Вакансии", hint: "Роли и позиции", enabled: true },
  { path: "candidates", label: "Кандидаты", hint: "Пул кандидатов", enabled: true },
  { path: "reports", label: "Разборы", hint: "Карты талантов", enabled: true },
  { path: "company", label: "Моя компания", hint: "Контекст и данные", enabled: true },
];

export default function HrShell() {
  const { companyId } = useParams<{ companyId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const base = `/hr/company/${companyId}`;

  const savedTheme = localStorage.getItem("talentscan-theme");
  const theme: "dark" | "light" = savedTheme === "light" ? "light" : "dark";
  const toggleTheme = () => {
    const next: "dark" | "light" = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    localStorage.setItem("talentscan-theme", next);
  };

  const signOut = async () => {
    await supabase?.auth.signOut();
    navigate("/hr/login");
  };

  const sectionPath = location.pathname.replace(base, "").replace(/^\//, "") || "";

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
            <span className="hr-sidebar-tagline">Рабочий кабинет работодателя</span>
          </div>

          <div className="hr-sidebar-main">
            <nav className="hr-nav">
              {NAV.map((item) => {
                const to = item.path ? `${base}/${item.path}` : base;
                const active =
                  item.path === ""
                    ? sectionPath === ""
                    : sectionPath.startsWith(item.path);
                if (!item.enabled) {
                  return (
                    <span key={item.path} className="hr-nav--disabled">
                      <span>
                        {item.label}
                        <small>{item.hint}</small>
                      </span>
                    </span>
                  );
                }
                return (
                  <Link key={item.path} to={to} className={active ? "active" : ""}>
                    <span>
                      {item.label}
                      <small>{item.hint}</small>
                    </span>
                  </Link>
                );
              })}
            </nav>
          </div>

          <footer className="hr-sidebar-footer" aria-label="Настройки">
            <Link to={`${base}/company`} className="hr-sidebar-footer-btn">
              <span className="hr-sidebar-footer-icon" aria-hidden="true">
                ⚙
              </span>
              <span className="hr-sidebar-footer-text">
                <span className="hr-sidebar-footer-label">Настройки</span>
                <span className="hr-sidebar-footer-meta">Компания</span>
              </span>
            </Link>
            <div className="hr-sidebar-footer-row">
              <span className="hr-sidebar-footer-icon" aria-hidden="true">
                {theme === "dark" ? "☀" : "☾"}
              </span>
              <span className="hr-sidebar-footer-label">Тема</span>
              <ThemeToggleSwitch theme={theme} onToggle={toggleTheme} className="ts-sidebar-footer-switch" />
            </div>
            <button
              type="button"
              className="hr-sidebar-footer-btn hr-sidebar-footer-btn--danger"
              onClick={signOut}
            >
              <span className="hr-sidebar-footer-icon" aria-hidden="true">
                ⎋
              </span>
              <span className="hr-sidebar-footer-label">Выйти</span>
            </button>
          </footer>
        </aside>

        <div className="hr-app-area">
          <header className="hr-topbar">
            <div className="hr-topbar-actions">
              <Link to={`${base}/candidates/new`} className="hr-btn">
                + Кандидат
              </Link>
              <Link to={`${base}/vacancies/new`} className="hr-btn hr-btn--ghost">
                + Вакансия
              </Link>
            </div>
          </header>

          <main className="hr-workspace">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
