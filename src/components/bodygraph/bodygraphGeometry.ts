export type Point = { x: number; y: number };

export const BODYGRAPH_VIEWBOX = {
  width: 360,
  height: 620,
} as const;

export type CenterKey =
  | "Head"
  | "Ajna"
  | "Throat"
  | "G"
  | "Ego"
  | "Sacral"
  | "Solar Plexus"
  | "Spleen"
  | "Root";

export type CenterShape =
  | { type: "polygon"; points: Point[] }
  | { type: "rect"; x: number; y: number; width: number; height: number; rx: number };

export const CENTER_SHAPES: Record<CenterKey, CenterShape> = {
  Head: {
    type: "polygon",
    points: [
      { x: 140, y: 82 },
      { x: 180, y: 20 },
      { x: 220, y: 82 },
    ],
  },
  Ajna: {
    type: "polygon",
    points: [
      { x: 135, y: 104 },
      { x: 225, y: 104 },
      { x: 180, y: 172 },
    ],
  },
  Throat: { type: "rect", x: 132, y: 194, width: 96, height: 76, rx: 10 },
  G: {
    type: "polygon",
    points: [
      { x: 180, y: 296 },
      { x: 232, y: 348 },
      { x: 180, y: 400 },
      { x: 128, y: 348 },
    ],
  },
  Ego: {
    type: "polygon",
    points: [
      { x: 236, y: 334 },
      { x: 296, y: 364 },
      { x: 236, y: 394 },
    ],
  },
  Sacral: { type: "rect", x: 138, y: 422, width: 84, height: 76, rx: 8 },
  "Solar Plexus": {
    type: "polygon",
    points: [
      { x: 246, y: 414 },
      { x: 320, y: 456 },
      { x: 246, y: 512 },
    ],
  },
  Spleen: {
    type: "polygon",
    points: [
      { x: 114, y: 414 },
      { x: 40, y: 456 },
      { x: 114, y: 512 },
    ],
  },
  Root: { type: "rect", x: 138, y: 530, width: 84, height: 68, rx: 8 },
};

export const CENTER_DEFINED_COLORS: Record<CenterKey, string> = {
  Head: "#8b72b5",
  Ajna: "#2cb5b4",
  Throat: "#28b7b0",
  G: "#1d9d84",
  Ego: "#fffbeb",
  Sacral: "#e8c84a",
  "Solar Plexus": "#e8a060",
  Spleen: "#e9b640",
  Root: "#b28a4a",
};

/** Stroke for defined centers (Ego uses warm outline on light fill). */
export const CENTER_DEFINED_STROKES: Record<CenterKey, string> = {
  Head: "#8b72b5",
  Ajna: "#2cb5b4",
  Throat: "#28b7b0",
  G: "#1d9d84",
  Ego: "#c4a574",
  Sacral: "#c9a83a",
  "Solar Plexus": "#d48850",
  Spleen: "#d4a830",
  Root: "#b28a4a",
};

export const CENTER_ORDER: CenterKey[] = [
  "Head",
  "Ajna",
  "Throat",
  "G",
  "Ego",
  "Sacral",
  "Solar Plexus",
  "Spleen",
  "Root",
];

export const GATE_POSITIONS: Record<string, Point> = {
  // Head
  "64": { x: 158, y: 68 },
  "61": { x: 180, y: 68 },
  "63": { x: 202, y: 68 },
  // Ajna
  "47": { x: 155, y: 122 },
  "24": { x: 180, y: 122 },
  "4": { x: 205, y: 122 },
  "17": { x: 155, y: 148 },
  "43": { x: 180, y: 160 },
  "11": { x: 205, y: 148 },
  // Throat
  "62": { x: 150, y: 208 },
  "23": { x: 176, y: 208 },
  "56": { x: 202, y: 208 },
  "16": { x: 138, y: 232 },
  "35": { x: 222, y: 232 },
  "20": { x: 138, y: 254 },
  "12": { x: 222, y: 254 },
  "31": { x: 150, y: 266 },
  "8": { x: 170, y: 266 },
  "33": { x: 190, y: 266 },
  "45": { x: 210, y: 266 },
  // G
  "1": { x: 180, y: 314 },
  "7": { x: 156, y: 336 },
  "13": { x: 204, y: 336 },
  "10": { x: 138, y: 350 },
  "25": { x: 222, y: 350 },
  "15": { x: 156, y: 374 },
  "2": { x: 180, y: 390 },
  "46": { x: 204, y: 374 },
  // Ego
  "21": { x: 248, y: 348 },
  "51": { x: 268, y: 364 },
  "26": { x: 248, y: 380 },
  "40": { x: 282, y: 374 },
  // Sacral
  "5": { x: 156, y: 438 },
  "14": { x: 180, y: 438 },
  "29": { x: 204, y: 438 },
  "34": { x: 146, y: 460 },
  "59": { x: 214, y: 460 },
  "27": { x: 146, y: 482 },
  "42": { x: 168, y: 488 },
  "3": { x: 190, y: 488 },
  "9": { x: 212, y: 488 },
  // Solar Plexus
  "22": { x: 274, y: 426 },
  "36": { x: 302, y: 452 },
  "6": { x: 250, y: 456 },
  "37": { x: 274, y: 478 },
  "49": { x: 250, y: 496 },
  "55": { x: 302, y: 488 },
  "30": { x: 274, y: 506 },
  // Spleen
  "48": { x: 86, y: 426 },
  "57": { x: 110, y: 442 },
  "44": { x: 92, y: 460 },
  "50": { x: 74, y: 478 },
  "32": { x: 110, y: 488 },
  "28": { x: 60, y: 502 },
  "18": { x: 42, y: 514 },
  // Root
  "53": { x: 148, y: 542 },
  "60": { x: 166, y: 542 },
  "52": { x: 194, y: 542 },
  "19": { x: 212, y: 556 },
  "39": { x: 212, y: 576 },
  "41": { x: 194, y: 588 },
  "58": { x: 148, y: 588 },
  "38": { x: 166, y: 588 },
  "54": { x: 180, y: 570 },
};

/** All 36 Human Design channels as [gateA, gateB] pairs. */
export const CHANNELS: ReadonlyArray<readonly [string, string]> = [
  ["64", "47"],
  ["61", "24"],
  ["63", "4"],
  ["17", "62"],
  ["43", "23"],
  ["11", "56"],
  ["16", "48"],
  ["20", "57"],
  ["20", "34"],
  ["45", "21"],
  ["12", "22"],
  ["35", "36"],
  ["31", "7"],
  ["8", "1"],
  ["33", "13"],
  ["10", "20"],
  ["25", "51"],
  ["10", "57"],
  ["10", "34"],
  ["2", "14"],
  ["5", "15"],
  ["29", "46"],
  ["40", "37"],
  ["26", "44"],
  ["59", "6"],
  ["27", "50"],
  ["34", "57"],
  ["3", "60"],
  ["42", "53"],
  ["9", "52"],
  ["19", "49"],
  ["39", "55"],
  ["41", "30"],
  ["18", "58"],
  ["28", "38"],
  ["32", "54"],
] as const;

export const ALL_GATES = Object.keys(GATE_POSITIONS);
