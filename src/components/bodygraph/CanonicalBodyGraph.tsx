import { useMemo, type JSX } from "react";
import type { NormalizedChart } from "../BodyGraphViewer";
import {
  BODYGRAPH_VIEWBOX,
  CENTER_DEFINED_COLORS,
  CENTER_ORDER,
  CENTER_SHAPES,
  CHANNELS,
  GATE_POSITIONS,
  type CenterKey,
  type Point,
} from "./bodygraphGeometry";
import {
  buildGateSourceMap,
  channelHalfClass,
  gateCircleClass,
  gateLabelClass,
  gateSourceLabel,
  getGateSource,
  midpoint,
  pointsToString,
  type GateSource,
} from "./bodygraphUtils";

const GATE_RADIUS = 9;

type CanonicalBodyGraphProps = {
  normalizedChart: NormalizedChart;
};

function CenterShapeElement({
  centerKey,
  defined,
}: {
  centerKey: CenterKey;
  defined: boolean;
}): JSX.Element {
  const shape = CENTER_SHAPES[centerKey];
  const className = defined
    ? "bodygraph-center-shape"
    : "bodygraph-center-shape bodygraph-center-shape--open";

  if (shape.type === "polygon") {
    const fill = defined ? CENTER_DEFINED_COLORS[centerKey] : undefined;
    const stroke = defined
      ? centerKey === "Ego"
        ? "#94a3b8"
        : CENTER_DEFINED_COLORS[centerKey]
      : undefined;
    return (
      <polygon
        className={className}
        points={pointsToString(shape.points)}
        fill={fill}
        stroke={stroke}
      />
    );
  }

  const fill = defined ? CENTER_DEFINED_COLORS[centerKey] : undefined;
  const stroke = defined ? CENTER_DEFINED_COLORS[centerKey] : undefined;
  return (
    <rect
      className={className}
      x={shape.x}
      y={shape.y}
      width={shape.width}
      height={shape.height}
      rx={shape.rx}
      fill={fill}
      stroke={stroke}
    />
  );
}

function ChannelBackground({
  gateA,
  gateB,
  posA,
  posB,
}: {
  gateA: string;
  gateB: string;
  posA: Point;
  posB: Point;
}): JSX.Element {
  const d = `M ${posA.x} ${posA.y} L ${posB.x} ${posB.y}`;
  return (
    <path
      key={`bg-${gateA}-${gateB}`}
      className="bodygraph-channel-bg"
      d={d}
    />
  );
}

function ChannelHalf({
  from,
  to,
  source,
  channelKey,
  side,
}: {
  from: Point;
  to: Point;
  source: GateSource;
  channelKey: string;
  side: "a" | "b";
}): JSX.Element | null {
  if (source === "inactive") return null;

  const d = `M ${from.x} ${from.y} L ${to.x} ${to.y}`;

  if (source === "both") {
    return (
      <g key={`half-${channelKey}-${side}`}>
        <path
          className="bodygraph-channel-half bodygraph-channel-half--design bodygraph-channel-half--both-under"
          d={d}
        />
        <path
          className="bodygraph-channel-half bodygraph-channel-half--personality bodygraph-channel-half--both-over"
          d={d}
        />
      </g>
    );
  }

  return (
    <path
      key={`half-${channelKey}-${side}`}
      className={channelHalfClass(source)}
      d={d}
    />
  );
}

function GateMarker({
  gate,
  position,
  source,
}: {
  gate: string;
  position: Point;
  source: GateSource;
}): JSX.Element {
  return (
    <g
      key={gate}
      aria-label={`Ворота ${gate}, ${gateSourceLabel(source)}`}
    >
      <circle
        className={gateCircleClass(source)}
        cx={position.x}
        cy={position.y}
        r={GATE_RADIUS}
      />
      <text
        className={gateLabelClass(source)}
        x={position.x}
        y={position.y}
      >
        {gate}
      </text>
    </g>
  );
}

export default function CanonicalBodyGraph({
  normalizedChart,
}: CanonicalBodyGraphProps): JSX.Element {
  const gateSourceMap = useMemo(
    () => buildGateSourceMap(normalizedChart),
    [normalizedChart],
  );

  const definedCenters = useMemo(
    () => new Set(normalizedChart.definedCenters ?? []),
    [normalizedChart.definedCenters],
  );

  const channelElements = useMemo(() => {
    const backgrounds: JSX.Element[] = [];
    const activeHalves: JSX.Element[] = [];

    for (const [gateA, gateB] of CHANNELS) {
      const posA = GATE_POSITIONS[gateA];
      const posB = GATE_POSITIONS[gateB];
      if (!posA || !posB) continue;

      const channelKey = `${gateA}-${gateB}`;
      backgrounds.push(
        <ChannelBackground
          key={`bg-${channelKey}`}
          gateA={gateA}
          gateB={gateB}
          posA={posA}
          posB={posB}
        />,
      );

      const mid = midpoint(posA, posB);
      const sourceA = getGateSource(gateSourceMap, gateA);
      const sourceB = getGateSource(gateSourceMap, gateB);

      const halfA = (
        <ChannelHalf
          key={`active-${channelKey}-a`}
          from={posA}
          to={mid}
          source={sourceA}
          channelKey={channelKey}
          side="a"
        />
      );
      const halfB = (
        <ChannelHalf
          key={`active-${channelKey}-b`}
          from={posB}
          to={mid}
          source={sourceB}
          channelKey={channelKey}
          side="b"
        />
      );

      if (halfA) activeHalves.push(halfA);
      if (halfB) activeHalves.push(halfB);
    }

    return { backgrounds, activeHalves };
  }, [gateSourceMap]);

  const gateElements = useMemo(
    () =>
      Object.entries(GATE_POSITIONS).map(([gate, position]) => (
        <GateMarker
          key={gate}
          gate={gate}
          position={position}
          source={getGateSource(gateSourceMap, gate)}
        />
      )),
    [gateSourceMap],
  );

  return (
    <svg
      className="bodygraph-svg bodygraph-canonical-svg"
      viewBox={`0 0 ${BODYGRAPH_VIEWBOX.width} ${BODYGRAPH_VIEWBOX.height}`}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Бодиграф Human Design"
    >
      <title>Бодиграф Human Design</title>
      <desc>Карта центров, ворот и каналов Human Design</desc>

      <defs>
        <filter id="bodygraph-center-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.12" />
        </filter>
      </defs>

      <g className="bodygraph-channels-bg">{channelElements.backgrounds}</g>

      <g className="bodygraph-channels-active">{channelElements.activeHalves}</g>

      <g className="bodygraph-centers-layer" filter="url(#bodygraph-center-shadow)">
        {CENTER_ORDER.map((centerKey) => (
          <CenterShapeElement
            key={centerKey}
            centerKey={centerKey}
            defined={definedCenters.has(centerKey)}
          />
        ))}
      </g>

      <g className="bodygraph-gates-layer">{gateElements}</g>
    </svg>
  );
}
