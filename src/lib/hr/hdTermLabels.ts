/**
 * HD term labels: Russian display for Pro, HR replacements for Base.
 * Raw source_values keep canonical API English values.
 */

import type { CareerReadingLayerKeyV1 } from "./careerReadingLayersV1";

/** Canonical API / chart value → Russian label for Pro display. */
export const HD_TERM_RU_LABELS: Record<string, string> = {
  Projector: "Проектор",
  Generator: "Генератор",
  "Manifesting Generator": "Манифестирующий Генератор",
  Manifestor: "Манифестор",
  Reflector: "Рефлектор",

  "Wait for the Invitation": "ждать приглашения",
  "Wait for Invitation": "ждать приглашения",
  "Wait to Respond": "ждать отклика",
  "To Inform": "информировать перед действием",
  Inform: "информировать перед действием",

  Splenic: "селезёночный",
  Sacral: "сакральный",
  Emotional: "эмоциональный",
  Ego: "эго-манифестируемый",
  "Ego Manifested": "эго-манифестируемый",
  Self: "самоопределяемый",
  "Self-Projected": "само-проецируемый",
  Lunar: "лунный",
  Mental: "ментальный",
  Environmental: "окружения",

  Success: "успех",
  Bitterness: "горечь",
  Satisfaction: "удовлетворение",
  Frustration: "фрустрация",
  Peace: "покой",
  Anger: "злость",
  Surprise: "удивление",
  Disappointment: "разочарование",

  Personality: "Личность",
  Design: "Дизайн",
  Sun: "Солнце",
  Earth: "Земля",
  Moon: "Луна",
  Mercury: "Меркурий",
  Venus: "Венера",
  Mars: "Марс",
  Jupiter: "Юпитер",
  Saturn: "Сатурн",
  Uranus: "Уран",
  Neptune: "Нептун",
  Pluto: "Плутон",
  northNode: "Северный узел",
  southNode: "Южный узел",
  NorthNode: "Северный узел",
  SouthNode: "Южный узел",

  Head: "Голова",
  Ajna: "Аджна",
  Throat: "Горло",
  G: "G-центр",
  Heart: "Сердечный/Эго-центр",
  "Solar Plexus": "Солнечное сплетение",
  Spleen: "Селезёнка",
  Root: "Корень",

  // Russian HD spellings that may leak into Base
  Проектор: "Проектор",
  Генератор: "Генератор",
  Манифестор: "Манифестор",
  Рефлектор: "Рефлектор",
};

/** English/Russian HD tokens → plain HR wording for Base (longer keys first at runtime). */
export const HD_TERM_BASE_REPLACEMENTS: Record<string, string> = {
  "Human Design": "модель рабочего поведения",
  "Дизайн Человека": "модель рабочего поведения",
  "Manifesting Generator": "формат устойчивой рабочей энергии с быстрым включением",
  "Манифестирующий Генератор": "формат устойчивой рабочей энергии с быстрым включением",
  "Wait for the Invitation": "явный запрос на вклад",
  "Wait for Invitation": "явный запрос на вклад",
  "Wait to Respond": "включение через отклик на запрос",
  "To Inform": "информирование перед действием",
  "Solar Plexus": "зона эмоциональной вовлечённости",
  "Солнечное сплетение": "зона эмоциональной вовлечённости",
  "Self-Projected": "внутренний ориентир на смысл и направление",
  Personality: "осознаваемая рабочая тема",
  Личность: "осознаваемая рабочая тема",
  Design: "фоновый рабочий паттерн",
  Дизайн: "фоновый рабочий паттерн",
  Projector: "экспертный формат работы",
  Проектор: "экспертный формат работы",
  Generator: "формат устойчивой рабочей энергии",
  Генератор: "формат устойчивой рабочей энергии",
  Manifestor: "формат инициативного включения",
  Манифестор: "формат инициативного включения",
  Reflector: "формат работы через внешнюю среду",
  Рефлектор: "формат работы через внешнюю среду",
  Strategy: "способ входа в задачу",
  strategy: "способ входа в задачу",
  стратегия: "способ входа в задачу",
  стратегии: "способ входа в задачу",
  Authority: "способ проверки решения",
  authority: "способ проверки решения",
  авторитет: "способ проверки решения",
  Profile: "рабочий почерк",
  profile: "рабочий почерк",
  профиль: "рабочий почерк",
  Channel: "связка талантов",
  channel: "связка талантов",
  канал: "связка талантов",
  каналы: "связки талантов",
  Gate: "рабочая тема",
  gate: "рабочая тема",
  ворота: "рабочая тема",
  Center: "рабочая зона",
  center: "рабочая зона",
  центр: "рабочая зона",
  центры: "рабочие зоны",
  Splenic: "быстрое внутреннее распознавание риска и корректности момента",
  Sacral: "устойчивая рабочая энергия",
  Сакрал: "устойчивая рабочая энергия",
  Emotional: "эмоциональная проверка решений во времени",
  Ajna: "зона обработки идей",
  Аджна: "зона обработки идей",
  Throat: "зона выражения и коммуникации",
  Горло: "зона выражения и коммуникации",
  Root: "зона давления и темпа",
  Корень: "зона давления и темпа",
  Spleen: "зона быстрого распознавания",
  Селезёнка: "зона быстрого распознавания",
  Head: "зона вдохновения и давления мыслей",
  Голова: "зона вдохновения и давления мыслей",
  Ego: "зона воли и обещаний",
  Эго: "зона воли и обещаний",
  Sun: "главная тема",
  Солнце: "главная тема",
  Earth: "заземляющая тема",
  Земля: "заземляющая тема",
  bodygraph: "карта",
  бодиграф: "карта",
};

