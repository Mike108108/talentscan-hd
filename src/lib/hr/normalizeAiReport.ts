import type { HrPersonTalentMapV1, HrReport } from "./types";

const POSSIBLE_ROOT_KEYS = [
  "content",
  "report",
  "data",
  "result",
  "payload",
  "json",
  "content_json",
] as const;

const EXPECTED_REPORT_KEYS = [
  "hero",
  "data_quality",
  "executive_summary",
  "working_formula",
  "talents",
  "strengths",
  "risks",
  "suitable_directions",
  "questionable_directions",
  "roles",
  "work_environment",
  "management_style",
  "interview_questions",
  "test_tasks",
  "onboarding_7_30_90",
  "final_hr_recommendation",
  "qa_meta",
] as const;

const LIST_NESTED_KEYS = ["items", "list", "points", "values", "data", "entries"] as const;

function asString(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return fallback;
}

function asObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function textFromField(value: unknown, depth = 0, seen: WeakSet<object> = new WeakSet()): string {
  if (depth > 5) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value !== "object" || value === null || Array.isArray(value)) return "";
  if (seen.has(value)) return "";
  seen.add(value);
  const rec = value as Record<string, unknown>;
  for (const key of ["text", "summary", "description", "body", "value", "headline"]) {
    const child = rec[key];
    if (child === value) continue;
    const t = textFromField(child, depth + 1, seen);
    if (t) return t;
  }
  return "";
}

function hasExpectedReportKeys(obj: Record<string, unknown>): boolean {
  return EXPECTED_REPORT_KEYS.some((key) => key in obj);
}

function unwrapReportContent(
  parsed: Record<string, unknown>,
  depth = 0,
): Record<string, unknown> {
  if (depth > 6) return parsed;
  if (hasExpectedReportKeys(parsed)) return parsed;

  for (const key of POSSIBLE_ROOT_KEYS) {
    const inner = parsed[key];
    const innerParsed = parseReportContentJson(inner);
    if (!innerParsed) continue;
    const unwrapped = unwrapReportContent(innerParsed, depth + 1);
    if (hasExpectedReportKeys(unwrapped) || depth > 0) {
      return unwrapped;
    }
  }

  return parsed;
}

function normalizeItems(raw: unknown): HrPersonTalentMapV1["talents"] {
  if (typeof raw === "string") {
    const t = raw.trim();
    return t ? [{ title: "—", body: t }] : [];
  }
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const rec = raw as Record<string, unknown>;
    for (const key of LIST_NESTED_KEYS) {
      if (Array.isArray(rec[key])) return normalizeItems(rec[key]);
    }
  }
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    if (typeof item === "string") {
      const t = item.trim();
      return { title: "—", body: t };
    }
    const rec = asObject(item);
    const fit = asString(rec.fit);
    return {
      title: asString(rec.title ?? rec.question ?? rec.task ?? rec.label, "—"),
      body: asString(rec.body ?? rec.description ?? rec.text ?? rec.summary),
      ...(fit ? { fit } : {}),
    };
  });
}

function normalizeRoles(raw: unknown): HrPersonTalentMapV1["roles"] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    if (typeof item === "string") {
      const t = item.trim();
      return { role: t || "—", fit: "—", note: "" };
    }
    const rec = asObject(item);
    return {
      role: asString(rec.role ?? rec.title ?? rec.name, "—"),
      fit: asString(rec.fit, "—"),
      note: asString(rec.note),
    };
  });
}

function normalizeMetrics(raw: unknown): HrPersonTalentMapV1["data_quality"]["metrics"] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    const rec = asObject(item);
    const hint = asString(rec.hint);
    return {
      label: asString(rec.label, "—"),
      value: asString(rec.value, "—"),
      ...(hint ? { hint } : {}),
    };
  });
}

function normalizeDisclaimers(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map((d) => asString(d)).filter(Boolean);
  }
  if (typeof raw === "string" && raw.trim()) return [raw.trim()];
  return [];
}

/** Parse DB/API content_json (object or JSON string). */
export function parseReportContentJson(raw: unknown): Record<string, unknown> | null {
  if (raw == null) return null;
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
      return null;
    } catch {
      return null;
    }
  }
  if (typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  return null;
}

export function logReportContentShape(raw: unknown, reportId?: string): void {
  const parsed = parseReportContentJson(raw);
  const root = parsed ? unwrapReportContent(parsed) : null;
  console.info("[HR report content_json shape]", {
    reportId,
    contentType: raw == null ? "null" : typeof raw,
    isArray: Array.isArray(raw),
    topLevelKeys: parsed ? Object.keys(parsed) : null,
    rootKeys: root ? Object.keys(root) : null,
    hasExpectedKeys: root ? hasExpectedReportKeys(root) : false,
  });
}

/** Whether the report can be shown in the talent map workspace. */
export function isReadyTalentMapReport(report: HrReport | null): boolean {
  if (!report) return false;
  const status = String(report.report_status ?? "")
    .trim()
    .toLowerCase();
  if (status !== "ready") return false;
  const type = String(report.report_type ?? "hr_person_talent_map").trim();
  if (type !== "hr_person_talent_map") return false;
  return report.content_json != null;
}

