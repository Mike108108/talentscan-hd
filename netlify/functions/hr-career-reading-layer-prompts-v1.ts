/**
 * HD Career Reading Layer prompt skeletons v1 (Stage 4.10-A).
 *
 * Not connected to production generation. Defines system/user prompts and JSON schema names
 * for future per-layer OpenAI calls.
 */

import {
  CAREER_READING_LAYER_CATALOG_V1,
  type CareerReadingLayerKeyV1,
} from "../../src/lib/hr/careerReadingLayersV1";

export const CAREER_READING_LAYER_PROMPTS_VERSION_V1 = "career_reading_layer_prompts_v1" as const;

const JSON_SCHEMA_BY_LAYER: Record<CareerReadingLayerKeyV1, string> = {
  work_mode_and_decisions: "career_reading_layer_work_mode_and_decisions_v1",
  profile_work_style: "career_reading_layer_profile_work_style_v1",
  conscious_work_theme: "career_reading_layer_conscious_work_theme_v1",
  background_work_pattern: "career_reading_layer_background_work_pattern_v1",
  talent_channels: "career_reading_layer_talent_channels_v1",
  repeated_themes: "career_reading_layer_repeated_themes_v1",
  centers_stability_and_sensitivity: "career_reading_layer_centers_stability_and_sensitivity_v1",
  environment_focus_and_motivation: "career_reading_layer_environment_focus_and_motivation_v1",
};

const COMMON_SYSTEM_RULES = `Ты генерируешь один HD Career Reading Layer для HR-карты кандидата.

Base:
- пиши простым HR-языком;
- не используй технический HD-язык (Human Design, ворота, каналы, центры, Type, Strategy, Authority, Profile, Generator, Projector и т.д.);
- не принимай решение о найме;
- не используй проценты соответствия, fit_score, «подходит на N%», «брать/не брать»;
- каждый риск связывай с проверкой (what_to_check);
- не придумывай биографию или опыт кандидата;
- если данных не хватает, снижай confidence в pro/evidence.

Pro:
- обязательно укажи classical_sources с классическими HD-названиями;
- сохрани названия планет, активаций, каналов, ворот, центров;
- объясни connection_logic: как технические данные карты связаны с HR-выводом.

Summary:
- summary_for_synthesis: короткий, пригодный для следующего API-запроса (синтез блоков);
- matching_summary: короткий, пригодный для будущего role-fit (без вердикта о найме).

Верни один JSON-объект CareerReadingLayerReportV1 без markdown.`;

