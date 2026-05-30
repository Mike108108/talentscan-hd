/**
 * Normalize + validate AI HR report JSON before save / client render.
 */

export type NormalizedSectionItem = { title: string; body: string; fit?: string };
export type NormalizedRole = { role: string; fit: string; note: string };
export type NormalizedMetric = { label: string; value: string; hint?: string };

export type NormalizedConfidence = "high" | "medium" | "low";

export type NormalizedExecutiveSnapshot = {
  one_sentence: string;
  best_use: string;
  main_value: string;
  main_risk: string;
  how_to_check_first: string;
  decision_note: string;
};

export type NormalizedLayerMapItem = {
  id: string;
  title: string;
  client_summary: string;
  hr_meaning: string;
  key_signal: string;
  risk_signal: string;
  how_to_check: string;
  confidence: NormalizedConfidence;
  ui_priority: number;
  source_layer_id: string;
};

export type NormalizedHypothesisCard = {
  id: string;
  type: "talent" | "risk" | "condition" | "management" | "growth";
  title: string;
  statement: string;
  why_it_matters: string;
  workplace_manifestation: string;
  how_to_check: string;
  good_signal: string;
  warning_signal: string;
  related_layer_ids: string[];
  confidence: NormalizedConfidence;
  client_visible: boolean;
};

export type NormalizedRiskCheck = {
  id: string;
  risk: string;
  how_it_may_show_up: string;
  interview_check: string;
  test_task_check: string;
  good_signal: string;
  warning_signal: string;
  management_prevention: string;
  related_hypothesis_ids: string[];
  confidence: NormalizedConfidence;
};

export type NormalizedManagementPlaybook = {
  how_to_set_tasks: string;
  how_to_give_feedback: string;
  how_to_motivate: string;
  what_not_to_do: string;
  best_environment: string;
  overload_signals: string;
  first_30_days_focus: string;
};

export type NormalizedVerificationPlan = {
  first_check: string;
  interview_focus: string;
  test_task_focus: string;
  what_to_observe: string;
  decision_after_check: string;
};

export type NormalizedEvidenceItem = {
  id: string;
  conclusion: string;
  based_on: string[];
  source_layer_ids: string[];
  confidence: NormalizedConfidence;
  client_visible: boolean;
};

export type NormalizedPersonTalentMap = {
  schema_version?: string;
  hero: {
    name: string;
    subtitle: string;
    status_label: string;
    best_work_format: string;
    key_talent: string;
    main_risk: string;
    headline: string;
  };
  data_quality: {
    completeness: string;
    confidence: string;
    notes: string;
    metrics: NormalizedMetric[];
  };
  executive_summary: { text: string; fit_score?: number | null };
  working_formula: { text: string };
  talents: NormalizedSectionItem[];
  strengths: NormalizedSectionItem[];
  risks: NormalizedSectionItem[];
  suitable_directions: NormalizedSectionItem[];
  questionable_directions: NormalizedSectionItem[];
  roles: NormalizedRole[];
  work_environment: NormalizedSectionItem[];
  management_style: NormalizedSectionItem[];
  interview_questions: NormalizedSectionItem[];
  test_tasks: NormalizedSectionItem[];
  onboarding_7_30_90: {
    day_7: string;
    day_30: string;
    day_90: string;
    items: NormalizedSectionItem[];
  };
  final_hr_recommendation: { text: string };
  qa_meta: {
    hypothesis_level: string;
    report_type_note?: string;
    next_best_report?: string;
    disclaimers: string[];
  };
  executive_snapshot?: NormalizedExecutiveSnapshot;
  layer_map?: NormalizedLayerMapItem[];
  hypothesis_cards?: NormalizedHypothesisCard[];
  risk_checks?: NormalizedRiskCheck[];
  management_playbook?: NormalizedManagementPlaybook;
  verification_plan?: NormalizedVerificationPlan;
  evidence_map?: NormalizedEvidenceItem[];
  ui?: unknown;
};

function asString(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return fallback;
}

function asOptionalNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.round(Math.min(100, Math.max(0, value)));
  }
  return undefined;
}

