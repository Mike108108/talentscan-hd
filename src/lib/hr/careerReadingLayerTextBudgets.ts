/**
 * Field length budgets and post-parse trimming for Career Reading Layers v1 (Stage 4.10-B.6).
 */

function asRecord(value: unknown): Record<string, unknown> {
  if (value != null && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function asString(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => asString(item)).filter(Boolean);
}

export function trimTextByChars(value: string, maxChars: number): string {
  const text = value.trim();
  if (!text || maxChars <= 0) return text;
  if (text.length <= maxChars) return text;

  const slice = text.slice(0, maxChars);
  const lastSentenceEnd = Math.max(
    slice.lastIndexOf("."),
    slice.lastIndexOf("!"),
    slice.lastIndexOf("?"),
    slice.lastIndexOf("…"),
  );

  if (lastSentenceEnd > Math.floor(maxChars * 0.55)) {
    return slice.slice(0, lastSentenceEnd + 1).trim();
  }

  return slice.trim().replace(/[,\s;:]+$/, "") + "…";
}

export function uniqueNonEmptyStrings(items: unknown[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    const text = asString(item);
    if (!text) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(text);
  }
  return out;
}

function trimNullable(value: unknown, maxChars: number): string | null {
  if (value == null) return null;
  const text = asString(value);
  if (!text) return null;
  return trimTextByChars(text, maxChars);
}

function trimStringField(obj: Record<string, unknown>, key: string, maxChars: number): void {
  const text = asString(obj[key]);
  if (text) obj[key] = trimTextByChars(text, maxChars);
}

function trimStringArrayField(
  obj: Record<string, unknown>,
  key: string,
  maxItems: number,
  maxCharsPerItem: number,
): void {
  const items = uniqueNonEmptyStrings(asStringArray(obj[key])).slice(0, maxItems);
  obj[key] = items.map((item) => trimTextByChars(item, maxCharsPerItem));
}

function trimCheckRecords(
  checks: unknown[],
  maxItems: number,
  limits: {
    hypothesis: number;
    check_method: number;
    good_signal: number;
    warning_signal: number;
  },
): Record<string, unknown>[] {
  const list = Array.isArray(checks) ? checks : [];
  return list.slice(0, maxItems).map((item) => {
    const rec = asRecord(item);
    trimStringField(rec, "hypothesis", limits.hypothesis);
    trimStringField(rec, "check_method", limits.check_method);
    trimStringField(rec, "good_signal", limits.good_signal);
    trimStringField(rec, "warning_signal", limits.warning_signal);
    return rec;
  });
}

function trimPointRecords(
  points: unknown[],
  maxItems: number,
  titleMax: number,
  descriptionMax: number,
): Record<string, unknown>[] {
  const list = Array.isArray(points) ? points : [];
  return list.slice(0, maxItems).map((item) => {
    const rec = { ...asRecord(item) };
    trimStringField(rec, "title", titleMax);
    trimStringField(rec, "description", descriptionMax);
    return rec;
  });
}

function trimRiskRecords(risks: unknown[]): Record<string, unknown>[] {
  const list = Array.isArray(risks) ? risks : [];
  return list.slice(0, 3).map((item) => {
    const rec = { ...asRecord(item) };
    trimStringField(rec, "title", 70);
    trimStringField(rec, "description", 220);
    if (rec.how_it_may_show_up != null) {
      rec.how_it_may_show_up = trimNullable(rec.how_it_may_show_up, 180);
    }
    if (rec.mitigation != null) {
      rec.mitigation = trimNullable(rec.mitigation, 220);
    }
    return rec;
  });
}

function trimSectionRecords(sections: unknown[]): Record<string, unknown>[] {
  const list = Array.isArray(sections) ? sections : [];
  return list.slice(0, 3).map((item) => {
    const rec = { ...asRecord(item) };
    trimStringField(rec, "title", 70);
    if (rec.body != null) rec.body = trimNullable(rec.body, 260);
    trimStringArrayField(rec, "items", 4, 140);
    return rec;
  });
}

function trimChannelTalents(talents: unknown[]): Record<string, unknown>[] {
  const list = Array.isArray(talents) ? talents : [];
  return list.map((item) => {
    const rec = { ...asRecord(item) };
    trimStringField(rec, "title", 70);
    trimStringField(rec, "summary", 220);
    trimStringField(rec, "how_it_appears_at_work", 260);
    trimStringField(rec, "risk", 180);
    trimStringField(rec, "management_tip", 180);
    trimStringArrayField(rec, "where_useful", 4, 90);
    rec.what_to_check = trimCheckRecords(
      Array.isArray(rec.what_to_check) ? rec.what_to_check : [],
      2,
      {
      hypothesis: 180,
      check_method: 180,
      good_signal: 140,
      warning_signal: 140,
    });
    return rec;
  });
}

function trimCenterZones(zones: unknown[]): Record<string, unknown>[] {
  const list = Array.isArray(zones) ? zones : [];
  return list.map((item) => {
    const rec = { ...asRecord(item) };
    trimStringField(rec, "title", 70);
    trimStringField(rec, "work_meaning", 220);
    if (rec.potential_strength != null) {
      rec.potential_strength = trimNullable(rec.potential_strength, 180);
    }
    if (rec.risk_under_pressure != null) {
      rec.risk_under_pressure = trimNullable(rec.risk_under_pressure, 180);
    }
    if (rec.management_tip != null) {
      rec.management_tip = trimNullable(rec.management_tip, 180);
    }
    rec.what_to_check = trimCheckRecords(
      Array.isArray(rec.what_to_check) ? rec.what_to_check : [],
      2,
      {
      hypothesis: 180,
      check_method: 180,
      good_signal: 140,
      warning_signal: 140,
    });
    return rec;
  });
}

function trimRepeatedGateThemes(themes: unknown[]): Record<string, unknown>[] {
  const list = Array.isArray(themes) ? themes : [];
  return list.slice(0, 8).map((item) => {
    const rec = { ...asRecord(item) };
    trimStringField(rec, "title", 70);
    trimStringField(rec, "summary", 220);
    if (rec.talent_potential != null) {
      rec.talent_potential = trimNullable(rec.talent_potential, 180);
    }
    if (rec.risk_pattern != null) {
      rec.risk_pattern = trimNullable(rec.risk_pattern, 180);
    }
    rec.what_to_check = trimCheckRecords(
      Array.isArray(rec.what_to_check) ? rec.what_to_check : [],
      2,
      {
      hypothesis: 180,
      check_method: 180,
      good_signal: 140,
      warning_signal: 140,
    });
    return rec;
  });
}

/** Trim client-facing prose and pro.connection_logic after parse (insurance, not aggressive). */
export function trimCareerReadingLayerTextLengths(layer: Record<string, unknown>): void {
  const base = asRecord(layer.base);
  trimStringField(base, "headline", 90);
  trimStringField(base, "short_summary", 450);
  trimStringField(base, "detailed_explanation", 900);
  trimStringField(base, "how_it_appears_at_work", 500);
  trimStringArrayField(base, "where_useful", 5, 90);
  base.strengths = trimPointRecords(
    Array.isArray(base.strengths) ? base.strengths : [],
    4,
    70,
    180,
  );
  base.risks = trimRiskRecords(Array.isArray(base.risks) ? base.risks : []);
  trimStringArrayField(base, "management_tips", 4, 140);
  base.what_to_check = trimCheckRecords(
    Array.isArray(base.what_to_check) ? base.what_to_check : [],
    3,
    {
    hypothesis: 180,
    check_method: 180,
    good_signal: 140,
    warning_signal: 140,
  });
  base.sections = trimSectionRecords(Array.isArray(base.sections) ? base.sections : []);
  layer.base = base;

  const pro = asRecord(layer.pro);
  trimStringField(pro, "connection_logic", 1200);
  trimStringArrayField(pro, "limitations", 3, 220);
  if (pro.human_check != null) pro.human_check = trimNullable(pro.human_check, 220);
  layer.pro = pro;

  const synthesis = asRecord(layer.summary_for_synthesis);
  trimStringField(synthesis, "one_sentence", 220);
  for (const key of ["strengths", "risks", "conditions", "management_focus", "what_to_check"]) {
    trimStringArrayField(synthesis, key, 4, 140);
  }
  layer.summary_for_synthesis = synthesis;

  const matching = asRecord(layer.matching_summary);
  for (const key of [
    "good_for",
    "bad_for",
    "role_fit_positive_signals",
    "role_fit_risk_signals",
    "check_in_role_fit",
  ]) {
    trimStringArrayField(matching, key, 4, 140);
  }
  layer.matching_summary = matching;

  const special = asRecord(layer.special_payload);
  if (Array.isArray(special.channel_talents)) {
    special.channel_talents = trimChannelTalents(special.channel_talents);
  }
  if (Array.isArray(special.center_zones)) {
    special.center_zones = trimCenterZones(special.center_zones);
  }
  if (Array.isArray(special.repeated_gate_themes)) {
    special.repeated_gate_themes = trimRepeatedGateThemes(special.repeated_gate_themes);
  }
  layer.special_payload = special;
}

/** De-duplicate repeated strings in list fields after trim. */
export function dedupeCareerReadingLayerListFields(layer: Record<string, unknown>): void {
  const base = asRecord(layer.base);
  base.where_useful = uniqueNonEmptyStrings(asStringArray(base.where_useful));
  base.management_tips = uniqueNonEmptyStrings(asStringArray(base.management_tips));
  layer.base = base;

  const synthesis = asRecord(layer.summary_for_synthesis);
  for (const key of ["strengths", "risks", "conditions", "management_focus", "what_to_check"]) {
    synthesis[key] = uniqueNonEmptyStrings(asStringArray(synthesis[key]));
  }
  layer.summary_for_synthesis = synthesis;

  const matching = asRecord(layer.matching_summary);
  for (const key of [
    "good_for",
    "bad_for",
    "role_fit_positive_signals",
    "role_fit_risk_signals",
    "check_in_role_fit",
  ]) {
    matching[key] = uniqueNonEmptyStrings(asStringArray(matching[key]));
  }
  layer.matching_summary = matching;
}
