import { useState, type ReactNode } from "react";
import GlobalSidebar from "./GlobalSidebar";
import MobileNav from "./MobileNav";
import Topbar from "./Topbar";
import type { AppSection, MainNavSection } from "./shellTypes";

type AppShellProps = {
  activeSection: AppSection;
  onSectionChange: (section: AppSection) => void;
  userEmail?: string;
  displayName: string;
  onNewReport: () => void;
  onSignOut: () => void;
  theme: "dark" | "light";
  onToggleTheme: () => void;
  topbarTitle: string;
  topbarBreadcrumbs: string[];
  children: ReactNode;
};

export default function AppShell({
  activeSection,
  onSectionChange,
  userEmail,
  displayName,
  onNewReport,
  onSignOut,
  theme,
  onToggleTheme,
  topbarTitle,
  topbarBreadcrumbs,
  children,
}: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleMainNav = (section: MainNavSection) => {
    onSectionChange(section);
  };

  const workspaceModifiers = [
    activeSection === "my-map" ? "ts-workspace--wide" : "",
    activeSection === "today" ? "ts-workspace--today" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="ts-shell">
      <GlobalSidebar
        activeSection={activeSection}
        onSectionChange={handleMainNav}
        displayName={displayName}
        userEmail={userEmail}
        theme={theme}
        onToggleTheme={onToggleTheme}
        onSettings={() => onSectionChange("settings")}
        onSignOut={onSignOut}
        className="ts-sidebar--desktop"
      />

      <MobileNav
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        activeSection={activeSection}
        onSectionChange={handleMainNav}
        displayName={displayName}
        userEmail={userEmail}
        theme={theme}
        onToggleTheme={onToggleTheme}
        onSettings={() => onSectionChange("settings")}
        onSignOut={onSignOut}
      />

      <div className="ts-app-area">
        <Topbar
          title={topbarTitle}
          breadcrumbs={topbarBreadcrumbs}
          onNewReport={onNewReport}
          onMenuOpen={() => setMobileOpen(true)}
          userEmail={userEmail}
          displayName={displayName}
        />
        <main className={`ts-workspace ${workspaceModifiers}`.trim()}>{children}</main>
      </div>
    </div>
  );
}
