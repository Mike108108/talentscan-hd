type ComingSoonScreenProps = {
  title: string;
  description: string;
  primaryActionLabel: string;
  onPrimaryAction: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
};

export default function ComingSoonScreen({
  title,
  description,
  primaryActionLabel,
  onPrimaryAction,
  secondaryActionLabel,
  onSecondaryAction,
}: ComingSoonScreenProps) {
  return (
    <div className="ts-screen ts-screen--center">
      <div className="ts-panel ts-coming-soon-card">
        <span className="ts-coming-soon-badge">Скоро</span>
        <h2 className="ts-screen-title">{title}</h2>
        <p className="ts-screen-subtitle">{description}</p>
        <div className="ts-action-row">
          <button type="button" className="ts-topbar-primary-btn" onClick={onPrimaryAction}>
            {primaryActionLabel}
          </button>
          {secondaryActionLabel && onSecondaryAction && (
            <button
              type="button"
              className="account-btn account-btn--secondary"
              onClick={onSecondaryAction}
            >
              {secondaryActionLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
