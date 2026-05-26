import { useState } from "react";
import type { JSX } from "react";
import type { HdChartRecord, HdChartStatus, NormalizedChart } from "./BodyGraphViewer";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TodayGraphCardProps = {
  hdChart: HdChartRecord | null;
  hdChartStatus: HdChartStatus;
  hdChartLoading: boolean;
  hdChartCalculating?: boolean;
  profileCompletenessPercent: number;
  onGoToMyMap: () => void;
  onGoToData: () => void;
};

function chartStatusLabel(status: HdChartStatus): { text: string; ok: boolean } {
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

type GraphTab = "transit" | "changes" | "base";

function getNc(hdChart: HdChartRecord | null): NormalizedChart | null {
  if (!hdChart) return null;
  return hdChart.normalized_chart_json ?? null;
}

// ---------------------------------------------------------------------------
// Transit tab — structure only, no fake gate/channel numbers
// ---------------------------------------------------------------------------

const TRANSIT_ZONES = [
  { title: "Ворота дня", badge: "transit-ready" },
  { title: "Каналы дня", badge: "скоро" },
  { title: "Временная подсветка центров", badge: "будет подключено" },
  { title: "Совпало с моей картой", badge: "скоро" },
];

function badgeLabel(badge: string): string {
  if (badge === "transit-ready") return "transit-ready";
  if (badge === "будет подключено") return "будет подключено";
  return "скоро";
}

function TransitTab(): JSX.Element {
  return (
    <div className="tgc-transit">
      <div className="tgc-transit-visual">
        <div className="tgc-orb tgc-orb--1" />
        <div className="tgc-orb tgc-orb--2" />
        <div className="tgc-orb tgc-orb--3" />
        <div className="tgc-transit-radar">
          <div className="tgc-radar-ring tgc-radar-ring--outer" />
          <div className="tgc-radar-ring tgc-radar-ring--mid" />
          <div className="tgc-radar-ring tgc-radar-ring--inner" />
          <div className="tgc-transit-center">
            <span className="tgc-transit-star">✦</span>
            <span className="tgc-transit-label">Дневной радар</span>
            <span className="tgc-transit-sub">транзитный слой</span>
          </div>
        </div>
      </div>

      <div className="tgc-transit-zones">
        {TRANSIT_ZONES.map((zone) => (
          <div key={zone.title} className="tgc-transit-zone">
            <span className="tgc-transit-zone-title">{zone.title}</span>
            <span className={`tgc-zone-badge tgc-zone-badge--${zone.badge === "transit-ready" ? "ready" : zone.badge === "будет подключено" ? "pending" : "soon"}`}>
              {badgeLabel(zone.badge)}
            </span>
          </div>
        ))}
      </div>

      <p className="tgc-note">
        Реальные транзитные данные будут подключены следующим этапом. Сейчас экран показывает структуру дневного радара и вашу постоянную базу.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Changes tab — user-facing copy
// ---------------------------------------------------------------------------

const CHANGES_ROWS: { label: string; hint: string }[] = [
  {
    label: "Что может временно усиливаться",
    hint: "Темы дня, которые могут ощущаться ярче обычного",
  },
  {
    label: "Что может ощущаться как внешний фон",
    hint: "Влияния дня, не обязательно «ваши» по природе",
  },
  {
    label: "Что важно не путать со своей постоянной базой",
    hint: "Временное ≠ ваше постоянное определение",
  },
];

function ChangesTab(): JSX.Element {
  return (
    <div className="tgc-changes">
      <p className="tgc-changes-desc">
        После подключения транзитов здесь появится сравнение дня с вашей базовой картой — понятным языком, без технических терминов.
      </p>
      <div className="tgc-changes-rows">
        {CHANGES_ROWS.map((row) => (
          <div key={row.label} className="tgc-changes-row">
            <div className="tgc-changes-row-main">
              <span className="tgc-changes-row-label">{row.label}</span>
              <span className="tgc-changes-row-hint">{row.hint}</span>
            </div>
            <span className="tgc-coming-badge">скоро</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Base tab — real natal data when available
// ---------------------------------------------------------------------------

function BaseTab({
  hdChart,
  hdChartStatus,
  hdChartLoading,
  hdChartCalculating,
  onGoToMyMap,
  onGoToData,
}: TodayGraphCardProps): JSX.Element {
  if (hdChartLoading || hdChartCalculating) {
    return (
      <div className="tgc-base tgc-base--empty">
        <p className="tgc-base-msg">{hdChartCalculating ? "Рассчитываем карту…" : "Загрузка карты…"}</p>
      </div>
    );
  }

  if (hdChartStatus === "none" || !hdChart) {
    return (
      <div className="tgc-base tgc-base--empty">
        <span className="tgc-base-icon">🔮</span>
        <p className="tgc-base-msg">Карта ещё не рассчитана</p>
        <button className="tgc-action-btn" onClick={onGoToData}>
          Перейти в Данные →
        </button>
      </div>
    );
  }

  if (hdChartStatus === "no_coords") {
    return (
      <div className="tgc-base tgc-base--empty">
        <span className="tgc-base-icon">📍</span>
        <p className="tgc-base-msg">Нет координат для расчёта карты</p>
        <button className="tgc-action-btn" onClick={onGoToData}>
          Обновить данные →
        </button>
      </div>
    );
  }

  if (hdChartStatus === "outdated") {
    return (
      <div className="tgc-base tgc-base--outdated">
        <span className="tgc-base-icon">⚠️</span>
        <p className="tgc-base-msg">Карта требует обновления</p>
        <p className="tgc-base-sub">Данные рождения изменились. Пересчитайте карту для точных рекомендаций.</p>
        <button className="tgc-action-btn" onClick={onGoToData}>
          Обновить данные →
        </button>
      </div>
    );
  }

  const nc = getNc(hdChart);
  const definedCenters: string[] = Array.isArray(hdChart.defined_centers)
    ? hdChart.defined_centers
    : nc?.definedCenters ?? [];
  const channels: string[] = Array.isArray(hdChart.channels_short)
    ? hdChart.channels_short
    : nc?.channelsShort ?? [];
  const gates: string[] = nc?.gatesAll?.length
    ? nc.gatesAll
    : Array.isArray(hdChart.gates_all)
    ? hdChart.gates_all
    : [];

  return (
    <div className="tgc-base">
      <div className="tgc-base-rows">
        {hdChart.type && (
          <div className="tgc-base-row">
            <span className="tgc-base-key">Тип</span>
            <span className="tgc-base-val">{hdChart.type}</span>
          </div>
        )}
        {hdChart.profile && (
          <div className="tgc-base-row">
            <span className="tgc-base-key">Профиль</span>
            <span className="tgc-base-val">{hdChart.profile}</span>
          </div>
        )}
        {hdChart.strategy && (
          <div className="tgc-base-row">
            <span className="tgc-base-key">Стратегия</span>
            <span className="tgc-base-val">{hdChart.strategy}</span>
          </div>
        )}
        {hdChart.authority && (
          <div className="tgc-base-row">
            <span className="tgc-base-key">Авторитет</span>
            <span className="tgc-base-val">{hdChart.authority}</span>
          </div>
        )}
        <div className="tgc-base-row">
          <span className="tgc-base-key">Определённых центров</span>
          <span className="tgc-base-val">{definedCenters.length} / 9</span>
        </div>
        <div className="tgc-base-row">
          <span className="tgc-base-key">Каналов</span>
          <span className="tgc-base-val">{channels.length}</span>
        </div>
        {gates.length > 0 && (
          <div className="tgc-base-row">
            <span className="tgc-base-key">Ворот в карте</span>
            <span className="tgc-base-val">{gates.length}</span>
          </div>
        )}
      </div>

      {definedCenters.length > 0 && (
        <div className="tgc-base-section">
          <span className="tgc-base-section-label">Определённые центры</span>
          <div className="tgc-base-centers">
            {definedCenters.slice(0, 6).map((c) => (
              <span key={c} className="tgc-chip tgc-chip--defined">{c}</span>
            ))}
            {definedCenters.length > 6 && (
              <span className="tgc-chip tgc-chip--more">+{definedCenters.length - 6}</span>
            )}
          </div>
        </div>
      )}

      {channels.length > 0 && (
        <div className="tgc-base-section">
          <span className="tgc-base-section-label">Каналы</span>
          <div className="tgc-base-centers">
            {channels.slice(0, 5).map((ch) => (
              <span key={ch} className="tgc-chip">{ch}</span>
            ))}
            {channels.length > 5 && (
              <span className="tgc-chip tgc-chip--more">+{channels.length - 5}</span>
            )}
          </div>
        </div>
      )}

      {gates.length > 0 && (
        <div className="tgc-base-section">
          <span className="tgc-base-section-label">Ворота (выборка)</span>
          <div className="tgc-base-centers">
            {gates.slice(0, 8).map((g) => (
              <span key={g} className="tgc-chip">{g}</span>
            ))}
            {gates.length > 8 && (
              <span className="tgc-chip tgc-chip--more">+{gates.length - 8}</span>
            )}
          </div>
        </div>
      )}

      <button className="tgc-action-btn tgc-action-btn--primary" onClick={onGoToMyMap}>
        Открыть полную карту →
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function TodayGraphCard({
  hdChart,
  hdChartStatus,
  hdChartLoading,
  hdChartCalculating,
  profileCompletenessPercent,
  onGoToMyMap,
  onGoToData,
}: TodayGraphCardProps): JSX.Element {
  const [tab, setTab] = useState<GraphTab>("transit");
  const chart = chartStatusLabel(hdChartStatus);

  return (
    <div className="tgc tgc--dock">
      <div className="tgc-dock-title-row">
        <h3 className="tgc-title">Дневной радар</h3>
        <div className="tgc-dock-badges">
          <span className={`tgc-dock-badge${chart.ok ? " tgc-dock-badge--ok" : ""}`}>
            {chart.text}
          </span>
          <span className="tgc-dock-badge tgc-dock-badge--muted">
            Профиль {profileCompletenessPercent}%
          </span>
        </div>
      </div>
      <div className="tgc-header">
        <div className="tgc-tabs">
          {(["transit", "changes", "base"] as GraphTab[]).map((t) => (
            <button
              key={t}
              className={`tgc-tab${tab === t ? " tgc-tab--active" : ""}`}
              onClick={() => setTab(t)}
            >
              {t === "transit" ? "Транзит" : t === "changes" ? "Изменения" : "Моя база"}
            </button>
          ))}
        </div>
      </div>

      <div className="tgc-body">
        {tab === "transit" && <TransitTab />}
        {tab === "changes" && <ChangesTab />}
        {tab === "base" && (
          <BaseTab
            hdChart={hdChart}
            hdChartStatus={hdChartStatus}
            hdChartLoading={hdChartLoading}
            hdChartCalculating={hdChartCalculating}
            profileCompletenessPercent={profileCompletenessPercent}
            onGoToMyMap={onGoToMyMap}
            onGoToData={onGoToData}
          />
        )}
      </div>
    </div>
  );
}
