import { useState } from "react";
import type { JSX } from "react";
import BodyGraphViewer from "./BodyGraphViewer";
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

function todayDate(): string {
  return new Intl.DateTimeFormat("ru-RU", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());
}

function getNc(hdChart: HdChartRecord | null): NormalizedChart | null {
  if (!hdChart) return null;
  return hdChart.normalized_chart_json ?? null;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function HeroBlock({
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
      "Сегодня лучше не распыляться. Выберите 1–2 действия, где ваша энергия даст максимальный эффект, и проверяйте решения через свой внутренний способ выбора.";
  } else if (hdChartStatus === "outdated") {
    focusText =
      "Данные рождения изменились. Обновите карту, чтобы рекомендации были точнее.";
  } else {
    focusText =
      "Чтобы собрать персональный фокус дня точнее, сначала рассчитайте карту во вкладке «Данные».";
  }

  return (
    <div className="today-hero">
      <div className="today-hero-eyebrow">
        <span className="today-hero-tag">Сегодня</span>
        <span className="today-hero-date">{todayDate()}</span>
      </div>
      {name && (
        <p className="today-hero-greeting">Привет, {name} 👋</p>
      )}
      <h1 className="today-hero-title">Главный фокус дня</h1>
      <p className="today-hero-focus">{focusText}</p>
      <div className="today-hero-actions">
        <button className="today-btn today-btn--primary" onClick={onGoToCareerMap}>
          Открыть Мою карту
        </button>
        {hdChartStatus === "none" || hdChartStatus === "outdated" ? (
          <button className="today-btn today-btn--secondary" onClick={onGoToData}>
            {hdChartStatus === "outdated" ? "Обновить карту" : "Рассчитать карту"}
          </button>
        ) : (
          <button className="today-btn today-btn--secondary" onClick={onGoToData}>
            Уточнить данные
          </button>
        )}
      </div>
    </div>
  );
}

// Transit preview chips
const TRANSIT_CHIPS = [
  "Солнце дня",
  "Земля дня",
  "Луна",
  "Текущие ворота",
  "Временные каналы",
  "Подсветка центров",
];

function BodyGraphBlock({
  hdChart,
  hdChartStatus,
  hdChartLoading,
  hdChartCalculating,
  onGoToData,
  calculateHdChart,
}: {
  hdChart: HdChartRecord | null;
  hdChartStatus: HdChartStatus;
  hdChartLoading: boolean;
  hdChartCalculating: boolean;
  onGoToData: () => void;
  calculateHdChart: () => void;
}): JSX.Element {
  const [mode, setMode] = useState<"transit" | "my-chart">("my-chart");

  return (
    <div className="today-section today-bodygraph-block">
      <div className="today-section-header">
        <div>
          <h2 className="today-section-title">Бодиграф дня</h2>
          <p className="today-section-subtitle">Натальная карта + будущий транзитный слой</p>
        </div>
        <div className="today-segmented">
          <button
            className={`today-segmented-btn${mode === "transit" ? " today-segmented-btn--active" : ""}`}
            onClick={() => setMode("transit")}
          >
            Сегодня с транзитом
          </button>
          <button
            className={`today-segmented-btn${mode === "my-chart" ? " today-segmented-btn--active" : ""}`}
            onClick={() => setMode("my-chart")}
          >
            Моя карта
          </button>
        </div>
      </div>

      {mode === "transit" ? (
        <TransitPreview onSwitchToMyChart={() => setMode("my-chart")} />
      ) : (
        <div className="today-bodygraph-viewer">
          <BodyGraphViewer
            chart={hdChart}
            status={hdChartStatus}
            loading={hdChartLoading}
            onGoToData={onGoToData}
            onRecalculate={calculateHdChart}
            recalculating={hdChartCalculating}
          />
        </div>
      )}
    </div>
  );
}

function TransitPreview({ onSwitchToMyChart }: { onSwitchToMyChart: () => void }): JSX.Element {
  return (
    <div className="today-transit-preview">
      <div className="today-transit-mock">
        <div className="today-transit-mock-bg">
          <div className="today-transit-mock-orb today-transit-mock-orb--1" />
          <div className="today-transit-mock-orb today-transit-mock-orb--2" />
          <div className="today-transit-mock-orb today-transit-mock-orb--3" />
          <div className="today-transit-mock-icon">✦</div>
          <div className="today-transit-mock-label">Транзитный слой</div>
          <div className="today-transit-mock-sublabel">готовится к подключению</div>
        </div>
      </div>

      <div className="today-transit-info">
        <p className="today-transit-coming">
          На следующем этапе здесь появится реальная карта текущего момента и её наложение на вашу натальную карту.
        </p>

        <div className="today-transit-chips">
          {TRANSIT_CHIPS.map((chip) => (
            <span key={chip} className="today-transit-chip">{chip}</span>
          ))}
        </div>

        <p className="today-transit-note">
          Сейчас экран показывает персональные рекомендации на базе вашей сохранённой карты и профиля. Реальные транзиты будут подключены следующим этапом.
        </p>

        <button className="today-btn today-btn--secondary" onClick={onSwitchToMyChart}>
          Посмотреть мою карту
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Compass cards
// ---------------------------------------------------------------------------

type CompassCard = {
  icon: string;
  title: string;
  text: string;
  color: string;
};

function buildCompassCards(nc: NormalizedChart | null): CompassCard[] {
  const hasChart = !!nc;

  const energy: CompassCard = {
    icon: "⚡",
    title: "Энергия",
    color: "amber",
    text: hasChart
      ? "Сегодня не обязательно брать всё силой. Лучше выбрать действия, где вы действительно чувствуете внутреннее «да», интерес или ясный импульс."
      : "После расчёта карты здесь появится подсказка, как лучше распределять энергию в течение дня.",
  };

  const decisions: CompassCard = {
    icon: "🧭",
    title: "Решения",
    color: "blue",
    text:
      nc?.authority
        ? "Проверяйте важные решения через свой способ выбора, а не через срочность, давление или желание всем быстро ответить."
        : "После расчёта карты здесь появится подсказка по вашему авторитету принятия решений.",
  };

  const communication: CompassCard = {
    icon: "💬",
    title: "Коммуникация",
    color: "violet",
    text: "Сегодня лучше говорить точнее, а не больше. Один ясный запрос может быть сильнее длинного объяснения.",
  };

  const focus: CompassCard = {
    icon: "🎯",
    title: "Фокус",
    color: "green",
    text: "Выберите один главный результат дня. Не превращайте день в бесконечную гонку задач.",
  };

  return [energy, decisions, communication, focus];
}

function CompassSection({ hdChart }: { hdChart: HdChartRecord | null }): JSX.Element {
  const nc = getNc(hdChart);
  const cards = buildCompassCards(nc);

  return (
    <div className="today-section">
      <h2 className="today-section-title">Компас дня</h2>
      <p className="today-section-subtitle">Четыре измерения вашего дня</p>
      <div className="today-compass-grid">
        {cards.map((card) => (
          <div key={card.title} className={`today-compass-card today-compass-card--${card.color}`}>
            <div className="today-compass-card-icon">{card.icon}</div>
            <h3 className="today-compass-card-title">{card.title}</h3>
            <p className="today-compass-card-text">{card.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Quick questions
// ---------------------------------------------------------------------------

const QUICK_QUESTIONS = [
  "На чём мне сегодня сфокусироваться?",
  "Где я могу слить энергию?",
  "Как мне сегодня принимать решения?",
  "Что лучше сделать по работе?",
  "Как экологично общаться сегодня?",
  "Какой один шаг приблизит меня к моей роли?",
];

function QuickQuestionsBlock({ onGoToAiAssistant }: { onGoToAiAssistant: () => void }): JSX.Element {
  return (
    <div className="today-section">
      <h2 className="today-section-title">Спросить ИИ-помощника</h2>
      <p className="today-section-subtitle">Выберите вопрос — откроется чат с помощником</p>
      <div className="today-questions-chips">
        {QUICK_QUESTIONS.map((q) => (
          <button key={q} className="today-question-chip" onClick={onGoToAiAssistant}>
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Day plan
// ---------------------------------------------------------------------------

const DAY_PLAN_STEPS = [
  {
    num: "1",
    title: "Собрать фокус",
    text: "Выберите одну главную задачу дня.",
  },
  {
    num: "2",
    title: "Проверить решение",
    text: "Не принимайте важное решение из давления или спешки.",
  },
  {
    num: "3",
    title: "Закрыть день наблюдением",
    text: "Отметьте, где вы действовали в согласии с собой, а где пытались себя дожать.",
  },
];

function DayPlanBlock(): JSX.Element {
  return (
    <div className="today-section">
      <h2 className="today-section-title">3 шага на сегодня</h2>
      <p className="today-section-subtitle">Минимальная практика для осознанного дня</p>
      <div className="today-plan-steps">
        {DAY_PLAN_STEPS.map((step) => (
          <div key={step.num} className="today-plan-step">
            <div className="today-plan-step-num">{step.num}</div>
            <div className="today-plan-step-body">
              <h3 className="today-plan-step-title">{step.title}</h3>
              <p className="today-plan-step-text">{step.text}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Accuracy block
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

  const chartStatusLabel = (() => {
    switch (hdChartStatus) {
      case "ok": return { text: "Карта рассчитана", ok: true };
      case "outdated": return { text: "Карта устарела — нужен пересчёт", ok: false };
      case "error": return { text: "Ошибка расчёта карты", ok: false };
      case "none": return { text: "Карта не рассчитана", ok: false };
      case "no_coords": return { text: "Нет координат для расчёта карты", ok: false };
    }
  })();

  return (
    <div className="today-section today-accuracy-block">
      <h2 className="today-section-title">Точность сегодняшних подсказок</h2>
      <p className="today-accuracy-intro">
        Чем точнее заполнены данные рождения, профиль и карьерные цели, тем точнее TalentScan сможет объяснять ваш день, роли, энергию и решения.
      </p>

      <div className="today-accuracy-items">
        <div className={`today-accuracy-item${chartStatusLabel.ok ? " today-accuracy-item--ok" : " today-accuracy-item--warn"}`}>
          <span className="today-accuracy-item-icon">{chartStatusLabel.ok ? "✓" : "○"}</span>
          <span>{chartStatusLabel.text}</span>
        </div>

        <div className={`today-accuracy-item${profileCompleteness.percent >= 50 ? " today-accuracy-item--ok" : " today-accuracy-item--warn"}`}>
          <span className="today-accuracy-item-icon">{profileCompleteness.percent >= 50 ? "✓" : "○"}</span>
          <span>Профиль заполнен на {profileCompleteness.percent}% — {profileCompleteness.label}</span>
        </div>

        <div className={`today-accuracy-item${hasBirthData ? " today-accuracy-item--ok" : " today-accuracy-item--warn"}`}>
          <span className="today-accuracy-item-icon">{hasBirthData ? "✓" : "○"}</span>
          <span>{hasBirthData ? "Данные рождения указаны" : "Данные рождения не указаны"}</span>
        </div>

        <div className={`today-accuracy-item${hasCoords ? " today-accuracy-item--ok" : " today-accuracy-item--warn"}`}>
          <span className="today-accuracy-item-icon">{hasCoords ? "✓" : "○"}</span>
          <span>{hasCoords ? "Координаты места рождения есть" : "Координаты места рождения не указаны"}</span>
        </div>
      </div>

      <div className="today-accuracy-actions">
        <button className="today-btn today-btn--secondary today-btn--sm" onClick={onGoToData}>
          Уточнить данные
        </button>
        <button className="today-btn today-btn--ghost today-btn--sm" onClick={onGoToCareerMap}>
          Открыть Мою карту
        </button>
        <button className="today-btn today-btn--ghost today-btn--sm" onClick={() => onGoToNewReport("talent_map")}>
          Сделать новый разбор
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Quick nav
// ---------------------------------------------------------------------------

const QUICK_NAV = [
  { icon: "🗺️", label: "Моя карта", key: "career-map" as const },
  { icon: "📋", label: "Данные", key: "data" as const },
  { icon: "✨", label: "Новый разбор", key: "new-report" as const },
  { icon: "🤖", label: "ИИ-помощник", key: "ai-assistant" as const },
];

type NavKey = "career-map" | "data" | "new-report" | "ai-assistant";

function QuickNavBlock({
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
    <div className="today-section">
      <h2 className="today-section-title">Быстрые переходы</h2>
      <div className="today-quicknav">
        {QUICK_NAV.map((item) => (
          <button
            key={item.key}
            className="today-quicknav-card"
            onClick={() => handleNav(item.key)}
          >
            <span className="today-quicknav-icon" aria-hidden="true">{item.icon}</span>
            <span className="today-quicknav-label">{item.label}</span>
          </button>
        ))}
      </div>
    </div>
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
  calculateHdChart,
}: TodayScreenProps): JSX.Element {
  return (
    <div className="today-screen">
      <HeroBlock
        profile={profile}
        hdChartStatus={hdChartStatus}
        onGoToCareerMap={onGoToCareerMap}
        onGoToData={onGoToData}
      />

      <BodyGraphBlock
        hdChart={hdChart}
        hdChartStatus={hdChartStatus}
        hdChartLoading={hdChartLoading}
        hdChartCalculating={hdChartCalculating}
        onGoToData={onGoToData}
        calculateHdChart={calculateHdChart}
      />

      <CompassSection hdChart={hdChart} />

      <QuickQuestionsBlock onGoToAiAssistant={onGoToAiAssistant} />

      <DayPlanBlock />

      <AccuracyBlock
        profile={profile}
        profileCompleteness={profileCompleteness}
        hdChartStatus={hdChartStatus}
        onGoToData={onGoToData}
        onGoToCareerMap={onGoToCareerMap}
        onGoToNewReport={onGoToNewReport}
      />

      <QuickNavBlock
        onGoToCareerMap={onGoToCareerMap}
        onGoToData={onGoToData}
        onGoToNewReport={onGoToNewReport}
        onGoToAiAssistant={onGoToAiAssistant}
      />
    </div>
  );
}
