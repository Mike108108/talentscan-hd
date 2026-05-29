import type { HrPersonTalentMapV1 } from "./types";

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

function textFromField(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return asString(asObject(value).text);
}

function normalizeItems(raw: unknown): HrPersonTalentMapV1["talents"] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    const rec = asObject(item);
    const fit = asString(rec.fit);
    return {
      title: asString(rec.title, "—"),
      body: asString(rec.body),
      ...(fit ? { fit } : {}),
    };
  });
}

function normalizeRoles(raw: unknown): HrPersonTalentMapV1["roles"] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    const rec = asObject(item);
    return {
      role: asString(rec.role, "—"),
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

/** Defensive normalization so incomplete AI JSON does not break the UI. */
export function normalizeAiReportContent(raw: unknown): HrPersonTalentMapV1 {
  const root = parseReportContentJson(raw) ?? {};
  const hero = asObject(root.hero);
  const dataQuality = asObject(
    typeof root.data_quality === "object" && root.data_quality && !Array.isArray(root.data_quality)
      ? root.data_quality
      : {},
  );
  const executiveRaw = root.executive_summary;
  const executive = asObject(
    typeof executiveRaw === "object" && executiveRaw && !Array.isArray(executiveRaw)
      ? executiveRaw
      : {},
  );
  const workingFormulaRaw = root.working_formula;
  const workingFormula = asObject(
    typeof workingFormulaRaw === "object" &&
      workingFormulaRaw &&
      !Array.isArray(workingFormulaRaw)
      ? workingFormulaRaw
      : {},
  );
  const onboarding = asObject(root.onboarding_7_30_90);
  const finalRecRaw = root.final_hr_recommendation;
  const finalRec = asObject(
    typeof finalRecRaw === "object" && finalRecRaw && !Array.isArray(finalRecRaw)
      ? finalRecRaw
      : {},
  );
  const qaMeta = asObject(root.qa_meta);

  const fitScoreRaw = executive.fit_score;
  const fitScore =
    typeof fitScoreRaw === "number" && Number.isFinite(fitScoreRaw)
      ? Math.round(Math.min(100, Math.max(0, fitScoreRaw)))
      : undefined;

  const disclaimers = Array.isArray(qaMeta.disclaimers)
    ? qaMeta.disclaimers.map((d) => asString(d)).filter(Boolean)
    : [];

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
      text: textFromField(executiveRaw) || asString(executive.text),
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
      day_7: asString(onboarding.day_7),
      day_30: asString(onboarding.day_30),
      day_90: asString(onboarding.day_90),
      items: normalizeItems(onboarding.items),
    },
    final_hr_recommendation: {
      text: textFromField(finalRecRaw) || asString(finalRec.text),
    },
    qa_meta: {
      hypothesis_level: asString(qaMeta.hypothesis_level),
      disclaimers,
    },
  };
}
