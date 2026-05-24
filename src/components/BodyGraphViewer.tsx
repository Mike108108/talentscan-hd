import type { JSX } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type NormalizedChart = {
  type?: string;
  profile?: string;
  strategy?: string;
  authority?: string;
  incarnationCross?: string;
  definition?: string;
  signature?: string;
  notSelfTheme?: string;

  definedCenters?: string[];
  openCenters?: string[];

  channelsShort?: string[];
  channelsLong?: string[];

  gatesAll?: string[];
  gatesPersonality?: string[];
  gatesDesign?: string[];
  gatesBoth?: string[];

  gateSources?: Record<string, string[]>;

  activations?: {
    design?: Record<string, string>;
    personality?: Record<string, string>;
  };

  variables?: unknown;
  cognition?: string;
  determination?: string;
  motivation?: string;
  transference?: string;
  perspective?: string;
  distraction?: string;
  environment?: string;
  circuitries?: unknown;

  birthDateUtc?: string;
  canRenderBodygraph?: boolean;
  missingForBodygraph?: string[];
};

export type HdChartRecord = {
  id: string;
  user_id: string;
  birth_date: string;
  birth_time: string;
  birth_time_accuracy: string | null;
  birth_place_label: string;
  birth_latitude: number;
  birth_longitude: number;
  type: string | null;
  profile: string | null;
  strategy: string | null;
  authority: string | null;
  incarnation_cross: string | null;
  definition: string | null;
  signature: string | null;
  not_self_theme: string | null;
  defined_centers: string[];
  open_centers: string[];
  channels_short: string[];
  channels_long: string[];
  gates_all: string[];
  gates_personality: string[];
  gates_design: string[];
  gates_both: string[];
  can_render_bodygraph: boolean;
  is_active: boolean;
  calculated_at: string;
  calculation_status: string;
  calculation_error: string | null;
  input_hash: string;
  provider: string | null;
  normalizer_version: string | null;
  normalized_chart_json: NormalizedChart | null;
  activations: { design?: Record<string, string>; personality?: Record<string, string> } | null;
  raw_chart_json?: unknown;
};

export type HdChartStatus = "none" | "ok" | "outdated" | "no_coords" | "error";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CENTER_LABELS: Record<string, string> = {
  Head: "Голова",
  Ajna: "Аджна",
  Throat: "Горло",
  G: "G-центр",
  Ego: "Эго",
  Sacral: "Сакраль",
  "Solar Plexus": "Солнечное сплетение",
  Spleen: "Селезёнка",
  Root: "Корень",
};

const CENTER_SUBLABELS: Record<string, string> = {
  Head: "Вдохновение",
  Ajna: "Мышление",
  Throat: "Голос",
  G: "Направление",
  Ego: "Воля",
  Sacral: "Энергия",
  "Solar Plexus": "Эмоции",
  Spleen: "Инстинкт",
  Root: "Давление",
};

// SVG positions for 9 centers (cx, cy)
const CENTER_POS: Record<string, [number, number]> = {
  Head: [160, 36],
  Ajna: [160, 100],
  Throat: [160, 165],
  G: [115, 228],
  Ego: [218, 202],
  Sacral: [115, 298],
  "Solar Plexus": [218, 272],
  Spleen: [50, 260],
  Root: [115, 368],
};

// All possible center-to-center connections (from CHANNEL_CENTER_MAP collapsed to unique pairs)
const CENTER_CONNECTIONS: Array<[string, string]> = [
  ["Head", "Ajna"],
  ["Ajna", "Throat"],
  ["Throat", "Spleen"],
  ["Throat", "Sacral"],
  ["Throat", "Ego"],
  ["Throat", "Solar Plexus"],
  ["Throat", "G"],
  ["G", "Ego"],
  ["G", "Spleen"],
  ["G", "Sacral"],
  ["Ego", "Solar Plexus"],
  ["Ego", "Spleen"],
  ["Sacral", "Solar Plexus"],
  ["Sacral", "Spleen"],
  ["Sacral", "Root"],
  ["Root", "Solar Plexus"],
  ["Root", "Spleen"],
];

