import type { CandidateChartStatus, HrCandidate } from "./types";

export const CHART_STATUS_LABELS: Record<CandidateChartStatus, string> = {
  draft: "Не рассчитана",
  birth_data_incomplete: "Нужно уточнить данные",
  ready_to_calculate: "Готов к расчёту",
  calculating: "Считается",
  calculated: "Карта рассчитана",
  calculation_error: "Ошибка расчёта",
};

function statusFromBirthFields(candidate: Partial<HrCandidate>): CandidateChartStatus {
  const hasName = Boolean(candidate.name?.trim());
  const hasDate = Boolean(candidate.birth_date);
  const hasTime = Boolean(candidate.birth_time);
  const hasPlace = Boolean(candidate.birth_place_text?.trim());
  const hasCoords =
    typeof candidate.birth_place_lat === "number" &&
    typeof candidate.birth_place_lon === "number";

  if (!hasName) return "draft";
  if (!hasDate || !hasPlace) return "birth_data_incomplete";
  if (!hasTime) return "birth_data_incomplete";
  if (!hasCoords) return "birth_data_incomplete";
  return "ready_to_calculate";
}

export function deriveChartStatus(candidate: Partial<HrCandidate>): CandidateChartStatus {
  if (candidate.chart_status === "calculating") return "calculating";
  if (candidate.chart_status === "calculation_error") return "calculation_error";

  const fromFields = statusFromBirthFields(candidate);

  if (candidate.chart_status === "calculated") {
    return fromFields === "ready_to_calculate" ? "calculated" : fromFields;
  }

  return fromFields;
}

export function canCalculateChart(candidate: Partial<HrCandidate>): boolean {
  return deriveChartStatus(candidate) === "ready_to_calculate";
}
