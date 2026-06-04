export const CAREER_READING_QUALITY_SCAN_VERSION_V1 =
  "career_reading_quality_scan_v1" as const;

export type CareerReadingQualityIssueV1 = {
  code: string;
  severity: "info" | "warning" | "error";
  path: string;
  message: string;
  snippet?: string;
  term?: string;
};

export type CareerReadingQualityScanV1 = {
  version: typeof CAREER_READING_QUALITY_SCAN_VERSION_V1;
  status: "pass" | "warn" | "fail";
  issue_count: number;
  error_count: number;
  warning_count: number;
  checks: Record<
    string,
    {
      status: "pass" | "warn" | "fail";
      issue_count: number;
      issues: CareerReadingQualityIssueV1[];
    }
  >;
  summary: {
    base_forbidden_hd_terms_count: number;
    english_or_mixed_language_count: number;
    weird_phrase_count: number;
    repetition_score: number;
    generic_text_count: number;
    role_fit_forbidden_count: number;
    methodology_risk_count: number;
    missing_evidence_count: number;
  };
};

type TextField = { path: string; text: string };

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((v) => asString(v)).filter(Boolean);
}

function makeSnippet(text: string, index: number, len = 80): string {
  const start = Math.max(0, index - 20);
  return text.slice(start, start + len).replace(/\s+/g, " ");
}

function collectBaseTextFields(layer: Record<string, unknown>): TextField[] {
  const base = asRecord(layer.base);
  const fields: TextField[] = [];
  for (const key of [
    "headline",
    "short_summary",
    "detailed_explanation",
    "how_it_appears_at_work",
  ]) {
    const text = asString(base[key]);
    if (text) fields.push({ path: `base.${key}`, text });
  }
  asStringArray(base.where_useful).forEach((text, i) => {
    fields.push({ path: `base.where_useful[${i}]`, text });
  });
  const strengths = Array.isArray(base.strengths) ? base.strengths : [];
  strengths.forEach((item, i) => {
    const rec = asRecord(item);
    for (const key of ["title", "description"]) {
      const text = asString(rec[key]);
      if (text) fields.push({ path: `base.strengths[${i}].${key}`, text });
    }
  });
  const risks = Array.isArray(base.risks) ? base.risks : [];
  risks.forEach((item, i) => {
    const rec = asRecord(item);
    for (const key of ["title", "description", "how_it_may_show_up", "mitigation"]) {
      const text = asString(rec[key]);
      if (text) fields.push({ path: `base.risks[${i}].${key}`, text });
    }
  });
  asStringArray(base.management_tips).forEach((text, i) => {
    fields.push({ path: `base.management_tips[${i}]`, text });
  });
  const checks = Array.isArray(base.what_to_check) ? base.what_to_check : [];
  checks.forEach((item, i) => {
    const rec = asRecord(item);
    for (const key of ["hypothesis", "check_method", "good_signal", "warning_signal"]) {
      const text = asString(rec[key]);
      if (text) fields.push({ path: `base.what_to_check[${i}].${key}`, text });
    }
  });
  return fields;
}

function collectClientFacingTextFields(layer: Record<string, unknown>): TextField[] {
  const fields = collectBaseTextFields(layer);
  const synthesis = asRecord(layer.summary_for_synthesis);
  const oneSentence = asString(synthesis.one_sentence);
  if (oneSentence) fields.push({ path: "summary_for_synthesis.one_sentence", text: oneSentence });
  for (const key of ["strengths", "risks", "conditions", "management_focus", "what_to_check"]) {
    asStringArray(synthesis[key]).forEach((text, i) => {
      fields.push({ path: `summary_for_synthesis.${key}[${i}]`, text });
    });
  }
  const matching = asRecord(layer.matching_summary);
  for (const key of [
    "good_for",
    "bad_for",
    "role_fit_positive_signals",
    "role_fit_risk_signals",
    "check_in_role_fit",
  ]) {
    asStringArray(matching[key]).forEach((text, i) => {
      fields.push({ path: `matching_summary.${key}[${i}]`, text });
    });
  }
  const summary = asString(matching.summary);
  if (summary) fields.push({ path: "matching_summary.summary", text: summary });
  return fields;
}

function collectAllScanText(layer: Record<string, unknown>): string {
  return collectClientFacingTextFields(layer)
    .map((f) => f.text)
    .join("\n");
}

