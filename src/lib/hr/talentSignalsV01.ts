import { baseFieldToText } from "./synthesisBlocksV01";
import type {
  HrTalentMapManagementPlaybook,
  HrTalentMapRiskCheck,
  HrTalentMapSectionItem,
  HrTalentMapSynthesisBlockV2,
  HrTalentMapSynthesisBlocksV2,
} from "./types";

export type TalentSignalKindV01 =
  | "strength"
  | "condition"
  | "risk"
  | "communication"
  | "management"
  | "team_contribution";

export type TalentSignalV01 = {
  key: string;
  title: string;
  kind: TalentSignalKindV01;
  icon?: string;
  summary: string;
  what_to_check?: string;
  source_synthesis_keys?: string[];
  source_layer_keys?: string[];
};

export type DashboardPointV01 = {
  key: string;
  text: string;
  detail?: string;
};

export type DashboardConclusionV01 = {
  who_at_work?: string;
  where_shines?: string;
  what_to_check_first?: string;
  how_to_interact?: string;
};

export type DashboardDetailSectionKeyV01 =
  | "work_formula"
  | "talents"
  | "work_environment"
  | "risks"
  | "management";

export type DashboardDetailSectionV01 = {
  key: DashboardDetailSectionKeyV01;
  title: string;
  content: string;
  items: HrTalentMapSectionItem[];
  playbook?: HrTalentMapManagementPlaybook;
  checks?: HrTalentMapRiskCheck[];
};

const MAX_SIGNALS = 8;
const MIN_SIGNALS = 4;

const KIND_LABEL_RU: Record<TalentSignalKindV01, string> = {
  strength: "Сила",
  condition: "Условие",
  risk: "Риск",
  communication: "Коммуникация",
  management: "Управление",
  team_contribution: "Командный вклад",
};

const KIND_ICON: Record<TalentSignalKindV01, string> = {
  strength: "✦",
  condition: "◎",
  risk: "⚠",
  communication: "💬",
  management: "🎯",
  team_contribution: "🤝",
};

const SYNTHESIS_SOURCE_LABEL: Record<string, string> = {
  executive_summary: "общая сводка",
  work_formula: "рабочая формула",
  talents: "таланты",
  work_environment: "рабочая среда",
  risks: "риски",
  management: "управление",
};

export function talentSignalKindLabelRu(kind: TalentSignalKindV01): string {
  return KIND_LABEL_RU[kind];
}

function asString(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function blockText(block: HrTalentMapSynthesisBlockV2 | undefined): string {
  if (!block) return "";
  return (
    asString(block.text) ||
    asString(block.summary) ||
    asString(block.one_sentence) ||
    baseFieldToText(block.items)
  );
}

function normalizeItems(raw: unknown): HrTalentMapSectionItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (typeof item === "string") {
        const t = item.trim();
        return t ? { title: "—", body: t } : null;
      }
      if (item && typeof item === "object") {
        const rec = item as Record<string, unknown>;
        const title = asString(rec.title) || "—";
        const body = asString(rec.body ?? rec.text ?? rec.summary);
        if (!title && !body) return null;
        return { title: title || "—", body };
      }
      return null;
    })
    .filter((item): item is HrTalentMapSectionItem => item != null);
}

function truncate(text: string, maxLen: number): string {
  const t = text.trim();
  if (t.length <= maxLen) return t;
  const cut = t.slice(0, maxLen - 1);
  const lastSpace = cut.lastIndexOf(" ");
  if (lastSpace > maxLen * 0.6) return `${cut.slice(0, lastSpace)}…`;
  return `${cut}…`;
}

function sourceHint(keys: string[]): string | undefined {
  const labels = keys
    .map((k) => SYNTHESIS_SOURCE_LABEL[k])
    .filter(Boolean);
  if (!labels.length) return undefined;
  return `Источник: ${labels.join(", ")}`;
}

function itemSummary(item: HrTalentMapSectionItem): string {
  const body = asString(item.body);
  const title = asString(item.title);
  if (title && title !== "—" && body) return truncate(body, 220);
  return truncate(body || title, 220);
}

function itemTitle(item: HrTalentMapSectionItem, fallback: string): string {
  const title = asString(item.title);
  if (title && title !== "—") return truncate(title, 80);
  return truncate(asString(item.body), 80) || fallback;
}

function pushUniqueSignal(
  out: TalentSignalV01[],
  seen: Set<string>,
  signal: TalentSignalV01,
): void {
  const dedupeKey = `${signal.kind}:${signal.title}:${signal.summary.slice(0, 40)}`;
  if (seen.has(dedupeKey)) return;
  seen.add(dedupeKey);
  out.push(signal);
}

