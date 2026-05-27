import { Link, Outlet, useLocation, useNavigate, useParams } from "react-router-dom";
import { supabase } from "../../lib/supabase";

const NAV = [
  { path: "", label: "Обзор", hint: "Главный экран", enabled: true },
  { path: "candidates", label: "Кандидаты", hint: "Карты талантов", enabled: true },
  { path: "people", label: "Люди", hint: "Скоро", enabled: false },
  { path: "vacancies", label: "Вакансии", hint: "Скоро", enabled: false },
  { path: "data", label: "Данные", hint: "Скоро", enabled: false },
];

const ROADMAP = [
  "Сравнения",
  "TeamScan",
  "Интервью",
  "Адаптация",
];

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
      <div className="hr-app">
        <header className="hr-topbar">
          <div className="hr-brand">
            <div className="hr-logo" aria-hidden />
            <div>
              <h1>TalentScan HR</h1>
              <p>Рабочий кабинет работодателя</p>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Link to="/hr/companies" className="hr-btn hr-btn--ghost">
              Компании
            </Link>
            <span className="hr-pill">
              <span className="hr-dot" />
              Demo HR access
            </span>
            <button type="button" className="hr-btn hr-btn--secondary" onClick={signOut}>
              Выйти
            </button>
          </div>
        </header>

        <div className="hr-layout">
          <aside className="hr-sidebar">
            <div style={{ padding: "8px 10px 12px", borderBottom: "1px solid rgba(255,255,255,.1)" }}>
              <b style={{ fontSize: 17 }}>Workspace</b>
              <span style={{ display: "block", color: "var(--hr-muted)", fontSize: 11, marginTop: 4 }}>
                Разделы кабинета
              </span>
            </div>
            <nav className="hr-nav" style={{ marginTop: 8 }}>
              {NAV.map((item) => {
                const to = item.path ? `${base}/${item.path}` : base;
                const active =
                  item.path === ""
                    ? sectionPath === ""
                    : sectionPath.startsWith(item.path);
                if (!item.enabled) {
                  return (
                    <span key={item.path} className="hr-nav--disabled" style={{ padding: "8px 9px" }}>
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
            <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid rgba(255,255,255,.1)" }}>
              <p style={{ margin: "0 0 8px", fontSize: 11, color: "var(--hr-muted)" }}>Скоро</p>
              {ROADMAP.map((label) => (
                <div key={label} className="hr-nav--disabled" style={{ padding: "6px 9px", fontSize: 13 }}>
                  {label}
                </div>
              ))}
            </div>
          </aside>
          <main>
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
