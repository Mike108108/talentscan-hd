import GlobalSidebar from "./GlobalSidebar";
import type { AppSection, MainNavSection } from "./shellTypes";

type MobileNavProps = {
  open: boolean;
  onClose: () => void;
  activeSection: AppSection;
  onSectionChange: (section: MainNavSection) => void;
  displayName: string;
  userEmail?: string;
  theme: "dark" | "light";
  onToggleTheme: () => void;
  onSettings: () => void;
  onSignOut: () => void;
};

export default function MobileNav({
  open,
  onClose,
  activeSection,
  onSectionChange,
  displayName,
  userEmail,
  theme,
  onToggleTheme,
  onSettings,
  onSignOut,
}: MobileNavProps) {
  if (!open) return null;

  const handleNav = (section: MainNavSection) => {
    onSectionChange(section);
    onClose();
  };

  const handleSettings = () => {
    onSettings();
    onClose();
  };

  return (
    <div className="ts-mobile-nav" role="dialog" aria-modal="true" aria-label="Меню">
      <button
        type="button"
        className="ts-mobile-nav-backdrop"
        onClick={onClose}
        aria-label="Закрыть меню"
      />
      <div className="ts-mobile-drawer">
        <div className="ts-mobile-drawer-header">
          <span className="ts-sidebar-logo">TalentScan</span>
          <button
            type="button"
            className="ts-mobile-drawer-close"
            onClick={onClose}
            aria-label="Закрыть"
          >
            ×
          </button>
        </div>
        <GlobalSidebar
          activeSection={activeSection}
          onSectionChange={handleNav}
          displayName={displayName}
          userEmail={userEmail}
          theme={theme}
          onToggleTheme={onToggleTheme}
          onSettings={handleSettings}
          onSignOut={() => {
            onSignOut();
            onClose();
          }}
          className="ts-sidebar--drawer"
        />
      </div>
    </div>
  );
}
