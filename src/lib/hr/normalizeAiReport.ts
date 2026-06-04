import type {
  HrPersonTalentMapV1,
  HrPersonTalentMapV2,
  HrReport,
  HrTalentMapConfidence,
  HrTalentMapExecutiveSnapshot,
  HrTalentMapEvidenceItem,
  HrTalentMapHypothesisCard,
  HrTalentMapLayer,
  HrTalentMapManagementPlaybook,
  HrTalentMapRiskCheck,
  HrTalentMapVerificationPlan,
} from "./types";
import { isTalentMapV2, isTalentMapV2Ready } from "./talentMapContentV2";
import { mapV2ToLegacyWorkspaceContent } from "./talentMapWorkspaceAdapter";

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
  "schema_version",
  "executive_snapshot",
  "layer_map",
  "hypothesis_cards",
  "risk_checks",
  "management_playbook",
  "verification_plan",
  "evidence_map",
  "ui",
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

const DISPLAYABLE_TALENT_MAP_REPORT_TYPES = new Set([
  "hr_person_talent_map",
  "hr_person_talent_map_core_layers_spike",
]);

function hasCareerReadingLayersInContent(raw: unknown): boolean {
  const root = parseReportContentJson(raw);
  if (!root) return false;
  const layers = root.career_reading_layers;
  return Array.isArray(layers) && layers.length > 0;
}

function spikeHasLayerReports(report: HrReport): boolean {
  const type = String(report.report_type ?? "").trim();
  const root = parseReportContentJson(report.content_json);
  if (!root) return false;

  if (hasCareerReadingLayersInContent(report.content_json)) return true;

  if (type !== "hr_person_talent_map_core_layers_spike") {
    if (type === "hr_person_talent_map") {
      const layerReports = root.layer_reports;
      return Array.isArray(layerReports) && layerReports.length > 0;
    }
    return true;
  }
  const layerReports = root.layer_reports;
  return Array.isArray(layerReports) && layerReports.length > 0;
}

/** Strict production v1 ready check (legacy hr_person_talent_map only). */
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

/** Whether the report can be shown on the candidate talent map page (v1 or core-layers spike). */
export function isDisplayableTalentMapReport(report: HrReport | null): boolean {
  if (!report) return false;
  const status = String(report.report_status ?? "")
    .trim()
    .toLowerCase();
  if (status !== "ready") return false;
  const type = String(report.report_type ?? "").trim();
  if (!DISPLAYABLE_TALENT_MAP_REPORT_TYPES.has(type)) return false;
  if (report.content_json == null) return false;
  return spikeHasLayerReports(report);
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
  if (isTalentMapV2(parsed)) return parsed;
  return unwrapReportContent(parsed);
}

function normalizeConfidence(raw: unknown): HrTalentMapConfidence {
  const v = asString(raw).toLowerCase();
  if (v === "high" || v === "medium" || v === "low") return v;
  return "medium";
}

function normalizeStringArray(raw: unknown, max = 20): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .slice(0, max)
    .map((item) => asString(item))
    .filter(Boolean);
}

function normalizeExecutiveSnapshot(raw: unknown): HrTalentMapExecutiveSnapshot | undefined {
  const rec = asObject(raw);
  const snapshot: HrTalentMapExecutiveSnapshot = {
    one_sentence: asString(rec.one_sentence),
    best_use: asString(rec.best_use),
    main_value: asString(rec.main_value),
    main_risk: asString(rec.main_risk),
    how_to_check_first: asString(rec.how_to_check_first),
    decision_note: asString(rec.decision_note),
  };
  if (!Object.values(snapshot).some(Boolean)) return undefined;
  return snapshot;
}

function normalizeLayerMap(raw: unknown): HrTalentMapLayer[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 12).map((item, idx) => {
    const rec = asObject(item);
    return {
      id: asString(rec.id, `layer-${idx + 1}`),
      title: asString(rec.title, "—"),
      client_summary: asString(rec.client_summary),
      hr_meaning: asString(rec.hr_meaning),
      key_signal: asString(rec.key_signal),
      risk_signal: asString(rec.risk_signal),
      how_to_check: asString(rec.how_to_check),
      confidence: normalizeConfidence(rec.confidence),
      ui_priority:
        typeof rec.ui_priority === "number" && Number.isFinite(rec.ui_priority)
          ? rec.ui_priority
          : idx + 1,
      source_layer_id: asString(rec.source_layer_id),
    };
  });
}

function normalizeHypothesisCards(raw: unknown): HrTalentMapHypothesisCard[] {
  if (!Array.isArray(raw)) return [];
  const types = new Set(["talent", "risk", "condition", "management", "growth"]);
  return raw.slice(0, 30).map((item, idx) => {
    const rec = asObject(item);
    const typeRaw = asString(rec.type).toLowerCase();
    const type = types.has(typeRaw)
      ? (typeRaw as HrTalentMapHypothesisCard["type"])
      : "talent";
    return {
      id: asString(rec.id, `hypothesis-${idx + 1}`),
      type,
      title: asString(rec.title, "—"),
      statement: asString(rec.statement),
      why_it_matters: asString(rec.why_it_matters),
      workplace_manifestation: asString(rec.workplace_manifestation),
      how_to_check: asString(rec.how_to_check),
      good_signal: asString(rec.good_signal),
      warning_signal: asString(rec.warning_signal),
      related_layer_ids: normalizeStringArray(rec.related_layer_ids),
      confidence: normalizeConfidence(rec.confidence),
      client_visible: rec.client_visible !== false,
    };
  });
}