const CHANNEL_CENTER_MAP: Record<string, [string, string]> = {
  "64-47": ["Head", "Ajna"],
  "61-24": ["Head", "Ajna"],
  "63-4": ["Head", "Ajna"],
  "17-62": ["Ajna", "Throat"],
  "43-23": ["Ajna", "Throat"],
  "11-56": ["Ajna", "Throat"],
  "16-48": ["Throat", "Spleen"],
  "20-57": ["Throat", "Spleen"],
  "20-34": ["Throat", "Sacral"],
  "45-21": ["Throat", "Ego"],
  "12-22": ["Throat", "Solar Plexus"],
  "35-36": ["Throat", "Solar Plexus"],
  "31-7": ["Throat", "G"],
  "8-1": ["Throat", "G"],
  "33-13": ["Throat", "G"],
  "10-20": ["Throat", "G"],
  "25-51": ["G", "Ego"],
  "10-57": ["G", "Spleen"],
  "10-34": ["G", "Sacral"],
  "2-14": ["G", "Sacral"],
  "5-15": ["G", "Sacral"],
  "29-46": ["G", "Sacral"],
  "40-37": ["Ego", "Solar Plexus"],
  "26-44": ["Ego", "Spleen"],
  "59-6": ["Sacral", "Solar Plexus"],
  "27-50": ["Sacral", "Spleen"],
  "34-57": ["Sacral", "Spleen"],
  "3-60": ["Sacral", "Root"],
  "42-53": ["Sacral", "Root"],
  "9-52": ["Sacral", "Root"],
  "19-49": ["Root", "Solar Plexus"],
  "39-55": ["Root", "Solar Plexus"],
  "41-30": ["Root", "Solar Plexus"],
  "18-58": ["Root", "Spleen"],
  "28-38": ["Root", "Spleen"],
  "32-54": ["Root", "Spleen"],
};

const PLANET_LABELS: Record<string, string> = {
  sun: "☉ Солнце",
  earth: "⊕ Земля",
  moon: "☽ Луна",
  northNode: "☊ Сев. Узел",
  southNode: "☋ Юж. Узел",
  mercury: "☿ Меркурий",
  venus: "♀ Венера",
  mars: "♂ Марс",
  jupiter: "♃ Юпитер",
  saturn: "♄ Сатурн",
  uranus: "⛢ Уран",
  neptune: "♆ Нептун",
  pluto: "♇ Плутон",
  chiron: "⚷ Хирон",
};

// ---------------------------------------------------------------------------
// Helper: build NormalizedChart from chart record
// ---------------------------------------------------------------------------

