import { useState } from "react";
import type { JSX } from "react";
import TodayGraphCard from "./TodayGraphCard";
import type { HdChartRecord, HdChartStatus, NormalizedChart } from "./BodyGraphViewer";

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
  onGoToNewReport: (type: import("../lib/supabase").AnalysisType) => void;
  onGoToAiAssistant: () => void;
  calculateHdChart: () => void;
};

type FeedTab = "focus" | "planets" | "recommendations" | "practice" | "ai";

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
// Planets tab data (preview only — no real positions)
// ---------------------------------------------------------------------------

const PLANETS = [
  { symbol: "☉", name: "Солнце", role: "Главный фокус дня", badge: "скоро" as const },
  { symbol: "⊕", name: "Земля", role: "Заземление и опора", badge: "скоро" as const },
  { symbol: "☽", name: "Луна", role: "Эмоциональный и телесный импульс", badge: "будет подключено" as const },
  { symbol: "☿", name: "Меркурий", role: "Мысли и коммуникация", badge: "скоро" as const },
  { symbol: "♀", name: "Венера", role: "Ценности и отношения", badge: "скоро" as const },
  { symbol: "♂", name: "Марс", role: "Действие, напряжение и взросление", badge: "будет подключено" as const },
];

// ---------------------------------------------------------------------------
// Compact date line (minimal header)
// ---------------------------------------------------------------------------

function CompactDateLine({
  hdChartStatus,
  onGoToData,
}: {
  hdChartStatus: HdChartStatus;
  onGoToData: () => void;
}): JSX.Element {
  const showDataCta =
    hdChartStatus === "none" ||
    hdChartStatus === "outdated" ||
    hdChartStatus === "no_coords" ||
    hdChartStatus === "error";

  return (
    <header className="today-date-line">
      <span className="today-hero-date">{todayDateCompact()}</span>
      {showDataCta && (
        <button className="today-date-line-cta" onClick={onGoToData}>
          {hdChartStatus === "outdated"
            ? "Обновить данные"
            : hdChartStatus === "none"
            ? "Перейти в Данные"
            : "Уточнить данные"}
        </button>
      )}
    </header>
  );
}

// ---------------------------------------------------------------------------
// Browser-like feed tabs
// ---------------------------------------------------------------------------

const FEED_TABS: { id: FeedTab; label: string }[] = [
  { id: "focus", label: "Фокус дня" },
  { id: "planets", label: "Планеты сейчас" },
  { id: "recommendations", label: "Рекомендации" },
  { id: "practice", label: "Практика" },
  { id: "ai", label: "AI-чат" },
];