/** True when content_json can be parsed into an object (workspace may use fallbacks). */
export function canParseReportContent(raw: unknown): boolean {
  if (raw == null) return false;
  if (typeof raw === "object" && !Array.isArray(raw)) return true;
  if (typeof raw === "string") return parseReportContentJson(raw) != null;
  return false;
}

/** Parsed content root for workspace (never throws). */
export function getReportContentRoot(raw: unknown): Record<string, unknown> {
  const parsed = parseReportContentJson(raw);
  if (!parsed) return {};
  return unwrapReportContent(parsed);
}

function buildNormalizedContent(root: Record<string, unknown>): HrPersonTalentMapV1 {
  const hero = asObject(root.hero);
  const dataQuality = asObject(root.data_quality);
  const executiveRaw = root.executive_summary;
  const executive = asObject(executiveRaw);
  const workingFormulaRaw = root.working_formula;
  const workingFormula = asObject(workingFormulaRaw);
  const onboarding = asObject(root.onboarding_7_30_90);
  const finalRecRaw = root.final_hr_recommendation;
  const finalRec = asObject(finalRecRaw);
  const qaMeta = asObject(root.qa_meta);

  const fitScoreRaw = executive.fit_score ?? root.fit_score;
  const fitScore =
    typeof fitScoreRaw === "number" && Number.isFinite(fitScoreRaw)
      ? Math.round(Math.min(100, Math.max(0, fitScoreRaw)))
      : undefined;

  const executiveText =
    textFromField(executiveRaw) ||
    asString(executive.text) ||
    textFromField(root.summary) ||
    textFromField(finalRecRaw) ||
    asString(finalRec.text) ||
    textFromField(hero.summary) ||
    asString(hero.headline) ||
    "Разбор создан. Данные требуют адаптации отображения.";

  const finalText =
    textFromField(finalRecRaw) ||
    asString(finalRec.text) ||
    executiveText;

  return {
    hero: {
      name: asString(hero.name),
      subtitle: asString(hero.subtitle),
      status_label: asString(hero.status_label),
      best_work_format: asString(hero.best_work_format),
      key_talent: asString(hero.key_talent),
      main_risk: asString(hero.main_risk),
      headline: asString(hero.headline),
    },
    data_quality: {
      completeness: asString(dataQuality.completeness),
      confidence: asString(dataQuality.confidence),
      notes: asString(dataQuality.notes),
      metrics: normalizeMetrics(dataQuality.metrics),
    },
    executive_summary: {
      text: executiveText,
      ...(fitScore !== undefined ? { fit_score: fitScore } : {}),
    },
    working_formula: {
      text: textFromField(workingFormulaRaw) || asString(workingFormula.text),
    },
    talents: normalizeItems(root.talents),
    strengths: normalizeItems(root.strengths),
    risks: normalizeItems(root.risks),
    suitable_directions: normalizeItems(root.suitable_directions),
    questionable_directions: normalizeItems(root.questionable_directions),
    roles: normalizeRoles(root.roles),
    work_environment: normalizeItems(root.work_environment),
    management_style: normalizeItems(root.management_style),
    interview_questions: normalizeItems(root.interview_questions),
    test_tasks: normalizeItems(root.test_tasks),
    onboarding_7_30_90: {
      day_7: textFromField(onboarding.day_7) || asString(onboarding.day_7),
      day_30: textFromField(onboarding.day_30) || asString(onboarding.day_30),
      day_90: textFromField(onboarding.day_90) || asString(onboarding.day_90),
      items: normalizeItems(onboarding.items),
    },
    final_hr_recommendation: { text: finalText },
    qa_meta: {
      hypothesis_level: asString(qaMeta.hypothesis_level),
      disclaimers: normalizeDisclaimers(qaMeta.disclaimers),
    },
  };
}

export function logNormalizedWorkspaceContent(content: HrPersonTalentMapV1): void {
  console.info("[HR normalized workspace content]", {
    hero: content.hero,
    executiveSummaryType: typeof content.executive_summary,
    executiveSummaryTextType: typeof content.executive_summary?.text,
    talentsIsArray: Array.isArray(content.talents),
    risksIsArray: Array.isArray(content.risks),
    rolesIsArray: Array.isArray(content.roles),
    interviewIsArray: Array.isArray(content.interview_questions),
    testTasksIsArray: Array.isArray(content.test_tasks),
    metricsIsArray: Array.isArray(content.data_quality?.metrics),
    onboarding: content.onboarding_7_30_90,
  });
}

/** Defensive normalization so incomplete AI JSON does not break the UI. */
export function normalizeAiReportContent(raw: unknown): HrPersonTalentMapV1 {
  try {
    const root = getReportContentRoot(raw);
    return buildNormalizedContent(root);
  } catch (err) {
    console.error("[normalizeAiReportContent] failed", err);
    return buildNormalizedContent({});
  }
}
