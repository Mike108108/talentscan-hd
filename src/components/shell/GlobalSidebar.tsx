import { MAIN_NAV_ITEMS, type AppSection, type MainNavSection } from "./shellTypes";
import { Link, useLocation } from "react-router-dom";

type GlobalSidebarProps = {
  activeSection: AppSection;
  onSectionChange: (section: MainNavSection) => void;
  displayName: string;
  userEmail?: string;
  theme: "dark" | "light";
  onToggleTheme: () => void;
  onSettings: () => void;
  onSignOut: () => void;
  className?: string;
};

function getSidebarActiveId(activeSection: AppSection): MainNavSection | null {
  if (activeSection === "new-report") return "reports";
  if (activeSection === "settings") return null;
  return activeSection;
}

export default function GlobalSidebar({
  activeSection,
  onSectionChange,
  displayName,
  userEmail,
  theme: _theme,
  onToggleTheme: _onToggleTheme,
  onSettings,
  onSignOut,
  className = "",
}: GlobalSidebarProps) {
  const sidebarActive = getSidebarActiveId(activeSection);
  const profileLabel = displayName || userEmail || "Профиль";
  const location = useLocation();
  const inHr = location.pathname.startsWith("/hr");
  const cabinetStatus = inHr ? "HR-кабинет" : "Личный кабинет";

  return (
    <aside className={`ts-sidebar ${className}`.trim()} aria-label="Главное меню">
      <div className="ts-sidebar-brand">
        <div className="ts-sidebar-brand-row">
          <span className="ts-sidebar-logo">TalentScan</span>
          <div className="ts-cabinet-switch" aria-label="Переключение кабинета">
            {inHr ? (
              <>
                <Link to="/app" className="ts-cabinet-switch-btn" aria-label="Перейти в личный кабинет">
                  ЛК
                </Link>
                <span className="ts-cabinet-switch-btn ts-cabinet-switch-btn--active" aria-current="true">
                  HR
                </span>
              </>
            ) : (
              <>
                <span className="ts-cabinet-switch-btn ts-cabinet-switch-btn--active" aria-current="true">
                  ЛК
                </span>
                <Link to="/hr/cabinet" className="ts-cabinet-switch-btn" aria-label="Перейти в HR-кабинет">
                  HR
                </Link>
              </>
            )}
          </div>
        </div>
        <span className="ts-sidebar-tagline">{cabinetStatus}</span>
      </div>

      <div className="ts-sidebar-main">
        <nav className="ts-sidebar-nav">
          {MAIN_NAV_ITEMS.map((item) => {
            const isActive = sidebarActive === item.id;
            return (
              <button
                key={item.id}
                type="button"
                className={`ts-sidebar-item${isActive ? " ts-sidebar-item--active" : ""}`}
                onClick={() => onSectionChange(item.id)}
                aria-current={isActive ? "page" : undefined}
              >
                <span className="ts-sidebar-item-icon" aria-hidden="true">
                  {item.icon}
                </span>
                <span className="ts-sidebar-item-label">{item.label}</span>
                {"soon" in item && item.soon && (
                  <span className="ts-sidebar-soon">скоро</span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      <footer className="ts-sidebar-footer">
        <button
          type="button"
          className={`ts-sidebar-footer-btn${activeSection === "settings" ? " ts-sidebar-item--active" : ""}`}
          onClick={onSettings}
        >
          <span className="ts-sidebar-item-icon" aria-hidden="true">
            ⚙
          </span>
          <span className="ts-sidebar-footer-text">
            <span className="ts-sidebar-footer-label">Настройки</span>
            <span className="ts-sidebar-footer-meta">{profileLabel}</span>
          </span>
        </button>
        <button
          type="button"
          className="ts-sidebar-footer-btn ts-sidebar-footer-btn--compact ts-sidebar-footer-btn--danger"
          onClick={onSignOut}
        >
          <span className="ts-sidebar-item-icon" aria-hidden="true">
            ⎋
          </span>
          <span className="ts-sidebar-footer-label">Выйти</span>
        </button>
      </footer>
    </aside>
  );
}