function makeSignal(args: {
  key: string;
  title: string;
  kind: TalentSignalKindV01;
  summary: string;
  what_to_check?: string;
  source_synthesis_keys?: string[];
}): TalentSignalV01 {
  return {
    ...args,
    icon: KIND_ICON[args.kind],
    summary: truncate(args.summary, 220),
    what_to_check: args.what_to_check ? truncate(args.what_to_check, 180) : undefined,
  };
}

function playbookField(
  playbook: HrTalentMapManagementPlaybook | undefined,
  field: keyof HrTalentMapManagementPlaybook,
): string {
  if (!playbook) return "";
  return asString(playbook[field]);
}

function buildFallbackSignals(blocks: HrTalentMapSynthesisBlocksV2): TalentSignalV01[] {
  const out: TalentSignalV01[] = [];
  const seen = new Set<string>();

  for (const key of [
    "executive_summary",
    "work_formula",
    "talents",
    "work_environment",
    "risks",
    "management",
  ] as const) {
    const block = blocks[key];
    if (!block) continue;

    const text = blockText(block);
    if (text) {
      pushUniqueSignal(
        out,
        seen,
        makeSignal({
          key: `${key}-summary`,
          title:
            key === "executive_summary"
              ? "Общий профиль"
              : key === "work_formula"
                ? "Рабочий паттерн"
                : SYNTHESIS_SOURCE_LABEL[key] ?? key,
          kind:
            key === "risks"
              ? "risk"
              : key === "management"
                ? "management"
                : key === "work_environment"
                  ? "condition"
                  : "strength",
          summary: text,
          source_synthesis_keys: [key],
        }),
      );
    }

    for (const [idx, item] of normalizeItems(block.items).slice(0, 2).entries()) {
      pushUniqueSignal(
        out,
        seen,
        makeSignal({
          key: `${key}-item-${idx}`,
          title: itemTitle(item, "Рабочий паттерн"),
          kind:
            key === "risks"
              ? "risk"
              : key === "management"
                ? "management"
                : key === "work_environment"
                  ? "condition"
                  : "strength",
          summary: itemSummary(item),
          source_synthesis_keys: [key],
        }),
      );
    }
  }

  return out.slice(0, MAX_SIGNALS);
}

