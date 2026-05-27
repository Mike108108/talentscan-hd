import type { NormalizedChart } from "../BodyGraphViewer";
import type { CenterKey, Point } from "./bodygraphGeometry";

export type GateSource = "inactive" | "personality" | "design" | "both";

export function normalizeGateValue(value: unknown): string | null {
  if (value === null || value === undefined) return null;

  const raw = typeof value === "number" ? String(value) : String(value).trim();
  if (!raw) return null;

  const gatePart = raw.split(".")[0]?.trim();
  if (!gatePart || !/^\d+$/.test(gatePart)) return null;

  const num = Number.parseInt(gatePart, 10);
  if (num < 1 || num > 64) return null;

  return String(num);
}

export function buildGateSourceMap(
  normalizedChart: NormalizedChart,
): Record<string, GateSource> {
  const map: Record<string, GateSource> = {};

  const setSource = (raw: unknown, incoming: "personality" | "design" | "both") => {
    const gate = normalizeGateValue(raw);
    if (!gate) return;

    if (incoming === "both") {
      map[gate] = "both";
      return;
    }

    const existing = map[gate];
    if (existing === "both") return;

    if (incoming === "personality") {
      if (existing === "design") map[gate] = "both";
      else if (!existing) map[gate] = "personality";
      return;
    }

    if (existing === "personality") map[gate] = "both";
    else if (!existing) map[gate] = "design";
  };

  for (const g of normalizedChart.gatesPersonality ?? []) {
    setSource(g, "personality");
  }
  for (const g of normalizedChart.gatesDesign ?? []) {
    setSource(g, "design");
  }
  for (const g of normalizedChart.gatesBoth ?? []) {
    setSource(g, "both");
  }

  for (const v of Object.values(normalizedChart.activations?.personality ?? {})) {
    setSource(v, "personality");
  }
  for (const v of Object.values(normalizedChart.activations?.design ?? {})) {
    setSource(v, "design");
  }

  return map;
}

export function getGateSource(
  map: Record<string, GateSource>,
  gate: string,
): GateSource {
  return map[gate] ?? "inactive";
}

export function pointsToString(points: Point[]): string {
  return points.map((p) => `${p.x},${p.y}`).join(" ");
}

export function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

export function centerIsDefined(
  normalizedChart: NormalizedChart,
  centerName: CenterKey,
): boolean {
  return (normalizedChart.definedCenters ?? []).includes(centerName);
}

export function gateSourceLabel(source: GateSource): string {
  switch (source) {
    case "personality":
      return "Личность";
    case "design":
      return "Дизайн";
    case "both":
      return "Оба слоя";
    default:
      return "Неактивно";
  }
}

export function channelHalfClass(source: GateSource): string {
  if (source === "inactive") return "";
  return `bodygraph-channel-half bodygraph-channel-half--${source}`;
}

export function gateCircleClass(source: GateSource): string {
  return `bodygraph-gate-circle bodygraph-gate-circle--${source}`;
}

export function gateLabelClass(source: GateSource): string {
  return source === "inactive"
    ? "bodygraph-gate-label bodygraph-gate-label--inactive"
    : "bodygraph-gate-label bodygraph-gate-label--active";
}