function normalizeSectionItems(raw: unknown): NormalizedSectionItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    const rec = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
    const fit = asString(rec.fit);
    return {
      title: asString(rec.title, "—"),
      body: asString(rec.body),
      ...(fit ? { fit } : {}),
    };
  });
}

function normalizeRoles(raw: unknown): NormalizedRole[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    const rec = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
    return {
      role: asString(rec.role, "—"),
      fit: asString(rec.fit, "—"),
      note: asString(rec.note),
    };
  });
}

function normalizeMetrics(raw: unknown): NormalizedMetric[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    const rec = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
    const hint = asString(rec.hint);
    return {
      label: asString(rec.label, "—"),
      value: asString(rec.value, "—"),
      ...(hint ? { hint } : {}),
    };
  });
}

function normalizeObject(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  return {};
}

function normalizeConfidence(raw: unknown): NormalizedConfidence {
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

function normalizeHypothesisType(
  raw: unknown,
): NormalizedHypothesisCard["type"] {
  const v = asString(raw).toLowerCase();
  if (
    v === "talent" ||
    v === "risk" ||
    v === "condition" ||
    v === "management" ||
    v === "growth"
  ) {
    return v;
  }
  return "talent";
}

function normalizeExecutiveSnapshot(raw: unknown): NormalizedExecutiveSnapshot | undefined {
  const rec = normalizeObject(raw);
  const oneSentence = asString(rec.one_sentence);
  const bestUse = asString(rec.best_use);
  const mainValue = asString(rec.main_value);
  const mainRisk = asString(rec.main_risk);
  const howToCheckFirst = asString(rec.how_to_check_first);
  const decisionNote = asString(rec.decision_note);
  if (!oneSentence && !bestUse && !mainRisk && !howToCheckFirst) return undefined;
  return {
    one_sentence: oneSentence,
    best_use: bestUse,
    main_value: mainValue,
    main_risk: mainRisk,
    how_to_check_first: howToCheckFirst,
    decision_note: decisionNote,
  };
}

function normalizeLayerMap(raw: unknown): NormalizedLayerMapItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 12).map((item, idx) => {
    const rec = normalizeObject(item);
    return {
      id: asString(rec.id, `layer-${idx + 1}`),
      title: asString(rec.title, "—"),
      client_summary: asString(rec.client_summary),
      hr_meaning: asString(rec.hr_meaning),
      key_signal: asString(rec.key_signal),
      risk_signal: asString(rec.risk_signal),
      how_to_check: asString(rec.how_to_check),
      confidence: normalizeConfidence(rec.confidence),
      ui_priority: typeof rec.ui_priority === "number" && Number.isFinite(rec.ui_priority)
        ? rec.ui_priority
        : idx + 1,
      source_layer_id: asString(rec.source_layer_id),
    };
  });
}