export function buildTalentSignalsV01(input: {
  synthesisBlocks?: HrTalentMapSynthesisBlocksV2 | null;
  productLayers?: unknown[];
  workspace?: unknown;
}): TalentSignalV01[] {
  const blocks = input.synthesisBlocks;
  if (!blocks) return [];

  const exec = blocks.executive_summary;
  const talents = blocks.talents;
  const workEnv = blocks.work_environment;
  const risks = blocks.risks;
  const management = blocks.management;
  const formula = blocks.work_formula;

  const out: TalentSignalV01[] = [];
  const seen = new Set<string>();

  const mainValue = asString(exec?.main_value);
  if (mainValue) {
    pushUniqueSignal(
      out,
      seen,
      makeSignal({
        key: "exec-main-value",
        title: "Главная ценность",
        kind: "strength",
        summary: mainValue,
        what_to_check: asString(exec?.how_to_check_first) || undefined,
        source_synthesis_keys: ["executive_summary"],
      }),
    );
  }

  const bestUse = asString(exec?.best_use);
  if (bestUse) {
    pushUniqueSignal(
      out,
      seen,
      makeSignal({
        key: "exec-best-use",
        title: "Где раскрывается",
        kind: "condition",
        summary: bestUse,
        source_synthesis_keys: ["executive_summary", "work_environment"],
      }),
    );
  }

  const formulaText = blockText(formula);
  if (formulaText && out.length < MAX_SIGNALS) {
    pushUniqueSignal(
      out,
      seen,
      makeSignal({
        key: "work-formula",
        title: "Рабочая формула",
        kind: "strength",
        summary: formulaText.replace(/<[^>]+>/g, ""),
        source_synthesis_keys: ["work_formula"],
      }),
    );
  }

  for (const [idx, item] of normalizeItems(talents?.items).slice(0, 2).entries()) {
    pushUniqueSignal(
      out,
      seen,
      makeSignal({
        key: `talent-${idx}`,
        title: itemTitle(item, "Сильная сторона"),
        kind: "strength",
        summary: itemSummary(item),
        source_synthesis_keys: ["talents"],
      }),
    );
  }

  const envItems = normalizeItems(workEnv?.items);
  const envItem = envItems[0];
  if (envItem) {
    pushUniqueSignal(
      out,
      seen,
      makeSignal({
        key: "work-env-condition",
        title: itemTitle(envItem, "Условие среды"),
        kind: "condition",
        summary: itemSummary(envItem),
        source_synthesis_keys: ["work_environment"],
      }),
    );
  }

  const overload = playbookField(management?.playbook, "overload_signals");
  if (!envItem && overload) {
    pushUniqueSignal(
      out,
      seen,
      makeSignal({
        key: "work-env-overload",
        title: "Условия среды",
        kind: "condition",
        summary: overload,
        source_synthesis_keys: ["work_environment", "management"],
      }),
    );
  }

  const riskItems = normalizeItems(risks?.items);
  const riskChecks = Array.isArray(risks?.checks) ? risks!.checks! : [];
  const mainRisk = asString(exec?.main_risk) || asString(riskItems[0]?.body);
  const riskTitle =
    asString(riskItems[0]?.title) !== "—" ? asString(riskItems[0]?.title) : "Зона риска";
  if (mainRisk) {
    const check =
      asString(riskChecks[0]?.interview_check) ||
      asString(riskChecks[0]?.test_task_check) ||
      asString(exec?.how_to_check_first);
    pushUniqueSignal(
      out,
      seen,
      makeSignal({
        key: "main-risk",
        title: riskTitle || "Зона риска",
        kind: "risk",
        summary: mainRisk,
        what_to_check: check || undefined,
        source_synthesis_keys: ["risks", "executive_summary"],
      }),
    );
  }

  const mgmtPlaybook = management?.playbook;
  const mgmtAdvice =
    playbookField(mgmtPlaybook, "how_to_set_tasks") ||
    playbookField(mgmtPlaybook, "how_to_give_feedback") ||
    asString(normalizeItems(management?.items)[0]?.body);
  if (mgmtAdvice) {
    pushUniqueSignal(
      out,
      seen,
      makeSignal({
        key: "management-advice",
        title: "Управленческий фокус",
        kind: "management",
        summary: mgmtAdvice,
        source_synthesis_keys: ["management"],
      }),
    );
  }

  const commItem = envItems.find((item) =>
    /коммун|объясн|диалог|обратн/i.test(`${item.title} ${item.body}`),
  );
  const teamItem = envItems.find((item) =>
    /команд|вклад|коллаб|синхрон/i.test(`${item.title} ${item.body}`),
  );
  const commTalent = normalizeItems(talents?.items).find((item) =>
    /коммун|объясн|структур/i.test(`${item.title} ${item.body}`),
  );

  if (commItem || commTalent) {
    const item = commItem ?? commTalent!;
    pushUniqueSignal(
      out,
      seen,
      makeSignal({
        key: "communication-signal",
        title: itemTitle(item, "Коммуникация"),
        kind: "communication",
        summary: itemSummary(item),
        source_synthesis_keys: commItem ? ["work_environment"] : ["talents"],
      }),
    );
  } else if (teamItem) {
    pushUniqueSignal(
      out,
      seen,
      makeSignal({
        key: "team-contribution",
        title: itemTitle(teamItem, "Командный вклад"),
        kind: "team_contribution",
        summary: itemSummary(teamItem),
        source_synthesis_keys: ["work_environment"],
      }),
    );
  }

  let signals = out.slice(0, MAX_SIGNALS);

  if (signals.length < MIN_SIGNALS) {
    const fallbacks = buildFallbackSignals(blocks).filter(
      (fb) => !signals.some((s) => s.key === fb.key),
    );
    signals = [...signals, ...fallbacks].slice(0, MAX_SIGNALS);
  }

  if (signals.length < MIN_SIGNALS && exec) {
    const oneSentence = asString(exec.one_sentence);
    if (oneSentence) {
      signals.push(
        makeSignal({
          key: "exec-one-sentence",
          title: "Краткий профиль",
          kind: "strength",
          summary: oneSentence,
          source_synthesis_keys: ["executive_summary"],
        }),
      );
    }
  }

  return signals.slice(0, MAX_SIGNALS);
}

export function buildDashboardStrengthsV01(input: {
  synthesisBlocks?: HrTalentMapSynthesisBlocksV2 | null;
}): DashboardPointV01[] {
  const blocks = input.synthesisBlocks;
  if (!blocks) return [];

  const out: DashboardPointV01[] = [];
  const seen = new Set<string>();

  const push = (text: string, detail?: string) => {
    const key = text.slice(0, 60);
    if (!text.trim() || seen.has(key)) return;
    seen.add(key);
    out.push({ key, text: truncate(text, 160), detail: detail ? truncate(detail, 120) : undefined });
  };

  const mainValue = asString(blocks.executive_summary?.main_value);
  if (mainValue) push(mainValue);

  for (const item of normalizeItems(blocks.talents?.items)) {
    const title = asString(item.title);
    const body = asString(item.body);
    if (title && title !== "—") push(title, body || undefined);
    else if (body) push(body);
    if (out.length >= 5) break;
  }

  const formulaText = blockText(blocks.work_formula)?.replace(/<[^>]+>/g, "");
  if (formulaText && out.length < 5) push(formulaText);

  for (const item of normalizeItems(blocks.work_formula?.items)) {
    push(itemTitle(item, "Паттерн"), itemSummary(item));
    if (out.length >= 5) break;
  }

  return out.slice(0, 5);
}

