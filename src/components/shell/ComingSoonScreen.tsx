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
    <div className="ts-coming-soon tab-screen">
      <div className="ts-coming-soon-card">
        <span className="ts-coming-soon-badge">Скоро</span>
        <h1 className="screen-title">{title}</h1>
        <p className="screen-subtitle">{description}</p>
        <div className="ts-coming-soon-actions">
          <button type="button" className="submit-btn" onClick={onPrimaryAction}>
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
