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
      { x: 135, y: 75 },
      { x: 180, y: 8 },
      { x: 225, y: 75 },
    ],
  },
  Ajna: {
    type: "polygon",
    points: [
      { x: 130, y: 98 },
      { x: 230, y: 98 },
      { x: 180, y: 172 },
    ],
  },
  Throat: { type: "rect", x: 125, y: 195, width: 110, height: 78, rx: 14 },
  G: {
    type: "polygon",
    points: [
      { x: 180, y: 295 },
      { x: 235, y: 350 },
      { x: 180, y: 405 },
      { x: 125, y: 350 },
    ],
  },
  Ego: {
    type: "polygon",
    points: [
      { x: 250, y: 335 },
      { x: 310, y: 365 },
      { x: 250, y: 395 },
    ],
  },
  Sacral: { type: "rect", x: 135, y: 420, width: 90, height: 80, rx: 12 },
  "Solar Plexus": {
    type: "polygon",
    points: [
      { x: 255, y: 410 },
      { x: 330, y: 455 },
      { x: 255, y: 515 },
    ],
  },
  Spleen: {
    type: "polygon",
    points: [
      { x: 105, y: 410 },
      { x: 30, y: 455 },
      { x: 105, y: 515 },
    ],
  },
  Root: { type: "rect", x: 135, y: 530, width: 90, height: 70, rx: 12 },
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
  Root: "#a78bfa",
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
  "64": { x: 158, y: 62 },
  "61": { x: 180, y: 62 },
  "63": { x: 202, y: 62 },
  // Ajna
  "47": { x: 155, y: 112 },
  "24": { x: 180, y: 112 },
  "4": { x: 205, y: 112 },
  "17": { x: 155, y: 138 },
  "43": { x: 180, y: 158 },
  "11": { x: 205, y: 138 },
  // Throat
  "62": { x: 150, y: 207 },
  "23": { x: 175, y: 207 },
  "56": { x: 200, y: 207 },
  "16": { x: 135, y: 230 },
  "35": { x: 225, y: 230 },
  "20": { x: 135, y: 255 },
  "12": { x: 225, y: 255 },
  "31": { x: 150, y: 263 },
  "8": { x: 170, y: 263 },
  "33": { x: 190, y: 263 },
  "45": { x: 210, y: 263 },
  // G
  "1": { x: 180, y: 315 },
  "7": { x: 155, y: 335 },
  "13": { x: 205, y: 335 },
  "10": { x: 135, y: 350 },
  "25": { x: 225, y: 350 },
  "15": { x: 155, y: 375 },
  "2": { x: 180, y: 392 },
  "46": { x: 205, y: 375 },
  // Ego
  "21": { x: 262, y: 350 },
  "51": { x: 282, y: 365 },
  "26": { x: 262, y: 380 },
  "40": { x: 297, y: 375 },
  // Sacral
  "5": { x: 155, y: 433 },
  "14": { x: 180, y: 433 },
  "29": { x: 205, y: 433 },
  "34": { x: 145, y: 458 },
  "59": { x: 215, y: 458 },
  "27": { x: 145, y: 482 },
  "42": { x: 170, y: 488 },
  "3": { x: 190, y: 488 },
  "9": { x: 210, y: 488 },
  // Solar Plexus
  "22": { x: 285, y: 420 },
  "36": { x: 312, y: 448 },
  "6": { x: 260, y: 455 },
  "37": { x: 285, y: 475 },
  "49": { x: 260, y: 492 },
  "55": { x: 312, y: 484 },
  "30": { x: 285, y: 505 },
  // Spleen
  "48": { x: 80, y: 420 },
  "57": { x: 105, y: 435 },
  "44": { x: 88, y: 455 },
  "50": { x: 70, y: 475 },
  "32": { x: 105, y: 485 },
  "28": { x: 55, y: 500 },
  "18": { x: 35, y: 512 },
  // Root
  "53": { x: 145, y: 542 },
  "60": { x: 165, y: 542 },
  "52": { x: 195, y: 542 },
  "19": { x: 215, y: 558 },
  "39": { x: 215, y: 578 },
  "41": { x: 195, y: 590 },
  "58": { x: 145, y: 590 },
  "38": { x: 165, y: 590 },
  "54": { x: 180, y: 568 },
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
