import { useEffect, useState } from "react";
import type { CareerReadingLayerReportV1 } from "../../lib/hr/careerReadingLayersV1";
import {
  CAREER_READING_LAYER_CATALOG_V1,
  CAREER_READING_LAYER_KEYS_V1,
  getCareerReadingLayers,
} from "../../lib/hr/talentMapContentV2";
import { coerceStringArray, getText } from "../../lib/hr/talentMapUiHelpers";

export type CareerReadingCatalogItem = {
  layer_key: string;
  hr_title: string;
  short_summary: string;
  layer: CareerReadingLayerReportV1;
};

export function buildCareerReadingLayerCatalog(rawContent: unknown): CareerReadingCatalogItem[] {
  const layers = getCareerReadingLayers(rawContent);
  const byKey = new Map(layers.map((layer) => [layer.layer_key, layer]));

  return CAREER_READING_LAYER_KEYS_V1.map((key) => {
    const catalog = CAREER_READING_LAYER_CATALOG_V1[key];
    const layer = byKey.get(key);
    return {
      layer_key: key,
      hr_title: layer?.title ?? catalog.title,
      short_summary: layer?.base?.short_summary ?? layer?.base?.headline ?? "—",
      layer: layer ?? ({
        layer_key: key,
        title: catalog.title,
        status: "missing_data",
        ui_priority: catalog.ui_priority,
        source_facts: {},
        base: { headline: "—", short_summary: "—", where_useful: [], risks: [], management_tips: [], what_to_check: [] },
        pro: { classical_sources: [], connection_logic: "", confidence: "low" },
        evidence: { source_fields: [], source_chart_elements: [], confidence: "low" },
        summary_for_synthesis: {
          one_sentence: "—",
          strengths: [],
          risks: [],
          conditions: [],
          management_focus: [],
          what_to_check: [],
        },
        matching_summary: {
          good_for: [],
          bad_for: [],
          role_fit_positive_signals: [],
          role_fit_risk_signals: [],
          check_in_role_fit: [],
        },
        qa: {},
      } as CareerReadingLayerReportV1),
    };
  });
}

export function getCareerReadingCatalogItemByKey(
  catalog: CareerReadingCatalogItem[],
  layerKey: string,
): CareerReadingCatalogItem | undefined {
  return catalog.find((item) => item.layer_key === layerKey);
}

function SectionBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="hr-tm-panel-block">
      <h4 className="hr-tm-panel-block-title">{title}</h4>
      {children}
    </div>
  );
}

function BulletList({ items }: { items: string[] }) {
  if (items.length === 0) return null;
  return (
    <ul className="hr-tm-bullets">
      {items.map((item, i) => (
        <li key={`${item.slice(0, 24)}-${i}`}>{item}</li>
      ))}
    </ul>
  );
}

function CareerReadingSpecialPayload({ layer }: { layer: CareerReadingLayerReportV1 }) {
  const payload = layer.special_payload;
  if (!payload) return null;

  if (payload.channel_talents && payload.channel_talents.length > 0) {
    return (
      <SectionBlock title="Карточки талантов по каналам">
        <div className="hr-tm-section-stack">
          {payload.channel_talents.map((card) => (
            <div key={card.channel_key} className="hr-tm-playbook-card">
              <h5 className="hr-tm-playbook-card-title">{card.title}</h5>
              <p>{card.summary}</p>
              {card.where_useful?.length ? (
                <>
                  <p className="hr-muted">Где полезно</p>
                  <BulletList items={card.where_useful} />
                </>
              ) : null}
              {card.how_it_appears_at_work ? (
                <p className="hr-muted">На работе: {card.how_it_appears_at_work}</p>
              ) : null}
              {card.risk ? <p className="hr-muted">Риск: {card.risk}</p> : null}
              {card.management_tip ? <p className="hr-muted">Совет: {card.management_tip}</p> : null}
            </div>
          ))}
        </div>
      </SectionBlock>
    );
  }

  if (payload.center_zones && payload.center_zones.length > 0) {
    return (
      <SectionBlock title="Зоны устойчивости и чувствительности">
        <div className="hr-tm-section-stack">
          {payload.center_zones.map((zone) => (
            <div key={`${zone.center_key}-${zone.defined}`} className="hr-tm-playbook-card">
              <h5 className="hr-tm-playbook-card-title">
                {zone.title}{" "}
                <span className="hr-muted">({zone.defined ? "устойчивая" : "чувствительная"})</span>
              </h5>
              <p>{zone.work_meaning}</p>
              {zone.potential_strength ? <p className="hr-muted">Сила: {zone.potential_strength}</p> : null}
              {zone.risk_under_pressure ? (
                <p className="hr-muted">Под давлением: {zone.risk_under_pressure}</p>
              ) : null}
              {zone.management_tip ? <p className="hr-muted">Совет: {zone.management_tip}</p> : null}
            </div>
          ))}
        </div>
      </SectionBlock>
    );
  }

  if (payload.repeated_gate_themes && payload.repeated_gate_themes.length > 0) {
    return (
      <SectionBlock title="Усиленные рабочие мотивы">
        <div className="hr-tm-section-stack">
          {payload.repeated_gate_themes.map((theme) => (
            <div key={theme.gate} className="hr-tm-playbook-card">
              <h5 className="hr-tm-playbook-card-title">{theme.title}</h5>
              <p>{theme.summary}</p>
              {theme.talent_potential ? (
                <p className="hr-muted">Потенциал: {theme.talent_potential}</p>
              ) : null}
              {theme.risk_pattern ? <p className="hr-muted">Риск: {theme.risk_pattern}</p> : null}
            </div>
          ))}
        </div>
      </SectionBlock>
    );
  }

  return null;
}

