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
  | "career"
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
  { id: "career", label: "Карьера" },
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
// Cockpit: map layers (level 3) + sphere summary (level 2 right panel)
// ---------------------------------------------------------------------------

function MapLayerChips({
  active,
  onChange,
}: {
  active: MapLayer;
  onChange: (layer: MapLayer) => void;
}): JSX.Element {
  return (
    <div className="my-map-layer-chips" role="tablist" aria-label="Слои карты">
      {MAP_LAYERS.map((item) => (
        <button
          key={item.id}
          type="button"
          role="tab"
          aria-selected={active === item.id}
          className={`my-map-layer-chip${active === item.id ? " my-map-layer-chip--active" : ""}`}
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
      <div className="my-map-layer-panel my-map-layer-bodygraph">
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
      <div className="my-map-layer-panel">
        <LayerEmptyHint>Загрузка данных карты…</LayerEmptyHint>
      </div>
    );
  }

  const nc = hdChart ? getNormalizedChart(hdChart) : null;
  const hasChart = hdChartStatus === "ok" || hdChartStatus === "outdated";

  if (!hasChart || !nc) {
    return (
      <div className="my-map-layer-panel">
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
        <div className="my-map-layer-panel">
          <LayerEmptyHint>
            Список центров появится после расчёта карты с полными данными.
          </LayerEmptyHint>
        </div>
      );
    }
    return (
      <div className="my-map-layer-panel">
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
        <div className="my-map-layer-panel">
          <LayerEmptyHint>Каналы появятся после расчёта карты с полными данными.</LayerEmptyHint>
        </div>
      );
    }
    return (
      <div className="my-map-layer-panel">
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
        <div className="my-map-layer-panel">
          <LayerEmptyHint>
            Планетарные активации появятся после расчёта карты с полными данными.
          </LayerEmptyHint>
        </div>
      );
    }
    return (
      <div className="my-map-layer-panel">
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
        <div className="my-map-layer-panel">
          <LayerSoonPanel
            title="Переменные"
            description="Слой переменных будет раскрыт после подключения расширенной интерпретации карты."
          />
        </div>
      );
    }
    return (
      <div className="my-map-layer-panel">
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
    <div className="my-map-layer-panel">
      <LayerSoonPanel title={soon.title} description={soon.description} />
    </div>
  );
}

function SummaryPreviewCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}): JSX.Element {
  return (
    <div className="my-map-summary-preview-card">
      <h3 className="my-map-summary-preview-title">{title}</h3>
      <div className="my-map-summary-preview-body">{children}</div>
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

function SphereSummaryPanel({
  tab,
  hdChart,
  hdChartStatus,
  profileCompleteness,
  onGoToData,
  onGoToNewReport,
  onLayerChange,
}: {
  tab: MapTab;
  hdChart: HdChartRecord | null;
  hdChartStatus: HdChartStatus;
  profileCompleteness: { percent: number; label: string };
  onGoToData: () => void;
  onGoToNewReport: (type: AnalysisType) => void;
  onLayerChange: (layer: MapLayer) => void;
}): JSX.Element {
  const nc = hdChart ? getNormalizedChart(hdChart) : null;

  let title = "Обзор";
  let lead = "";
  let body: ReactNode = null;

  switch (tab) {
    case "overview":
      title = "Паспорт карты";
      lead = "Ключевые параметры вашей постоянной карты.";
      body = <PassportSummary hdChart={hdChart} hdChartStatus={hdChartStatus} />;
      break;
    case "talents":
      title = "Таланты";
      lead =
        "Здесь будет собираться перевод ворот, каналов и устойчивых качеств в понятные таланты.";
      body = (
        <div className="my-map-summary-previews">
          <SummaryPreviewCard title="Что уже видно по карте">
            <p className="my-map-summary-text">
              {nc?.definedCenters?.length
                ? `Определённых центров: ${nc.definedCenters.length}. `
                : ""}
              {nc?.channelsShort?.length
                ? `Активных каналов: ${nc.channelsShort.length}. `
                : ""}
              {nc?.gatesAll?.length ? `Ворот в карте: ${nc.gatesAll.length}.` : ""}
              {!nc?.definedCenters?.length && !nc?.channelsShort?.length && !nc?.gatesAll?.length
                ? "Рассчитайте карту — здесь появится структура талантов из ваших данных."
                : " Детальный перевод появится на следующем этапе."}
            </p>
          </SummaryPreviewCard>
          <SummaryPreviewCard title="Что будет добавлено дальше">
            <p className="my-map-summary-text">
              Персональные формулировки талантов, сценарии проявления и связка с карьерой и
              отношениями — без выдуманных интерпретаций.
            </p>
          </SummaryPreviewCard>
          <SummaryPreviewCard title="Как использовать">
            <p className="my-map-summary-text">
              Смотрите слои «Каналы» и «Центры» слева и раздел «Подробнее» ниже для структуры
              будущего разбора.
            </p>
          </SummaryPreviewCard>
        </div>
      );
      break;
    case "career":
      title = "Карьера";
      lead =
        "Как эта карта будет переводиться в рабочий стиль, подходящие роли и ограничения.";
      body = (
        <>
          <p className="my-map-summary-text">
            {nc?.type
              ? `Тип ${nc.type}${nc.strategy ? ` · стратегия «${nc.strategy}»` : ""}${nc.authority ? ` · авторитет ${nc.authority}` : ""}.`
              : "После расчёта карты здесь появится краткий рабочий профиль."}
          </p>
          <div className="my-map-summary-cta-row">
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
        </>
      );
      break;
    case "workEnvironment":
      title = "Рабочая среда";
      lead = "Условия, ритм, формат команды, баланс давления и свободы.";
      body = (
        <p className="my-map-summary-text">
          {nc?.definition
            ? `Определение: ${nc.definition}. `
            : ""}
          Этот слой будет расширен на следующем этапе. Сейчас показана структура будущего разбора
          по рабочей среде.
        </p>
      );
      break;
    case "relationships":
      title = "Отношения";
      lead = "Как вы входите в контакт, где нужна бережность, что важно в близости.";
      body = (
        <p className="my-map-summary-text">
          {nc?.strategy
            ? `Опора на стратегию «${nc.strategy}» в контакте с людьми. `
            : ""}
          Этот слой будет расширен на следующем этапе. Сейчас показана структура будущего разбора
          по отношениям.
        </p>
      );
      break;
    case "communication":
      title = "Коммуникация";
      lead = "Как вы объясняете, договариваетесь, задаёте вопросы и обозначаете границы.";
      body = (
        <p className="my-map-summary-text">
          {nc?.profile ? `Профиль ${nc.profile} — ролевая линия в общении. ` : ""}
          Этот слой будет расширен на следующем этапе. Сейчас показана структура будущего разбора
          по коммуникации.
        </p>
      );
      break;
    case "energyBody":
      title = "Энергия и тело";
      lead = "Ритм, перегруз, восстановление. Не медицинский совет.";
      body = (
        <>
          <p className="my-map-summary-text">
            {nc?.type
              ? `Базовый ритм связан с типом ${nc.type}. `
              : ""}
            Для телесных зон смотрите слой «Центры» — там видны определённые и открытые центры.
          </p>
          <button
            type="button"
            className="my-map-layer-link"
            onClick={() => onLayerChange("centers")}
          >
            Открыть слой «Центры» →
          </button>
        </>
      );
      break;
    case "money":
      title = "Деньги";
      lead = "Ценность, предложения и решения про обмен — не финансовые советы.";
      body = (
        <p className="my-map-summary-text">
          {nc?.authority
            ? `Ориентир для решений: авторитет ${nc.authority}. `
            : ""}
          Этот слой будет расширен на следующем этапе. Сейчас показана структура будущего разбора
          по деньгам и ценности.
        </p>
      );
      break;
    case "developmentPlan":
      title = "План развития";
      lead = "Ближайшие шаги, профиль и разборы для углубления.";
      body = (
        <>
          <ul className="my-map-summary-list">
            <li>Довести анкету до {profileCompleteness.percent}% и выше</li>
            <li>Наблюдать сигнатуру и не-я тему в ежедневных решениях</li>
            <li>Запустить разбор, когда нужна конкретика по роли или вакансии</li>
          </ul>
          {(hdChartStatus === "none" || hdChartStatus === "outdated") && (
            <button type="button" className="my-map-layer-link" onClick={onGoToData}>
              Перейти в Данные →
            </button>
          )}
        </>
      );
      break;
  }

  return (
    <aside className="my-map-sphere-summary" aria-label={title}>
      <div className="my-map-passport-card my-map-sphere-summary-card">
        <h2 className="my-map-passport-title">{title}</h2>
        {lead && <p className="my-map-sphere-lead">{lead}</p>}
        <div className="my-map-sphere-body">{body}</div>
      </div>
    </aside>
  );
}

// ---------------------------------------------------------------------------
// Inner tab content components
// ---------------------------------------------------------------------------

function InsightCard({
  title,
  children,
  accent,
}: {
  title: string;
  children: ReactNode;
  accent?: boolean;
}): JSX.Element {
  return (
    <div className={`my-map-insight-card${accent ? " my-map-insight-card--accent" : ""}`}>
      <h3 className="my-map-insight-title">{title}</h3>
      <div className="my-map-insight-body">{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Обзор
// ---------------------------------------------------------------------------

function TabOverview({
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
    <div className="my-map-section">
      <div className="my-map-data-quality">
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
              <button className="my-map-dq-btn" onClick={onGoToData}>
                Перейти в Данные →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Таланты
// ---------------------------------------------------------------------------

function TabTalents({ hdChart }: { hdChart: HdChartRecord | null }): JSX.Element {
  const nc = hdChart ? getNormalizedChart(hdChart) : null;

  return (
    <div className="my-map-section">
      <div className="my-map-section-header">
        <h2 className="my-map-section-title">Таланты</h2>
        <p className="my-map-section-desc">
          Природные сильные стороны, врождённая ценность и качества для развития
        </p>
      </div>

      <div className="my-map-section-grid">
        <InsightCard title="Главные таланты карты" accent>
          {nc ? (
            <ul className="my-map-list">
              {nc.type && (
                <li>
                  <strong>Тип:</strong> {nc.type} — это основа вашей энергетической механики
                </li>
              )}
              {nc.profile && (
                <li>
                  <strong>Профиль {nc.profile}</strong> — архетип, через который раскрывается ваша роль
                </li>
              )}
              {nc.authority && (
                <li>
                  <strong>Авторитет:</strong> {nc.authority} — ваш внутренний компас для верных решений
                </li>
              )}
              {nc.definedCenters && nc.definedCenters.length > 0 && (
                <li>
                  <strong>Определённых центров:</strong> {nc.definedCenters.length} — устойчивые зоны силы
                </li>
              )}
              {nc.channelsShort && nc.channelsShort.length > 0 && (
                <li>
                  <strong>Каналов:</strong> {nc.channelsShort.length} — встроенные дары и способности
                </li>
              )}
            </ul>
          ) : (
            <p className="my-map-empty-hint">
              Рассчитайте HD-карту во вкладке «Данные», чтобы увидеть ваши таланты
            </p>
          )}
        </InsightCard>

        <InsightCard title="Как проявлять себя сильнее">
          {nc?.strategy ? (
            <ul className="my-map-list">
              <li>
                Следуйте стратегии <strong>«{nc.strategy}»</strong> — она снижает сопротивление
                и открывает правильные возможности
              </li>
              {nc.signature && (
                <li>
                  Сигнатура успеха <strong>«{nc.signature}»</strong> — ориентир, что вы на своём месте
                </li>
              )}
            </ul>
          ) : (
            <p className="my-map-empty-hint">Появится после расчёта карты</p>
          )}
        </InsightCard>

        <InsightCard title="Где талант теряется">
          {nc?.notSelfTheme ? (
            <ul className="my-map-list">
              <li>
                Не-я тема <strong>«{nc.notSelfTheme}»</strong> — сигнал, что вы действуете
                вопреки своей природе
              </li>
              {nc.openCenters && nc.openCenters.length > 0 && (
                <li>
                  Открытых центров: <strong>{nc.openCenters.length}</strong> — места, где легко
                  брать на себя чужую энергию
                </li>
              )}
            </ul>
          ) : (
            <p className="my-map-empty-hint">Появится после расчёта карты</p>
          )}
        </InsightCard>

        <InsightCard title="Что стоит развивать">
          {nc ? (
            <ul className="my-map-list">
              {nc.gatesAll && nc.gatesAll.length > 0 && (
                <li>
                  Активных ворот: <strong>{nc.gatesAll.length}</strong> — каждые несут
                  потенциал для развития
                </li>
              )}
              <li>
                Изучение своего профиля и стратегии — ключевой практический шаг
              </li>
              <li>
                Первичная версия раздела — углублённый AI-анализ появится в следующих обновлениях
              </li>
            </ul>
          ) : (
            <p className="my-map-empty-hint">Появится после расчёта карты</p>
          )}
        </InsightCard>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Карьера
// ---------------------------------------------------------------------------

function TabCareer({
  hdChart,
  onGoToNewReport,
}: {
  hdChart: HdChartRecord | null;
  onGoToNewReport: (type: AnalysisType) => void;
}): JSX.Element {
  const nc = hdChart ? getNormalizedChart(hdChart) : null;

  return (
    <div className="my-map-section">
      <div className="my-map-section-header">
        <h2 className="my-map-section-title">Карьера</h2>
        <p className="my-map-section-desc">
          Базовая карьерная логика вашего дизайна — не конкретные вакансии, а фундаментальный вектор
        </p>
      </div>

      <div className="my-map-section-grid">
        <InsightCard title="Рабочий вектор" accent>
          {nc?.type ? (
            <ul className="my-map-list">
              <li>
                <strong>Тип: {nc.type}</strong>
              </li>
              {nc.type === "Generator" && (
                <>
                  <li>Вы созданы для работы, которая по-настоящему зажигает</li>
                  <li>Сакральный отклик — лучший фильтр для карьерных решений</li>
                </>
              )}
              {nc.type === "Manifesting Generator" && (
                <>
                  <li>Многогранность и скорость — ваш актив</li>
                  <li>Лучшие результаты там, где есть разнообразие задач</li>
                </>
              )}
              {nc.type === "Projector" && (
                <>
                  <li>Ваша сила — в видении системы и направлении других</li>
                  <li>Работайте с теми, кто ценит вашу экспертизу</li>
                </>
              )}
              {nc.type === "Manifestor" && (
                <>
                  <li>Вы инициатор — лучшие результаты, когда действуете самостоятельно</li>
                  <li>Информирование команды снижает сопротивление</li>
                </>
              )}
              {nc.type === "Reflector" && (
                <>
                  <li>Ваша сила — в отражении и оценке среды</li>
                  <li>Лунный цикл (28–29 дней) — ваш ориентир для важных решений</li>
                </>
              )}
            </ul>
          ) : (
            <p className="my-map-empty-hint">Рассчитайте HD-карту, чтобы увидеть вектор</p>
          )}
        </InsightCard>

        <InsightCard title="Как принимать карьерные решения">
          {nc?.authority ? (
            <ul className="my-map-list">
              <li>
                <strong>Авторитет: {nc.authority}</strong>
              </li>
              <li>Опирайтесь именно на этот внутренний сигнал при выборе ролей и офферов</li>
              {nc.strategy && (
                <li>Стратегия <strong>«{nc.strategy}»</strong> — ваш алгоритм входа в правильные возможности</li>
              )}
            </ul>
          ) : (
            <p className="my-map-empty-hint">Появится после расчёта карты</p>
          )}
        </InsightCard>

        <InsightCard title="Сильные рабочие задачи">
          {nc ? (
            <ul className="my-map-list">
              {nc.definedCenters && nc.definedCenters.length > 0 && (
                <li>
                  Определённые центры ({nc.definedCenters.join(", ")}) дают устойчивость
                  в соответствующих областях
                </li>
              )}
              {nc.channelsShort && nc.channelsShort.length > 0 && (
                <li>
                  {nc.channelsShort.length} активных канала — встроенные способности и дары
                </li>
              )}
              <li>Углублённый анализ задач появится в следующих обновлениях</li>
            </ul>
          ) : (
            <p className="my-map-empty-hint">Появится после расчёта карты</p>
          )}
        </InsightCard>

        <InsightCard title="Спорные рабочие форматы">
          {nc ? (
            <ul className="my-map-list">
              {nc.openCenters && nc.openCenters.length > 0 && (
                <li>
                  Открытые центры ({nc.openCenters.join(", ")}) могут создавать перегрузку
                  в определённых форматах
                </li>
              )}
              <li>Подробный анализ появится с AI-расширением раздела</li>
            </ul>
          ) : (
            <p className="my-map-empty-hint">Появится после расчёта карты</p>
          )}
        </InsightCard>
      </div>

      <div className="my-map-cta-row">
        <button
          className="my-map-cta-btn"
          onClick={() => onGoToNewReport("talent_map")}
        >
          ✨ Запустить карьерный разбор →
        </button>
        <button
          className="my-map-cta-btn my-map-cta-btn--secondary"
          onClick={() => onGoToNewReport("current_role")}
        >
          🧭 Разобрать текущую роль →
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Рабочая среда
// ---------------------------------------------------------------------------

function TabWorkEnvironment({ hdChart }: { hdChart: HdChartRecord | null }): JSX.Element {
  const nc = hdChart ? getNormalizedChart(hdChart) : null;

  return (
    <div className="my-map-section">
      <div className="my-map-section-header">
        <h2 className="my-map-section-title">Рабочая среда</h2>
        <p className="my-map-section-desc">
          Условия, в которых вы раскрываетесь, и среда, которая истощает
        </p>
      </div>

      <div className="my-map-section-grid">
        <InsightCard title="Подходящий темп" accent>
          {nc?.type ? (
            <ul className="my-map-list">
              {(nc.type === "Generator" || nc.type === "Manifesting Generator") && (
                <>
                  <li>Устойчивый рабочий ритм с вовлечёнными задачами</li>
                  <li>Важно чувствовать отклик на работу — усталость без удовольствия = не ваше</li>
                </>
              )}
              {nc.type === "Projector" && (
                <>
                  <li>Короткие интенсивные периоды работы чередуются с отдыхом</li>
                  <li>Работа по приглашению — ключ к устойчивости</li>
                </>
              )}
              {nc.type === "Manifestor" && (
                <>
                  <li>Свой темп, минимум внешних дедлайнов</li>
                  <li>Периоды активности сменяются восстановлением</li>
                </>
              )}
              {nc.type === "Reflector" && (
                <>
                  <li>Медленный, вдумчивый темп</li>
                  <li>Важно не торопиться с решениями — лунный цикл как ориентир</li>
                </>
              )}
            </ul>
          ) : (
            <p className="my-map-empty-hint">Появится после расчёта карты</p>
          )}
        </InsightCard>

        <InsightCard title="Идеальная команда">
          {nc ? (
            <ul className="my-map-list">
              <li>Люди, которые ценят ваш вклад и не требуют постоянного доказательства компетентности</li>
              <li>Среда, где можно работать в своём режиме без навязчивого контроля</li>
              <li>Развёрнутый анализ появится в следующих обновлениях</li>
            </ul>
          ) : (
            <p className="my-map-empty-hint">Появится после расчёта карты</p>
          )}
        </InsightCard>

        <InsightCard title="Условия раскрытия">
          {nc?.definition ? (
            <ul className="my-map-list">
              <li>
                <strong>Определение: {nc.definition}</strong>
              </li>
              {nc.definition === "Single" && (
                <li>Вы самодостаточны — работаете стабильно независимо от команды</li>
              )}
              {nc.definition === "Split" && (
                <li>Правильные люди рядом усиливают вас — важно окружение</li>
              )}
              {nc.definition?.includes("Triple") && (
                <li>Нуждаетесь в разнообразном окружении для полного раскрытия</li>
              )}
              <li>Среда, где ваши таланты видят и ценят</li>
            </ul>
          ) : (
            <p className="my-map-empty-hint">Появится после расчёта карты</p>
          )}
        </InsightCard>

        <InsightCard title="Риски выгорания">
          {nc ? (
            <ul className="my-map-list">
              {nc.notSelfTheme && (
                <li>
                  Основной сигнал выгорания — <strong>«{nc.notSelfTheme}»</strong>
                </li>
              )}
              {nc.openCenters && nc.openCenters.length > 0 && (
                <li>
                  Открытые центры ({nc.openCenters.length}) — места уязвимости
                  к чужим энергиям
                </li>
              )}
              <li>Принятие условий, которые противоречат стратегии и авторитету</li>
            </ul>
          ) : (
            <p className="my-map-empty-hint">Появится после расчёта карты</p>
          )}
        </InsightCard>

        <InsightCard title="Границы и режим">
          {nc ? (
            <ul className="my-map-list">
              <li>Режим, учитывающий вашу стратегию — основа устойчивости</li>
              <li>Право говорить «нет» задачам, которые не вызывают отклика</li>
              <li>Детальные рекомендации появятся с AI-расширением</li>
            </ul>
          ) : (
            <p className="my-map-empty-hint">Появится после расчёта карты</p>
          )}
        </InsightCard>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Отношения
// ---------------------------------------------------------------------------

function TabRelationships({ hdChart }: { hdChart: HdChartRecord | null }): JSX.Element {
  const nc = hdChart ? getNormalizedChart(hdChart) : null;

  return (
    <div className="my-map-section">
      <div className="my-map-section-header">
        <h2 className="my-map-section-title">Отношения</h2>
        <p className="my-map-section-desc">
          Личная карта отношений — как вы входите в контакт и что важно в близости
        </p>
      </div>

      <div className="my-map-section-grid">
        <InsightCard title="Как вы входите в контакт" accent>
          {nc?.strategy ? (
            <ul className="my-map-list">
              <li>
                Стратегия <strong>«{nc.strategy}»</strong> применима не только в карьере,
                но и в отношениях
              </li>
              <li>Через неё вы можете строить контакт экологично — без навязывания</li>
            </ul>
          ) : (
            <p className="my-map-empty-hint">Появится после расчёта карты</p>
          )}
        </InsightCard>

        <InsightCard title="Чувствительные места">
          {nc ? (
            <ul className="my-map-list">
              {nc.openCenters && nc.openCenters.length > 0 && (
                <li>
                  Открытые центры ({nc.openCenters.join(", ")}) — зоны, где вы легко
                  берёте на себя чужую энергию в отношениях
                </li>
              )}
              <li>Важно не брать на себя чужие эмоции и состояния</li>
            </ul>
          ) : (
            <p className="my-map-empty-hint">Появится после расчёта карты</p>
          )}
        </InsightCard>

        <InsightCard title="Полезные договорённости">
          <ul className="my-map-list">
            <li>Прозрачность о своём режиме и ритме работы</li>
            <li>Право на восстановление без объяснений</li>
            <li>Пространство для принятия решений в своём темпе</li>
          </ul>
        </InsightCard>

        <InsightCard title="Кто усиливает / перегружает">
          {nc ? (
            <ul className="my-map-list">
              <li>Люди, уважающие вашу стратегию и авторитет — усиливают</li>
              <li>Те, кто игнорирует ваши сигналы или требует постоянного доказательства — истощают</li>
              <li>Детальный анализ совместимости появится в следующих обновлениях</li>
            </ul>
          ) : (
            <p className="my-map-empty-hint">Появится после расчёта карты</p>
          )}
        </InsightCard>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Коммуникация
// ---------------------------------------------------------------------------

function TabCommunication({ hdChart }: { hdChart: HdChartRecord | null }): JSX.Element {
  const nc = hdChart ? getNormalizedChart(hdChart) : null;
  const hasThroat = nc?.definedCenters?.includes("Throat");

  return (
    <div className="my-map-section">
      <div className="my-map-section-header">
        <h2 className="my-map-section-title">Коммуникация</h2>
        <p className="my-map-section-desc">
          Как вам легче говорить, презентовать себя и договариваться
        </p>
      </div>

      <div className="my-map-section-grid">
        <InsightCard title="Как вам легче говорить" accent>
          {nc ? (
            <ul className="my-map-list">
              {hasThroat ? (
                <>
                  <li>
                    <strong>Горло определено</strong> — у вас устойчивый, постоянный голос
                  </li>
                  <li>Вы говорите уверенно, ваши слова несут силу и привлекают внимание</li>
                </>
              ) : (
                <>
                  <li>
                    <strong>Горло открыто</strong> — ваш голос гибко адаптируется к ситуации
                  </li>
                  <li>Важно говорить тогда, когда вас действительно слышат</li>
                </>
              )}
            </ul>
          ) : (
            <p className="my-map-empty-hint">Появится после расчёта карты</p>
          )}
        </InsightCard>

        <InsightCard title="Самопрезентация">
          {nc ? (
            <ul className="my-map-list">
              {nc.type && <li>Тип <strong>{nc.type}</strong> определяет энергетику вашего присутствия</li>}
              {nc.profile && <li>Профиль <strong>{nc.profile}</strong> — ваша ролевая карта в коммуникации</li>}
              <li>Говорите о своих достижениях через конкретные результаты и вклад</li>
            </ul>
          ) : (
            <p className="my-map-empty-hint">Появится после расчёта карты</p>
          )}
        </InsightCard>

        <InsightCard title="Как задавать вопросы и договариваться">
          <ul className="my-map-list">
            <li>Уточняйте ожидания до начала работы, а не в процессе</li>
            <li>Давайте себе время на обдумывание предложений</li>
            <li>Договорённости работают лучше, когда они письменные</li>
          </ul>
        </InsightCard>

        <InsightCard title="Потенциальные конфликты">
          {nc?.notSelfTheme ? (
            <ul className="my-map-list">
              <li>
                Не-я тема <strong>«{nc.notSelfTheme}»</strong> может провоцировать
                конфликты в коммуникации
              </li>
              <li>Заметив этот сигнал — остановитесь и вернитесь к своей стратегии</li>
            </ul>
          ) : (
            <ul className="my-map-list">
              <li>Конфликты чаще возникают, когда вы действуете против своей природы</li>
              <li>Ориентир — следовать своему авторитету в трудных разговорах</li>
            </ul>
          )}
        </InsightCard>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Энергия и тело
// ---------------------------------------------------------------------------

function TabEnergyBody({ hdChart }: { hdChart: HdChartRecord | null }): JSX.Element {
  const nc = hdChart ? getNormalizedChart(hdChart) : null;
  const hasSacral = nc?.definedCenters?.includes("Sacral");
  const hasRoot = nc?.definedCenters?.includes("Root");

  return (
    <div className="my-map-section">
      <div className="my-map-section-header">
        <h2 className="my-map-section-title">Энергия и тело</h2>
        <p className="my-map-section-desc">
          Как набирать энергию, восстанавливаться и слушать телесные сигналы. Не медицинский совет.
        </p>
      </div>

      <div className="my-map-section-grid">
        <InsightCard title="Источники энергии" accent>
          {nc?.type ? (
            <ul className="my-map-list">
              {hasSacral ? (
                <li>
                  <strong>Сакральный центр определён</strong> — у вас мощный, воспроизводимый
                  жизненный двигатель. Энергия восстанавливается через сон и вовлечённую работу
                </li>
              ) : (
                <li>
                  <strong>Сакральный центр открыт</strong> — вы не генерируете энергию самостоятельно,
                  важно бережно расходовать и восстанавливать её
                </li>
              )}
              {hasRoot && (
                <li>
                  <strong>Корневой центр определён</strong> — есть постоянное давление к действию.
                  Важно не реагировать импульсивно на каждый стресс
                </li>
              )}
            </ul>
          ) : (
            <p className="my-map-empty-hint">Появится после расчёта карты</p>
          )}
        </InsightCard>

        <InsightCard title="Энергетические утечки">
          {nc ? (
            <ul className="my-map-list">
              {nc.openCenters && nc.openCenters.length > 0 && (
                <li>
                  Открытые центры ({nc.openCenters.length}) — места, где вы
                  поглощаете и усиливаете чужие энергии
                </li>
              )}
              <li>Переработка, работа без отклика, игнорирование усталости</li>
              <li>Дела, которые «надо», но не вызывают отклика</li>
            </ul>
          ) : (
            <p className="my-map-empty-hint">Появится после расчёта карты</p>
          )}
        </InsightCard>

        <InsightCard title="Восстановление и сон">
          {nc?.type ? (
            <ul className="my-map-list">
              {(nc.type === "Generator" || nc.type === "Manifesting Generator") && (
                <>
                  <li>Важно ложиться спать уставшим — тело должно истощить сакральную энергию</li>
                  <li>Не засыпать сразу — лечь и почитать, дать телу переключиться</li>
                </>
              )}
              {nc.type === "Projector" && (
                <>
                  <li>Регулярный отдых до наступления усталости — не доводить до истощения</li>
                  <li>Тихое время перед сном особенно важно</li>
                </>
              )}
              {nc.type === "Manifestor" && (
                <>
                  <li>Право на изоляцию и тишину для восстановления</li>
                  <li>Отдых — необходимость, а не слабость</li>
                </>
              )}
              {nc.type === "Reflector" && (
                <>
                  <li>Сон в одиночестве или особенно тихой среде</li>
                  <li>Важно лечь спать до полуночи и давать себе время на лунный цикл</li>
                </>
              )}
            </ul>
          ) : (
            <p className="my-map-empty-hint">Появится после расчёта карты</p>
          )}
        </InsightCard>

        <InsightCard title="Питание и телесные сигналы">
          <ul className="my-map-list">
            <li>Тело — ваш лучший навигатор. Замечайте сигналы усталости и напряжения</li>
            <li>Физическая активность, которая приносит удовольствие — лучшая</li>
            <li>
              <em>Персонализированный раздел «Питание» появится в будущих обновлениях</em>
            </li>
          </ul>
        </InsightCard>

        <InsightCard title="Как не загонять себя">
          {nc ? (
            <ul className="my-map-list">
              <li>Замечайте свою не-я тему — это сигнал, что что-то идёт не так</li>
              <li>Уважайте стратегию в ежедневных решениях, не только в больших</li>
              <li>Регулярный аудит своего расписания на соответствие природе</li>
            </ul>
          ) : (
            <p className="my-map-empty-hint">Появится после расчёта карты</p>
          )}
        </InsightCard>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Деньги
// ---------------------------------------------------------------------------

function TabMoney({ hdChart }: { hdChart: HdChartRecord | null }): JSX.Element {
  const nc = hdChart ? getNormalizedChart(hdChart) : null;

  return (
    <div className="my-map-section">
      <div className="my-map-section-header">
        <h2 className="my-map-section-title">Деньги</h2>
        <p className="my-map-section-desc">
          Личная стратегия ценности. Не финансовые советы или инвестиции — только ваша природная механика.
        </p>
      </div>

      <div className="my-map-section-grid">
        <InsightCard title="Через что легче создавать ценность" accent>
          {nc ? (
            <ul className="my-map-list">
              {nc.type && (
                <li>
                  Как <strong>{nc.type}</strong>, вы создаёте ценность через свою уникальную
                  энергетику — не через подражание другим типам
                </li>
              )}
              {nc.channelsShort && nc.channelsShort.length > 0 && (
                <li>
                  {nc.channelsShort.length} активных канала — ваши встроенные зоны ценности
                  для других
                </li>
              )}
              {nc.authority && (
                <li>
                  Авторитет <strong>{nc.authority}</strong> помогает выбирать предложения,
                  которые действительно вас ценят
                </li>
              )}
            </ul>
          ) : (
            <p className="my-map-empty-hint">Появится после расчёта карты</p>
          )}
        </InsightCard>

        <InsightCard title="Где можешь обесценивать себя">
          {nc ? (
            <ul className="my-map-list">
              {nc.openCenters?.includes("Ego") ? (
                <li>
                  <strong>Эго-центр открыт</strong> — склонность брать на себя обязательства,
                  которые истощают, и недооценивать свою ценность
                </li>
              ) : (
                <li>Принятие условий, противоречащих авторитету — зона риска</li>
              )}
              <li>Работа из страха, а не из отклика — приводит к недооценке себя</li>
              <li>Согласие на невыгодные условия под давлением</li>
            </ul>
          ) : (
            <p className="my-map-empty-hint">Появится после расчёта карты</p>
          )}
        </InsightCard>

        <InsightCard title="Токсичные денежные паттерны">
          {nc ? (
            <ul className="my-map-list">
              <li>Соглашаться на любую работу, лишь бы был доход</li>
              <li>Игнорировать внутренние сигналы в пользу внешних ожиданий</li>
              <li>Сравнивать себя с другими типами вместо следования своей природе</li>
            </ul>
          ) : (
            <p className="my-map-empty-hint">Появится после расчёта карты</p>
          )}
        </InsightCard>

        <InsightCard title="Экологичный обмен ценности">
          {nc?.strategy ? (
            <ul className="my-map-list">
              <li>
                Стратегия <strong>«{nc.strategy}»</strong> — ориентир для выбора условий
                и партнёров, которые резонируют с вашей природой
              </li>
              <li>Честная цена своего труда — это уважение к своему дизайну</li>
              <li>
                Первичная версия раздела — углублённый анализ появится в следующих обновлениях
              </li>
            </ul>
          ) : (
            <p className="my-map-empty-hint">Появится после расчёта карты</p>
          )}
        </InsightCard>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: План развития
// ---------------------------------------------------------------------------

function TabDevelopmentPlan({
  hdChart,
  onGoToNewReport,
}: {
  hdChart: HdChartRecord | null;
  onGoToNewReport: (type: AnalysisType) => void;
}): JSX.Element {
  const nc = hdChart ? getNormalizedChart(hdChart) : null;

  return (
    <div className="my-map-section">
      <div className="my-map-section-header">
        <h2 className="my-map-section-title">План развития</h2>
        <p className="my-map-section-desc">
          Практические шаги на сейчас — что наблюдать, пробовать и делать
        </p>
      </div>

      <div className="my-map-section-grid">
        <InsightCard title="Что попробовать на этой неделе" accent>
          {nc ? (
            <ul className="my-map-list">
              {nc.strategy && (
                <li>
                  Замечайте в течение дня, следуете ли стратегии <strong>«{nc.strategy}»</strong>
                </li>
              )}
              <li>Выберите одну рабочую задачу, которая вызывает настоящий отклик</li>
              <li>Запишите один пример, когда всё шло легко — что в нём было особенного?</li>
            </ul>
          ) : (
            <p className="my-map-empty-hint">Рассчитайте HD-карту для персональных рекомендаций</p>
          )}
        </InsightCard>

        <InsightCard title="Что наблюдать">
          {nc ? (
            <ul className="my-map-list">
              {nc.signature && (
                <li>
                  Когда возникает чувство <strong>«{nc.signature}»</strong> — записывайте контекст
                </li>
              )}
              {nc.notSelfTheme && (
                <li>
                  Когда появляется <strong>«{nc.notSelfTheme}»</strong> — что предшествовало?
                </li>
              )}
              <li>Энергетические паттерны: когда полны сил, когда истощены?</li>
            </ul>
          ) : (
            <p className="my-map-empty-hint">Появится после расчёта карты</p>
          )}
        </InsightCard>

        <InsightCard title="Какой эксперимент сделать">
          <ul className="my-map-list">
            <li>Примите одно решение, полностью следуя своему авторитету — без логики, только сигнал</li>
            <li>Один день живите без соглашений, которые не вызывают отклика</li>
            <li>Поговорите о своих талантах с кем-то, кто вас хорошо знает — что они видят?</li>
          </ul>
        </InsightCard>

        <InsightCard title="Вопрос себе на эту неделю">
          {nc?.type ? (
            <ul className="my-map-list">
              {nc.type === "Generator" || nc.type === "Manifesting Generator" ? (
                <li>«Что из того, что я делаю сейчас, по-настоящему зажигает?»</li>
              ) : nc.type === "Projector" ? (
                <li>«Где меня сегодня признали и пригласили? Как я ответил?»</li>
              ) : nc.type === "Manifestor" ? (
                <li>«Что я инициировал сегодня? Кого информировал заранее?»</li>
              ) : (
                <li>«Что среда отражает мне сегодня?»</li>
              )}
              <li>«Что бы я сделал иначе, если бы не было страха?»</li>
            </ul>
          ) : (
            <ul className="my-map-list">
              <li>«Что в моей работе приносит настоящее удовлетворение?»</li>
              <li>«Где я чаще всего действую вопреки своей природе?»</li>
            </ul>
          )}
        </InsightCard>
      </div>

      <div className="my-map-cta-row">
        <button
          className="my-map-cta-btn"
          onClick={() => onGoToNewReport("talent_map")}
        >
          ✨ Сделать новый разбор →
        </button>
      </div>
    </div>
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

      <div className="my-map-cockpit">
        <div className="my-map-cockpit-left">
          <MapLayerChips active={activeMapLayer} onChange={setActiveMapLayer} />
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
        <SphereSummaryPanel
          tab={activeMapTab}
          hdChart={hdChart}
          hdChartStatus={hdChartStatus}
          profileCompleteness={profileCompleteness}
          onGoToData={onGoToData}
          onGoToNewReport={onGoToNewReport}
          onLayerChange={setActiveMapLayer}
        />
      </div>

      <div className="my-map-tab-content my-map-tab-content--secondary" role="tabpanel">
        <div className="my-map-detail-intro">
          <h2 className="my-map-detail-heading">Подробнее</h2>
          <p className="my-map-detail-sub">
            Дополнительная детализация выбранной сферы — следующий слой разбора.
          </p>
        </div>
        {activeMapTab === "overview" && (
          <TabOverview
            hdChartStatus={hdChartStatus}
            profile={profile}
            profileCompleteness={profileCompleteness}
            onGoToData={onGoToData}
          />
        )}
        {activeMapTab === "talents" && <TabTalents hdChart={hdChart} />}
        {activeMapTab === "career" && (
          <TabCareer hdChart={hdChart} onGoToNewReport={onGoToNewReport} />
        )}
        {activeMapTab === "workEnvironment" && <TabWorkEnvironment hdChart={hdChart} />}
        {activeMapTab === "relationships" && <TabRelationships hdChart={hdChart} />}
        {activeMapTab === "communication" && <TabCommunication hdChart={hdChart} />}
        {activeMapTab === "energyBody" && <TabEnergyBody hdChart={hdChart} />}
        {activeMapTab === "money" && <TabMoney hdChart={hdChart} />}
        {activeMapTab === "developmentPlan" && (
          <TabDevelopmentPlan hdChart={hdChart} onGoToNewReport={onGoToNewReport} />
        )}
      </div>
    </section>
  );
}
