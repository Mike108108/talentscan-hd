import { useState } from "react";
import type { JSX } from "react";
import TodayGraphCard from "./TodayGraphCard";
import type { HdChartRecord, HdChartStatus, NormalizedChart } from "./BodyGraphViewer";
import type { AnalysisType } from "../lib/supabase";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type UserProfile = {
  displayName: string;
  birthDate: string;
  birthTime: string;
  birthPlace: string;
  birthTimeAccuracy: string;
  birthPlaceLabel: string;
  birthLatitude: number | null;
  birthLongitude: number | null;
  [key: string]: unknown;
};

type ProfileCompleteness = {
  percent: number;
  label: string;
};

type TodayScreenProps = {
  profile: UserProfile;
  profileCompleteness: ProfileCompleteness;
  hdChart: HdChartRecord | null;
  hdChartStatus: HdChartStatus;
  hdChartLoading: boolean;
  hdChartCalculating: boolean;
  reportsCount: number;
  onGoToCareerMap: () => void;
  onGoToData: () => void;
  onGoToNewReport: (type: AnalysisType) => void;
  onGoToAiAssistant: () => void;
  calculateHdChart: () => void;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function todayDateCompact(): string {
  const d = new Date();
  const weekday = new Intl.DateTimeFormat("ru-RU", { weekday: "long" }).format(d);
  const dayMonth = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long" }).format(d);
  return `${weekday.charAt(0).toUpperCase() + weekday.slice(1)}, ${dayMonth}`;
}

function getNc(hdChart: HdChartRecord | null): NormalizedChart | null {
  if (!hdChart) return null;
  return hdChart.normalized_chart_json ?? null;
}

// ---------------------------------------------------------------------------
// Planet strip (preview)
// ---------------------------------------------------------------------------

const PLANETS = [
  { symbol: "☉", name: "Солнце" },
  { symbol: "⊕", name: "Земля" },
  { symbol: "☽", name: "Луна" },
  { symbol: "☿", name: "Меркурий" },
  { symbol: "♀", name: "Венера" },
  { symbol: "♂", name: "Марс" },
];

function PlanetStrip(): JSX.Element {
  return (
    <div className="today-planet-strip">
      <span className="today-planet-strip-heading">Планеты сегодня</span>
      <div className="today-planet-pills">
        {PLANETS.map((p) => (
          <div key={p.name} className="today-planet-pill">
            <span className="today-planet-symbol">{p.symbol}</span>
            <span className="today-planet-name">{p.name}</span>
            <span className="today-planet-badge">скоро</span>
          </div>
        ))}
      </div>
      <p className="today-planet-note">
        Реальные положения планет будут подключены следующим этапом.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// A. Compact Hero
// ---------------------------------------------------------------------------

function CompactHero({
  profile,
  hdChartStatus,
  onGoToCareerMap,
  onGoToData,
}: {
  profile: UserProfile;
  hdChartStatus: HdChartStatus;
  onGoToCareerMap: () => void;
  onGoToData: () => void;
}): JSX.Element {
  const name = profile.displayName;

  let focusText: string;
  if (hdChartStatus === "ok") {
    focusText =
      "Выберите 1–2 действия, где ваша энергия даст максимальный эффект, и проверяйте решения через свой внутренний способ выбора.";
  } else if (hdChartStatus === "outdated") {
    focusText = "Данные рождения изменились. Обновите карту, чтобы рекомендации стали точнее.";
  } else {
    focusText = "Рассчитайте карту во вкладке «Данные» — и фокус дня станет персональным.";
  }

  return (
    <div className="today-compact-hero">
      <div className="today-compact-hero-top">
        <div className="today-compact-hero-left">
          <div className="today-compact-hero-eyebrow">
            <span className="today-hero-tag">Сегодня</span>
            <span className="today-hero-date">{todayDateCompact()}</span>
          </div>
          {name && <p className="today-compact-hero-greeting">Привет, {name}</p>}
          <h1 className="today-compact-hero-title">Главный фокус дня</h1>
          <p className="today-compact-hero-text">{focusText}</p>
        </div>
        <div className="today-compact-hero-actions">
          <button className="today-btn today-btn--primary today-btn--sm" onClick={onGoToCareerMap}>
            Моя карта
          </button>
          <button className="today-btn today-btn--ghost today-btn--sm" onClick={onGoToData}>
            {hdChartStatus === "outdated"
              ? "Обновить карту"
              : hdChartStatus === "none"
              ? "Рассчитать карту"
              : "Данные"}
          </button>
        </div>
      </div>
      <PlanetStrip />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Quick rail (left side)
// ---------------------------------------------------------------------------

const QUICK_NAV = [
  { icon: "🗺️", label: "Моя карта", key: "career-map" as const },
  { icon: "📋", label: "Данные", key: "data" as const },
  { icon: "✨", label: "Новый разбор", key: "new-report" as const },
  { icon: "🤖", label: "ИИ-помощник", key: "ai-assistant" as const },
];

type NavKey = "career-map" | "data" | "new-report" | "ai-assistant";

function QuickRail({
  onGoToCareerMap,
  onGoToData,
  onGoToNewReport,
  onGoToAiAssistant,
}: {
  onGoToCareerMap: () => void;
  onGoToData: () => void;
  onGoToNewReport: (type: AnalysisType) => void;
  onGoToAiAssistant: () => void;
}): JSX.Element {
  function handleNav(key: NavKey) {
    switch (key) {
      case "career-map": onGoToCareerMap(); break;
      case "data": onGoToData(); break;
      case "new-report": onGoToNewReport("talent_map"); break;
      case "ai-assistant": onGoToAiAssistant(); break;
    }
  }
  return (
    <div className="today-quick-rail">
      {QUICK_NAV.map((item) => (
        <button
          key={item.key}
          className="today-quick-rail-btn"
          onClick={() => handleNav(item.key)}
        >
          <span className="today-quick-rail-icon" aria-hidden="true">{item.icon}</span>
          <span className="today-quick-rail-label">{item.label}</span>
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mini accuracy status (left side, bottom)
// ---------------------------------------------------------------------------

function MiniAccuracy({
  profileCompleteness,
  hdChartStatus,
  onGoToData,
}: {
  profileCompleteness: ProfileCompleteness;
  hdChartStatus: HdChartStatus;
  onGoToData: () => void;
}): JSX.Element {
  const chartOk = hdChartStatus === "ok";
  const profileOk = profileCompleteness.percent >= 50;

  return (
    <div className="today-mini-accuracy">
      <p className="today-mini-accuracy-title">Точность подсказок</p>
      <div className="today-mini-accuracy-row">
        <span className={`today-mini-dot${chartOk ? " today-mini-dot--ok" : ""}`} />
        <span className="today-mini-accuracy-text">
          {chartOk ? "Карта рассчитана" : hdChartStatus === "outdated" ? "Карта устарела" : "Карта не рассчитана"}
        </span>
      </div>
      <div className="today-mini-accuracy-row">
        <span className={`today-mini-dot${profileOk ? " today-mini-dot--ok" : ""}`} />
        <span className="today-mini-accuracy-text">Профиль {profileCompleteness.percent}%</span>
      </div>
      {!chartOk && (
        <button className="today-mini-accuracy-cta" onClick={onGoToData}>
          Уточнить данные →
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// B. AI mini-card (right side, top)
// ---------------------------------------------------------------------------

const AI_QUICK_QUESTIONS = [
  "На чём мне сегодня сфокусироваться?",
  "Это моё состояние или фон дня?",
  "Как мне принять решение?",
  "Где я могу перегореть?",
];

function AiMiniCard({ onGoToAiAssistant }: { onGoToAiAssistant: () => void }): JSX.Element {
  return (
    <div className="today-ai-card">
      <div className="today-ai-card-header">
        <span className="today-ai-card-icon">🤖</span>
        <div>
          <h3 className="today-ai-card-title">ИИ-помощник</h3>
          <p className="today-ai-card-sub">Спросите, как прожить день точнее</p>
        </div>
      </div>
      <div className="today-ai-chips">
        {AI_QUICK_QUESTIONS.map((q) => (
          <button key={q} className="today-ai-chip" onClick={onGoToAiAssistant}>
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// C. Compass day (right side, compact 2x2)
// ---------------------------------------------------------------------------

type CompassCard = {
  icon: string;
  title: string;
  text: string;
  color: string;
};

function buildCompassCards(nc: NormalizedChart | null): CompassCard[] {
  const hasChart = !!nc;
  return [
    {
      icon: "⚡",
      title: "Энергия",
      color: "amber",
      text: hasChart
        ? "Выбирайте действия, где чувствуете внутреннее «да» или ясный импульс."
        : "Рассчитайте карту — здесь появится подсказка по энергии.",
    },
    {
      icon: "🧭",
      title: "Решения",
      color: "blue",
      text: nc?.authority
        ? "Проверяйте решения через свой авторитет, а не через срочность."
        : "После расчёта карты — подсказка по авторитету решений.",
    },
    {
      icon: "💬",
      title: "Коммуникация",
      color: "violet",
      text: "Говорите точнее, а не больше. Один ясный запрос сильнее длинного объяснения.",
    },
    {
      icon: "🎯",
      title: "Фокус",
      color: "green",
      text: "Один главный результат дня. Не превращайте его в гонку задач.",
    },
  ];
}

function CompassBlock({ hdChart }: { hdChart: HdChartRecord | null }): JSX.Element {
  const cards = buildCompassCards(getNc(hdChart));
  return (
    <div className="today-section">
      <h2 className="today-section-title">Компас дня</h2>
      <div className="today-compass-grid">
        {cards.map((card) => (
          <div key={card.title} className={`today-compass-card today-compass-card--${card.color}`}>
            <span className="today-compass-icon">{card.icon}</span>
            <strong className="today-compass-label">{card.title}</strong>
            <p className="today-compass-text">{card.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// D. Day plan (compact)
// ---------------------------------------------------------------------------

const DAY_PLAN = [
  { num: "1", title: "Собрать фокус", text: "Выберите одну главную задачу дня." },
  { num: "2", title: "Проверить решение", text: "Не принимайте важное решение из давления или спешки." },
  { num: "3", title: "Закрыть день наблюдением", text: "Где вы действовали в согласии с собой, а где дожимали себя?" },
];

function DayPlanBlock(): JSX.Element {
  return (
    <div className="today-section">
      <h2 className="today-section-title">3 шага на сегодня</h2>
      <div className="today-plan">
        {DAY_PLAN.map((step) => (
          <div key={step.num} className="today-plan-row">
            <div className="today-plan-num">{step.num}</div>
            <div>
              <strong className="today-plan-title">{step.title}</strong>
              <p className="today-plan-text">{step.text}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// E. Accuracy block (right side, full)
// ---------------------------------------------------------------------------

function AccuracyBlock({
  profile,
  profileCompleteness,
  hdChartStatus,
  onGoToData,
  onGoToCareerMap,
  onGoToNewReport,
}: {
  profile: UserProfile;
  profileCompleteness: ProfileCompleteness;
  hdChartStatus: HdChartStatus;
  onGoToData: () => void;
  onGoToCareerMap: () => void;
  onGoToNewReport: (type: AnalysisType) => void;
}): JSX.Element {
  const hasBirthData = !!(profile.birthDate && profile.birthTime);
  const hasCoords = !!profile.birthLatitude;

  const chartRow = (() => {
    switch (hdChartStatus) {
      case "ok": return { text: "Карта рассчитана", ok: true };
      case "outdated": return { text: "Карта устарела", ok: false };
      case "error": return { text: "Ошибка расчёта", ok: false };
      case "none": return { text: "Карта не рассчитана", ok: false };
      case "no_coords": return { text: "Нет координат для карты", ok: false };
    }
  })();

  const rows = [
    chartRow,
    { text: `Профиль ${profileCompleteness.percent}% — ${profileCompleteness.label}`, ok: profileCompleteness.percent >= 50 },
    { text: hasBirthData ? "Данные рождения указаны" : "Данные рождения не указаны", ok: hasBirthData },
    { text: hasCoords ? "Координаты есть" : "Координаты не указаны", ok: hasCoords },
  ];

  return (
    <div className="today-section">
      <h2 className="today-section-title">Точность подсказок</h2>
      <p className="today-accuracy-intro">
        Чем точнее данные рождения, профиль и цели — тем точнее TalentScan объясняет ваш день, роли и решения.
      </p>
      <div className="today-accuracy-rows">
        {rows.map((row, i) => (
          <div key={i} className={`today-accuracy-row${row.ok ? " today-accuracy-row--ok" : ""}`}>
            <span className="today-accuracy-dot">{row.ok ? "✓" : "○"}</span>
            <span>{row.text}</span>
          </div>
        ))}
      </div>
      <div className="today-accuracy-actions">
        <button className="today-btn today-btn--secondary today-btn--sm" onClick={onGoToData}>
          Уточнить данные
        </button>
        <button className="today-btn today-btn--ghost today-btn--sm" onClick={onGoToCareerMap}>
          Моя карта
        </button>
        <button className="today-btn today-btn--ghost today-btn--sm" onClick={() => onGoToNewReport("talent_map")}>
          Новый разбор
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Floating AI button + drawer
// ---------------------------------------------------------------------------

const DRAWER_QUESTIONS = [
  "На чём мне сегодня сфокусироваться?",
  "Где я могу слить энергию?",
  "Как принять решение?",
  "Что сегодня важно по работе?",
];

function FloatingAi({ onGoToAiAssistant }: { onGoToAiAssistant: () => void }): JSX.Element {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="today-ai-backdrop"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Drawer */}
      {open && (
        <div className="today-ai-drawer" role="dialog" aria-label="ИИ-помощник">
          <div className="today-ai-drawer-header">
            <span className="today-ai-drawer-title">ИИ-помощник TalentScan</span>
            <button
              className="today-ai-drawer-close"
              onClick={() => setOpen(false)}
              aria-label="Закрыть"
            >
              ×
            </button>
          </div>
          <p className="today-ai-drawer-note">
            Полноценный чат будет подключён следующим этапом.
          </p>
          <div className="today-ai-drawer-chips">
            {DRAWER_QUESTIONS.map((q) => (
              <button
                key={q}
                className="today-ai-chip"
                onClick={() => {
                  setOpen(false);
                  onGoToAiAssistant();
                }}
              >
                {q}
              </button>
            ))}
          </div>
          <button
            className="today-btn today-btn--primary"
            style={{ width: "100%", marginTop: "0.75rem" }}
            onClick={() => {
              setOpen(false);
              onGoToAiAssistant();
            }}
          >
            Открыть ИИ-помощника
          </button>
        </div>
      )}

      {/* Float button */}
      <button
        className={`today-ai-float${open ? " today-ai-float--open" : ""}`}
        onClick={() => setOpen((v) => !v)}
        aria-label="ИИ-помощник"
      >
        <span className="today-ai-float-icon">{open ? "×" : "💬"}</span>
      </button>
    </>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function TodayScreen({
  profile,
  profileCompleteness,
  hdChart,
  hdChartStatus,
  hdChartLoading,
  hdChartCalculating,
  onGoToCareerMap,
  onGoToData,
  onGoToNewReport,
  onGoToAiAssistant,
  calculateHdChart: _calculateHdChart,
}: TodayScreenProps): JSX.Element {
  return (
    <div className="today-screen">
      {/* Compact header */}
      <CompactHero
        profile={profile}
        hdChartStatus={hdChartStatus}
        onGoToCareerMap={onGoToCareerMap}
        onGoToData={onGoToData}
      />

      {/* Cockpit grid */}
      <div className="today-cockpit">
        {/* LEFT RAIL — sticky on desktop */}
        <div className="today-left-rail">
          <TodayGraphCard
            hdChart={hdChart}
            hdChartStatus={hdChartStatus}
            hdChartLoading={hdChartLoading}
            hdChartCalculating={hdChartCalculating}
            onGoToMyMap={onGoToCareerMap}
            onGoToData={onGoToData}
          />

          <QuickRail
            onGoToCareerMap={onGoToCareerMap}
            onGoToData={onGoToData}
            onGoToNewReport={onGoToNewReport}
            onGoToAiAssistant={onGoToAiAssistant}
          />

          <MiniAccuracy
            profileCompleteness={profileCompleteness}
            hdChartStatus={hdChartStatus}
            onGoToData={onGoToData}
          />
        </div>

        {/* RIGHT FLOW — scrollable */}
        <div className="today-right-flow">
          <AiMiniCard onGoToAiAssistant={onGoToAiAssistant} />

          <CompassBlock hdChart={hdChart} />

          <DayPlanBlock />

          <AccuracyBlock
            profile={profile}
            profileCompleteness={profileCompleteness}
            hdChartStatus={hdChartStatus}
            onGoToData={onGoToData}
            onGoToCareerMap={onGoToCareerMap}
            onGoToNewReport={onGoToNewReport}
          />
        </div>
      </div>

      {/* Floating AI */}
      <FloatingAi onGoToAiAssistant={onGoToAiAssistant} />
    </div>
  );
}