function normalizeRiskChecks(raw: unknown): HrTalentMapRiskCheck[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 20).map((item, idx) => {
    const rec = asObject(item);
    return {
      id: asString(rec.id, `risk-${idx + 1}`),
      risk: asString(rec.risk, "—"),
      how_it_may_show_up: asString(rec.how_it_may_show_up),
      interview_check: asString(rec.interview_check),
      test_task_check: asString(rec.test_task_check),
      good_signal: asString(rec.good_signal),
      warning_signal: asString(rec.warning_signal),
      management_prevention: asString(rec.management_prevention),
      related_hypothesis_ids: normalizeStringArray(rec.related_hypothesis_ids),
      confidence: normalizeConfidence(rec.confidence),
    };
  });
}

function normalizeManagementPlaybook(raw: unknown): HrTalentMapManagementPlaybook | undefined {
  const rec = asObject(raw);
  const playbook: HrTalentMapManagementPlaybook = {
    how_to_set_tasks: asString(rec.how_to_set_tasks),
    how_to_give_feedback: asString(rec.how_to_give_feedback),
    how_to_motivate: asString(rec.how_to_motivate),
    what_not_to_do: asString(rec.what_not_to_do),
    best_environment: asString(rec.best_environment),
    overload_signals: asString(rec.overload_signals),
    first_30_days_focus: asString(rec.first_30_days_focus),
  };
  if (!Object.values(playbook).some(Boolean)) return undefined;
  return playbook;
}

function normalizeVerificationPlan(raw: unknown): HrTalentMapVerificationPlan | undefined {
  const rec = asObject(raw);
  const plan: HrTalentMapVerificationPlan = {
    first_check: asString(rec.first_check),
    interview_focus: asString(rec.interview_focus),
    test_task_focus: asString(rec.test_task_focus),
    what_to_observe: asString(rec.what_to_observe),
    decision_after_check: asString(rec.decision_after_check),
  };
  if (!Object.values(plan).some(Boolean)) return undefined;
  return plan;
}

function normalizeEvidenceMap(raw: unknown): HrTalentMapEvidenceItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 40).map((item, idx) => {
    const rec = asObject(item);
    return {
      id: asString(rec.id, `evidence-${idx + 1}`),
      conclusion: asString(rec.conclusion),
      based_on: normalizeStringArray(rec.based_on),
      source_layer_ids: normalizeStringArray(rec.source_layer_ids),
      confidence: normalizeConfidence(rec.confidence),
      client_visible: rec.client_visible === true,
    };
  });
}

function isTalentMapV12Legacy(root: Record<string, unknown>): boolean {
  if (asString(root.schema_version) === "hr_person_talent_map_v1_2") return true;
  if (Array.isArray(root.layer_map) && root.layer_map.length > 0) return true;
  if (Array.isArray(root.hypothesis_cards) && root.hypothesis_cards.length > 0) return true;
  if (Array.isArray(root.risk_checks) && root.risk_checks.length > 0) return true;
  return false;
}

/** Whether workspace should use layered v1.2 or v2 shell layout. */
export function isTalentMapV2OrLayered(root: Record<string, unknown>): boolean {
  if (isTalentMapV2Ready(root)) return true;
  return isTalentMapV12Legacy(root);
}

/** Whether workspace should use v1.2 layered layout (includes v2). */
export function isTalentMapV12(root: Record<string, unknown>): boolean {
  return isTalentMapV2OrLayered(root);
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

  const schemaVersion = asString(root.schema_version);
  const executiveSnapshot = normalizeExecutiveSnapshot(root.executive_snapshot);
  const layerMap = normalizeLayerMap(root.layer_map);
  const hypothesisCards = normalizeHypothesisCards(root.hypothesis_cards);
  const riskChecks = normalizeRiskChecks(root.risk_checks);
  const managementPlaybook = normalizeManagementPlaybook(root.management_playbook);
  const verificationPlan = normalizeVerificationPlan(root.verification_plan);
  const evidenceMap = normalizeEvidenceMap(root.evidence_map);

  return {
    ...(schemaVersion ? { schema_version: schemaVersion } : {}),
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
    ...(executiveSnapshot ? { executive_snapshot: executiveSnapshot } : {}),
    ...(layerMap.length > 0 ? { layer_map: layerMap } : {}),
    ...(hypothesisCards.length > 0 ? { hypothesis_cards: hypothesisCards } : {}),
    ...(riskChecks.length > 0 ? { risk_checks: riskChecks } : {}),
    ...(managementPlaybook ? { management_playbook: managementPlaybook } : {}),
    ...(verificationPlan ? { verification_plan: verificationPlan } : {}),
    ...(evidenceMap.length > 0 ? { evidence_map: evidenceMap } : {}),
    ...(root.ui !== undefined ? { ui: root.ui } : {}),
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
    const parsed = parseReportContentJson(raw);
    if (parsed && isTalentMapV2(parsed)) {
      return mapV2ToLegacyWorkspaceContent(parsed as HrPersonTalentMapV2);
    }
    const root = parsed ? unwrapReportContent(parsed) : {};
    if (isTalentMapV2(root)) {
      return mapV2ToLegacyWorkspaceContent(root as HrPersonTalentMapV2);
    }
    return buildNormalizedContent(root);
  } catch (err) {
    console.error("[normalizeAiReportContent] failed", err);
    return buildNormalizedContent({});
  }
}
