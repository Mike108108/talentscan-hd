/**
 * Normalize + validate AI HR report JSON before save / client render.
 */

export type NormalizedSectionItem = { title: string; body: string; fit?: string };
export type NormalizedRole = { role: string; fit: string; note: string };
export type NormalizedMetric = { label: string; value: string; hint?: string };

export type NormalizedPersonTalentMap = {
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
  executive_summary: { text: string; fit_score: number };
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
  qa_meta: { hypothesis_level: string; disclaimers: string[] };
};

function asString(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.round(Math.min(100, Math.max(0, value)));
  }
  return fallback;
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

export function normalizePersonTalentMapContent(raw: unknown): NormalizedPersonTalentMap {
  const root = normalizeObject(raw);
  const hero = normalizeObject(root.hero);
  const dataQuality = normalizeObject(root.data_quality);
  const executive = normalizeObject(root.executive_summary);
  const workingFormula = normalizeObject(root.working_formula);
  const onboarding = normalizeObject(root.onboarding_7_30_90);
  const finalRec = normalizeObject(root.final_hr_recommendation);
  const qaMeta = normalizeObject(root.qa_meta);

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
      text: asString(executive.text),
      fit_score: asNumber(executive.fit_score),
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
      disclaimers,
    },
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

function collectClientText(value: unknown, acc: string[] = []): string[] {
  if (typeof value === "string") {
    acc.push(value);
    return acc;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectClientText(item, acc);
    return acc;
  }
  if (value && typeof value === "object") {
    for (const v of Object.values(value as Record<string, unknown>)) {
      collectClientText(v, acc);
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
  return {
    report_type: reportType,
    company: analysisPacket.company ?? null,
    candidate: analysisPacket.candidate ?? null,
    vacancy: analysisPacket.vacancy ?? null,
    normalized_chart: analysisPacket.normalized_chart ?? null,
    prompt_version: analysisPacket.prompt_version ?? null,
  };
}
