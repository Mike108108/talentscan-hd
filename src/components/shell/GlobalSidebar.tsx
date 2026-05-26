import { MAIN_NAV_ITEMS, type AppSection, type MainNavSection } from "./shellTypes";

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
  theme,
  onToggleTheme,
  onSettings,
  onSignOut,
  className = "",
}: GlobalSidebarProps) {
  const sidebarActive = getSidebarActiveId(activeSection);
  const profileLabel = displayName || userEmail || "Профиль";

  return (
    <aside className={`ts-sidebar ${className}`.trim()} aria-label="Главное меню">
      <div className="ts-sidebar-brand">
        <span className="ts-sidebar-logo">TalentScan</span>
        <span className="ts-sidebar-tagline">Кабинет</span>
      </div>

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

      <div className="ts-sidebar-footer">
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
          className="ts-sidebar-footer-btn ts-sidebar-footer-btn--compact"
          onClick={onToggleTheme}
          aria-label={
            theme === "dark"
              ? "Переключить на светлую тему"
              : "Переключить на тёмную тему"
          }
        >
          <span className="ts-sidebar-item-icon" aria-hidden="true">
            {theme === "dark" ? "☀" : "☾"}
          </span>
          <span className="ts-sidebar-footer-label">Тема</span>
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
      </div>
    </aside>
  );
}
