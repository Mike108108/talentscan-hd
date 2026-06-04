import {
  CAREER_READING_LAYER_KEYS_V1,
  CAREER_READING_LAYERS_VERSION_V1,
  type CareerReadingCenterZoneV1,
  type CareerReadingChannelTalentV1,
  type CareerReadingCheckV1,
  type CareerReadingLayerReportV1,
  type CareerReadingPointV1,
  type CareerReadingRepeatedGateThemeV1,
  type CareerReadingRiskV1,
  type CareerReadingSectionV1,
} from "./careerReadingLayersV1";
import {
  getCareerReadingLayers,
  isCareerReadingTalentMapV3Ready,
  parseCareerReadingTalentMapV3,
} from "./talentMapContentV2";
import { escapeHtml } from "../safeHtml";

const V3_SCHEMA = "hr_person_talent_map_v3";
const CAREER_GENERATION_MODE = "career_reading_layers_v1";

function asString(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => asString(item)).filter(Boolean);
}

function slugifyCandidateName(name: string | null | undefined): string {
  const raw = (name ?? "candidate").trim().toLowerCase();
  const slug = raw
    .replace(/[^\p{L}\p{N}]+/gu, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);
  return slug || "candidate";
}

function formatExportDate(iso: string | null | undefined): string {
  if (iso) {
    const parsed = new Date(iso);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString().slice(0, 10);
    }
  }
  return new Date().toISOString().slice(0, 10);
}

function formatDisplayDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleString("ru-RU", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function readGenerationMeta(root: Record<string, unknown>) {
  const genMeta = asRecord(root.generation_meta);
  return {
    schema_version: asString(root.schema_version) || V3_SCHEMA,
    generation_mode: asString(genMeta.generation_mode) || CAREER_GENERATION_MODE,
    career_reading_layers_version:
      asString(root.career_reading_layers_version) || CAREER_READING_LAYERS_VERSION_V1,
    model: asString(genMeta.selected_model) || asString(root.model),
    prompt_version: asString(genMeta.prompt_version) || asString(root.prompt_version),
  };
}

/** Ready v3 career reading report with layers can be exported as standalone HTML. */
export function canExportCareerReadingHtmlReport(content: unknown): boolean {
  const root = parseCareerReadingTalentMapV3(content);
  if (!root) return false;

  const layers = getCareerReadingLayers(root);
  if (layers.length === 0) return false;

  const meta = readGenerationMeta(root);
  const isV3Schema = meta.schema_version === V3_SCHEMA;
  const isCareerMode = meta.generation_mode === CAREER_GENERATION_MODE;

  return (isV3Schema || isCareerMode) && isCareerReadingTalentMapV3Ready(root);
}

function renderParagraph(label: string, value: string | null | undefined): string {
  const text = asString(value);
  if (!text) return "";
  return `<p><strong>${escapeHtml(label)}:</strong> ${escapeHtml(text)}</p>`;
}

function renderStringList(items: string[] | undefined, emptyLabel = "—"): string {
  const list = asStringArray(items);
  if (list.length === 0) {
    return `<p class="muted">${escapeHtml(emptyLabel)}</p>`;
  }
  return `<ul>${list.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

function renderChecksTable(checks: CareerReadingCheckV1[] | undefined): string {
  const rows = Array.isArray(checks) ? checks : [];
  if (rows.length === 0) {
    return `<p class="muted">—</p>`;
  }
  const head = `<thead><tr>
    <th>Гипотеза</th><th>Как проверить</th><th>Хороший сигнал</th><th>Предупреждающий сигнал</th>
  </tr></thead>`;
  const body = rows
    .map(
      (c) => `<tr>
        <td>${escapeHtml(c.hypothesis)}</td>
        <td>${escapeHtml(c.check_method)}</td>
        <td>${escapeHtml(c.good_signal)}</td>
        <td>${escapeHtml(c.warning_signal)}</td>
      </tr>`,
    )
    .join("");
  return `<table class="data-table">${head}<tbody>${body}</tbody></table>`;
}

function renderPoints(points: CareerReadingPointV1[] | undefined): string {
  const items = Array.isArray(points) ? points : [];
  if (items.length === 0) return `<p class="muted">—</p>`;
  return items
    .map(
      (p) => `<div class="card">
        <h4>${escapeHtml(p.title)}</h4>
        <p>${escapeHtml(p.description)}</p>
        ${
          p.source_layer_keys?.length
            ? `<p class="muted"><small>source_layer_keys: ${escapeHtml(p.source_layer_keys.join(", "))}</small></p>`
            : ""
        }
      </div>`,
    )
    .join("");
}

function renderRisks(risks: CareerReadingRiskV1[] | undefined): string {
  const items = Array.isArray(risks) ? risks : [];
  if (items.length === 0) return `<p class="muted">—</p>`;
  return items
    .map(
      (r) => `<div class="card card--risk">
        <h4>${escapeHtml(r.title)}</h4>
        <p>${escapeHtml(r.description)}</p>
        ${renderParagraph("Как может проявиться", r.how_it_may_show_up)}
        ${renderParagraph("Смягчение", r.mitigation)}
      </div>`,
    )
    .join("");
}

function renderSections(sections: CareerReadingSectionV1[] | undefined): string {
  const items = Array.isArray(sections) ? sections : [];
  if (items.length === 0) return `<p class="muted">—</p>`;
  return items
    .map((s) => {
      const body = asString(s.body);
      const list = renderStringList(s.items);
      return `<div class="card">
        <h4>${escapeHtml(s.title)}</h4>
        ${body ? `<p>${escapeHtml(body)}</p>` : ""}
        ${list}
      </div>`;
    })
    .join("");
}

function renderEvidenceBlock(
  evidence: CareerReadingLayerReportV1["evidence"],
  heading = "Evidence",
): string {
  const elements = Array.isArray(evidence.source_chart_elements)
    ? evidence.source_chart_elements
    : [];
  const chartRows = elements
    .map(
      (el) => `<tr>
        <td>${escapeHtml(el.kind)}</td>
        <td>${escapeHtml(el.key)}</td>
        <td>${escapeHtml(el.value)}</td>
        <td>${escapeHtml(el.side ?? "—")}</td>
        <td>${escapeHtml(el.planet ?? "—")}</td>
        <td>${escapeHtml(el.line ?? "—")}</td>
      </tr>`,
    )
    .join("");

  return `<section class="sub">
    <h3>${escapeHtml(heading)}</h3>
    <p><strong>source_fields:</strong> ${escapeHtml(evidence.source_fields.join(", ") || "—")}</p>
    <p><strong>confidence:</strong> ${escapeHtml(evidence.confidence)}</p>
    <h4>warnings</h4>
    ${renderStringList(evidence.warnings)}
    <h4>source_chart_elements</h4>
    ${
      chartRows
        ? `<table class="data-table"><thead><tr>
            <th>kind</th><th>key</th><th>value</th><th>side</th><th>planet</th><th>line</th>
          </tr></thead><tbody>${chartRows}</tbody></table>`
        : `<p class="muted">—</p>`
    }
  </section>`;
}

function renderChannelTalent(channel: CareerReadingChannelTalentV1, index: number): string {
  return `<article class="card card--channel">
    <h4>Канал ${index + 1}: ${escapeHtml(channel.title)}</h4>
    <table class="meta-table">
      <tbody>
        <tr><th>channel_key</th><td>${escapeHtml(channel.channel_key)}</td></tr>
        <tr><th>classical_name</th><td>${escapeHtml(channel.classical_name ?? "—")}</td></tr>
        <tr><th>gates</th><td>${escapeHtml((channel.gates ?? []).join(", ") || "—")}</td></tr>
        <tr><th>centers</th><td>${escapeHtml((channel.centers ?? []).join(", ") || "—")}</td></tr>
        <tr><th>circuit</th><td>${escapeHtml(channel.circuit ?? "—")}</td></tr>
      </tbody>
    </table>
    ${renderParagraph("summary", channel.summary)}
    <h5>where_useful</h5>
    ${renderStringList(channel.where_useful)}
    ${renderParagraph("how_it_appears_at_work", channel.how_it_appears_at_work)}
    ${renderParagraph("risk", channel.risk)}
    ${renderParagraph("management_tip", channel.management_tip)}
    <h5>what_to_check</h5>
    ${renderChecksTable(channel.what_to_check)}
    ${renderEvidenceBlock(channel.evidence, "Evidence (канал)")}
  </article>`;
}

function renderCenterZone(zone: CareerReadingCenterZoneV1, index: number): string {
  return `<article class="card card--center">
    <h4>Зона ${index + 1}: ${escapeHtml(zone.title)}</h4>
    <table class="meta-table">
      <tbody>
        <tr><th>center_key</th><td>${escapeHtml(zone.center_key)}</td></tr>
        <tr><th>classical_name</th><td>${escapeHtml(zone.classical_name)}</td></tr>
        <tr><th>defined</th><td>${zone.defined ? "да" : "нет"}</td></tr>
      </tbody>
    </table>
    ${renderParagraph("work_meaning", zone.work_meaning)}
    ${renderParagraph("potential_strength", zone.potential_strength)}
    ${renderParagraph("risk_under_pressure", zone.risk_under_pressure)}
    ${renderParagraph("management_tip", zone.management_tip)}
    <h5>what_to_check</h5>
    ${renderChecksTable(zone.what_to_check)}
  </article>`;
}

function renderRepeatedGateTheme(theme: CareerReadingRepeatedGateThemeV1, index: number): string {
  return `<article class="card card--theme">
    <h4>Тема ${index + 1}: ${escapeHtml(theme.title)}</h4>
    <p><strong>gate:</strong> ${escapeHtml(theme.gate)} · <strong>sources:</strong> ${escapeHtml(theme.sources.join(", ") || "—")}</p>
    ${renderParagraph("summary", theme.summary)}
    ${renderParagraph("talent_potential", theme.talent_potential)}
    ${renderParagraph("risk_pattern", theme.risk_pattern)}
    <h5>what_to_check</h5>
    ${renderChecksTable(theme.what_to_check)}
  </article>`;
}

function renderSpecialPayload(layer: CareerReadingLayerReportV1): string {
  const payload = layer.special_payload;
  if (!payload) return "";

  const parts: string[] = [];
  const channels = payload.channel_talents ?? [];
  if (channels.length > 0) {
    parts.push(
      `<section class="sub"><h3>Special payload · channel_talents (${channels.length})</h3>
      ${channels.map((c, i) => renderChannelTalent(c, i)).join("")}</section>`,
    );
  }

  const zones = payload.center_zones ?? [];
  if (zones.length > 0) {
    parts.push(
      `<section class="sub"><h3>Special payload · center_zones (${zones.length})</h3>
      ${zones.map((z, i) => renderCenterZone(z, i)).join("")}</section>`,
    );
  }

  const themes = payload.repeated_gate_themes ?? [];
  if (themes.length > 0) {
    parts.push(
      `<section class="sub"><h3>Special payload · repeated_gate_themes (${themes.length})</h3>
      ${themes.map((t, i) => renderRepeatedGateTheme(t, i)).join("")}</section>`,
    );
  }

  if (typeof payload.channels_count === "number") {
    parts.push(`<p><strong>channels_count:</strong> ${payload.channels_count}</p>`);
  }

  return parts.join("\n");
}

function renderPro(pro: CareerReadingLayerReportV1["pro"]): string {
  const sources = Array.isArray(pro.classical_sources) ? pro.classical_sources : [];
  const sourceRows = sources
    .map(
      (s) => `<tr>
        <td>${escapeHtml(s.source_label)}</td>
        <td>${escapeHtml(s.source_key)}</td>
        <td>${escapeHtml(s.raw_path)}</td>
        <td>${escapeHtml(s.value_summary)}</td>
        <td>${escapeHtml(s.confidence)}</td>
      </tr>`,
    )
    .join("");

  const sourceValuesJson = escapeHtml(
    JSON.stringify(pro.source_values ?? {}, null, 2),
  );

  return `<section class="sub">
    <h3>Pro</h3>
    ${renderParagraph("technical_title", pro.technical_title)}
    <h4>classical_sources</h4>
    ${
      sourceRows
        ? `<table class="data-table"><thead><tr>
            <th>source_label</th><th>source_key</th><th>raw_path</th><th>value_summary</th><th>confidence</th>
          </tr></thead><tbody>${sourceRows}</tbody></table>`
        : `<p class="muted">—</p>`
    }
    <h4>source_values</h4>
    <pre class="json">${sourceValuesJson}</pre>
    ${renderParagraph("connection_logic", pro.connection_logic)}
    <p><strong>confidence:</strong> ${escapeHtml(pro.confidence)}</p>
    <h4>limitations</h4>
    ${renderStringList(pro.limitations)}
    ${renderParagraph("human_check", pro.human_check)}
  </section>`;
}

function renderLayer(layer: CareerReadingLayerReportV1, index: number): string {
  const base = layer.base;
  const synthesis = layer.summary_for_synthesis;
  const matching = layer.matching_summary;

  return `<section class="layer" id="layer-${escapeHtml(layer.layer_key)}">
    <header class="layer-header">
      <h2>Слой ${index + 1}. ${escapeHtml(layer.title)}</h2>
      <p class="layer-meta"><code>${escapeHtml(layer.layer_key)}</code> · status: ${escapeHtml(layer.status)} · ui_priority: ${layer.ui_priority}</p>
    </header>

    <section class="sub">
      <h3>Base</h3>
      ${renderParagraph("headline", base.headline)}
      ${renderParagraph("short_summary", base.short_summary)}
      ${renderParagraph("detailed_explanation", base.detailed_explanation)}
      ${renderParagraph("how_it_appears_at_work", base.how_it_appears_at_work)}
      <h4>where_useful</h4>
      ${renderStringList(base.where_useful)}
      <h4>strengths</h4>
      ${renderPoints(base.strengths)}
      <h4>risks</h4>
      ${renderRisks(base.risks)}
      <h4>management_tips</h4>
      ${renderStringList(base.management_tips)}
      <h4>what_to_check</h4>
      ${renderChecksTable(base.what_to_check)}
      <h4>sections</h4>
      ${renderSections(base.sections)}
    </section>

    ${renderSpecialPayload(layer)}

    ${renderPro(layer.pro)}
    ${renderEvidenceBlock(layer.evidence)}

    <section class="sub">
      <h3>summary_for_synthesis</h3>
      ${renderParagraph("one_sentence", synthesis.one_sentence)}
      <h4>strengths</h4>${renderStringList(synthesis.strengths)}
      <h4>risks</h4>${renderStringList(synthesis.risks)}
      <h4>conditions</h4>${renderStringList(synthesis.conditions)}
      <h4>management_focus</h4>${renderStringList(synthesis.management_focus)}
      <h4>what_to_check</h4>${renderStringList(synthesis.what_to_check)}
    </section>

    <section class="sub">
      <h3>matching_summary</h3>
      <h4>good_for</h4>${renderStringList(matching.good_for)}
      <h4>bad_for</h4>${renderStringList(matching.bad_for)}
      <h4>role_fit_positive_signals</h4>${renderStringList(matching.role_fit_positive_signals)}
      <h4>role_fit_risk_signals</h4>${renderStringList(matching.role_fit_risk_signals)}
      <h4>check_in_role_fit</h4>${renderStringList(matching.check_in_role_fit)}
    </section>
  </section>`;
}

function sortLayers(layers: CareerReadingLayerReportV1[]): CareerReadingLayerReportV1[] {
  const byKey = new Map(layers.map((layer) => [layer.layer_key, layer]));
  const ordered = CAREER_READING_LAYER_KEYS_V1.map((key) => byKey.get(key)).filter(
    (layer): layer is CareerReadingLayerReportV1 => layer != null,
  );
  const knownKeys = new Set<string>(CAREER_READING_LAYER_KEYS_V1);
  const extra = layers.filter((layer) => !knownKeys.has(layer.layer_key));
  return [...ordered, ...extra];
}

const REPORT_CSS = `
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 24px 20px 48px;
    font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    font-size: 15px;
    line-height: 1.55;
    color: #1a1a1a;
    background: #f6f7f9;
  }
  .wrap { max-width: 960px; margin: 0 auto; background: #fff; padding: 28px 32px 40px; border-radius: 12px; box-shadow: 0 2px 12px rgba(0,0,0,.06); }
  h1 { font-size: 1.65rem; margin: 0 0 8px; }
  h2 { font-size: 1.35rem; margin: 28px 0 8px; border-bottom: 2px solid #e8eaef; padding-bottom: 6px; }
  h3 { font-size: 1.1rem; margin: 20px 0 8px; color: #2d3748; }
  h4 { font-size: 1rem; margin: 14px 0 6px; }
  h5 { font-size: .92rem; margin: 10px 0 4px; }
  p { margin: 6px 0; }
  ul { margin: 6px 0 12px; padding-left: 1.25rem; }
  .muted { color: #6b7280; }
  .disclaimer {
    margin: 16px 0 20px;
    padding: 12px 14px;
    background: #fff8e6;
    border: 1px solid #f0d78c;
    border-radius: 8px;
    font-size: .92rem;
  }
  .meta-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 8px 16px;
    margin: 12px 0 20px;
    font-size: .9rem;
  }
  .meta-grid dt { font-weight: 600; color: #4b5563; }
  .meta-grid dd { margin: 0 0 8px; }
  .layer { margin-top: 36px; padding-top: 8px; border-top: 3px solid #dbeafe; }
  .layer-header { margin-bottom: 12px; }
  .layer-meta { color: #6b7280; font-size: .88rem; }
  .sub { margin: 12px 0; }
  .card {
    margin: 10px 0;
    padding: 12px 14px;
    background: #f9fafb;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
  }
  .card--risk { border-left: 4px solid #f59e0b; }
  .card--channel { border-left: 4px solid #3b82f6; }
  .card--center { border-left: 4px solid #10b981; }
  .card--theme { border-left: 4px solid #8b5cf6; }
  table.data-table, table.meta-table {
    width: 100%;
    border-collapse: collapse;
    margin: 8px 0 14px;
    font-size: .88rem;
  }
  table.data-table th, table.data-table td,
  table.meta-table th, table.meta-table td {
    border: 1px solid #e5e7eb;
    padding: 6px 8px;
    text-align: left;
    vertical-align: top;
  }
  table.data-table th, table.meta-table th { background: #f3f4f6; font-weight: 600; }
  pre.json {
    margin: 8px 0 14px;
    padding: 12px;
    background: #1e293b;
    color: #e2e8f0;
    border-radius: 8px;
    overflow-x: auto;
    font-size: .78rem;
    line-height: 1.45;
    white-space: pre-wrap;
    word-break: break-word;
  }
  details.raw-debug { margin-top: 40px; }
  details.raw-debug summary { cursor: pointer; font-weight: 600; }
  .toc { margin: 16px 0 24px; padding: 12px 16px; background: #f0f9ff; border-radius: 8px; }
  .toc ol { margin: 8px 0 0; }
`;

export function buildCareerReadingHtmlReport(args: {
  content: unknown;
  candidateName?: string | null;
  generatedAt?: string | null;
  reportStatus?: string | null;
}): string {
  const root = parseCareerReadingTalentMapV3(args.content);
  if (!root) {
    throw new Error("content_json is not a career reading v3 report");
  }

  const layers = sortLayers(getCareerReadingLayers(root));
  const meta = readGenerationMeta(root);
  const candidateName = asString(args.candidateName) || "Кандидат";
  const generatedLabel = formatDisplayDate(args.generatedAt);
  const reportStatus = asString(args.reportStatus) || "—";

  const toc = layers
    .map(
      (layer, i) =>
        `<li><a href="#layer-${escapeHtml(layer.layer_key)}">${i + 1}. ${escapeHtml(layer.title)}</a></li>`,
    )
    .join("");

  const layerHtml = layers.map((layer, i) => renderLayer(layer, i)).join("\n");

  const rawJson = escapeHtml(JSON.stringify(root, null, 2));

  return `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>TalentScan — ${escapeHtml(candidateName)} — Career Reading Report</title>
  <style>${REPORT_CSS}</style>
</head>
<body>
  <div class="wrap">
    <h1>TalentScan — Карта талантов кандидата</h1>
    <p><strong>${escapeHtml(candidateName)}</strong></p>
    <dl class="meta-grid">
      <dt>Дата генерации</dt><dd>${escapeHtml(generatedLabel)}</dd>
      <dt>schema_version</dt><dd>${escapeHtml(meta.schema_version)}</dd>
      <dt>generation_mode</dt><dd>${escapeHtml(meta.generation_mode)}</dd>
      <dt>career_reading_layers_version</dt><dd>${escapeHtml(meta.career_reading_layers_version)}</dd>
      <dt>model</dt><dd>${escapeHtml(meta.model) || "—"}</dd>
      <dt>prompt_version</dt><dd>${escapeHtml(meta.prompt_version) || "—"}</dd>
      <dt>report_status</dt><dd>${escapeHtml(reportStatus)}</dd>
      <dt>Слоёв в отчёте</dt><dd>${layers.length}</dd>
    </dl>
    <p class="disclaimer">Это общая карта кандидата. Она не является оценкой под конкретную вакансию и не принимает решение о найме.</p>

    <nav class="toc" aria-label="Содержание">
      <strong>8 Career Reading Layers</strong>
      <ol>${toc}</ol>
    </nav>

    ${layerHtml}

    <details class="raw-debug">
      <summary>Raw content_json для отладки</summary>
      <pre class="json">${rawJson}</pre>
    </details>
  </div>
</body>
</html>`;
}

export function downloadCareerReadingHtmlReport(args: {
  content: unknown;
  candidateName?: string | null;
  generatedAt?: string | null;
  reportStatus?: string | null;
}): void {
  const html = buildCareerReadingHtmlReport(args);
  const slug = slugifyCandidateName(args.candidateName);
  const date = formatExportDate(args.generatedAt);
  const filename = `talentscan_${slug}_career_reading_report_${date}.html`;

  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