const BASE_REPLACEMENT_ENTRIES = Object.entries(HD_TERM_BASE_REPLACEMENTS).sort(
  (a, b) => b[0].length - a[0].length,
);

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function lookupRuLabel(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (HD_TERM_RU_LABELS[trimmed]) return HD_TERM_RU_LABELS[trimmed];

  const lower = trimmed.toLowerCase();
  for (const [key, label] of Object.entries(HD_TERM_RU_LABELS)) {
    if (key.toLowerCase() === lower) return label;
  }
  return null;
}

/** Russian HD label for Pro (types, strategy, centers, planets, etc.). */
export function translateHdTermForPro(value: unknown): string {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) return "";
  return lookupRuLabel(text) ?? text;
}

/** Replace HD terms with HR wording for Base fields. */
export function replaceHdTermForBase(text: string): string {
  if (!text.trim()) return text;

  let result = text;
  for (const [term, replacement] of BASE_REPLACEMENT_ENTRIES) {
    const pattern = new RegExp(escapeRegExp(term), "giu");
    result = result.replace(pattern, replacement);
  }
  return result.replace(/\s{2,}/g, " ").trim();
}

export function formatCenterListForPro(centers: string[]): string {
  return centers.map((c) => translateHdTermForPro(c)).join(", ");
}

export function formatActivationForPro(
  side: "personality" | "design",
  planet: "sun" | "earth",
  activation: string,
): string {
  const value = activation.trim();
  if (!value) return "";
  const sideRu = side === "personality" ? "Личности" : "Дизайна";
  const planetRu = planet === "sun" ? "Солнце" : "Земля";
  return `${planetRu} ${sideRu} ${value}`;
}

export function formatChannelProLabel(fact: {
  channel_key: string;
  classical_name?: string;
  gates: [string, string];
  centers: [string, string];
}): { source_label: string; value_summary: string } {
  const name = fact.classical_name ? ` — ${fact.classical_name}` : "";
  return {
    source_label: `Канал ${fact.channel_key}${name}`,
    value_summary: `Ворота ${fact.gates[0]}–${fact.gates[1]}, центры ${translateHdTermForPro(fact.centers[0])} — ${translateHdTermForPro(fact.centers[1])}`,
  };
}

const WEAK_CONNECTION_LOGIC =
  /^(?:основано\s+на|based\s+on|source\s+fields|layer_input|данные\s+слоя)/iu;

export function isWeakProConnectionLogic(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return true;
  if (trimmed.length < 80) return true;
  return WEAK_CONNECTION_LOGIC.test(trimmed);
}

