import { useMemo, type JSX } from "react";
import type { NormalizedChart } from "../BodyGraphViewer";
import {
  BODYGRAPH_VIEWBOX,
  CENTER_DEFINED_COLORS,
  CENTER_DEFINED_STROKES,
  CENTER_ORDER,
  CENTER_SHAPES,
  CHANNEL_TEMPLATE,
  GATE_LABEL_POSITIONS,
  type CenterKey,
} from "./bodygraphTemplate";
import {
  buildGateSourceMap,
  channelHalfClass,
  gateCircleClass,
  gateLabelClass,
  gateSourceLabel,
  getGateSource,
  pointsToString,
  type GateSource,
} from "./bodygraphUtils";

const GATE_RADIUS = 7;

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
    const stroke = defined ? CENTER_DEFINED_STROKES[centerKey] : undefined;
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
  const stroke = defined ? CENTER_DEFINED_STROKES[centerKey] : undefined;
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

function TemplateChannelHalf({
  pathD,
  source,
  channelId,
  gate,
}: {
  pathD: string;
  source: GateSource;
  channelId: string;
  gate: string;
}): JSX.Element | null {
  if (source === "inactive") return null;

  if (source === "both") {
    return (
      <g key={`active-${channelId}-${gate}`}>
        <path
          className="bodygraph-channel-half bodygraph-channel-half--design bodygraph-channel-half--both-under"
          d={pathD}
        />
        <path
          className="bodygraph-channel-half bodygraph-channel-half--personality bodygraph-channel-half--both-over"
          d={pathD}
        />
      </g>
    );
  }

  return (
    <path
      key={`active-${channelId}-${gate}`}
      className={channelHalfClass(source)}
      d={pathD}
    />
  );
}

function GateMarker({
  gate,
  position,
  source,
}: {
  gate: string;
  position: { x: number; y: number };
  source: GateSource;
}): JSX.Element {
  return (
    <g aria-label={`Ворота ${gate}, ${gateSourceLabel(source)}`}>
      <circle
        className={gateCircleClass(source)}
        cx={position.x}
        cy={position.y}
        r={GATE_RADIUS}
      />
      <text className={gateLabelClass(source)} x={position.x} y={position.y}>
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

    for (const channel of CHANNEL_TEMPLATE) {
      const [gateA, gateB] = channel.gates;
      const pathA = channel.halves[gateA];
      const pathB = channel.halves[gateB];
      if (!pathA || !pathB) continue;

      backgrounds.push(
        <path
          key={`bg-${channel.id}-${gateA}`}
          className="bodygraph-channel-bg"
          d={pathA}
        />,
        <path
          key={`bg-${channel.id}-${gateB}`}
          className="bodygraph-channel-bg"
          d={pathB}
        />,
      );

      const sourceA = getGateSource(gateSourceMap, gateA);
      const sourceB = getGateSource(gateSourceMap, gateB);

      const halfA = (
        <TemplateChannelHalf
          key={`active-${channel.id}-a`}
          pathD={pathA}
          source={sourceA}
          channelId={channel.id}
          gate={gateA}
        />
      );
      const halfB = (
        <TemplateChannelHalf
          key={`active-${channel.id}-b`}
          pathD={pathB}
          source={sourceB}
          channelId={channel.id}
          gate={gateB}
        />
      );

      if (halfA) activeHalves.push(halfA);
      if (halfB) activeHalves.push(halfB);
    }

    return { backgrounds, activeHalves };
  }, [gateSourceMap]);

  const gateElements = useMemo(
    () =>
      Object.entries(GATE_LABEL_POSITIONS).map(([gate, position]) => (
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

      <g className="bodygraph-channels-bg">{channelElements.backgrounds}</g>

      <g className="bodygraph-channels-active">{channelElements.activeHalves}</g>

      <g className="bodygraph-centers-layer">
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