export function buildDashboardRisksV01(input: {
  synthesisBlocks?: HrTalentMapSynthesisBlocksV2 | null;
}): DashboardPointV01[] {
  const blocks = input.synthesisBlocks;
  if (!blocks) return [];

  const out: DashboardPointV01[] = [];
  const seen = new Set<string>();

  const push = (text: string, detail?: string) => {
    const key = text.slice(0, 60);
    if (!text.trim() || seen.has(key)) return;
    seen.add(key);
    out.push({ key, text: truncate(text, 160), detail: detail ? truncate(detail, 120) : undefined });
  };

  const mainRisk = asString(blocks.executive_summary?.main_risk);
  if (mainRisk) push(mainRisk);

  for (const item of normalizeItems(blocks.risks?.items)) {
    const title = asString(item.title);
    const body = asString(item.body);
    if (title && title !== "—") push(title, body || undefined);
    else if (body) push(body);
    if (out.length >= 5) break;
  }

  const checks = Array.isArray(blocks.risks?.checks) ? blocks.risks!.checks! : [];
  for (const check of checks) {
    const risk = asString(check.risk);
    const showUp = asString(check.how_it_may_show_up);
    if (risk) push(risk, showUp || undefined);
    if (out.length >= 5) break;
  }

  const overload = playbookField(blocks.management?.playbook, "overload_signals");
  if (overload && out.length < 5) push(`Перегруз: ${overload}`);

  for (const item of normalizeItems(blocks.work_environment?.items)) {
    if (/перегруз|хаос|давлен|конфликт|риск|сбивает|перегруж/i.test(`${item.title} ${item.body}`)) {
      push(itemTitle(item, "Условие риска"), itemSummary(item));
    }
    if (out.length >= 5) break;
  }

  return out.slice(0, 5);
}

export function buildDashboardConclusionV01(input: {
  synthesisBlocks?: HrTalentMapSynthesisBlocksV2 | null;
}): DashboardConclusionV01 {
  const blocks = input.synthesisBlocks;
  const exec = blocks?.executive_summary;
  const mgmt = blocks?.management;

  const who =
    asString(exec?.one_sentence) ||
    blockText(exec) ||
    asString(exec?.main_value);

  const where = asString(exec?.best_use);
  const check = asString(exec?.how_to_check_first);
  const interact =
    playbookField(mgmt?.playbook, "how_to_give_feedback") ||
    playbookField(mgmt?.playbook, "how_to_set_tasks") ||
    asString(normalizeItems(mgmt?.items)[0]?.body);

  return {
    who_at_work: who || undefined,
    where_shines: where || undefined,
    what_to_check_first: check || undefined,
    how_to_interact: interact || undefined,
  };
}

export function buildDashboardDetailSectionsV01(input: {
  synthesisBlocks?: HrTalentMapSynthesisBlocksV2 | null;
}): DashboardDetailSectionV01[] {
  const blocks = input.synthesisBlocks;
  if (!blocks) return [];

  const sections: Array<{
    key: DashboardDetailSectionKeyV01;
    title: string;
    block?: HrTalentMapSynthesisBlockV2;
  }> = [
    { key: "work_formula", title: "Рабочая формула", block: blocks.work_formula },
    { key: "talents", title: "Таланты", block: blocks.talents },
    { key: "work_environment", title: "Рабочая среда", block: blocks.work_environment },
    { key: "risks", title: "Риски", block: blocks.risks },
    { key: "management", title: "Управление", block: blocks.management },
  ];

  return sections
    .map(({ key, title, block }) => {
      if (!block) return null;
      const content = blockText(block)?.replace(/<[^>]+>/g, "") ?? "";
      const items = normalizeItems(block.items);
      const hasContent =
        content ||
        items.length > 0 ||
        block.playbook ||
        (Array.isArray(block.checks) && block.checks.length > 0);
      if (!hasContent) return null;
      const section: DashboardDetailSectionV01 = {
        key,
        title,
        content,
        items,
      };
      if (block.playbook) section.playbook = block.playbook;
      if (Array.isArray(block.checks) && block.checks.length > 0) {
        section.checks = block.checks;
      }
      return section;
    })
    .filter((s): s is DashboardDetailSectionV01 => s != null);
}

export function formatSignalSourceHint(signal: TalentSignalV01): string | undefined {
  if (!signal.source_synthesis_keys?.length) return undefined;
  return sourceHint(signal.source_synthesis_keys);
}
