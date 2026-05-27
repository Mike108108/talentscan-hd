export type Point = { x: number; y: number };

export const BODYGRAPH_VIEWBOX = {
  width: 430,
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
      { x: 170, y: 78 },
      { x: 215, y: 8 },
      { x: 260, y: 78 },
    ],
  },
  Ajna: {
    type: "polygon",
    points: [
      { x: 155, y: 104 },
      { x: 275, y: 104 },
      { x: 215, y: 180 },
    ],
  },
  Throat: { type: "rect", x: 150, y: 200, width: 130, height: 82, rx: 15 },
  G: {
    type: "polygon",
    points: [
      { x: 215, y: 305 },
      { x: 278, y: 365 },
      { x: 215, y: 425 },
      { x: 152, y: 365 },
    ],
  },
  Ego: {
    type: "polygon",
    points: [
      { x: 292, y: 348 },
      { x: 362, y: 382 },
      { x: 292, y: 414 },
    ],
  },
  Sacral: { type: "rect", x: 165, y: 435, width: 100, height: 82, rx: 13 },
  "Solar Plexus": {
    type: "polygon",
    points: [
      { x: 305, y: 420 },
      { x: 400, y: 468 },
      { x: 305, y: 532 },
    ],
  },
  Spleen: {
    type: "polygon",
    points: [
      { x: 125, y: 420 },
      { x: 30, y: 468 },
      { x: 125, y: 532 },
    ],
  },
  Root: { type: "rect", x: 165, y: 545, width: 100, height: 72, rx: 13 },
};

export const CENTER_DEFINED_COLORS: Record<CenterKey, string> = {
  Head: "#8b5cf6",
  Ajna: "#22c1c3",
  Throat: "#14b8a6",
  G: "#10b981",
  Ego: "#f59e0b",
  Sacral: "#facc15",
  "Solar Plexus": "#fb923c",
  Spleen: "#fbbf24",
  Root: "#c0843e",
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
  "64": { x: 190, y: 66 },
  "61": { x: 215, y: 66 },
  "63": { x: 240, y: 66 },
  // Ajna
  "47": { x: 185, y: 120 },
  "24": { x: 215, y: 120 },
  "4": { x: 245, y: 120 },
  "17": { x: 185, y: 150 },
  "43": { x: 215, y: 168 },
  "11": { x: 245, y: 150 },
  // Throat
  "62": { x: 178, y: 214 },
  "23": { x: 205, y: 214 },
  "56": { x: 232, y: 214 },
  "16": { x: 162, y: 240 },
  "35": { x: 268, y: 240 },
  "20": { x: 162, y: 265 },
  "12": { x: 268, y: 265 },
  "31": { x: 180, y: 275 },
  "8": { x: 204, y: 275 },
  "33": { x: 226, y: 275 },
  "45": { x: 250, y: 275 },
  // G
  "1": { x: 215, y: 325 },
  "7": { x: 188, y: 348 },
  "13": { x: 242, y: 348 },
  "10": { x: 160, y: 365 },
  "25": { x: 270, y: 365 },
  "15": { x: 188, y: 392 },
  "2": { x: 215, y: 408 },
  "46": { x: 242, y: 392 },
  // Ego
  "21": { x: 306, y: 363 },
  "51": { x: 330, y: 382 },
  "26": { x: 306, y: 400 },
  "40": { x: 348, y: 392 },
  // Sacral
  "5": { x: 188, y: 450 },
  "14": { x: 215, y: 450 },
  "29": { x: 242, y: 450 },
  "34": { x: 176, y: 474 },
  "59": { x: 254, y: 474 },
  "27": { x: 176, y: 500 },
  "42": { x: 202, y: 506 },
  "3": { x: 228, y: 506 },
  "9": { x: 252, y: 506 },
  // Solar Plexus
  "22": { x: 342, y: 435 },
  "36": { x: 376, y: 462 },
  "6": { x: 310, y: 470 },
  "37": { x: 342, y: 492 },
  "49": { x: 310, y: 512 },
  "55": { x: 376, y: 502 },
  "30": { x: 342, y: 522 },
  // Spleen
  "48": { x: 92, y: 435 },
  "57": { x: 122, y: 452 },
  "44": { x: 102, y: 474 },
  "50": { x: 75, y: 494 },
  "32": { x: 122, y: 506 },
  "28": { x: 60, y: 522 },
  "18": { x: 38, y: 535 },
  // Root
  "53": { x: 176, y: 558 },
  "60": { x: 199, y: 558 },
  "52": { x: 234, y: 558 },
  "19": { x: 255, y: 574 },
  "39": { x: 255, y: 594 },
  "41": { x: 234, y: 606 },
  "58": { x: 176, y: 606 },
  "38": { x: 199, y: 606 },
  "54": { x: 215, y: 584 },
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