const BASE_FORBIDDEN_HD: Array<{ label: string; pattern: RegExp }> = [
  { label: "Human Design", pattern: /\bhuman design\b/giu },
  { label: "Дизайн Человека", pattern: /\bдизайн человека\b/giu },
  { label: "бодиграф", pattern: /\bбодиграф\b/giu },
  { label: "Проектор", pattern: /\bпроектор\b/giu },
  { label: "Генератор", pattern: /\bгенератор\b/giu },
  {
    label: "Манифестирующий Генератор",
    pattern: /\bманифестирующ\w+\s+генератор\b/giu,
  },
  { label: "Манифестор", pattern: /\bманифестор\b/giu },
  { label: "Рефлектор", pattern: /\bрефлектор\b/giu },
  { label: "Сакрал", pattern: /\bсакрал\w*\b/giu },
  { label: "Селезёнка", pattern: /селезёнк/iu },
  { label: "Эмоциональный центр", pattern: /эмоциональн\w+\s+центр/iu },
  { label: "Эго", pattern: /(?<![\p{L}])эго(?![\p{L}])/iu },
  { label: "G-центр", pattern: /G[\s-]?центр/iu },
  { label: "Аджна", pattern: /\bаджн\w*\b/giu },
  { label: "Корень", pattern: /(?<![\p{L}])корень(?![\p{L}])/iu },
  { label: "Темя", pattern: /(?<![\p{L}])темя(?![\p{L}])/iu },
  { label: "Горло", pattern: /(?<![\p{L}])горл\w*(?![\p{L}])/iu },
  { label: "ворота", pattern: /(?<![\p{L}])ворот[аеу]?(?![\p{L}])/iu },
  { label: "гейт", pattern: /\bгейт\w*\b/giu },
  { label: "канал", pattern: /(?<![\p{L}])канал\w*(?![\p{L}])/iu },
  { label: "центр", pattern: /(?<![\p{L}])центр\w*(?![\p{L}])/iu },
  { label: "линия", pattern: /(?<![\p{L}])линия(?![\p{L}])/iu },
  { label: "стратегия (HD)", pattern: /(?<![\p{L}])стратеги\w*(?![\p{L}])/iu },
  { label: "авторитет (HD)", pattern: /(?<![\p{L}])авторитет\w*(?![\p{L}])/iu },
  { label: "Эмоциональный центр", pattern: /эмоциональн\w+\s+центр/iu },
  { label: "Эго-центр", pattern: /эго[\s-]?центр/iu },
  { label: "G-центр", pattern: /G[\s-]?центр/iu },
  { label: "Селезёнка", pattern: /селезёнк/iu },
  { label: "Темя", pattern: /(?<![\p{L}])темя(?![\p{L}])/iu },
  { label: "Корень", pattern: /(?<![\p{L}])корень(?![\p{L}])/iu },
];

const ROLE_FIT_FORBIDDEN: Array<{ label: string; pattern: RegExp }> = [
  { label: "подходит на", pattern: /подходит\s+на\s+\d+/iu },
  { label: "соответствует на", pattern: /соответствует\s+на\s+\d+/iu },
  { label: "fit_score", pattern: /\bfit_score\b/i },
  { label: "процент соответствия", pattern: /процент\s+соответствия/iu },
  { label: "не брать", pattern: /(?<![\p{L}])не\s+брать(?![\p{L}])/iu },
  { label: "брать (вердикт)", pattern: /(?<![\p{L}])брать(?![\p{L}])\s+(?:кандидат|на\s+работу)/iu },
  { label: "нанять", pattern: /(?<![\p{L}])нанять(?![\p{L}])/iu },
  { label: "не нанимать", pattern: /(?<![\p{L}])не\s+нанимать(?![\p{L}])/iu },
  { label: "hire / no hire", pattern: /\bhire\s*\/\s*no hire\b/i },
  { label: "strong hire", pattern: /\bstrong hire\b/i },
  { label: "reject", pattern: /\breject\b/i },
];

const WEIRD_PHRASES: Array<{ label: string; pattern: RegExp }> = [
  { label: "постановка целей на окрик", pattern: /постановка\s+целей\s+на\s+окрик/iu },
  { label: "окрик/мгновение", pattern: /окрик\s*\/\s*мгновение/iu },
  { label: "Грейдами служат", pattern: /грейдами\s+служат/iu },
  { label: "проектировщика", pattern: /проектировщика/iu },
  { label: "форм-фактор", pattern: /форм[\s-]?фактор/iu },
  {
    label: "соблюдение формального процесса вовлечения",
    pattern: /соблюдени\w+\s+формальн\w+\s+процесс\w+\s+вовлечен/i,
  },
  { label: "кандидат демонстрирует", pattern: /кандидат\s+демонстрирует/iu },
  { label: "данный слой", pattern: /данный\s+слой/iu },
  {
    label: "источники мотивации активируют",
    pattern: /источники\s+мотивации\s+активируют/iu,
  },
];