function chartValue(input: Record<string, unknown>, key: string): string {
  const value = input[key];
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function activationFromInput(
  input: Record<string, unknown>,
  side: "personality" | "design",
  planet: string,
): string {
  const activations = input.activations;
  if (activations && typeof activations === "object" && !Array.isArray(activations)) {
    const sideMap = (activations as Record<string, unknown>)[side];
    if (sideMap && typeof sideMap === "object" && !Array.isArray(sideMap)) {
      const v = (sideMap as Record<string, unknown>)[planet];
      if (typeof v === "string" && v.trim()) return v.trim();
    }
  }
  if (side === "personality" && planet === "sun") return chartValue(input, "personality_sun");
  if (side === "design" && planet === "sun") return chartValue(input, "design_sun");
  return "";
}

/** Expert HD connection_logic in Russian (deterministic fallback). */
export function buildDeterministicProConnectionLogic(
  layerKey: CareerReadingLayerKeyV1,
  layerInput: unknown,
): string {
  const input =
    layerInput != null && typeof layerInput === "object" && !Array.isArray(layerInput)
      ? (layerInput as Record<string, unknown>)
      : {};

  switch (layerKey) {
    case "work_mode_and_decisions": {
      const type = translateHdTermForPro(chartValue(input, "type"));
      const strategy = translateHdTermForPro(chartValue(input, "strategy"));
      const authority = translateHdTermForPro(chartValue(input, "authority"));
      if (!type || !strategy || !authority) return "";
      return `В классической логике Дизайна Человека здесь соединяются тип ${type}, стратегия ${strategy} и ${authority} авторитет. ${type === "Проектор" ? "Проекторская механика показывает, что человек раскрывается не через постоянную производственную нагрузку, а через точечное признание его взгляда и приглашение в подходящую задачу." : "Эта комбинация задаёт базовый способ включения в работу и фильтр решений."} Стратегия «${strategy}» уточняет корректный вход: важно, чтобы было понятно, зачем человека зовут и какую роль он занимает. ${authority.charAt(0).toUpperCase() + authority.slice(1)} авторитет добавляет способ проверки шага: решение считается корректным, когда совпадает с внутренним телесно-интуитивным «да/нет», даже если рациональное объяснение формулируется позже.`;
    }
    case "profile_work_style": {
      const profile = chartValue(input, "profile");
      const definition = chartValue(input, "definition");
      const pSun = activationFromInput(input, "personality", "sun");
      const dSun = activationFromInput(input, "design", "sun");
      if (!profile) return "";
      const parts = [
        `Профиль ${profile} в классической логике Дизайна Человека описывает устойчивый рабочий почерк: как человек осваивает роль, выстраивает доверие и входит в задачу.`,
      ];
      if (definition) parts.push(`Определение (${definition}) показывает, какая часть внутренней логики остаётся стабильной под нагрузкой.`);
      if (pSun) parts.push(`${formatActivationForPro("personality", "sun", pSun)} задаёт осознаваемую рабочую тему.`);
      if (dSun) parts.push(`${formatActivationForPro("design", "sun", dSun)} показывает фоновый паттерн, который коллеги часто замечают раньше.`);
      return parts.join(" ");
    }
    case "conscious_work_theme": {
      const pSun = activationFromInput(input, "personality", "sun");
      const pEarth = activationFromInput(input, "personality", "earth");
      if (!pSun) return "";
      return `Сознательная рабочая тема в Дизайне Человека строится вокруг ${formatActivationForPro("personality", "sun", pSun)}${pEarth ? ` и ${formatActivationForPro("personality", "earth", pEarth)}` : ""}. Это осознаваемая линия силы: человек яснее видит, где его вклад осмыслен, и что даёт заземление в задаче. В Pro-логике важно отделить осознаваемую тему от фонового паттерна Дизайна.`;
    }
    case "background_work_pattern": {
      const dSun = activationFromInput(input, "design", "sun");
      const dEarth = activationFromInput(input, "design", "earth");
      if (!dSun) return "";
      return `Фоновый рабочий паттерн в Дизайне Человека читается через ${formatActivationForPro("design", "sun", dSun)}${dEarth ? ` и ${formatActivationForPro("design", "earth", dEarth)}` : ""}. Это менее осознаваемая, но устойчивая линия проявления: как человек действует, когда не объясняет себе поведение словами. Коллеги часто считывают этот паттерн раньше, чем сам человек формулирует его как «рабочий стиль».`;
    }
    case "talent_channels": {
      const count = typeof input.channels_count === "number" ? input.channels_count : 0;
      if (count <= 0) {
        return "В карте не выделены устойчивые каналы как отдельные связки талантов; интерпретация опирается на активации, центры и повторяющиеся темы.";
      }
      return `Устойчивые каналы в Дизайне Человека — это постоянные связки между двумя центрами через пару ворот. Каждый канал задаёт отдельную связку талантов: какая энергия стабильно доступна, между какими рабочими зонами она передаётся и где эта связка особенно полезна. В HR-слое важно читать каждый канал отдельно, не смешивая центры разных каналов и не подменяя их общим списком центров карты.`;
    }
    case "repeated_themes":
      return "Повторяющиеся ворота и источники активаций показывают усиленные рабочие мотивы: темы, которые возвращаются в разных контекстах задачи. В классической логике это не «случайные интересы», а устойчивые акценты, которые усиливаются при совпадении нескольких источников.";
    case "centers_stability_and_sensitivity": {
      const defined = Array.isArray(input.definedCenters ?? input.defined_centers)
        ? (input.definedCenters ?? input.defined_centers) as unknown[]
        : [];
      const open = Array.isArray(input.openCenters ?? input.open_centers)
        ? (input.openCenters ?? input.open_centers) as unknown[]
        : [];
      const definedRu = defined
        .map((c) => (typeof c === "string" ? translateHdTermForPro(c) : ""))
        .filter(Boolean);
      const openRu = open
        .map((c) => (typeof c === "string" ? translateHdTermForPro(c) : ""))
        .filter(Boolean);
      return `Центры в Дизайне Человека показывают, какие рабочие зоны у человека определены постоянно${definedRu.length ? ` (${definedRu.join(", ")})` : ""}, а какие остаются открытыми и чувствительными к среде${openRu.length ? ` (${openRu.join(", ")})` : ""}. Определённые зоны дают устойчивую опору; открытые — точки, где важны условия, нагрузка и чужое влияние.`;
    }
    case "environment_focus_and_motivation": {
      const env = translateHdTermForPro(chartValue(input, "environment"));
      const mot = translateHdTermForPro(chartValue(input, "motivation"));
      if (!env && !mot) return "";
      return `Среда и мотивация в Дизайне Человека — уточняющий слой: они не заменяют тип, стратегию и авторитет, но показывают, в каких условиях человеку проще раскрываться${env ? ` (среда: ${env})` : ""}${mot ? ` (мотивация: ${mot})` : ""}. Это помогает HR понять контекст, а не делать из него главный вердикт о кандидате.`;
    }
    default:
      return "";
  }
}
