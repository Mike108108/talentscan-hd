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

function ChartPassport({
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
    {
      label: "Крест",
      value: nc?.incarnationCross ?? hdChart?.incarnation_cross,
    },
    { label: "Сигнатура", value: nc?.signature ?? hdChart?.signature },
    {
      label: "Не-я тема",
      value: nc?.notSelfTheme ?? hdChart?.not_self_theme,
    },
  ];

  const filledRows = rows.filter((r) => r.value && r.value !== "—");

  return (
    <aside className="my-map-passport" aria-label="Паспорт карты">
      <div className="my-map-passport-card">
        <h2 className="my-map-passport-title">Паспорт карты</h2>
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

  return (
    <section className="my-map-screen">
      <CompactMapHeader
        hdChartStatus={hdChartStatus}
        profileCompleteness={profileCompleteness}
        hdChart={hdChart}
      />

      <MapFeedTabs active={activeMapTab} onChange={setActiveMapTab} />

      <div className="my-map-cockpit">
        <div className="my-map-cockpit-graph">
          <BodyGraphViewer
            chart={hdChart}
            status={hdChartStatus}
            loading={hdChartLoading}
            onGoToData={onGoToData}
            onRecalculate={calculateHdChart}
            recalculating={hdChartCalculating}
          />
        </div>
        <ChartPassport hdChart={hdChart} hdChartStatus={hdChartStatus} />
      </div>

      <div className="my-map-tab-content" role="tabpanel">
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