const GENERIC_PHRASES: Array<{ label: string; pattern: RegExp }> = [
  { label: "важно создать условия", pattern: /важно\s+создать\s+условия/iu },
  { label: "нужно учитывать особенности", pattern: /нужно\s+учитывать\s+особенност/iu },
  {
    label: "может быть полезен в разных задачах",
    pattern: /может\s+быть\s+полезен\s+в\s+разных\s+задачах/iu,
  },
  {
    label: "требуется индивидуальный подход",
    pattern: /требуется\s+индивидуальн\w+\s+подход/iu,
  },
  { label: "проявляется по-разному", pattern: /проявляется\s+по[\s-]?разному/iu },
];

const METHODOLOGY_RISKS: Array<{ label: string; pattern: RegExp }> = [
  {
    label: "Проектор = пассивный",
    pattern: /проектор\w*[^.]{0,60}пассивн/iu,
  },
  { label: "открытый центр = слабость", pattern: /открыт\w+\s+центр[^.]{0,40}слабост/iu },
  {
    label: "определённый центр = талант",
    pattern: /определённ\w+\s+центр[^.]{0,40}автоматич/iu,
  },
  { label: "ворота = профессия", pattern: /ворот[аеу]?[^.]{0,30}професс/i },
];

const ENGLISH_WORD_PATTERN = /\b(?:roles?|progress|signal|hire|fit|score|manager|team)\b/i;

function scanPatterns(
  fields: TextField[],
  patterns: Array<{ label: string; pattern: RegExp }>,
  code: string,
  severity: CareerReadingQualityIssueV1["severity"],
): CareerReadingQualityIssueV1[] {
  const issues: CareerReadingQualityIssueV1[] = [];
  for (const field of fields) {
    for (const { label, pattern } of patterns) {
      pattern.lastIndex = 0;
      const hit = pattern.exec(field.text);
      if (!hit) continue;
      issues.push({
        code,
        severity,
        path: field.path,
        message: `Обнаружено: ${label}`,
        term: label,
        snippet: makeSnippet(field.text, hit.index),
      });
    }
  }
  return issues;
}

function computeRepetitionScore(text: string): number {
  const normalized = text
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) return 0;

  const sentences = normalized
    .split(/[.!?…]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 24);
  if (sentences.length < 2) return 0;

  const seen = new Map<string, number>();
  let duplicateWeight = 0;
  for (const sentence of sentences) {
    const count = (seen.get(sentence) ?? 0) + 1;
    seen.set(sentence, count);
    if (count > 1) duplicateWeight += 1;
  }

  const words = normalized.split(" ").filter((w) => w.length > 3);
  const trigrams: string[] = [];
  for (let i = 0; i < words.length - 2; i++) {
    trigrams.push(`${words[i]} ${words[i + 1]} ${words[i + 2]}`);
  }
  const triSeen = new Map<string, number>();
  let triDup = 0;
  for (const tri of trigrams) {
    const c = (triSeen.get(tri) ?? 0) + 1;
    triSeen.set(tri, c);
    if (c > 1) triDup += 1;
  }

  const sentenceScore = sentences.length > 0 ? duplicateWeight / sentences.length : 0;
  const triScore = trigrams.length > 0 ? triDup / trigrams.length : 0;
  return Math.min(1, sentenceScore * 0.6 + triScore * 0.4);
}

function buildCheck(
  issues: CareerReadingQualityIssueV1[],
): { status: "pass" | "warn" | "fail"; issue_count: number; issues: CareerReadingQualityIssueV1[] } {
  const error_count = issues.filter((i) => i.severity === "error").length;
  const warning_count = issues.filter((i) => i.severity === "warning").length;
  let status: "pass" | "warn" | "fail" = "pass";
  if (error_count > 0) status = "fail";
  else if (warning_count > 0) status = "warn";
  return { status, issue_count: issues.length, issues };
}

function aggregateStatus(checks: Record<string, { status: string }>): "pass" | "warn" | "fail" {
  if (Object.values(checks).some((c) => c.status === "fail")) return "fail";
  if (Object.values(checks).some((c) => c.status === "warn")) return "warn";
  return "pass";
}