export function getNormalizedChart(chart: HdChartRecord): NormalizedChart | null {
  // Primary path: use normalized_chart_json
  if (
    chart.normalized_chart_json &&
    typeof chart.normalized_chart_json === "object" &&
    !Array.isArray(chart.normalized_chart_json)
  ) {
    return chart.normalized_chart_json as NormalizedChart;
  }

  // Fallback: build from quick fields if at least type is present
  const hasQuickFields =
    chart.type ||
    (Array.isArray(chart.defined_centers) && chart.defined_centers.length > 0);

  if (!hasQuickFields) return null;

  const fallback: NormalizedChart = {
    type: chart.type ?? undefined,
    profile: chart.profile ?? undefined,
    strategy: chart.strategy ?? undefined,
    authority: chart.authority ?? undefined,
    incarnationCross: chart.incarnation_cross ?? undefined,
    definition: chart.definition ?? undefined,
    signature: chart.signature ?? undefined,
    notSelfTheme: chart.not_self_theme ?? undefined,
    definedCenters: Array.isArray(chart.defined_centers) ? chart.defined_centers : [],
    openCenters: Array.isArray(chart.open_centers) ? chart.open_centers : [],
    channelsShort: Array.isArray(chart.channels_short) ? chart.channels_short : [],
    channelsLong: Array.isArray(chart.channels_long) ? chart.channels_long : [],
    gatesAll: Array.isArray(chart.gates_all) ? chart.gates_all : [],
    gatesPersonality: Array.isArray(chart.gates_personality) ? chart.gates_personality : [],
    gatesDesign: Array.isArray(chart.gates_design) ? chart.gates_design : [],
    gatesBoth: Array.isArray(chart.gates_both) ? chart.gates_both : [],
    activations: chart.activations ?? undefined,
    canRenderBodygraph: chart.can_render_bodygraph,
  };

  return fallback;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function LoadingState(): JSX.Element {
  return (
    <div className="bodygraph-empty">
      <div className="bodygraph-empty-icon">🔮</div>
      <p className="bodygraph-empty-title">Загружаем карту…</p>
    </div>
  );
}

function NoChartState({ onGoToData }: { onGoToData: () => void }): JSX.Element {
  return (
    <div className="bodygraph-empty">
      <div className="bodygraph-empty-icon">🔮</div>
      <p className="bodygraph-empty-title">Карта ещё не рассчитана</p>
      <p className="bodygraph-empty-sub">
        Заполните дату, время и место рождения во вкладке «Данные» и нажмите «Рассчитать мою карту».
      </p>
      <button className="bodygraph-action-btn" onClick={onGoToData}>
        Перейти в Данные →
      </button>
    </div>
  );
}

function NoCoordsState({ onGoToData }: { onGoToData: () => void }): JSX.Element {
  return (
    <div className="bodygraph-empty">
      <div className="bodygraph-empty-icon">📍</div>
      <p className="bodygraph-empty-title">Город рождения не выбран</p>
      <p className="bodygraph-empty-sub">
        Сначала выберите город рождения из подсказки автодополнения.
      </p>
      <button className="bodygraph-action-btn" onClick={onGoToData}>
        Перейти в Данные →
      </button>
    </div>
  );
}

function ErrorState({
  chart,
  onGoToData,
}: {
  chart: HdChartRecord;
  onGoToData: () => void;
}): JSX.Element {
  return (
    <div className="bodygraph-empty bodygraph-empty--error">
      <div className="bodygraph-empty-icon">⚠️</div>
      <p className="bodygraph-empty-title">Не удалось рассчитать карту</p>
      {chart.calculation_error && (
        <p className="bodygraph-empty-sub">{chart.calculation_error}</p>
      )}
      <button className="bodygraph-action-btn" onClick={onGoToData}>
        Перейти в Данные →
      </button>
    </div>
  );
}

function OutdatedWarning({
  onGoToData,
  onRecalculate,
  recalculating,
}: {
  onGoToData: () => void;
  onRecalculate?: () => void;
  recalculating?: boolean;
}): JSX.Element {
  return (
    <div className="bodygraph-warning">
      <span className="bodygraph-warning-icon">⚠️</span>
      <span className="bodygraph-warning-text">
        Данные рождения изменились — карту нужно пересчитать
      </span>
      <div className="bodygraph-warning-actions">
        {onRecalculate ? (
          <button
            className="bodygraph-action-btn bodygraph-action-btn--sm"
            onClick={onRecalculate}
            disabled={recalculating}
          >
            {recalculating ? "Пересчитываем…" : "Пересчитать →"}
          </button>
        ) : (
          <button
            className="bodygraph-action-btn bodygraph-action-btn--sm"
            onClick={onGoToData}
          >
            Пересчитать в Данных →
          </button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SVG Bodygraph
// ---------------------------------------------------------------------------

function BodygraphSVG({
  normalizedChart,
}: {
  normalizedChart: NormalizedChart;
}): JSX.Element {
  const definedCenters = new Set(normalizedChart.definedCenters ?? []);
  const activeChannels = new Set(normalizedChart.channelsShort ?? []);

  // Determine which center pairs have active channels
  const activeConnections = new Set<string>();
  for (const ch of activeChannels) {
    const mapped = CHANNEL_CENTER_MAP[ch];
    if (mapped) {
      const key = [mapped[0], mapped[1]].sort().join("|");
      activeConnections.add(key);
    }
  }

  const connectionKey = (a: string, b: string) => [a, b].sort().join("|");

  return (
    <svg
      className="bodygraph-svg"
      viewBox="0 0 320 420"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Схема центров Human Design"
      role="img"
    >
      {/* Inactive channel lines (background) */}
      {CENTER_CONNECTIONS.map(([a, b]) => {
        const posA = CENTER_POS[a];
        const posB = CENTER_POS[b];
        if (!posA || !posB) return null;
        const key = connectionKey(a, b);
        const isActive = activeConnections.has(key);
        if (isActive) return null;
        return (
          <line
            key={`line-bg-${a}-${b}`}
            x1={posA[0]}
            y1={posA[1]}
            x2={posB[0]}
            y2={posB[1]}
            className="bodygraph-channel"
          />
        );
      })}

      {/* Active channel lines (foreground) */}
      {CENTER_CONNECTIONS.map(([a, b]) => {
        const posA = CENTER_POS[a];
        const posB = CENTER_POS[b];
        if (!posA || !posB) return null;
        const key = connectionKey(a, b);
        const isActive = activeConnections.has(key);
        if (!isActive) return null;
        return (
          <line
            key={`line-active-${a}-${b}`}
            x1={posA[0]}
            y1={posA[1]}
            x2={posB[0]}
            y2={posB[1]}
            className="bodygraph-channel bodygraph-channel--active"
          />
        );
      })}

      {/* Center circles */}
      {Object.entries(CENTER_POS).map(([name, [cx, cy]]) => {
        const isDefined = definedCenters.has(name);
        return (
          <g key={name} className="bodygraph-center-group">
            <circle
              cx={cx}
              cy={cy}
              r={26}
              className={`bodygraph-center ${isDefined ? "bodygraph-center--defined" : "bodygraph-center--open"}`}
            />
            <text
              x={cx}
              y={cy - 4}
              textAnchor="middle"
              dominantBaseline="middle"
              className="bodygraph-center-name"
            >
              {name === "Solar Plexus" ? "SP" : name}
            </text>
            <text
              x={cx}
              y={cy + 10}
              textAnchor="middle"
              dominantBaseline="middle"
              className="bodygraph-center-sublabel"
            >
              {CENTER_SUBLABELS[name]}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Summary grid
// ---------------------------------------------------------------------------

function SummaryGrid({ nc }: { nc: NormalizedChart }): JSX.Element {
  const items = [
    { label: "Тип", value: nc.type },
    { label: "Профиль", value: nc.profile },
    { label: "Стратегия", value: nc.strategy },
    { label: "Авторитет", value: nc.authority },
    { label: "Определение", value: nc.definition },
    { label: "Крест", value: nc.incarnationCross },
    { label: "Сигнатура", value: nc.signature },
    { label: "Не-я тема", value: nc.notSelfTheme },
  ].filter((item) => item.value && item.value !== "—");

  if (items.length === 0) return <></>;

  return (
    <div className="bodygraph-summary-grid">
      {items.map(({ label, value }) => (
        <div key={label} className="bodygraph-summary-card">
          <span className="bodygraph-summary-label">{label}</span>
          <span className="bodygraph-summary-value">{value}</span>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Centers section
// ---------------------------------------------------------------------------

function CentersSection({ nc }: { nc: NormalizedChart }): JSX.Element | null {
  const defined = nc.definedCenters ?? [];
  const open = nc.openCenters ?? [];
  if (defined.length === 0 && open.length === 0) return null;

  return (
    <div className="bodygraph-mobile-section">
      <h3 className="bodygraph-section-title">Центры</h3>
      {defined.length > 0 && (
        <div className="bodygraph-centers-group">
          <p className="bodygraph-centers-sublabel">Определённые ({defined.length})</p>
          <div className="bodygraph-chip-list">
            {defined.map((c) => (
              <span key={c} className="bodygraph-chip bodygraph-chip--defined">
                {CENTER_LABELS[c] ?? c}
              </span>
            ))}
          </div>
        </div>
      )}
      {open.length > 0 && (
        <div className="bodygraph-centers-group">
          <p className="bodygraph-centers-sublabel">Открытые ({open.length})</p>
          <div className="bodygraph-chip-list">
            {open.map((c) => (
              <span key={c} className="bodygraph-chip bodygraph-chip--open">
                {CENTER_LABELS[c] ?? c}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Channels section
// ---------------------------------------------------------------------------

function ChannelsSection({ nc }: { nc: NormalizedChart }): JSX.Element | null {
  const short = nc.channelsShort ?? [];
  const long = nc.channelsLong ?? [];

  if (short.length === 0 && long.length === 0) return null;

  // Build display list: prefer long names if available
  const displayChannels: string[] = [];
  if (long.length > 0) {
    displayChannels.push(...long);
  } else {
    displayChannels.push(...short);
  }

  return (
    <div className="bodygraph-mobile-section">
      <h3 className="bodygraph-section-title">
        Каналы ({short.length})
      </h3>
      <ul className="bodygraph-channel-list">
        {displayChannels.map((ch, i) => (
          <li key={i} className="bodygraph-channel-item">
            {ch}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Gates section
// ---------------------------------------------------------------------------

function GatesSection({ nc }: { nc: NormalizedChart }): JSX.Element | null {
  const all = nc.gatesAll ?? [];
  const personality = nc.gatesPersonality ?? [];
  const design = nc.gatesDesign ?? [];
  const both = nc.gatesBoth ?? [];

  if (all.length === 0) return null;

  return (
    <div className="bodygraph-mobile-section">
      <h3 className="bodygraph-section-title">Ворота ({all.length})</h3>

      <div className="bodygraph-gates-tabs">
        <div className="bodygraph-gates-group">
          <p className="bodygraph-centers-sublabel">Все активные</p>
          <div className="bodygraph-chip-list">
            {all.map((g) => {
              const isPersonality = personality.includes(g);
              const isDesign = design.includes(g);
              const isBoth = both.includes(g);
              let chipClass = "bodygraph-chip";
              if (isBoth) chipClass += " bodygraph-chip--gate-both";
              else if (isPersonality) chipClass += " bodygraph-chip--gate-personality";
              else if (isDesign) chipClass += " bodygraph-chip--gate-design";
              else chipClass += " bodygraph-chip--gate";
              return (
                <span key={g} className={chipClass} title={
                  isBoth ? "Личность + Дизайн" :
                  isPersonality ? "Личность" :
                  isDesign ? "Дизайн" : ""
                }>
                  {g}
                </span>
              );
            })}
          </div>
        </div>

        <div className="bodygraph-gates-legend">
          <span className="bodygraph-chip bodygraph-chip--gate-personality">Личность</span>
          <span className="bodygraph-chip bodygraph-chip--gate-design">Дизайн</span>
          {both.length > 0 && (
            <span className="bodygraph-chip bodygraph-chip--gate-both">Оба слоя</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Activations section
// ---------------------------------------------------------------------------

function ActivationsSection({ nc }: { nc: NormalizedChart }): JSX.Element | null {
  const act = nc.activations;
  const designMap = act?.design;
  const personalityMap = act?.personality;

  const hasPers = personalityMap && Object.keys(personalityMap).length > 0;
  const hasDesign = designMap && Object.keys(designMap).length > 0;

  if (!hasPers && !hasDesign) return null;

  const planetOrder = [
    "sun", "earth", "moon", "northNode", "southNode",
    "mercury", "venus", "mars", "jupiter", "saturn",
    "uranus", "neptune", "pluto", "chiron",
  ];

  function sortedEntries(map: Record<string, string>): Array<[string, string]> {
    const ordered: Array<[string, string]> = [];
    for (const p of planetOrder) {
      if (map[p] !== undefined) ordered.push([p, map[p]]);
    }
    // Any remaining keys not in planetOrder
    for (const [k, v] of Object.entries(map)) {
      if (!planetOrder.includes(k)) ordered.push([k, v]);
    }
    return ordered;
  }

  return (
    <div className="bodygraph-mobile-section">
      <h3 className="bodygraph-section-title">Планетарные активации</h3>
      <div className="bodygraph-activations-grid">
        {hasPers && (
          <div className="bodygraph-activation-col">
            <p className="bodygraph-activation-heading">Личность (сознательная)</p>
            <div className="bodygraph-activation-rows">
              {sortedEntries(personalityMap!).map(([planet, value]) => (
                <div key={`p-${planet}`} className="bodygraph-activation-row">
                  <span className="bodygraph-activation-planet">
                    {PLANET_LABELS[planet] ?? planet}
                  </span>
                  <span className="bodygraph-activation-value">{value}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {hasDesign && (
          <div className="bodygraph-activation-col">
            <p className="bodygraph-activation-heading">Дизайн (бессознательная)</p>
            <div className="bodygraph-activation-rows">
              {sortedEntries(designMap!).map(([planet, value]) => (
                <div key={`d-${planet}`} className="bodygraph-activation-row">
                  <span className="bodygraph-activation-planet">
                    {PLANET_LABELS[planet] ?? planet}
                  </span>
                  <span className="bodygraph-activation-value">{value}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

type BodyGraphViewerProps = {
  chart: HdChartRecord | null;
  status: HdChartStatus;
  loading: boolean;
  onGoToData: () => void;
  onRecalculate?: () => void;
  recalculating?: boolean;
};

export default function BodyGraphViewer({
  chart,
  status,
  loading,
  onGoToData,
  onRecalculate,
  recalculating,
}: BodyGraphViewerProps): JSX.Element {
  if (loading) {
    return (
      <div className="bodygraph-viewer">
        <LoadingState />
      </div>
    );
  }

  if (status === "none" || !chart) {
    return (
      <div className="bodygraph-viewer">
        <NoChartState onGoToData={onGoToData} />
      </div>
    );
  }

  if (status === "no_coords") {
    return (
      <div className="bodygraph-viewer">
        <NoCoordsState onGoToData={onGoToData} />
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="bodygraph-viewer">
        <ErrorState chart={chart} onGoToData={onGoToData} />
      </div>
    );
  }

  // Status is "ok" or "outdated" — try to render the chart
  const nc = getNormalizedChart(chart);

  if (!nc) {
    // No normalized data at all, show minimal fallback
    return (
      <div className="bodygraph-viewer">
        {status === "outdated" && (
          <OutdatedWarning
            onGoToData={onGoToData}
            onRecalculate={onRecalculate}
            recalculating={recalculating}
          />
        )}
        <div className="bodygraph-empty">
          <div className="bodygraph-empty-icon">🔮</div>
          <p className="bodygraph-empty-title">Данные карты недоступны</p>
          <p className="bodygraph-empty-sub">
            Карта была рассчитана, но данные для отображения не сохранились. Попробуйте пересчитать.
          </p>
          <button className="bodygraph-action-btn" onClick={onGoToData}>
            Перейти в Данные →
          </button>
        </div>
      </div>
    );
  }

  const calculatedAt = chart.calculated_at
    ? new Date(chart.calculated_at).toLocaleString("ru-RU", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : null;

  return (
    <div className="bodygraph-viewer">
      {/* Outdated warning (but we still show the old chart below) */}
      {status === "outdated" && (
        <OutdatedWarning
          onGoToData={onGoToData}
          onRecalculate={onRecalculate}
          recalculating={recalculating}
        />
      )}

      {/* Chart header */}
      <div className="bodygraph-header">
        <div className="bodygraph-header-info">
          <h2 className="bodygraph-title">
            {nc.type ? `${nc.type}${nc.profile ? ` · ${nc.profile}` : ""}` : "Human Design карта"}
          </h2>
          {calculatedAt && (
            <p className="bodygraph-calc-date">Рассчитана: {calculatedAt}</p>
          )}
        </div>
        {status === "outdated" && (
          <span className="bodygraph-stale-badge">Устаревшая</span>
        )}
      </div>

      {/* Main layout: SVG + summary */}
      <div className="bodygraph-layout">
        {/* SVG bodygraph */}
        <div className="bodygraph-visual-card">
          <BodygraphSVG normalizedChart={nc} />

          {/* Center legend inside visual card */}
          <div className="bodygraph-svg-legend">
            <span className="bodygraph-legend-item bodygraph-legend-item--defined">Определённый</span>
            <span className="bodygraph-legend-item bodygraph-legend-item--open">Открытый</span>
          </div>
        </div>

        {/* Summary cards */}
        <div className="bodygraph-summary-col">
          <SummaryGrid nc={nc} />
        </div>
      </div>

      {/* Detail sections */}
      <CentersSection nc={nc} />
      <ChannelsSection nc={nc} />
      <GatesSection nc={nc} />
      <ActivationsSection nc={nc} />
    </div>
  );
}