export function CareerReadingLayerDetailPanel({ item }: { item: CareerReadingCatalogItem }) {
  const [mode, setMode] = useState<"base" | "pro">("base");
  const layer = item.layer;

  useEffect(() => {
    setMode("base");
  }, [item.layer_key]);

  const base = layer.base;
  const pro = layer.pro;

  return (
    <>
      <div className="hr-layer-mode-toggle" role="tablist" aria-label="Режим просмотра слоя">
        <button
          type="button"
          role="tab"
          aria-selected={mode === "base"}
          className={`hr-layer-mode-btn${mode === "base" ? " hr-layer-mode-btn--active" : ""}`}
          onClick={() => setMode("base")}
        >
          Base
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "pro"}
          className={`hr-layer-mode-btn${mode === "pro" ? " hr-layer-mode-btn--active" : ""}`}
          onClick={() => setMode("pro")}
        >
          Pro
        </button>
      </div>

      {mode === "base" ? (
        <>
          <p className="hr-tm-panel-lead">{getText(base.headline)}</p>
          <p>{getText(base.short_summary)}</p>
          {base.detailed_explanation ? <p>{getText(base.detailed_explanation)}</p> : null}
          {base.how_it_appears_at_work ? (
            <SectionBlock title="Как проявляется на работе">
              <p>{getText(base.how_it_appears_at_work)}</p>
            </SectionBlock>
          ) : null}
          {coerceStringArray(base.where_useful).length ? (
            <SectionBlock title="Где полезно">
              <BulletList items={coerceStringArray(base.where_useful)} />
            </SectionBlock>
          ) : null}
          {Array.isArray(base.risks) && base.risks.length > 0 ? (
            <SectionBlock title="Риски">
              <div className="hr-tm-section-stack">
                {base.risks.map((risk, i) => (
                  <div key={`${risk.title}-${i}`} className="hr-tm-playbook-card">
                    <h5 className="hr-tm-playbook-card-title">{risk.title}</h5>
                    <p>{risk.description}</p>
                  </div>
                ))}
              </div>
            </SectionBlock>
          ) : null}
          {coerceStringArray(base.management_tips).length ? (
            <SectionBlock title="Советы руководителю">
              <BulletList items={coerceStringArray(base.management_tips)} />
            </SectionBlock>
          ) : null}
          <CareerReadingSpecialPayload layer={layer} />
        </>
      ) : (
        <>
          {pro.technical_title ? <p className="hr-muted">{pro.technical_title}</p> : null}
          {pro.classical_sources?.length ? (
            <SectionBlock title="Classical sources">
              <ul className="hr-tm-bullets">
                {pro.classical_sources.map((src) => (
                  <li key={src.source_key}>
                    <strong>{src.source_label}</strong>: {src.value_summary}
                  </li>
                ))}
              </ul>
            </SectionBlock>
          ) : null}
          {pro.source_values && Object.keys(pro.source_values).length > 0 ? (
            <SectionBlock title="Source values">
              <pre className="hr-tm-code-block">
                {JSON.stringify(pro.source_values, null, 2)}
              </pre>
            </SectionBlock>
          ) : null}
          {pro.connection_logic ? (
            <SectionBlock title="Connection logic">
              <p>{pro.connection_logic}</p>
            </SectionBlock>
          ) : null}
          {layer.evidence?.source_fields?.length ? (
            <SectionBlock title="Evidence fields">
              <BulletList items={coerceStringArray(layer.evidence.source_fields)} />
            </SectionBlock>
          ) : null}
        </>
      )}
    </>
  );
}

export function CareerReadingLayerList({
  catalog,
  onSelectLayer,
}: {
  catalog: CareerReadingCatalogItem[];
  onSelectLayer: (layerKey: string) => void;
}) {
  return (
    <div className="hr-layer-catalog">
      <p className="hr-tm-product-catalog-badge">Career Reading Layers v1 · 8 HD слоёв</p>
      <ul className="hr-layer-catalog-list">
        {catalog.map((item) => (
          <li key={item.layer_key}>
            <button
              type="button"
              className="hr-layer-catalog-item"
              onClick={() => onSelectLayer(item.layer_key)}
            >
              <span className="hr-layer-catalog-item-title">{item.hr_title}</span>
              <span className="hr-layer-catalog-item-desc">{item.short_summary}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
