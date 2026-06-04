import { useState, type ReactNode } from "react";
import { formulaToSafeHtml } from "../../lib/safeHtml";
import {
  buildDashboardConclusionV01,
  buildDashboardDetailSectionsV01,
  buildDashboardRisksV01,
  buildDashboardStrengthsV01,
  buildTalentSignalsV01,
  formatSignalSourceHint,
  talentSignalKindLabelRu,
  type DashboardDetailSectionV01,
  type TalentSignalV01,
} from "../../lib/hr/talentSignalsV01";
import type { HrTalentMapSynthesisBlocksV2, MergedLayerCatalogItem } from "../../lib/hr/types";
import {
  LayerCatalogList,
  ManagementPlaybookGrid,
} from "./talentMapPanelContent";

type DashboardProps = {
  synthesisBlocks: HrTalentMapSynthesisBlocksV2 | null;
  mergedCatalog: MergedLayerCatalogItem[];
  onSelectLayer: (layerKey: string) => void;
  normalizeHrCopy: (text: unknown) => string;
  onOpenDataQuality?: () => void;
};

function DashboardSection({
  id,
  title,
  subtitle,
  children,
  variant = "primary",
}: {
  id?: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
  variant?: "primary" | "secondary" | "evidence";
}) {
  return (
    <section
      id={id}
      className={`hr-tm-dash-section hr-tm-dash-section--${variant}`}
    >
      <header className="hr-tm-dash-section-header">
        <h3 className="hr-tm-dash-section-title">{title}</h3>
        {subtitle ? <p className="hr-tm-dash-section-sub">{subtitle}</p> : null}
      </header>
      {children}
    </section>
  );
}

function TalentSignalCard({ signal }: { signal: TalentSignalV01 }) {
  const sourceHint = formatSignalSourceHint(signal);
  return (
    <article className={`hr-tm-signal-card hr-tm-signal-card--${signal.kind}`}>
      <div className="hr-tm-signal-card-head">
        <span className="hr-tm-signal-card-icon" aria-hidden>
          {signal.icon ?? "•"}
        </span>
        <div className="hr-tm-signal-card-titles">
          <h4 className="hr-tm-signal-card-title">{signal.title}</h4>
          <span className={`hr-tm-signal-kind hr-tm-signal-kind--${signal.kind}`}>
            {talentSignalKindLabelRu(signal.kind)}
          </span>
        </div>
      </div>
      <p className="hr-tm-signal-card-summary">{signal.summary}</p>
      {signal.what_to_check ? (
        <p className="hr-tm-signal-card-check">
          <span className="hr-tm-signal-card-check-label">Проверить:</span>{" "}
          {signal.what_to_check}
        </p>
      ) : null}
      {sourceHint ? <p className="hr-tm-signal-card-source">{sourceHint}</p> : null}
    </article>
  );
}

