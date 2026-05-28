import { Link, Outlet, useLocation, useNavigate, useParams } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import "../../hr.css";

const NAV = [
  { path: "", label: "Обзор", hint: "Главный экран", enabled: true },
  { path: "vacancies", label: "Вакансии", hint: "Роли и позиции", enabled: true },
  { path: "candidates", label: "Кандидаты", hint: "Пул кандидатов", enabled: true },
  { path: "reports", label: "Разборы", hint: "Карты талантов", enabled: true },
  { path: "company", label: "Моя компания", hint: "Контекст и данные", enabled: true },
];

const ROADMAP = ["Сравнения", "TeamScan", "Интервью", "Адаптация"];

export default function HrShell() {
  const { companyId } = useParams<{ companyId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const base = `/hr/company/${companyId}`;

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
            <span className="hr-sidebar-logo">TalentScan</span>
            <span className="hr-sidebar-tagline">Кабинет</span>
          </div>

          <div className="hr-workspace-switch">
            <span className="hr-workspace-label">Рабочее пространство</span>
            <div className="hr-workspace-modes">
              <span className="hr-workspace-mode hr-workspace-mode--active" aria-current="true">
                HR
              </span>
              <Link to="/app" className="hr-workspace-mode">
                Личный
              </Link>
            </div>
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

          <div className="hr-sidebar-roadmap">
            <p className="hr-sidebar-roadmap-title">Дорожная карта</p>
            {ROADMAP.map((label) => (
              <div key={label} className="hr-sidebar-roadmap-item">
                {label}
              </div>
            ))}
          </div>
        </aside>

        <div className="hr-app-area">
          <header className="hr-topbar">
            <div className="hr-brand">
              <div className="hr-logo" aria-hidden />
              <div>
                <h1>TalentScan HR</h1>
                <p>Рабочий кабинет работодателя</p>
              </div>
            </div>
            <div className="hr-topbar-actions">
              <Link to="/app" className="hr-btn hr-btn--ghost">
                Личный кабинет
              </Link>
              <Link to="/hr/companies" className="hr-btn hr-btn--ghost">
                Компании
              </Link>
              <span className="hr-pill">
                <span className="hr-dot" />
                HR-доступ
              </span>
              <button type="button" className="hr-btn hr-btn--secondary" onClick={signOut}>
                Выйти
              </button>
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
