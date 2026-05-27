/**
 * BodyGraph Template v2 — fixed SVG geometry.
 * Channel paths are hand-authored corridors; never computed gate-to-gate.
 */

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
      { x: 150, y: 78 },
      { x: 180, y: 24 },
      { x: 210, y: 78 },
    ],
  },
  Ajna: {
    type: "polygon",
    points: [
      { x: 138, y: 102 },
      { x: 222, y: 102 },
      { x: 180, y: 168 },
    ],
  },
  Throat: { type: "rect", x: 138, y: 192, width: 84, height: 72, rx: 2 },
  G: {
    type: "polygon",
    points: [
      { x: 180, y: 294 },
      { x: 226, y: 346 },
      { x: 180, y: 398 },
      { x: 134, y: 346 },
    ],
  },
  Ego: {
    type: "polygon",
    points: [
      { x: 234, y: 332 },
      { x: 290, y: 362 },
      { x: 234, y: 392 },
    ],
  },
  Sacral: { type: "rect", x: 144, y: 418, width: 72, height: 72, rx: 2 },
  "Solar Plexus": {
    type: "polygon",
    points: [
      { x: 244, y: 412 },
      { x: 314, y: 454 },
      { x: 244, y: 508 },
    ],
  },
  Spleen: {
    type: "polygon",
    points: [
      { x: 116, y: 412 },
      { x: 46, y: 454 },
      { x: 116, y: 508 },
    ],
  },
  Root: { type: "rect", x: 144, y: 528, width: 72, height: 64, rx: 2 },
};

export const CENTER_DEFINED_COLORS: Record<CenterKey, string> = {
  Head: "#76518f",
  Ajna: "#2cb5b4",
  Throat: "#2ab7b0",
  G: "#15947f",
  Ego: "#fffbeb",
  Sacral: "#f2cf4a",
  "Solar Plexus": "#f0a05a",
  Spleen: "#e9b640",
  Root: "#b28a4a",
};