const LAYER_SPECIFIC_RULES: Record<CareerReadingLayerKeyV1, string> = {
  work_mode_and_decisions: `Слой: рабочий формат, вход в задачи, принятие решений, корректное включение в работу, риски некорректного входа.
Pro: Type, Strategy, Authority, Signature, Not-Self Theme.`,
  profile_work_style: `Слой: рабочий почерк — стиль проявления, обучение, доверие, вход в роль, адаптация, первые задачи.
Pro: Profile, Personality Sun line, Design Sun line, Definition (как supporting context).`,
  conscious_work_theme: `Слой: сознательная рабочая тема — осознаваемая сила, польза, заземляющая задача, талант/риск/напряжение.
Pro: Personality Sun, Personality Earth, gate.line, planet name, activation side = Personality.`,
  background_work_pattern: `Слой: фоновый рабочий паттерн — естественное проявление, что видят другие раньше, телесный/бессознательный стиль, автоматические риски.
Pro: Design Sun, Design Earth, gate.line, planet name, activation side = Design.`,
  talent_channels: `Слой: устойчивые связки талантов по каналам.

ОБЯЗАТЕЛЬНО:
1. Сначала определи количество каналов из layer_input.channelsShort / channelsLong.
2. Для каждого найденного канала создай отдельный CareerReadingChannelTalentV1 в special_payload.channel_talents.
3. Не ограничивайся общим выводом по всем каналам.
4. Если каналов 0 — status not_applicable или ready с честным empty-state в base (без выдуманных каналов):
   «Устойчивые связки талантов по каналам не выделены. Тогда рабочие способности читаются через главные активации, центры и повторяющиеся темы.»
5. Base не пишет «канал 11-56»; Pro хранит Channel, Channel key, Channel name, Gates in channel, Centers, Circuit.

Для каждого канала: channel_key, classical_name, gates, centers, circuit, title, summary, where_useful, how_it_appears_at_work, risk, management_tip, what_to_check, evidence.`,
  repeated_themes: `Слой: усиленные рабочие мотивы.

ОБЯЗАТЕЛЬНО:
- Не разбирай все gatesAll.
- Используй только gatesBoth, gateSources и repeated_gate_candidates из layer_input.
- Каждую значимую усиленную тему опиши отдельно в special_payload.repeated_gate_themes.
Pro: Gate, Line if available, Sources (personality.mercury, design.neptune, …), Activation side, Planet.`,
  centers_stability_and_sensitivity: `Слой: устойчивые и чувствительные зоны.

ОБЯЗАТЕЛЬНО:
- Раздели defined_zones (definedCenters) и open_sensitive_zones (openCenters).
- Каждую зону опиши отдельно в special_payload.center_zones (defined: true/false).
- Для каждой зоны: title (HR-язык), work_meaning, potential_strength, risk_under_pressure, management_tip, what_to_check.
- Base — HR-язык без «открытый Эго-центр»; Pro — классические названия центров (Defined Centers, Open Centers).`,
  environment_focus_and_motivation: `Слой: среда, фокус и условия раскрытия — УТОЧНЯЮЩИЙ, не главный вывод карты.

ОБЯЗАТЕЛЬНО:
- Не давай медицинских, диетологических или категоричных советов.
- Не делай environment/motivation/variables главным вердиктом о кандидате.
Pro: Environment, Motivation, Transference, Perspective, Distraction, Cognition, Determination, Variables, Nodes if used.`,
};

function buildLayerUserPrompt(args: {
  layer_key: CareerReadingLayerKeyV1;
  candidate_snapshot: unknown;
  normalized_chart_data: unknown;
  layer_input: unknown;
  language: string;
}): string {
  const catalog = CAREER_READING_LAYER_CATALOG_V1[args.layer_key];
  return `Сгенерируй career_reading_layer_report для слоя «${catalog.title}» (layer_key: ${args.layer_key}).
Язык Base и summary: ${args.language}.

${LAYER_SPECIFIC_RULES[args.layer_key]}

candidate_snapshot:
${JSON.stringify(args.candidate_snapshot ?? null)}

layer_input (только релевантные поля normalized_chart_data для этого слоя):
${JSON.stringify(args.layer_input ?? null)}

normalized_chart_data (справочно, не выходи за рамки layer_input для выводов):
${JSON.stringify(args.normalized_chart_data ?? null)}`;
}

/**
 * Builds system/user prompts and JSON schema name for one career reading layer.
 * Not wired to production — skeleton for Stage 4.10-B+.
 */
export function buildCareerReadingLayerPromptV1(args: {
  layer_key: CareerReadingLayerKeyV1;
  candidate_snapshot: unknown;
  normalized_chart_data: unknown;
  layer_input: unknown;
  language?: "ru";
}): {
  system: string;
  user: string;
  json_schema_name: string;
} {
  const language = args.language ?? "ru";
  const catalog = CAREER_READING_LAYER_CATALOG_V1[args.layer_key];

  const system = `${COMMON_SYSTEM_RULES}

Текущий слой: ${args.layer_key}
HR title: ${catalog.title}
ui_priority: ${catalog.ui_priority}
Ожидаемые source_fields: ${catalog.source_fields.join(", ")}

${LAYER_SPECIFIC_RULES[args.layer_key]}`;

  const user = buildLayerUserPrompt({
    layer_key: args.layer_key,
    candidate_snapshot: args.candidate_snapshot,
    normalized_chart_data: args.normalized_chart_data,
    layer_input: args.layer_input,
    language,
  });

  return {
    system,
    user,
    json_schema_name: JSON_SCHEMA_BY_LAYER[args.layer_key],
  };
}
