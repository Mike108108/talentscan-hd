import type { HrPersonTalentMapV1, HrTalentMapSectionItem, TalentMapItem } from "./types";

export type FlexibleSectionItem = {
  title: string;
  body: string;
  fit?: string;
  checks?: string;
  goodAnswer?: string;
  warningSign?: string;
  howToEvaluate?: string;
  timeEstimate?: string;
  criteria?: string;
  nextStep?: string;
  focus?: string;
  give?: string;
  verify?: string;
  successSignal?: string;
  risk?: string;
};

export type OnboardingPhase = {
  label: string;
  focus?: string;
  give?: string;
  verify?: string;
  successSignal?: string;
  risk?: string;
  summary?: string;
};

function asObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

export function getText(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (Array.isArray(value)) {
    const parts = value.map((v) => getText(v)).filter(Boolean);
    return parts.join("\n");
  }
  const obj = asObject(value);
  for (const key of ["text", "summary", "description", "body", "value", "title"]) {
    const t = getText(obj[key]);
    if (t) return t;
  }
  return fallback;
}

export function getList(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === "string") return item.trim();
        const obj = asObject(item);
        return getText(obj.text ?? obj.title ?? obj.body ?? item);
      })
      .filter(Boolean);
  }
  const obj = asObject(value);
  if (Array.isArray(obj.items)) return getList(obj.items);
  const single = getText(value);
  return single ? [single] : [];
}

export function isNonEmptyArray(value: unknown): boolean {
  return Array.isArray(value) && value.length > 0;
}

/** Coerce disclaimers / string lists from DB (array or single string). */
export function coerceStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((v) => getText(v)).filter(Boolean);
  }
  const single = getText(value);
  return single ? [single] : [];
}

export function coerceRolesList(value: unknown): HrPersonTalentMapV1["roles"] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    if (typeof item === "string") {
      const t = item.trim();
      return { role: t || "—", fit: "—", note: "" };
    }
    const rec = asObject(item);
    return {
      role: getText(rec.role ?? rec.title ?? rec.name, "—"),
      fit: getText(rec.fit, "—"),
      note: getText(rec.note),
    };
  });
}

export function parseFlexibleItem(raw: unknown): FlexibleSectionItem | null {
  if (typeof raw === "string") {
    const t = raw.trim();
    return t ? { title: "—", body: t } : null;
  }
  const rec = asObject(raw);
  const title = getText(rec.title ?? rec.question ?? rec.task ?? rec.label, "—");
  const body = getText(
    rec.body ??
      rec.description ??
      rec.summary ??
      rec.text ??
      rec.note ??
      rec.content,
  );
  const fit = getText(rec.fit);
  const checks = getText(rec.checks ?? rec.what_to_check ?? rec.verifies ?? rec.check);
  const goodAnswer = getText(rec.good_answer ?? rec.good ?? rec.positive_signal);
  const warningSign = getText(
    rec.warning_sign ?? rec.red_flag ?? rec.bad_answer ?? rec.concern,
  );
  const howToEvaluate = getText(rec.how_to_evaluate ?? rec.evaluation ?? rec.scoring);
  const timeEstimate = getText(rec.time ?? rec.duration ?? rec.time_estimate);
  const criteria = getText(rec.criteria ?? rec.success_criteria);
  const nextStep = getText(rec.next_step ?? rec.follow_up);

  if (!title && !body && !checks) return null;

  return {
    title: title || "—",
    body,
    ...(fit ? { fit } : {}),
    ...(checks ? { checks } : {}),
    ...(goodAnswer ? { goodAnswer } : {}),
    ...(warningSign ? { warningSign } : {}),
    ...(howToEvaluate ? { howToEvaluate } : {}),
    ...(timeEstimate ? { timeEstimate } : {}),
    ...(criteria ? { criteria } : {}),
    ...(nextStep ? { nextStep } : {}),
  };
}

export function parseFlexibleItems(raw: unknown): FlexibleSectionItem[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.map(parseFlexibleItem).filter((x): x is FlexibleSectionItem => x !== null);
  }
  const obj = asObject(raw);
  if (Array.isArray(obj.items)) return parseFlexibleItems(obj.items);
  const single = parseFlexibleItem(raw);
  return single ? [single] : [];
}