export const CENTER_DEFINED_STROKES: Record<CenterKey, string> = {
  Head: "#76518f",
  Ajna: "#2cb5b4",
  Throat: "#2ab7b0",
  G: "#15947f",
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

/** Fixed gate label / circle positions (inside center boundaries). */
export const GATE_LABEL_POSITIONS: Record<string, Point> = {
  "64": { x: 158, y: 66 },
  "61": { x: 180, y: 66 },
  "63": { x: 202, y: 66 },
  "47": { x: 155, y: 120 },
  "24": { x: 180, y: 120 },
  "4": { x: 205, y: 120 },
  "17": { x: 155, y: 146 },
  "43": { x: 180, y: 158 },
  "11": { x: 205, y: 146 },
  "62": { x: 150, y: 206 },
  "23": { x: 176, y: 206 },
  "56": { x: 202, y: 206 },
  "16": { x: 142, y: 228 },
  "35": { x: 218, y: 228 },
  "20": { x: 142, y: 250 },
  "12": { x: 218, y: 250 },
  "31": { x: 150, y: 262 },
  "8": { x: 170, y: 262 },
  "33": { x: 190, y: 262 },
  "45": { x: 210, y: 262 },
  "1": { x: 180, y: 312 },
  "7": { x: 156, y: 334 },
  "13": { x: 204, y: 334 },
  "10": { x: 142, y: 348 },
  "25": { x: 218, y: 348 },
  "15": { x: 156, y: 372 },
  "2": { x: 180, y: 388 },
  "46": { x: 204, y: 372 },
  "21": { x: 246, y: 346 },
  "51": { x: 266, y: 362 },
  "26": { x: 246, y: 378 },
  "40": { x: 278, y: 372 },
  "5": { x: 156, y: 436 },
  "14": { x: 180, y: 436 },
  "29": { x: 204, y: 436 },
  "34": { x: 148, y: 458 },
  "59": { x: 212, y: 458 },
  "27": { x: 148, y: 480 },
  "42": { x: 168, y: 486 },
  "3": { x: 188, y: 486 },
  "9": { x: 208, y: 486 },
  "22": { x: 270, y: 424 },
  "36": { x: 298, y: 450 },
  "6": { x: 248, y: 454 },
  "37": { x: 270, y: 476 },
  "49": { x: 248, y: 494 },
  "55": { x: 298, y: 486 },
  "30": { x: 270, y: 504 },
  "48": { x: 88, y: 424 },
  "57": { x: 112, y: 440 },
  "44": { x: 94, y: 458 },
  "50": { x: 76, y: 476 },
  "32": { x: 112, y: 486 },
  "28": { x: 62, y: 500 },
  "18": { x: 44, y: 512 },
  "53": { x: 150, y: 540 },
  "60": { x: 168, y: 540 },
  "52": { x: 192, y: 540 },
  "19": { x: 210, y: 554 },
  "39": { x: 210, y: 574 },
  "41": { x: 192, y: 586 },
  "58": { x: 150, y: 586 },
  "38": { x: 168, y: 586 },
  "54": { x: 180, y: 568 },
};

export type ChannelTemplateEntry = {
  id: string;
  gates: readonly [string, string];
  halves: Record<string, string>;
};

/**
 * Fixed half-channel SVG paths following canonical corridors.
 * Active rendering uses these paths only — never gate-to-gate math.
 */
export const CHANNEL_TEMPLATE: readonly ChannelTemplateEntry[] = [
  // Head ↔ Ajna
  {
    id: "64-47",
    gates: ["64", "47"],
    halves: {
      "64": "M 158 72 L 158 92 L 155 112",
      "47": "M 155 120 L 155 112",
    },
  },
  {
    id: "61-24",
    gates: ["61", "24"],
    halves: {
      "61": "M 180 72 L 180 112",
      "24": "M 180 120 L 180 112",
    },
  },
  {
    id: "63-4",
    gates: ["63", "4"],
    halves: {
      "63": "M 202 72 L 202 92 L 205 112",
      "4": "M 205 120 L 205 112",
    },
  },
  // Ajna ↔ Throat
  {
    id: "17-62",
    gates: ["17", "62"],
    halves: {
      "17": "M 155 146 L 155 178 L 150 198",
      "62": "M 150 206 L 150 198",
    },
  },
  {
    id: "43-23",
    gates: ["43", "23"],
    halves: {
      "43": "M 180 158 L 180 198",
      "23": "M 176 206 L 180 198",
    },
  },
  {
    id: "11-56",
    gates: ["11", "56"],
    halves: {
      "11": "M 205 146 L 205 178 L 202 198",
      "56": "M 202 206 L 202 198",
    },
  },
  // Throat ↔ Spleen
  {
    id: "16-48",
    gates: ["16", "48"],
    halves: {
      "16": "M 142 228 L 118 268 L 100 340 L 88 412",
      "48": "M 88 424 L 88 412",
    },
  },
  {
    id: "20-57",
    gates: ["20", "57"],
    halves: {
      "20": "M 142 250 L 128 300 L 112 380",
      "57": "M 112 440 L 112 380",
    },
  },
  // Throat ↔ Sacral
  {
    id: "20-34",
    gates: ["20", "34"],
    halves: {
      "20": "M 142 250 L 148 340 L 148 420",
      "34": "M 148 458 L 148 420",
    },
  },
  // Throat ↔ Ego
  {
    id: "45-21",
    gates: ["45", "21"],
    halves: {
      "45": "M 210 262 L 228 300 L 246 332",
      "21": "M 246 346 L 246 332",
    },
  },
  // Throat ↔ Solar Plexus
  {
    id: "12-22",
    gates: ["12", "22"],
    halves: {
      "12": "M 218 250 L 238 340 L 262 400",
      "22": "M 270 424 L 262 400",
    },
  },
  {
    id: "35-36",
    gates: ["35", "36"],
    halves: {
      "35": "M 218 228 L 252 360 L 290 430",
      "36": "M 298 450 L 290 430",
    },
  },
  // Throat ↔ G
  {
    id: "31-7",
    gates: ["31", "7"],
    halves: {
      "31": "M 150 262 L 152 298 L 156 322",
      "7": "M 156 334 L 156 322",
    },
  },
  {
    id: "8-1",
    gates: ["8", "1"],
    halves: {
      "8": "M 170 262 L 176 290 L 180 304",
      "1": "M 180 312 L 180 304",
    },
  },
  {
    id: "33-13",
    gates: ["33", "13"],
    halves: {
      "33": "M 190 262 L 198 290 L 204 322",
      "13": "M 204 334 L 204 322",
    },
  },
  {
    id: "10-20",
    gates: ["10", "20"],
    halves: {
      "10": "M 142 348 L 142 300 L 142 262",
      "20": "M 142 250 L 142 262",
    },
  },
  // G ↔ Ego
  {
    id: "25-51",
    gates: ["25", "51"],
    halves: {
      "25": "M 218 348 L 238 358",
      "51": "M 266 362 L 238 358",
    },
  },
  // G ↔ Spleen (10-57 uses upper G corridor)
  {
    id: "10-57",
    gates: ["10", "57"],
    halves: {
      "10": "M 142 348 L 128 380",
      "57": "M 112 440 L 128 380",
    },
  },
  // G ↔ Sacral (10-34 uses lower G corridor)
  {
    id: "10-34",
    gates: ["10", "34"],
    halves: {
      "10": "M 142 348 L 146 400",
      "34": "M 148 458 L 146 400",
    },
  },
  {
    id: "2-14",
    gates: ["2", "14"],
    halves: {
      "2": "M 180 388 L 180 418",
      "14": "M 180 436 L 180 418",
    },
  },
  {
    id: "5-15",
    gates: ["5", "15"],
    halves: {
      "5": "M 156 436 L 156 400 L 156 372",
      "15": "M 156 372 L 156 400",
    },
  },
  {
    id: "29-46",
    gates: ["29", "46"],
    halves: {
      "29": "M 204 436 L 204 400 L 204 372",
      "46": "M 204 372 L 204 400",
    },
  },
  // Ego ↔ Solar Plexus
  {
    id: "40-37",
    gates: ["40", "37"],
    halves: {
      "40": "M 278 372 L 274 420",
      "37": "M 270 476 L 274 420",
    },
  },
  // Ego ↔ Spleen
  {
    id: "26-44",
    gates: ["26", "44"],
    halves: {
      "26": "M 246 378 L 180 420 L 94 452",
      "44": "M 94 458 L 94 452",
    },
  },
  // Sacral ↔ Solar Plexus
  {
    id: "59-6",
    gates: ["59", "6"],
    halves: {
      "59": "M 212 458 L 232 456",
      "6": "M 248 454 L 232 456",
    },
  },
  // Sacral ↔ Spleen
  {
    id: "27-50",
    gates: ["27", "50"],
    halves: {
      "27": "M 148 480 L 112 478",
      "50": "M 76 476 L 112 478",
    },
  },
  {
    id: "34-57",
    gates: ["34", "57"],
    halves: {
      "34": "M 148 458 L 130 448",
      "57": "M 112 440 L 130 448",
    },
  },
  // Sacral ↔ Root
  {
    id: "3-60",
    gates: ["3", "60"],
    halves: {
      "3": "M 188 486 L 178 512",
      "60": "M 168 540 L 178 512",
    },
  },
  {
    id: "42-53",
    gates: ["42", "53"],
    halves: {
      "42": "M 168 486 L 158 512",
      "53": "M 150 540 L 158 512",
    },
  },
  {
    id: "9-52",
    gates: ["9", "52"],
    halves: {
      "9": "M 208 486 L 192 512",
      "52": "M 192 540 L 192 512",
    },
  },
  // Root ↔ Solar Plexus
  {
    id: "19-49",
    gates: ["19", "49"],
    halves: {
      "19": "M 210 554 L 232 524",
      "49": "M 248 494 L 232 524",
    },
  },
  {
    id: "39-55",
    gates: ["39", "55"],
    halves: {
      "39": "M 210 574 L 252 530",
      "55": "M 298 486 L 252 530",
    },
  },
  {
    id: "41-30",
    gates: ["41", "30"],
    halves: {
      "41": "M 192 586 L 228 548",
      "30": "M 270 504 L 228 548",
    },
  },
  // Root ↔ Spleen
  {
    id: "18-58",
    gates: ["18", "58"],
    halves: {
      "18": "M 44 512 L 98 548",
      "58": "M 150 586 L 98 548",
    },
  },
  {
    id: "28-38",
    gates: ["28", "38"],
    halves: {
      "28": "M 62 500 L 115 542",
      "38": "M 168 586 L 115 542",
    },
  },
  {
    id: "32-54",
    gates: ["32", "54"],
    halves: {
      "32": "M 112 486 L 146 528",
      "54": "M 180 568 L 146 528",
    },
  },
] as const;

export const ALL_GATES = Object.keys(GATE_LABEL_POSITIONS);

/** @deprecated Use GATE_LABEL_POSITIONS — kept for import compatibility */
export const GATE_POSITIONS = GATE_LABEL_POSITIONS;

/** @deprecated Channels are template-based — list of gate pairs only */
export const CHANNELS = CHANNEL_TEMPLATE.map((c) => c.gates) as ReadonlyArray<
  readonly [string, string]
>;
