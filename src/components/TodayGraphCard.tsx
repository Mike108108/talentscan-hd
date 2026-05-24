import { useState } from "react";
import type { JSX } from "react";
import type { HdChartRecord, HdChartStatus } from "./BodyGraphViewer";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TodayGraphCardProps = {
  hdChart: HdChartRecord | null;
  hdChartStatus: HdChartStatus;
  hdChartLoading: boolean;
  hdChartCalculating?: boolean;
  onGoToMyMap: () => void;
  onGoToData: () => void;
};

type GraphTab = "transit" | "changes" | "base";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TRANSIT_CHIPS = [
  "Солнце дня",
  "Земля дня",
  "Луна",
  "Текущие ворота",
  "Временные каналы",
  "Подсветка центров",
];

const CHANGES_ROWS: { label: string }[] = [
  { label: "Новые активации дня" },
  { label: "Временные каналы" },
  { label: "Подсветка открытых центров" },
  { label: "Главное отличие дня" },
];

// ---------------------------------------------------------------------------
// Sub-tabs
// ---------------------------------------------------------------------------

function TransitTab(): JSX.Element {
  return (
    <div className="tgc-transit">
      <div className="tgc-transit-visual">
        <div className="tgc-orb tgc-orb--1" />
        <div className="tgc-orb tgc-orb--2" />
        <div className="tgc-orb tgc-orb--3" />
        <div className="tgc-transit-center">
          <span className="tgc-transit-star">✦</span>
          <span className="tgc-transit-label">Транзитный слой</span>
          <span className="tgc-transit-sub">подключается следующим этапом</span>
        </div>
      </div>

      <div className="tgc-transit-chips">
        {TRANSIT_CHIPS.map((chip) => (
          <span key={chip} className="tgc-chip">{chip}</span>
        ))}
      </div>

      <p className="tgc-note">
        Реальные транзиты будут подключены следующим этапом. Сейчас рекомендации строятся на вашей сохранённой карте и профиле.
      </p>
    </div>
  );
}

function ChangesTab(): JSX.Element {
  return (
    <div className="tgc-changes">
      <p className="tgc-changes-desc">
        После подключения транзитов здесь появится список отличий между вашей базовой картой и картой текущего дня: новые ворота, временные каналы, подсвеченные центры и темы дня.
      </p>
      <div className="tgc-changes-rows">
        {CHANGES_ROWS.map((row) => (
          <div key={row.label} className="tgc-changes-row">
            <span className="tgc-changes-row-dot" />
            <span className="tgc-changes-row-label">{row.label}</span>
            <span className="tgc-coming-badge">Скоро</span>
          </div>
        ))}
      </div>
    </div>
  );
}

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
          Указать место рождения →
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

  const definedCenters: string[] = Array.isArray(hdChart.defined_centers)
    ? hdChart.defined_centers
    : [];
  const channelsCount = Array.isArray(hdChart.channels_short)
    ? hdChart.channels_short.length
    : 0;

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
        {hdChart.authority && (
          <div className="tgc-base-row">
            <span className="tgc-base-key">Авторитет</span>
            <span className="tgc-base-val">{hdChart.authority}</span>
          </div>
        )}
        {hdChart.strategy && (
          <div className="tgc-base-row">
            <span className="tgc-base-key">Стратегия</span>
            <span className="tgc-base-val">{hdChart.strategy}</span>
          </div>
        )}
        <div className="tgc-base-row">
          <span className="tgc-base-key">Определённых центров</span>
          <span className="tgc-base-val">{definedCenters.length} / 9</span>
        </div>
        <div className="tgc-base-row">
          <span className="tgc-base-key">Каналов</span>
          <span className="tgc-base-val">{channelsCount}</span>
        </div>
      </div>

      {definedCenters.length > 0 && (
        <div className="tgc-base-centers">
          {definedCenters.slice(0, 5).map((c) => (
            <span key={c} className="tgc-chip tgc-chip--defined">{c}</span>
          ))}
          {definedCenters.length > 5 && (
            <span className="tgc-chip tgc-chip--more">+{definedCenters.length - 5}</span>
          )}
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
  onGoToMyMap,
  onGoToData,
}: TodayGraphCardProps): JSX.Element {
  const [tab, setTab] = useState<GraphTab>("transit");

  return (
    <div className="tgc">
      <div className="tgc-header">
        <h3 className="tgc-title">Радар дня</h3>
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
            onGoToMyMap={onGoToMyMap}
            onGoToData={onGoToData}
          />
        )}
      </div>
    </div>
  );
}