export function itemsFromTalentMapItems(items: HrTalentMapSectionItem[] | TalentMapItem[]): FlexibleSectionItem[] {
  if (!Array.isArray(items)) return [];
  return items.map((item) => {
    if (!item || typeof item !== "object") {
      const t = getText(item);
      return { title: "—", body: t };
    }
    return {
      title: getText(item.title, "—"),
      body: getText(item.body),
      ...(item.fit ? { fit: getText(item.fit) } : {}),
    };
  });
}

export function mergeFlexibleItems(
  normalized: HrTalentMapSectionItem[] | TalentMapItem[],
  raw: unknown,
): FlexibleSectionItem[] {
  const fromRaw = parseFlexibleItems(raw);
  if (fromRaw.length > 0) return fromRaw;
  return itemsFromTalentMapItems(normalized);
}

export function parseOnboardingPhase(
  raw: unknown,
  label: string,
): OnboardingPhase | null {
  if (!raw) return null;
  if (typeof raw === "string") {
    const s = raw.trim();
    return s ? { label, summary: s } : null;
  }
  const rec = asObject(raw);
  const summary = getText(rec.summary ?? rec.text ?? rec.body);
  const focus = getText(rec.focus);
  const give = getText(rec.give ?? rec.provide);
  const verify = getText(rec.verify ?? rec.check);
  const successSignal = getText(rec.success_signal ?? rec.success);
  const risk = getText(rec.risk);

  if (!summary && !focus && !give && !verify) return null;

  return {
    label,
    ...(summary ? { summary } : {}),
    ...(focus ? { focus } : {}),
    ...(give ? { give } : {}),
    ...(verify ? { verify } : {}),
    ...(successSignal ? { successSignal } : {}),
    ...(risk ? { risk } : {}),
  };
}

export function parseOnboardingTimeline(
  onboarding: HrPersonTalentMapV1["onboarding_7_30_90"] | undefined,
  rawRoot?: unknown,
): OnboardingPhase[] {
  const raw = asObject(rawRoot);
  const ob = asObject(raw.onboarding_7_30_90 ?? rawRoot);
  const safeItems = Array.isArray(onboarding?.items) ? onboarding.items : [];
  const safeOnboarding = onboarding ?? { day_7: "", day_30: "", day_90: "", items: safeItems };

  const phases: OnboardingPhase[] = [];

  const d7 = parseOnboardingPhase(ob.day_7 ?? safeOnboarding.day_7, "Первые 7 дней");
  const d30 = parseOnboardingPhase(ob.day_30 ?? safeOnboarding.day_30, "Первые 30 дней");
  const d90 = parseOnboardingPhase(ob.day_90 ?? safeOnboarding.day_90, "Первые 90 дней");

  if (d7) phases.push(d7);
  if (d30) phases.push(d30);
  if (d90) phases.push(d90);

  const onboardingItems = safeOnboarding.items ?? [];
  if (phases.length === 0 && onboardingItems.length > 0) {
    for (const item of onboardingItems) {
      const title = getText(item?.title ?? item, "Этап");
      const body = getText(item?.body);
      phases.push({
        label: title,
        ...(body ? { summary: body } : {}),
        ...(item?.fit ? { risk: getText(item.fit) } : {}),
      });
    }
  }

  return phases;
}

export function extractCompletenessPercent(
  completeness?: string,
  metrics?: { label: string; value: string }[],
): number | null {
  const fromStr = completeness?.match(/(\d{1,3})\s*%/);
  if (fromStr) {
    const n = Number(fromStr[1]);
    if (Number.isFinite(n)) return Math.min(100, Math.max(0, n));
  }
  for (const m of metrics ?? []) {
    const match = `${m.label} ${m.value}`.match(/(\d{1,3})\s*%/);
    if (match) {
      const n = Number(match[1]);
      if (Number.isFinite(n)) return Math.min(100, Math.max(0, n));
    }
  }
  return null;
}

export function formatReportDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  try {
    return new Intl.DateTimeFormat("ru-RU", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return null;
  }
}