function FeedTabs({
  active,
  onChange,
}: {
  active: FeedTab;
  onChange: (tab: FeedTab) => void;
}): JSX.Element {
  return (
    <div className="today-feed-tabs" role="tablist" aria-label="Контент дня">
      {FEED_TABS.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={active === t.id}
          className={`today-feed-tab${active === t.id ? " today-feed-tab--active" : ""}`}
          onClick={() => onChange(t.id)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Фокус дня
// ---------------------------------------------------------------------------

function buildFocusContent(
  hdChartStatus: HdChartStatus,
  nc: NormalizedChart | null,
): {
  main: string;
  supports: string;
  watch: string;
  phrase: string;
} {
  if (hdChartStatus === "ok" && nc) {
    const strategy = nc.strategy ?? "вашей стратегии";
    const authority = nc.authority ?? "внутреннего способа выбора";
    return {
      main: "Выберите 1–2 действия, где ваша энергия даст максимальный эффект, и проверяйте решения через свой внутренний способ выбора.",
      supports: `Сегодня поддерживает опора на ${strategy.toLowerCase()} и ясность через ${authority.toLowerCase()}.`,
      watch: "Не превращайте день в гонку задач и не принимайте важное решение из давления или спешки.",
      phrase: "Один главный результат — сильнее десяти половинных.",
    };
  }
  if (hdChartStatus === "outdated") {
    return {
      main: "Данные рождения изменились — обновите карту, чтобы фокус дня снова стал персональным.",
      supports: "Пока рекомендации опираются на последнюю сохранённую версию профиля.",
      watch: "Не опирайтесь на устаревшие выводы при важных решениях.",
      phrase: "Точность данных — основа точного дня.",
    };
  }
  return {
    main: "Рассчитайте карту во вкладке «Данные» — и фокус дня станет персональным.",
    supports: "Сейчас подсказки общие: соберите один приоритет и проверьте, откуда приходит импульс к действию.",
    watch: "Не перегружайте день лишними обязательствами без внутреннего «да».",
    phrase: "Меньше шума — больше ясности.",
  };
}

function FocusTabPanel({
  displayName,
  hdChart,
  hdChartStatus,
}: {
  displayName: string;
  hdChart: HdChartRecord | null;
  hdChartStatus: HdChartStatus;
}): JSX.Element {
  const nc = getNc(hdChart);
  const content = buildFocusContent(hdChartStatus, nc);

  return (
    <div className="today-feed-panel">
      {displayName && (
        <p className="today-focus-greeting">Привет, {displayName}</p>
      )}
      <section className="today-focus-block">
        <h2 className="today-feed-heading">Главный фокус</h2>
        <p className="today-focus-lead">{content.main}</p>
      </section>
      <section className="today-focus-grid">
        <div className="today-focus-card">
          <h3 className="today-focus-card-title">Что сегодня поддерживает</h3>
          <p className="today-focus-card-text">{content.supports}</p>
        </div>
        <div className="today-focus-card">
          <h3 className="today-focus-card-title">Где быть внимательнее</h3>
          <p className="today-focus-card-text">{content.watch}</p>
        </div>
      </section>
      <blockquote className="today-phrase-day">{content.phrase}</blockquote>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Планеты сейчас
// ---------------------------------------------------------------------------

function PlanetsTabPanel(): JSX.Element {
  return (
    <div className="today-feed-panel">
      <div className="today-planets-grid">
        {PLANETS.map((p) => (
          <div key={p.name} className="today-planet-card">
            <div className="today-planet-card-top">
              <span className="today-planet-card-symbol">{p.symbol}</span>
              <span
                className={`today-planet-card-badge${
                  p.badge === "будет подключено" ? " today-planet-card-badge--pending" : ""
                }`}
              >
                {p.badge}
              </span>
            </div>
            <h3 className="today-planet-card-name">{p.name}</h3>
            <p className="today-planet-card-role">{p.role}</p>
          </div>
        ))}
      </div>
      <p className="today-planets-footer">
        Позже здесь появятся реальные положения планет и их влияние на вашу карту: какие
        темы дня активируются, что усиливается, где быть внимательнее и как использовать
        этот фон practically.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Рекомендации
// ---------------------------------------------------------------------------

type RecCard = { icon: string; title: string; text: string; color: string };

function buildRecommendationCards(nc: NormalizedChart | null, hasChart: boolean): RecCard[] {
  return [
    {
      icon: "💼",
      title: "Работа",
      color: "blue",
      text: hasChart
        ? "Выбирайте задачи, где чувствуете внутреннее «да». Один сильный результат важнее длинного списка."
        : "После расчёта карты здесь появится подсказка по рабочему ритму.",
    },
    {
      icon: "💬",
      title: "Коммуникация",
      color: "violet",
      text: "Говорите точнее, а не больше. Один ясный запрос сильнее длинного объяснения.",
    },
    {
      icon: "⚡",
      title: "Энергия",
      color: "amber",
      text: hasChart
        ? "Действуйте там, где чувствуете импульс или ясность — не там, где «надо срочно»."
        : "Рассчитайте карту — здесь появится подсказка по энергии дня.",
    },
    {
      icon: "🧭",
      title: "Решения",
      color: "teal",
      text: nc?.authority
        ? `Проверяйте решения через ${nc.authority.toLowerCase()}, а не через срочность или чужое давление.`
        : "После расчёта карты — подсказка по вашему способу принятия решений.",
    },
    {
      icon: "💎",
      title: "Деньги / ценность",
      color: "green",
      text: "Сверяйте траты и обязательства с тем, что для вас действительно ценно сегодня — не с фоновой тревогой.",
    },
  ];
}

function RecommendationsTabPanel({ hdChart }: { hdChart: HdChartRecord | null }): JSX.Element {
  const nc = getNc(hdChart);
  const cards = buildRecommendationCards(nc, !!nc);

  return (
    <div className="today-feed-panel">
      <div className="today-rec-grid">
        {cards.map((card) => (
          <div key={card.title} className={`today-rec-card today-rec-card--${card.color}`}>
            <span className="today-rec-icon">{card.icon}</span>
            <h3 className="today-rec-title">{card.title}</h3>
            <p className="today-rec-text">{card.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Практика
// ---------------------------------------------------------------------------

const PRACTICE_ACTIONS = [
  { num: "1", title: "Собрать фокус", text: "Выберите одну главную задачу дня и зафиксируйте её письменно." },
  { num: "2", title: "Проверить решение", text: "Не принимайте важное решение из давления, спешки или чужого ожидания." },
  { num: "3", title: "Закрыть день наблюдением", text: "Отметьте: где вы действовали в согласии с собой, а где дожимали себя." },
];

function PracticeTabPanel(): JSX.Element {
  return (
    <div className="today-feed-panel">
      <section className="today-practice-section">
        <h2 className="today-feed-heading">3 действия на сегодня</h2>
        <div className="today-plan">
          {PRACTICE_ACTIONS.map((step) => (
            <div key={step.num} className="today-plan-row">
              <div className="today-plan-num">{step.num}</div>
              <div>
                <strong className="today-plan-title">{step.title}</strong>
                <p className="today-plan-text">{step.text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
      <section className="today-practice-section">
        <h2 className="today-feed-heading">Короткий план</h2>
        <p className="today-practice-plan">
          Утро — один приоритет. День — проверка импульса перед важным шагом. Вечер — короткая
          фиксация: что сработало, что забрало энергию.
        </p>
      </section>
      <section className="today-practice-question">
        <span className="today-practice-question-label">Вопрос для самонаблюдения</span>
        <p className="today-practice-question-text">
          Где сегодня я действовал из внутреннего «да», а где — из привычки «надо»?
        </p>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: AI-чат
// ---------------------------------------------------------------------------

const AI_QUICK_QUESTIONS = [
  "На чём мне сегодня сфокусироваться?",
  "Это моё состояние или фон дня?",
  "Как мне принять решение?",
  "Где я могу перегореть?",
];

function AiTabPanel({ onGoToAiAssistant }: { onGoToAiAssistant: () => void }): JSX.Element {
  return (
    <div className="today-feed-panel">
      <p className="today-ai-tab-intro">
        Быстрые вопросы к AI-помощнику. Полноценный чат — в разделе «AI-помощник».
      </p>
      <div className="today-ai-chips">
        {AI_QUICK_QUESTIONS.map((q) => (
          <button key={q} className="today-ai-chip" onClick={onGoToAiAssistant}>
            {q}
          </button>
        ))}
      </div>
      <button className="today-btn today-btn--primary" onClick={onGoToAiAssistant}>
        Открыть AI-помощник
      </button>
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
      {open && (
        <div
          className="today-ai-backdrop"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      {open && (
        <div className="today-ai-drawer" role="dialog" aria-label="AI-помощник">
          <div className="today-ai-drawer-header">
            <span className="today-ai-drawer-title">AI-помощник TalentScan</span>
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
            Открыть AI-помощник
          </button>
        </div>
      )}

      <button
        className={`today-ai-float${open ? " today-ai-float--open" : ""}`}
        onClick={() => setOpen((v) => !v)}
        aria-label="AI-помощник"
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
  onGoToAiAssistant,
  calculateHdChart: _calculateHdChart,
}: TodayScreenProps): JSX.Element {
  const [feedTab, setFeedTab] = useState<FeedTab>("focus");

  return (
    <div className="today-screen">
      <CompactDateLine hdChartStatus={hdChartStatus} onGoToData={onGoToData} />

      <div className="today-cockpit">
        <main className="today-main-feed">
          <FeedTabs active={feedTab} onChange={setFeedTab} />
          <div className="today-feed-content" role="tabpanel">
            {feedTab === "focus" && (
              <FocusTabPanel
                displayName={profile.displayName}
                hdChart={hdChart}
                hdChartStatus={hdChartStatus}
              />
            )}
            {feedTab === "planets" && <PlanetsTabPanel />}
            {feedTab === "recommendations" && (
              <RecommendationsTabPanel hdChart={hdChart} />
            )}
            {feedTab === "practice" && <PracticeTabPanel />}
            {feedTab === "ai" && <AiTabPanel onGoToAiAssistant={onGoToAiAssistant} />}
          </div>
        </main>

        <aside className="today-transit-dock">
          <TodayGraphCard
            hdChart={hdChart}
            hdChartStatus={hdChartStatus}
            hdChartLoading={hdChartLoading}
            hdChartCalculating={hdChartCalculating}
            profileCompletenessPercent={profileCompleteness.percent}
            onGoToMyMap={onGoToCareerMap}
            onGoToData={onGoToData}
          />
        </aside>
      </div>

      <FloatingAi onGoToAiAssistant={onGoToAiAssistant} />
    </div>
  );
}