export function scanCareerReadingLayerQualityV1(
  layer: Record<string, unknown>,
): CareerReadingQualityScanV1 {
  const fields = collectClientFacingTextFields(layer);
  const allText = collectAllScanText(layer);

  const hdIssues = scanPatterns(fields, BASE_FORBIDDEN_HD, "base_forbidden_hd_terms", "error");
  for (const field of fields) {
    if (/\bпрофил[ьяeю]\b/giu.test(field.text) && /\b\d\s*\/\s*\d\b/.test(field.text)) {
      hdIssues.push({
        code: "base_forbidden_hd_terms",
        severity: "error",
        path: field.path,
        message: "Запрещённый HD-термин: профиль (HD)",
        term: "профиль (HD)",
        snippet: makeSnippet(field.text, 0),
      });
    }
  }

  const englishIssues: CareerReadingQualityIssueV1[] = [];
  for (const field of fields) {
    if (!field.path.startsWith("base.")) continue;
    const latinWords = field.text.match(/\b[a-z]{3,}\b/gi) ?? [];
    const hits = latinWords.filter((w) => ENGLISH_WORD_PATTERN.test(w));
    if (hits.length > 0 || (/\b[a-z]{4,}\b/i.test(field.text) && /[а-яё]/iu.test(field.text))) {
      const match = field.text.match(/\b[a-z]{3,}\b/i);
      if (match) {
        englishIssues.push({
          code: "english_or_mixed_language",
          severity: "warning",
          path: field.path,
          message: "Смешанный или английский язык в Base",
          term: match[0],
          snippet: makeSnippet(field.text, match.index ?? 0),
        });
      }
    }
  }

  const weirdIssues = scanPatterns(fields, WEIRD_PHRASES, "weird_phrase", "warning");
  const roleFitIssues = scanPatterns(
    collectClientFacingTextFields(layer),
    ROLE_FIT_FORBIDDEN,
    "role_fit_forbidden",
    "error",
  );
  const genericIssues = scanPatterns(fields, GENERIC_PHRASES, "generic_text", "warning");
  const methodologyIssues = scanPatterns(
    collectClientFacingTextFields(layer),
    METHODOLOGY_RISKS,
    "methodology_risk",
    "warning",
  );

  const repetition_score = computeRepetitionScore(allText);
  const repetitionIssues: CareerReadingQualityIssueV1[] = [];
  if (repetition_score > 0.3) {
    repetitionIssues.push({
      code: "repetition_score",
      severity: "error",
      path: "layer",
      message: `Высокий repetition_score: ${repetition_score.toFixed(3)}`,
    });
  } else if (repetition_score > 0.18) {
    repetitionIssues.push({
      code: "repetition_score",
      severity: "warning",
      path: "layer",
      message: `Повышенный repetition_score: ${repetition_score.toFixed(3)}`,
    });
  }

  const missingEvidenceIssues: CareerReadingQualityIssueV1[] = [];
  const evidence = asRecord(layer.evidence);
  if (asStringArray(evidence.source_fields).length === 0) {
    missingEvidenceIssues.push({
      code: "missing_evidence",
      severity: "error",
      path: "evidence.source_fields",
      message: "Пустой evidence.source_fields",
    });
  }
  const pro = asRecord(layer.pro);
  const classical = Array.isArray(pro.classical_sources) ? pro.classical_sources : [];
  if (classical.length === 0) {
    missingEvidenceIssues.push({
      code: "missing_evidence",
      severity: "warning",
      path: "pro.classical_sources",
      message: "Пустой pro.classical_sources",
    });
  }

  const genericCount = genericIssues.length;
  const genericCheckIssues =
    genericCount >= 3
      ? genericIssues
      : genericCount > 0
        ? genericIssues.map((i) => ({ ...i, severity: "info" as const }))
        : [];

  const checks: CareerReadingQualityScanV1["checks"] = {
    base_forbidden_hd_terms: buildCheck(hdIssues),
    english_or_mixed_language: buildCheck(englishIssues),
    weird_phrase: buildCheck(weirdIssues),
    repetition: buildCheck(repetitionIssues),
    generic_text: buildCheck(genericCheckIssues),
    role_fit_forbidden: buildCheck(roleFitIssues),
    methodology_risk: buildCheck(methodologyIssues),
    missing_evidence: buildCheck(missingEvidenceIssues),
  };

  const allIssues = Object.values(checks).flatMap((c) => c.issues);
  const error_count = allIssues.filter((i) => i.severity === "error").length;
  const warning_count = allIssues.filter((i) => i.severity === "warning").length;

  return {
    version: CAREER_READING_QUALITY_SCAN_VERSION_V1,
    status: aggregateStatus(checks),
    issue_count: allIssues.length,
    error_count,
    warning_count,
    checks,
    summary: {
      base_forbidden_hd_terms_count: hdIssues.length,
      english_or_mixed_language_count: englishIssues.length,
      weird_phrase_count: weirdIssues.length,
      repetition_score,
      generic_text_count: genericCount,
      role_fit_forbidden_count: roleFitIssues.length,
      methodology_risk_count: methodologyIssues.length,
      missing_evidence_count: missingEvidenceIssues.length,
    },
  };
}
