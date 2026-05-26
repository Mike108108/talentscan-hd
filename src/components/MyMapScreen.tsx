import { useState, type JSX, type ReactNode } from "react";
import BodyGraphViewer from "./BodyGraphViewer";
import type { HdChartRecord, HdChartStatus } from "./BodyGraphViewer";
import type { AnalysisType } from "../lib/supabase";
import { getNormalizedChart } from "./BodyGraphViewer";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type MapTab =
  | "overview"
  | "talents"
  | "workStyle"
  | "workEnvironment"
  | "relationships"
  | "communication"
  | "energyBody"
  | "money"
  | "developmentPlan";

type MapLayer =
  | "bodygraph"
  | "centers"
  | "channels"
  | "activations"
  | "variables"
  | "shadows"
  | "gifts"
  | "trauma";

const MAP_LAYERS: { id: MapLayer; label: string }[] = [
  { id: "bodygraph", label: "Бодиграф" },
  { id: "centers", label: "Центры" },
  { id: "channels", label: "Каналы" },
  { id: "activations", label: "Активации" },
  { id: "variables", label: "Переменные" },
  { id: "shadows", label: "Тени" },
  { id: "gifts", label: "Дары" },
  { id: "trauma", label: "Травма" },
];

const PLANET_LABELS: Record<string, string> = {
  sun: "Солнце",
  earth: "Земля",
  moon: "Луна",
  northNode: "Северный узел",
  southNode: "Южный узел",
  mercury: "Меркурий",
  venus: "Венера",
  mars: "Марс",
  jupiter: "Юпитер",
  saturn: "Сатурн",
  uranus: "Уран",
  neptune: "Нептун",
  pluto: "Плутон",
  chiron: "Хирон",
};

const PLANET_ORDER = [
  "sun",
  "earth",
  "moon",
  "northNode",
  "southNode",
  "mercury",
  "venus",
  "mars",
  "jupiter",
  "saturn",
  "uranus",
  "neptune",
  "pluto",
  "chiron",
];

type ProfileInfo = {
  displayName: string;
  birthDate: string;
  birthTime: string;
  birthTimeAccuracy: string;
};

type MyMapScreenProps = {
  hdChart: HdChartRecord | null;
  hdChartStatus: HdChartStatus;
  hdChartLoading: boolean;
  hdChartCalculating: boolean;
  calculateHdChart: () => void;
  profile: ProfileInfo;
  profileCompleteness: { percent: number; label: string };
  onGoToData: () => void;
  onGoToNewReport: (type: AnalysisType) => void;
};

const MAP_NAV: { id: MapTab; label: string }[] = [
  { id: "overview", label: "Обзор" },
  { id: "talents", label: "Таланты" },
  { id: "workStyle", label: "Рабочий стиль" },
  { id: "workEnvironment", label: "Рабочая среда" },
  { id: "relationships", label: "Отношения" },
  { id: "communication", label: "Коммуникация" },
  { id: "energyBody", label: "Энергия и тело" },
  { id: "money", label: "Деньги" },
  { id: "developmentPlan", label: "План развития" },
];

function chartStatusPill(status: HdChartStatus): { text: string; ok: boolean } {
  switch (status) {
    case "ok":
      return { text: "Карта рассчитана", ok: true };
    case "outdated":
      return { text: "Карта устарела", ok: false };
    case "no_coords":
      return { text: "Нет координат", ok: false };
    case "error":
      return { text: "Ошибка расчёта", ok: false };
    default:
      return { text: "Карта не рассчитана", ok: false };
  }
}

function formatChartUpdatedAt(calculatedAt: string | undefined): string | null {
  if (!calculatedAt) return null;
  const d = new Date(calculatedAt);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
}

// ---------------------------------------------------------------------------
// Compact header + passport (cockpit chrome)
// ---------------------------------------------------------------------------

function CompactMapHeader({
  hdChartStatus,
  profileCompleteness,
  hdChart,
}: {
  hdChartStatus: HdChartStatus;
  profileCompleteness: { percent: number; label: string };
  hdChart: HdChartRecord | null;
}): JSX.Element {
  const chartPill = chartStatusPill(hdChartStatus);
  const updatedLabel = hdChart?.calculated_at
    ? formatChartUpdatedAt(hdChart.calculated_at)
    : null;

  return (
    <header className="my-map-compact-header">
      <div className="my-map-header-text">
        <h1 className="my-map-header-title">Моя карта</h1>
        <p className="my-map-header-sub">
          Постоянная основа: бодиграф, таланты, энергия, работа, отношения и личные рекомендации.
        </p>
      </div>
      <div className="my-map-header-pills" aria-label="Статус карты">
        <span className={`my-map-pill${chartPill.ok ? " my-map-pill--ok" : ""}`}>
          {chartPill.text}
        </span>
        <span className="my-map-pill my-map-pill--muted">
          Профиль {profileCompleteness.percent}%
        </span>
        {updatedLabel && (
          <span className="my-map-pill my-map-pill--muted">
            Обновлена: {updatedLabel}
          </span>
        )}
      </div>
    </header>
  );
}