function normalizeHypothesisCards(raw: unknown): NormalizedHypothesisCard[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 30).map((item, idx) => {
    const rec = normalizeObject(item);
    return {
      id: asString(rec.id, `hypothesis-${idx + 1}`),
      type: normalizeHypothesisType(rec.type),
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

function normalizeRiskChecks(raw: unknown): NormalizedRiskCheck[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 20).map((item, idx) => {
    const rec = normalizeObject(item);
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

function normalizeManagementPlaybook(raw: unknown): NormalizedManagementPlaybook | undefined {
  const rec = normalizeObject(raw);
  const fields = {
    how_to_set_tasks: asString(rec.how_to_set_tasks),
    how_to_give_feedback: asString(rec.how_to_give_feedback),
    how_to_motivate: asString(rec.how_to_motivate),
    what_not_to_do: asString(rec.what_not_to_do),
    best_environment: asString(rec.best_environment),
    overload_signals: asString(rec.overload_signals),
    first_30_days_focus: asString(rec.first_30_days_focus),
  };
  if (!Object.values(fields).some(Boolean)) return undefined;
  return fields;
}

function normalizeVerificationPlan(raw: unknown): NormalizedVerificationPlan | undefined {
  const rec = normalizeObject(raw);
  const fields = {
    first_check: asString(rec.first_check),
    interview_focus: asString(rec.interview_focus),
    test_task_focus: asString(rec.test_task_focus),
    what_to_observe: asString(rec.what_to_observe),
    decision_after_check: asString(rec.decision_after_check),
  };
  if (!Object.values(fields).some(Boolean)) return undefined;
  return fields;
}

function normalizeEvidenceMap(raw: unknown): NormalizedEvidenceItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 40).map((item, idx) => {
    const rec = normalizeObject(item);
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

export function normalizePersonTalentMapContent(raw: unknown): NormalizedPersonTalentMap {
  const root = normalizeObject(raw);
  const hero = normalizeObject(root.hero);
  const dataQuality = normalizeObject(root.data_quality);
  const executive = normalizeObject(root.executive_summary);
  const workingFormula = normalizeObject(root.working_formula);
  const onboarding = normalizeObject(root.onboarding_7_30_90);
  const finalRec = normalizeObject(root.final_hr_recommendation);
  const qaMeta = normalizeObject(root.qa_meta);

  const fitScore = asOptionalNumber(executive.fit_score);

  const disclaimers = Array.isArray(qaMeta.disclaimers)
    ? qaMeta.disclaimers.map((d) => asString(d)).filter(Boolean)
    : [];

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
      text: asString(executive.text),
      ...(fitScore !== undefined ? { fit_score: fitScore } : {}),
    },
    working_formula: { text: asString(workingFormula.text) },
    talents: normalizeSectionItems(root.talents),
    strengths: normalizeSectionItems(root.strengths),
    risks: normalizeSectionItems(root.risks),
    suitable_directions: normalizeSectionItems(root.suitable_directions),
    questionable_directions: normalizeSectionItems(root.questionable_directions),
    roles: normalizeRoles(root.roles),
    work_environment: normalizeSectionItems(root.work_environment),
    management_style: normalizeSectionItems(root.management_style),
    interview_questions: normalizeSectionItems(root.interview_questions),
    test_tasks: normalizeSectionItems(root.test_tasks),
    onboarding_7_30_90: {
      day_7: asString(onboarding.day_7),
      day_30: asString(onboarding.day_30),
      day_90: asString(onboarding.day_90),
      items: normalizeSectionItems(onboarding.items),
    },
    final_hr_recommendation: { text: asString(finalRec.text) },
    qa_meta: {
      hypothesis_level: asString(qaMeta.hypothesis_level),
      ...(asString(qaMeta.report_type_note)
        ? { report_type_note: asString(qaMeta.report_type_note) }
        : {}),
      ...(asString(qaMeta.next_best_report)
        ? { next_best_report: asString(qaMeta.next_best_report) }
        : {}),
      disclaimers,
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

const HR_PHRASE_ALLOWLIST: RegExp[] = [
  /центр(?:ы|а)?\s+(?:ответственности|компетенций|принятия\s+решений)/giu,
  /канал(?:ы|а|ов)?\s+(?:продаж|коммуникации|привлечения|найма)/giu,
  /рабоч(?:ий|его|им|ем|ие)\s+профил(?:ь|я|ю|ем|е)/giu,
];

const BANNED_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
  { label: "Human Design", pattern: /\bhuman design\b/giu },
  { label: "Дизайн Человека", pattern: /\bдизайн человека\b/giu },
  { label: "бодиграф", pattern: /\bбодиграф\b/giu },
  { label: "bodygraph", pattern: /\bbodygraph\b/giu },
  { label: "рейв-карт", pattern: /\bрейв[- ]?карт/giu },
  { label: "ворота", pattern: /\bворот[аеу]\b/giu },
  { label: "каналы", pattern: /\bканал(?:ы|а|ов)?\b/giu },
  { label: "центры", pattern: /\bцентр(?:ы|а|ов)?\b/giu },
  { label: "сакрал", pattern: /\bсакрал\w*\b/giu },
  { label: "селезёнка", pattern: /\bселез[ёе]нк\w*\b/giu },
  { label: "эмоциональный центр", pattern: /\bэмоциональн\w+\s+центр\b/giu },
  { label: "профиль", pattern: /\bпрофил[ьяею]\b/giu },
  { label: "авторитет", pattern: /\bавторитет\b/giu },
  { label: "стратегия", pattern: /\bстратеги[яию]\b/giu },
  { label: "Генератор", pattern: /\bгенератор\b/giu },
  { label: "Проектор", pattern: /\bпроектор\b/giu },
  { label: "Манифестор", pattern: /\bманифестор\b/giu },
  { label: "Рефлектор", pattern: /\bрефлектор\b/giu },
  { label: "Генный Ключ", pattern: /\bгенн\w+\s+ключ\b/giu },
  { label: "соционика", pattern: /\bсоционик\w*\b/giu },
  { label: "социотип", pattern: /\bсоциотип\b/giu },
  { label: "инкарнационный крест", pattern: /\bинкарнационн\w+\s+крест\b/giu },
  { label: "incarnation cross", pattern: /\bincarnation cross\b/giu },
  { label: "внутренние аббревиатуры", pattern: /\b(чс|бэ|бл|чи)\b/giu },
];

function stripAllowlistedPhrases(text: string): string {
  let result = text;
  for (const pattern of HR_PHRASE_ALLOWLIST) {
    result = result.replace(pattern, " ");
  }
  return result;
}

function isInternalOnlyRecord(rec: Record<string, unknown>): boolean {
  if (rec.client_visible === false) return true;
  return false;
}

function collectClientText(value: unknown, acc: string[] = [], key?: string): string[] {
  if (key === "based_on" || key === "source_layer_id" || key === "source_layer_ids") {
    return acc;
  }
  if (typeof value === "string") {
    acc.push(value);
    return acc;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      if (item && typeof item === "object" && !Array.isArray(item)) {
        const rec = item as Record<string, unknown>;
        if (isInternalOnlyRecord(rec)) continue;
      }
      collectClientText(item, acc);
    }
    return acc;
  }
  if (value && typeof value === "object") {
    const rec = value as Record<string, unknown>;
    if (isInternalOnlyRecord(rec)) return acc;
    for (const [k, v] of Object.entries(rec)) {
      if (k === "evidence_map") {
        const items = Array.isArray(v) ? v : [];
        for (const item of items) {
          const ev = item && typeof item === "object" ? (item as Record<string, unknown>) : null;
          if (!ev || ev.client_visible === true) collectClientText(item, acc, k);
        }
        continue;
      }
      collectClientText(v, acc, k);
    }
  }
  return acc;
}

export function findBannedClientTerms(content: Record<string, unknown>): string[] {
  const texts = collectClientText(content);
  const found = new Set<string>();
  for (const text of texts) {
    const scrubbed = stripAllowlistedPhrases(text);
    for (const { label, pattern } of BANNED_PATTERNS) {
      pattern.lastIndex = 0;
      if (pattern.test(scrubbed)) found.add(label);
    }
    if (/\bпрофил[ьяeю]\b/giu.test(scrubbed) && /\b\d\s*\/\s*\d\b/.test(scrubbed)) {
      found.add("профиль (HD)");
    }
  }
  return Array.from(found);
}

export const BANNED_TERMS_USER_MESSAGE =
  "AI-отчёт содержит внутренние термины, попробуйте перегенерировать";

export function buildInputHashPayload(
  reportType: string,
  analysisPacket: Record<string, unknown>,
): Record<string, unknown> {
  const reportContext = analysisPacket.report_context ?? null;
  const promptVersion =
    reportContext &&
    typeof reportContext === "object" &&
    !Array.isArray(reportContext)
      ? (reportContext as Record<string, unknown>).prompt_version ?? null
      : analysisPacket.prompt_version ?? null;

  return {
    report_type: reportType,
    prompt_version: promptVersion,
    company: analysisPacket.company ?? null,
    candidate: analysisPacket.candidate ?? null,
    vacancy_context: analysisPacket.vacancy_context ?? analysisPacket.vacancy ?? null,
    source_chart: analysisPacket.source_chart ?? analysisPacket.normalized_chart ?? null,
  };
}
