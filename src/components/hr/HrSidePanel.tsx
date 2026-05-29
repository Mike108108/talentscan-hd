import { useEffect, useId, useRef } from "react";

export type HrSidePanelProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  eyebrow?: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
};

export function HrSidePanel({
  open,
  onClose,
  title,
  eyebrow,
  description,
  children,
  footer,
}: HrSidePanelProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (open) panelRef.current?.focus();
  }, [open]);

  if (!open) return null;

  return (
    <div className="hr-side-panel-root" aria-hidden={false}>
      <button
        type="button"
        className="hr-side-panel-overlay"
        aria-label="Закрыть панель"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        className="hr-side-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <header className="hr-side-panel-header">
          <button
            type="button"
            className="hr-side-panel-back"
            onClick={onClose}
            aria-label="Назад"
          >
            <span aria-hidden>←</span>
            <span className="hr-side-panel-back-text">Назад</span>
          </button>
          <button
            type="button"
            className="hr-side-panel-close"
            onClick={onClose}
            aria-label="Закрыть"
          >
            ×
          </button>
        </header>

        <div className="hr-side-panel-head">
          {eyebrow ? <p className="hr-side-panel-eyebrow">{eyebrow}</p> : null}
          <h2 id={titleId} className="hr-side-panel-title">
            {title}
          </h2>
          {description ? <p className="hr-side-panel-desc">{description}</p> : null}
        </div>

        <div className="hr-side-panel-body">{children}</div>

        {footer ? <footer className="hr-side-panel-footer">{footer}</footer> : null}
      </div>
    </div>
  );
}