function PointsColumn({
  title,
  points,
  emptyText,
  variant,
}: {
  title: string;
  points: Array<{ key: string; text: string; detail?: string }>;
  emptyText: string;
  variant: "strength" | "risk";
}) {
  return (
    <div className={`hr-tm-points-col hr-tm-points-col--${variant}`}>
      <h4 className="hr-tm-points-col-title">{title}</h4>
      {points.length === 0 ? (
        <p className="hr-muted hr-tm-points-empty">{emptyText}</p>
      ) : (
        <ul className="hr-tm-points-list">
          {points.map((p) => (
            <li key={p.key} className="hr-tm-points-item">
              <span className="hr-tm-points-text">{p.text}</span>
              {p.detail ? <span className="hr-tm-points-detail">{p.detail}</span> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ConclusionGrid({
  conclusion,
}: {
  conclusion: ReturnType<typeof buildDashboardConclusionV01>;
}) {
  const rows: Array<{ label: string; value?: string }> = [
    { label: "Кто это в работе", value: conclusion.who_at_work },
    { label: "Где раскрывается", value: conclusion.where_shines },
    { label: "Что проверить первым", value: conclusion.what_to_check_first },
    { label: "Как взаимодействовать", value: conclusion.how_to_interact },
  ].filter((r) => r.value);

  if (!rows.length) {
    return <p className="hr-muted">Общий вывод появится после генерации synthesis-блоков.</p>;
  }

  return (
    <div className="hr-tm-conclusion-grid">
      {rows.map((row) => (
        <div key={row.label} className="hr-tm-conclusion-grid-item">
          <span className="hr-tm-conclusion-grid-label">{row.label}</span>
          <p className="hr-tm-conclusion-grid-value">{row.value}</p>
        </div>
      ))}
    </div>
  );
}

function DetailSectionAccordion({
  section,
  normalizeHrCopy,
  defaultOpen,
}: {
  section: DashboardDetailSectionV01;
  normalizeHrCopy: (text: unknown) => string;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  const formulaHtml =
    section.key === "work_formula" && section.content
      ? formulaToSafeHtml(section.content)
      : "";

  return (
    <div className={`hr-tm-detail-accordion${open ? " hr-tm-detail-accordion--open" : ""}`}>
      <button
        type="button"
        className="hr-tm-detail-accordion-trigger"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span>{section.title}</span>
        <span className="hr-tm-detail-accordion-chevron" aria-hidden>
          {open ? "▾" : "▸"}
        </span>
      </button>
      {open ? (
        <div className="hr-tm-detail-accordion-body">
          {formulaHtml ? (
            <div
              className="hr-tm-overview-formula"
              dangerouslySetInnerHTML={{ __html: formulaHtml }}
            />
          ) : section.content ? (
            <p className="hr-tm-section-lead">{section.content}</p>
          ) : null}
          {section.items.length > 0 ? (
            <ul className="hr-tm-detail-items">
              {section.items.map((item, i) => (
                <li key={`${item.title}-${i}`}>
                  {item.title && item.title !== "—" ? (
                    <strong>{normalizeHrCopy(item.title)}</strong>
                  ) : null}
                  {item.body ? (
                    <span>
                      {item.title && item.title !== "—" ? " — " : ""}
                      {normalizeHrCopy(item.body)}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
          {section.key === "risks" && section.checks?.length ? (
            <div className="hr-tm-detail-checks">
              {section.checks.map((check, i) => (
                <div key={check.id || `check-${i}`} className="hr-tm-detail-check-row">
                  <strong>{normalizeHrCopy(check.risk)}</strong>
                  {check.how_it_may_show_up ? (
                    <span>{normalizeHrCopy(check.how_it_may_show_up)}</span>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}
          {section.key === "management" && section.playbook ? (
            <ManagementPlaybookGrid
              playbook={section.playbook}
              normalizeHrCopy={normalizeHrCopy}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function TalentMapDashboard({
  synthesisBlocks,
  mergedCatalog,
  onSelectLayer,
  normalizeHrCopy,
}: DashboardProps) {
  const signals = buildTalentSignalsV01({ synthesisBlocks });
  const strengths = buildDashboardStrengthsV01({ synthesisBlocks });
  const risks = buildDashboardRisksV01({ synthesisBlocks });
  const conclusion = buildDashboardConclusionV01({ synthesisBlocks });
  const detailSections = buildDashboardDetailSectionsV01({ synthesisBlocks });

  return (
    <div className="hr-tm-dashboard">
      {signals.length > 0 ? (
        <DashboardSection
          id="talent-signals"
          title="Рабочие сигналы"
          subtitle="Короткие паттерны, которые стоит учитывать в интервью, управлении и проверке задач."
        >
          <div className="hr-tm-signals-grid">
            {signals.map((signal) => (
              <TalentSignalCard key={signal.key} signal={signal} />
            ))}
          </div>
        </DashboardSection>
      ) : null}

      <DashboardSection title="Сильные стороны и зоны риска" variant="primary">
        <div className="hr-tm-points-grid">
          <PointsColumn
            title="Сильные стороны"
            points={strengths}
            emptyText="Сильные стороны появятся после генерации карты."
            variant="strength"
          />
          <PointsColumn
            title="Зоны риска"
            points={risks}
            emptyText="Зоны риска появятся после генерации карты."
            variant="risk"
          />
        </div>
      </DashboardSection>

      <DashboardSection title="Общий вывод по карте" variant="primary">
        <ConclusionGrid conclusion={conclusion} />
      </DashboardSection>

      {detailSections.length > 0 ? (
        <DashboardSection
          title="Подробные разделы"
          subtitle="Развёрнутые HR-блоки — открывайте при необходимости детальной подготовки."
          variant="secondary"
        >
          <div className="hr-tm-detail-accordions">
            {detailSections.map((section, idx) => (
              <DetailSectionAccordion
                key={section.key}
                section={section}
                normalizeHrCopy={normalizeHrCopy}
                defaultOpen={idx === 0}
              />
            ))}
          </div>
        </DashboardSection>
      ) : null}

      <DashboardSection
        id="layer-breakdown"
        title="Послойная расшифровка"
        subtitle="Подробные источники выводов: рабочие слои, условия, риски и evidence. Открывайте слой, если нужно понять основание вывода."
        variant="evidence"
      >
        <LayerCatalogList catalog={mergedCatalog} onSelectLayer={onSelectLayer} />
      </DashboardSection>
    </div>
  );
}

export function DownloadReportButton() {
  return (
    <button
      type="button"
      className="hr-btn hr-btn--ghost hr-tm-download-btn"
      disabled
      title="Экспорт полного отчёта будет добавлен следующим этапом."
    >
      Скачать отчёт — скоро
    </button>
  );
}
