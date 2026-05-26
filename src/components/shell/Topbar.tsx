type TopbarProps = {
  title: string;
  breadcrumbs: string[];
  onNewReport: () => void;
  onMenuOpen: () => void;
  userEmail?: string;
  displayName?: string;
};

export default function Topbar({
  title,
  breadcrumbs,
  onNewReport,
  onMenuOpen,
  userEmail,
  displayName,
}: TopbarProps) {
  const userLabel = displayName || userEmail;

  return (
    <header className="ts-topbar">
      <div className="ts-topbar-left">
        <button
          type="button"
          className="ts-topbar-menu-btn"
          onClick={onMenuOpen}
          aria-label="Открыть меню"
        >
          ☰
        </button>
        <div className="ts-topbar-headings">
          <nav className="ts-breadcrumbs" aria-label="Хлебные крошки">
            {breadcrumbs.map((crumb, i) => (
              <span key={`${crumb}-${i}`} className="ts-breadcrumb-part">
                {i > 0 && <span className="ts-breadcrumb-sep">/</span>}
                <span
                  className={
                    i === breadcrumbs.length - 1
                      ? "ts-breadcrumb-current"
                      : "ts-breadcrumb-link"
                  }
                >
                  {crumb}
                </span>
              </span>
            ))}
          </nav>
          <h1 className="ts-topbar-title">{title}</h1>
        </div>
      </div>

      <div className="ts-topbar-actions">
        <button type="button" className="ts-topbar-primary-btn" onClick={onNewReport}>
          + Новый разбор
        </button>
        {userLabel && (
          <span className="ts-topbar-user" title={userEmail}>
            {userLabel}
          </span>
        )}
      </div>
    </header>
  );
}