function MapFeedTabs({
  active,
  onChange,
}: {
  active: MapTab;
  onChange: (tab: MapTab) => void;
}): JSX.Element {
  return (
    <div className="my-map-feed-tabs" role="tablist" aria-label="Разделы карты">
      {MAP_NAV.map((item) => (
        <button
          key={item.id}
          role="tab"
          aria-selected={active === item.id}
          className={`my-map-feed-tab${active === item.id ? " my-map-feed-tab--active" : ""}`}
          onClick={() => onChange(item.id)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Overview cockpit: browser-tabs (level 3) embedded in map card
// ---------------------------------------------------------------------------

function MapBrowserTabs({
  active,
  onChange,
}: {
  active: MapLayer;
  onChange: (layer: MapLayer) => void;
}): JSX.Element {
  return (
    <div className="my-map-browser-tabs" role="tablist" aria-label="Слои карты">
      {MAP_LAYERS.map((item) => (
        <button
          key={item.id}
          type="button"
          role="tab"
          aria-selected={active === item.id}
          className={`my-map-browser-tab${active === item.id ? " my-map-browser-tab--active" : ""}`}
          onClick={() => onChange(item.id)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

function LayerEmptyHint({ children }: { children: ReactNode }): JSX.Element {
  return <p className="my-map-layer-empty">{children}</p>;
}

function LayerSoonPanel({
  title,
  description,
}: {
  title: string;
  description: string;
}): JSX.Element {
  return (
    <div className="my-map-layer-soon">
      <span className="my-map-layer-soon-badge">скоро</span>
      <h3 className="my-map-layer-soon-title">{title}</h3>
      <p className="my-map-layer-soon-text">{description}</p>
    </div>
  );
}

function sortedActivationEntries(map: Record<string, string>): Array<[string, string]> {
  const ordered: Array<[string, string]> = [];
  for (const p of PLANET_ORDER) {
    if (map[p] !== undefined) ordered.push([p, map[p]]);
  }
  for (const [k, v] of Object.entries(map)) {
    if (!PLANET_ORDER.includes(k)) ordered.push([k, v]);
  }
  return ordered;
}

function MapLayerPanel({
  layer,
  hdChart,
  hdChartStatus,
  hdChartLoading,
  hdChartCalculating,
  calculateHdChart,
  onGoToData,
}: {
  layer: MapLayer;
  hdChart: HdChartRecord | null;
  hdChartStatus: HdChartStatus;
  hdChartLoading: boolean;
  hdChartCalculating: boolean;
  calculateHdChart: () => void;
  onGoToData: () => void;
}): JSX.Element {
  if (layer === "bodygraph") {
    return (
      <div className="my-map-browser-layer-inner my-map-layer-bodygraph">
        <BodyGraphViewer
          chart={hdChart}
          status={hdChartStatus}
          loading={hdChartLoading}
          onGoToData={onGoToData}
          onRecalculate={calculateHdChart}
          recalculating={hdChartCalculating}
        />
      </div>
    );
  }

  if (hdChartLoading) {
    return (
      <div className="my-map-browser-layer-inner">
        <LayerEmptyHint>Загрузка данных карты…</LayerEmptyHint>
      </div>
    );
  }

  const nc = hdChart ? getNormalizedChart(hdChart) : null;
  const hasChart = hdChartStatus === "ok" || hdChartStatus === "outdated";

  if (!hasChart || !nc) {
    return (
      <div className="my-map-browser-layer-inner">
        <LayerEmptyHint>
          {hdChartStatus === "none" || !hdChart
            ? "Рассчитайте HD-карту во вкладке «Данные», чтобы открыть этот слой."
            : hdChartStatus === "no_coords"
            ? "Укажите координаты места рождения для расчёта карты."
            : hdChartStatus === "error"
            ? "При расчёте возникла ошибка — проверьте данные и попробуйте снова."
            : "Данные слоя появятся после успешного расчёта карты."}
        </LayerEmptyHint>
      </div>
    );
  }

  if (layer === "centers") {
    const defined = nc.definedCenters ?? [];
    const open = nc.openCenters ?? [];
    if (defined.length === 0 && open.length === 0) {
      return (
        <div className="my-map-browser-layer-inner">
          <LayerEmptyHint>
            Список центров появится после расчёта карты с полными данными.
          </LayerEmptyHint>
        </div>
      );
    }
    return (
      <div className="my-map-browser-layer-inner">
        <h3 className="my-map-layer-heading">Центры</h3>
        {defined.length > 0 && (
          <div className="my-map-layer-block">
            <p className="my-map-layer-sublabel">Определённые ({defined.length})</p>
            <div className="my-map-layer-chiplist">
              {defined.map((c) => (
                <span key={c} className="my-map-layer-chip-tag my-map-layer-chip-tag--defined">
                  {c}
                </span>
              ))}
            </div>
          </div>
        )}
        {open.length > 0 && (
          <div className="my-map-layer-block">
            <p className="my-map-layer-sublabel">Открытые ({open.length})</p>
            <div className="my-map-layer-chiplist">
              {open.map((c) => (
                <span key={c} className="my-map-layer-chip-tag my-map-layer-chip-tag--open">
                  {c}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  if (layer === "channels") {
    const short = nc.channelsShort ?? [];
    const long = nc.channelsLong ?? [];
    const display = long.length > 0 ? long : short;
    if (display.length === 0) {
      return (
        <div className="my-map-browser-layer-inner">
          <LayerEmptyHint>Каналы появятся после расчёта карты с полными данными.</LayerEmptyHint>
        </div>
      );
    }
    return (
      <div className="my-map-browser-layer-inner">
        <h3 className="my-map-layer-heading">Каналы ({short.length || display.length})</h3>
        <ul className="my-map-layer-list">
          {display.map((ch, i) => (
            <li key={`${ch}-${i}`}>{ch}</li>
          ))}
        </ul>
      </div>
    );
  }

  if (layer === "activations") {
    const personality = nc.activations?.personality;
    const design = nc.activations?.design;
    const hasPers = personality && Object.keys(personality).length > 0;
    const hasDesign = design && Object.keys(design).length > 0;
    if (!hasPers && !hasDesign) {
      return (
        <div className="my-map-browser-layer-inner">
          <LayerEmptyHint>
            Планетарные активации появятся после расчёта карты с полными данными.
          </LayerEmptyHint>
        </div>
      );
    }
    return (
      <div className="my-map-browser-layer-inner">
        <h3 className="my-map-layer-heading">Активации</h3>
        {hasPers && (
          <div className="my-map-layer-block">
            <p className="my-map-layer-sublabel">Личность</p>
            <dl className="my-map-layer-activations">
              {sortedActivationEntries(personality!).map(([planet, value]) => (
                <div key={`p-${planet}`} className="my-map-layer-act-row">
                  <dt>{PLANET_LABELS[planet] ?? planet}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}
        {hasDesign && (
          <div className="my-map-layer-block">
            <p className="my-map-layer-sublabel">Дизайн</p>
            <dl className="my-map-layer-activations">
              {sortedActivationEntries(design!).map(([planet, value]) => (
                <div key={`d-${planet}`} className="my-map-layer-act-row">
                  <dt>{PLANET_LABELS[planet] ?? planet}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}
      </div>
    );
  }

  if (layer === "variables") {
    const fields = [
      { label: "Когниция", value: nc.cognition },
      { label: "Определение (PHS)", value: nc.determination },
      { label: "Мотивация", value: nc.motivation },
      { label: "Трансферентность", value: nc.transference },
      { label: "Перспектива", value: nc.perspective },
      { label: "Отвлечение", value: nc.distraction },
      { label: "Среда", value: nc.environment },
    ].filter((f) => f.value && String(f.value).trim() !== "");

    const hasVariablesObject =
      nc.variables !== undefined &&
      nc.variables !== null &&
      typeof nc.variables === "object" &&
      !Array.isArray(nc.variables) &&
      Object.keys(nc.variables as object).length > 0;

    if (fields.length === 0 && !hasVariablesObject) {
      return (
        <div className="my-map-browser-layer-inner">
          <LayerSoonPanel
            title="Переменные"
            description="Слой переменных будет раскрыт после подключения расширенной интерпретации карты."
          />
        </div>
      );
    }
    return (
      <div className="my-map-browser-layer-inner">
        <h3 className="my-map-layer-heading">Переменные</h3>
        {fields.length > 0 && (
          <dl className="my-map-passport-rows">
            {fields.map(({ label, value }) => (
              <div key={label} className="my-map-passport-row">
                <dt className="my-map-passport-key">{label}</dt>
                <dd className="my-map-passport-val">{value}</dd>
              </div>
            ))}
          </dl>
        )}
        {hasVariablesObject && (
          <p className="my-map-layer-note">
            Расширенный блок переменных сохранён в карте — визуализация появится на следующем этапе.
          </p>
        )}
      </div>
    );
  }

  const soonCopy: Record<"shadows" | "gifts" | "trauma", { title: string; description: string }> = {
    shadows: {
      title: "Тени",
      description:
        "Слой будет подключён позже. Здесь появится расшифровка на основе Gene Keys / глубинных паттернов, когда будет готова смысловая база.",
    },
    gifts: {
      title: "Дары",
      description:
        "Слой будет подключён позже. Здесь появится расшифровка даров и устойчивых качеств, когда будет готова смысловая база.",
    },
    trauma: {
      title: "Травма",
      description:
        "Слой будет подключён позже. Здесь появится бережная расшифровка уязвимых паттернов, когда будет готова смысловая база.",
    },
  };

  const soon = soonCopy[layer as "shadows" | "gifts" | "trauma"];
  return (
    <div className="my-map-browser-layer-inner">
      <LayerSoonPanel title={soon.title} description={soon.description} />
    </div>
  );
}

function PassportSummary({
  hdChart,
  hdChartStatus,
}: {
  hdChart: HdChartRecord | null;
  hdChartStatus: HdChartStatus;
}): JSX.Element {
  const nc = hdChart ? getNormalizedChart(hdChart) : null;
  const hasChart = hdChartStatus === "ok" || hdChartStatus === "outdated";

  const rows: { label: string; value: string | null | undefined }[] = [
    { label: "Тип", value: nc?.type ?? hdChart?.type },
    { label: "Профиль", value: nc?.profile ?? hdChart?.profile },
    { label: "Стратегия", value: nc?.strategy ?? hdChart?.strategy },
    { label: "Авторитет", value: nc?.authority ?? hdChart?.authority },
    { label: "Определение", value: nc?.definition ?? hdChart?.definition },
    { label: "Крест", value: nc?.incarnationCross ?? hdChart?.incarnation_cross },
    { label: "Сигнатура", value: nc?.signature ?? hdChart?.signature },
    { label: "Не-я тема", value: nc?.notSelfTheme ?? hdChart?.not_self_theme },
  ];
  const filledRows = rows.filter((r) => r.value && r.value !== "—");

  return (
    <>
      {hasChart && filledRows.length > 0 ? (
        <dl className="my-map-passport-rows">
          {filledRows.map(({ label, value }) => (
            <div key={label} className="my-map-passport-row">
              <dt className="my-map-passport-key">{label}</dt>
              <dd className="my-map-passport-val">{value}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="my-map-passport-empty">
          {hdChartStatus === "none" || !hdChart
            ? "Рассчитайте HD-карту во вкладке «Данные», чтобы увидеть паспорт."
            : hdChartStatus === "no_coords"
            ? "Укажите координаты места рождения для расчёта карты."
            : hdChartStatus === "error"
            ? "При расчёте возникла ошибка — проверьте данные и попробуйте снова."
            : "Параметры карты появятся после успешного расчёта."}
        </p>
      )}
      <div className="my-map-passport-translation">
        <h3 className="my-map-passport-translation-title">Главный перевод</h3>
        <p className="my-map-passport-translation-text">
          Этот блок будет расширен персональной интерпретацией на следующих этапах.
        </p>
      </div>
    </>
  );
}

function DataQualityCard({
  hdChartStatus,
  profile,
  profileCompleteness,
  onGoToData,
}: {
  hdChartStatus: HdChartStatus;
  profile: ProfileInfo;
  profileCompleteness: { percent: number; label: string };
  onGoToData: () => void;
}): JSX.Element {
  return (
    <div className="my-map-data-quality my-map-overview-dq">
      <h3 className="my-map-data-quality-title">Точность данных</h3>
      <div className="my-map-data-quality-rows">
        <div className="my-map-dq-row">
          <span className="my-map-dq-label">Карта</span>
          <span className={`my-map-dq-value my-map-dq-value--${hdChartStatus}`}>
            {hdChartStatus === "ok"
              ? "Рассчитана"
              : hdChartStatus === "outdated"
              ? "Устарела"
              : hdChartStatus === "none"
              ? "Не рассчитана"
              : hdChartStatus === "no_coords"
              ? "Нет координат"
              : "Ошибка расчёта"}
          </span>
        </div>
        <div className="my-map-dq-row">
          <span className="my-map-dq-label">Анкета</span>
          <span className="my-map-dq-value">
            {profileCompleteness.percent}% — {profileCompleteness.label}
          </span>
        </div>
        <div className="my-map-dq-row">
          <span className="my-map-dq-label">Время рождения</span>
          <span className="my-map-dq-value">
            {profile.birthTimeAccuracy === "exact"
              ? "Точное"
              : profile.birthTimeAccuracy === "approximate"
              ? "Примерное"
              : profile.birthTimeAccuracy === "unknown"
              ? "Неизвестно"
              : profile.birthTime
              ? "Указано"
              : "Не указано"}
          </span>
        </div>
        {(hdChartStatus === "outdated" || hdChartStatus === "none") && (
          <div className="my-map-dq-row my-map-dq-row--action">
            <button type="button" className="my-map-dq-btn" onClick={onGoToData}>
              Перейти в Данные →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function OverviewCockpit({
  activeMapLayer,
  onLayerChange,
  hdChart,
  hdChartStatus,
  hdChartLoading,
  hdChartCalculating,
  calculateHdChart,
  profile,
  profileCompleteness,
  onGoToData,
}: {
  activeMapLayer: MapLayer;
  onLayerChange: (layer: MapLayer) => void;
  hdChart: HdChartRecord | null;
  hdChartStatus: HdChartStatus;
  hdChartLoading: boolean;
  hdChartCalculating: boolean;
  calculateHdChart: () => void;
  profile: ProfileInfo;
  profileCompleteness: { percent: number; label: string };
  onGoToData: () => void;
}): JSX.Element {
  return (
    <div className="my-map-cockpit my-map-overview-cockpit">
      <div className="my-map-browser-card">
        <MapBrowserTabs active={activeMapLayer} onChange={onLayerChange} />
        <div className="my-map-browser-body">
          <MapLayerPanel
            layer={activeMapLayer}
            hdChart={hdChart}
            hdChartStatus={hdChartStatus}
            hdChartLoading={hdChartLoading}
            hdChartCalculating={hdChartCalculating}
            calculateHdChart={calculateHdChart}
            onGoToData={onGoToData}
          />
        </div>
      </div>
      <aside className="my-map-overview-sidebar" aria-label="Паспорт карты">
        <div className="my-map-passport-card">
          <h2 className="my-map-passport-title">Паспорт карты</h2>
          <PassportSummary hdChart={hdChart} hdChartStatus={hdChartStatus} />
        </div>
        <DataQualityCard
          hdChartStatus={hdChartStatus}
          profile={profile}
          profileCompleteness={profileCompleteness}
          onGoToData={onGoToData}
        />
      </aside>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Standalone sphere screens (level 2, except Overview)
// ---------------------------------------------------------------------------

function SphereScreen({
  title,
  lead,
  children,
  actions,
}: {
  title: string;
  lead: string;
  children: ReactNode;
  actions?: ReactNode;
}): JSX.Element {
  return (
    <div className="my-map-sphere-screen" role="tabpanel">
      <header className="my-map-sphere-screen-header">
        <h2 className="my-map-sphere-screen-title">{title}</h2>
        <p className="my-map-sphere-screen-lead">{lead}</p>
      </header>
      <div className="my-map-sphere-screen-grid">{children}</div>
      {actions && <div className="my-map-sphere-screen-actions">{actions}</div>}
    </div>
  );
}

function SphereCard({ title, children }: { title: string; children: ReactNode }): JSX.Element {
  return (
    <div className="my-map-sphere-card">
      <h3 className="my-map-sphere-card-title">{title}</h3>
      <div className="my-map-sphere-card-body">{children}</div>
    </div>
  );
}

function chartFactsLine(hdChart: HdChartRecord | null): string {
  const nc = hdChart ? getNormalizedChart(hdChart) : null;
  if (!nc) return "Рассчитайте карту во вкладке «Данные» — здесь появятся параметры из ваших данных.";
  const parts: string[] = [];
  if (nc.type) parts.push(`тип ${nc.type}`);
  if (nc.profile) parts.push(`профиль ${nc.profile}`);
  if (nc.strategy) parts.push(`стратегия «${nc.strategy}»`);
  if (nc.authority) parts.push(`авторитет ${nc.authority}`);
  return parts.length > 0
    ? `Из карты уже доступно: ${parts.join(", ")}.`
    : "Параметры карты появятся после расчёта.";
}


function TabTalents({ hdChart }: { hdChart: HdChartRecord | null }): JSX.Element {
  const nc = hdChart ? getNormalizedChart(hdChart) : null;
  return (
    <SphereScreen
      title="Таланты"
      lead="Перевод карты в сильные стороны и устойчивые качества — без выдуманных формулировок."
    >
      <SphereCard title="Что здесь будет">
        <p className="my-map-sphere-text">
          Сборка талантов из ворот, каналов и устойчивых качеств вашей карты в понятный язык.
          {nc?.gatesAll?.length ? ` Сейчас в карте ${nc.gatesAll.length} активных ворот.` : ""}
        </p>
      </SphereCard>
      <SphereCard title="Как это использовать">
        <p className="my-map-sphere-text">
          Опирайтесь на «Обзор» и слои «Каналы» / «Центры» для структуры. Прикладные выводы появятся
          после подключения смысловой базы.
        </p>
      </SphereCard>
      <SphereCard title="Что нужно для точности">
        <p className="my-map-sphere-text">{chartFactsLine(hdChart)}</p>
      </SphereCard>
      <SphereCard title="Следующий шаг">
        <p className="my-map-sphere-text">
          Этот слой будет расширен на следующем этапе после подключения смысловой базы.
        </p>
      </SphereCard>
    </SphereScreen>
  );
}

function TabWorkStyle({
  hdChart,
  onGoToNewReport,
}: {
  hdChart: HdChartRecord | null;
  onGoToNewReport: (type: AnalysisType) => void;
}): JSX.Element {
  const nc = hdChart ? getNormalizedChart(hdChart) : null;
  return (
    <SphereScreen
      title="Рабочий стиль"
      lead="Как вы по постоянной карте устроены в работе: нагрузка, ритм и раскрытие в задачах."
      actions={
        <div className="my-map-cta-row">
          <button
            type="button"
            className="my-map-cta-btn my-map-cta-btn--sm"
            onClick={() => onGoToNewReport("vacancy_assessment")}
          >
            Оценить вакансию →
          </button>
          <button
            type="button"
            className="my-map-cta-btn my-map-cta-btn--secondary my-map-cta-btn--sm"
            onClick={() => onGoToNewReport("current_role")}
          >
            Разбор текущей роли →
          </button>
        </div>
      }
    >
      <SphereCard title="Как вы работаете">
        <p className="my-map-sphere-text">
          {nc?.type
            ? `Тип ${nc.type}${nc.strategy ? ` · стратегия «${nc.strategy}»` : ""}.`
            : chartFactsLine(hdChart)}
        </p>
      </SphereCard>
      <SphereCard title="Где раскрываетесь">
        <p className="my-map-sphere-text">
          {nc?.authority
            ? `Внутренний ориентир — авторитет ${nc.authority}.`
            : "Этот блок будет расширен на следующем этапе."}
        </p>
      </SphereCard>
      <SphereCard title="Где быстро устаёте">
        <p className="my-map-sphere-text">
          {nc?.notSelfTheme
            ? `Сигнал перегруза — не-я тема «${nc.notSelfTheme}».`
            : "Наблюдайте, когда работа идёт вопреки стратегии и авторитету."}
        </p>
      </SphereCard>
      <SphereCard title="Что проверить в роли">
        <p className="my-map-sphere-text">
          Соответствие роли вашему типу и ритму. Для вакансий и ролей — раздел «Карьера» в меню
          кабинета.
        </p>
      </SphereCard>
    </SphereScreen>
  );
}

function TabWorkEnvironment({ hdChart }: { hdChart: HdChartRecord | null }): JSX.Element {
  const nc = hdChart ? getNormalizedChart(hdChart) : null;
  return (
    <SphereScreen
      title="Рабочая среда"
      lead="Условия, ритм, формат команды и баланс давления и свободы."
    >
      <SphereCard title="Условия раскрытия">
        <p className="my-map-sphere-text">
          {nc?.definition
            ? `Определение карты: ${nc.definition}.`
            : "Этот слой будет расширен на следующем этапе."}
        </p>
      </SphereCard>
      <SphereCard title="Ритм и темп">
        <p className="my-map-sphere-text">{chartFactsLine(hdChart)}</p>
      </SphereCard>
      <SphereCard title="Команда и формат">
        <p className="my-map-sphere-text">
          Структура будущего разбора: кто рядом усиливает, какой формат работы поддерживает карту.
        </p>
      </SphereCard>
      <SphereCard title="Давление и свобода">
        <p className="my-map-sphere-text">
          Этот слой будет расширен на следующем этапе после подключения смысловой базы.
        </p>
      </SphereCard>
    </SphereScreen>
  );
}

function TabRelationships({ hdChart }: { hdChart: HdChartRecord | null }): JSX.Element {
  const nc = hdChart ? getNormalizedChart(hdChart) : null;
  return (
    <SphereScreen
      title="Отношения"
      lead="Контакт, близость, границы и бережность — по постоянной карте."
    >
      <SphereCard title="Как входите в контакт">
        <p className="my-map-sphere-text">
          {nc?.strategy
            ? `Опора на стратегию «${nc.strategy}» в отношениях.`
            : chartFactsLine(hdChart)}
        </p>
      </SphereCard>
      <SphereCard title="Близость и границы">
        <p className="my-map-sphere-text">
          Этот слой будет расширен на следующем этапе. Сейчас — структура будущего разбора.
        </p>
      </SphereCard>
      <SphereCard title="Уязвимости">
        <p className="my-map-sphere-text">
          {nc?.openCenters?.length
            ? `Открытых центров: ${nc.openCenters.length} — зоны чувствительности к чужой энергии.`
            : "Появится после расчёта карты с полными данными."}
        </p>
      </SphereCard>
      <SphereCard title="Что важно в паре и семье">
        <p className="my-map-sphere-text">
          Этот слой будет расширен на следующем этапе после подключения смысловой базы.
        </p>
      </SphereCard>
    </SphereScreen>
  );
}

function TabCommunication({ hdChart }: { hdChart: HdChartRecord | null }): JSX.Element {
  const nc = hdChart ? getNormalizedChart(hdChart) : null;
  return (
    <SphereScreen
      title="Коммуникация"
      lead="Речь, договорённости, вопросы и отказ — как это следует из вашей карты."
    >
      <SphereCard title="Как объясняете идеи">
        <p className="my-map-sphere-text">
          {nc?.profile ? `Профиль ${nc.profile} — ролевая линия в общении.` : chartFactsLine(hdChart)}
        </p>
      </SphereCard>
      <SphereCard title="Договорённости">
        <p className="my-map-sphere-text">
          Структура будущего разбора: как фиксировать ожидания и проверять взаимопонимание.
        </p>
      </SphereCard>
      <SphereCard title="Вопросы и уточнения">
        <p className="my-map-sphere-text">
          Этот слой будет расширен на следующем этапе после подключения смысловой базы.
        </p>
      </SphereCard>
      <SphereCard title="Отказ и границы">
        <p className="my-map-sphere-text">
          {nc?.notSelfTheme
            ? `Не-я тема «${nc.notSelfTheme}» может проявляться в сложных разговорах.`
            : "Честный preview — без персональных интерпретаций."}
        </p>
      </SphereCard>
    </SphereScreen>
  );
}

function TabEnergyBody({ hdChart }: { hdChart: HdChartRecord | null }): JSX.Element {
  const nc = hdChart ? getNormalizedChart(hdChart) : null;
  return (
    <SphereScreen
      title="Энергия и тело"
      lead="Ритм, перегруз, восстановление и телесные сигналы. Не медицинский совет."
    >
      <SphereCard title="Ритм дня">
        <p className="my-map-sphere-text">
          {nc?.type ? `Базовый ритм связан с типом ${nc.type}.` : chartFactsLine(hdChart)}
        </p>
      </SphereCard>
      <SphereCard title="Перегруз">
        <p className="my-map-sphere-text">
          {nc?.notSelfTheme
            ? `Сигнал — «${nc.notSelfTheme}».`
            : "Этот слой будет расширен на следующем этапе."}
        </p>
      </SphereCard>
      <SphereCard title="Восстановление">
        <p className="my-map-sphere-text">
          В «Обзоре» откройте слой «Центры» для определённых и открытых зон тела.
        </p>
      </SphereCard>
      <SphereCard title="Телесные сигналы">
        <p className="my-map-sphere-text">
          Этот слой будет расширен на следующем этапе после подключения смысловой базы.
        </p>
      </SphereCard>
    </SphereScreen>
  );
}

function TabMoney({ hdChart }: { hdChart: HdChartRecord | null }): JSX.Element {
  const nc = hdChart ? getNormalizedChart(hdChart) : null;
  return (
    <SphereScreen
      title="Деньги"
      lead="Ценность, предложения и денежные решения — не финансовые советы."
    >
      <SphereCard title="Создание ценности">
        <p className="my-map-sphere-text">
          {nc?.channelsShort?.length
            ? `Активных каналов: ${nc.channelsShort.length} — зоны встроенной ценности.`
            : chartFactsLine(hdChart)}
        </p>
      </SphereCard>
      <SphereCard title="Предложения и обмен">
        <p className="my-map-sphere-text">
          Этот слой будет расширен на следующем этапе. Сейчас — структура будущего разбора.
        </p>
      </SphereCard>
      <SphereCard title="Денежные решения">
        <p className="my-map-sphere-text">
          {nc?.authority
            ? `Ориентир — авторитет ${nc.authority}.`
            : "Появится после расчёта карты."}
        </p>
      </SphereCard>
      <SphereCard title="Обесценивание">
        <p className="my-map-sphere-text">
          Этот слой будет расширен на следующем этапе после подключения смысловой базы.
        </p>
      </SphereCard>
    </SphereScreen>
  );
}

function TabDevelopmentPlan({
  hdChartStatus,
  profileCompleteness,
  onGoToData,
  onGoToNewReport,
}: {
  hdChart: HdChartRecord | null;
  hdChartStatus: HdChartStatus;
  profileCompleteness: { percent: number; label: string };
  onGoToData: () => void;
  onGoToNewReport: (type: AnalysisType) => void;
}): JSX.Element {
  return (
    <SphereScreen
      title="План развития"
      lead="Ближайшие шаги: профиль, наблюдения и разборы для углубления."
      actions={
        <div className="my-map-cta-row">
          <button
            type="button"
            className="my-map-cta-btn my-map-cta-btn--sm"
            onClick={() => onGoToNewReport("talent_map")}
          >
            Запустить разбор карты →
          </button>
        </div>
      }
    >
      <SphereCard title="Ближайшие шаги">
        <ul className="my-map-summary-list">
          <li>Довести анкету до {profileCompleteness.percent}% и выше</li>
          <li>Наблюдать сигнатуру и не-я тему в решениях</li>
          <li>Использовать «Обзор» для базовых параметров карты</li>
        </ul>
      </SphereCard>
      <SphereCard title="Что добавить в профиль">
        <p className="my-map-sphere-text">
          {hdChartStatus === "outdated" || hdChartStatus === "none"
            ? "Обновите данные рождения и пересчитайте карту."
            : "Уточните время и место рождения для более точных выводов."}
        </p>
        {(hdChartStatus === "outdated" || hdChartStatus === "none") && (
          <button type="button" className="my-map-layer-link" onClick={onGoToData}>
            Перейти в Данные →
          </button>
        )}
      </SphereCard>
      <SphereCard title="Какие разборы запустить">
        <p className="my-map-sphere-text">
          Разбор роли, вакансии или карты талантов — в разделе «Разборы» и через кнопку ниже.
        </p>
      </SphereCard>
      <SphereCard title="Следующий слой">
        <p className="my-map-sphere-text">
          Персональные рекомендации появятся на следующем этапе после подключения смысловой базы.
        </p>
      </SphereCard>
    </SphereScreen>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function MyMapScreen({
  hdChart,
  hdChartStatus,
  hdChartLoading,
  hdChartCalculating,
  calculateHdChart,
  profile,
  profileCompleteness,
  onGoToData,
  onGoToNewReport,
}: MyMapScreenProps): JSX.Element {
  const [activeMapTab, setActiveMapTab] = useState<MapTab>("overview");
  const [activeMapLayer, setActiveMapLayer] = useState<MapLayer>("bodygraph");

  return (
    <section className="my-map-screen">
      <CompactMapHeader
        hdChartStatus={hdChartStatus}
        profileCompleteness={profileCompleteness}
        hdChart={hdChart}
      />

      <MapFeedTabs active={activeMapTab} onChange={setActiveMapTab} />

      {activeMapTab === "overview" ? (
        <OverviewCockpit
          activeMapLayer={activeMapLayer}
          onLayerChange={setActiveMapLayer}
          hdChart={hdChart}
          hdChartStatus={hdChartStatus}
          hdChartLoading={hdChartLoading}
          hdChartCalculating={hdChartCalculating}
          calculateHdChart={calculateHdChart}
          profile={profile}
          profileCompleteness={profileCompleteness}
          onGoToData={onGoToData}
        />
      ) : (
        <>
          {activeMapTab === "talents" && <TabTalents hdChart={hdChart} />}
          {activeMapTab === "workStyle" && (
            <TabWorkStyle hdChart={hdChart} onGoToNewReport={onGoToNewReport} />
          )}
          {activeMapTab === "workEnvironment" && <TabWorkEnvironment hdChart={hdChart} />}
          {activeMapTab === "relationships" && <TabRelationships hdChart={hdChart} />}
          {activeMapTab === "communication" && <TabCommunication hdChart={hdChart} />}
          {activeMapTab === "energyBody" && <TabEnergyBody hdChart={hdChart} />}
          {activeMapTab === "money" && <TabMoney hdChart={hdChart} />}
          {activeMapTab === "developmentPlan" && (
            <TabDevelopmentPlan
              hdChart={hdChart}
              hdChartStatus={hdChartStatus}
              profileCompleteness={profileCompleteness}
              onGoToData={onGoToData}
              onGoToNewReport={onGoToNewReport}
            />
          )}
        </>
      )}
    </section>
  );
}
