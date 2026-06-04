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
- пиши простым HR-языком про работу, найм и управление;
- Base = plain HR/work/hiring language only;
- не используй HD-термины в Base даже по-русски (Проектор, стратегия, авторитет, ворота, канал, центр, профиль, Human Design и т.д.);
- не пиши полу-технические гибриды и странные смешанные формулировки;
- не используй канцелярит и шаблоны: «форм-фактор», «соблюдение формального процесса вовлечения», «кандидат демонстрирует», «данный слой», «источники мотивации активируют»;
- не используй английские слова вроде roles, progress, Signal в Base/summary/matching;
- пиши про: как человек входит в задачу, где полезен, как проверять, как работать руководителю, где риск;
- не принимай решение о найме;
- не используй проценты соответствия, fit_score, «подходит на N%», «брать/не брать»;
- каждый риск связывай с проверкой (what_to_check);
- не придумывай биографию или опыт кандидата;
- если данных не хватает, снижай confidence в pro/evidence.

Примеры Base (плохо → хорошо):
- Плохо: «Проектор со стратегией ожидания приглашения...»
  Хорошо: «Кандидат лучше включается, когда его вклад явно запрошен, роль понятна и есть согласованные ожидания по результату.»
- Плохо: «канал 18-58 показывает...»
  Хорошо: «У кандидата есть устойчивая связка таланта: замечать слабые места, улучшать качество решения и формулировать корректировку.»
- Плохо: «ворота 54 активируют мотивацию...»
  Хорошо: «Одна из повторяющихся рабочих тем связана с ростом, амбицией и желанием двигаться к более значимому результату.»

Pro:
- не придумывай названия книг, авторов, внешних источников, raw_path и фиктивные classical_sources;
- classical_sources должны ссылаться только на элементы карты из layer_input (Type, Strategy, Authority, Profile, Channel, Gate, Center, Personality/Design Sun/Earth и т.д.);
- в Pro используй русские HD-названия в source_label (Тип: Проектор, Стратегия: ждать приглашения, Канал 11-56 — Curiosity, Солнце Личности 18.1);
- value_summary может содержать canonical API values; source_label и connection_logic — на русском;
- connection_logic — экспертное HD-объяснение на русском (классическая механика Дизайна Человека), не шаблон «основано на source fields»;
- technical_title и human_check — по делу, без заглушек.

Summary:
- summary_for_synthesis: короткий, пригодный для следующего API-запроса (синтез блоков);
- matching_summary: короткий, пригодный для будущего role-fit (без вердикта о найме).

Компактность (strict JSON — лимиты по полям, не общий объём):
- пиши компактно и по делу;
- не заполняй поля ради объёма;
- сначала точность, потом стиль;
- JSON должен быть полным и валидным; не раздувай поля так, чтобы ответ не поместился в лимит токенов;
- пиши содержательно, но компактно;
- не растягивай поля ради объёма;
- не повторяй одну мысль в разных полях;
- headline = короткий точный заголовок;
- short_summary = быстрая HR-выжимка;
- detailed_explanation = основной смысл слоя;
- how_it_appears_at_work = наблюдаемое рабочее поведение;
- where_useful = где применять;
- strengths / risks / management_tips / what_to_check — каждое поле со своей функцией;
- Pro = экспертная HD-логика на русском, без длинной лекции.

Не копируй headline в short_summary.
Не копируй short_summary в detailed_explanation.
Не повторяй одинаковый пункт в strengths, where_useful и management_tips.
Если мысль уже в Base, в summary_for_synthesis дай короткую выжимку, а не повтор.

Field length budget:
- base.headline: до 90 символов.
- base.short_summary: 250–450 символов, 2–3 предложения.
- base.detailed_explanation: 600–900 символов, 4–6 предложений, без повтора short_summary.
- base.how_it_appears_at_work: 300–500 символов, только наблюдаемое поведение.
- base.where_useful: 3–5 пунктов, каждый до 90 символов.
- base.strengths: 2–4 пункта; title до 70; description до 180.
- base.risks: 1–3 пункта; title до 70; description до 220; how_it_may_show_up до 180; mitigation до 220.
- base.management_tips: 2–4 пункта, каждый до 140 символов.
- base.what_to_check: 1–3 проверки; hypothesis/check_method до 180; good_signal/warning_signal до 140.
- base.sections: 0–3 секции; title до 70; body до 260; items 2–4 пункта.
- pro.connection_logic: 700–1200 символов, связь элементов карты с HR-выводом, не лекция.
- pro.limitations: 0–3 пункта.
- summary_for_synthesis.one_sentence: до 220 символов.
- summary_for_synthesis arrays: 2–4 пункта, каждый до 140 символов.
- matching_summary arrays: 2–4 пункта, каждый до 140 символов.
- special_payload.channel_talents: summary до 220; how_it_appears_at_work до 260; risk/management_tip до 180; where_useful 2–4 пункта.
- special_payload.center_zones: work_meaning до 220; potential_strength/risk_under_pressure/management_tip до 180.
- special_payload.repeated_gate_themes: summary до 220; talent_potential/risk_pattern до 180.

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
1. layer_input.channel_facts — source of truth для channel_key, gates, centers, classical_name, circuit.
2. Не меняй channel_key, gates, centers, classical_name, circuit из channel_facts.
3. Не добавляй в channel_talents[].centers центры, которых нет в channel_facts для этого канала.
4. centers в channel_talents = только два центра, которые соединяет ЭТОТ канал (из channel_facts), а не все definedCenters/openCenters кандидата.
5. Сначала определи количество каналов из channel_facts (или channelsShort/channelsLong).
6. Для каждого канала — отдельная карточка в special_payload.channel_talents.
7. Если channel_facts пуст — не выдумывай каналы; status not_applicable или честный empty-state в base.
8. Base не пишет «канал 11-56»; интерпретация (title, summary, risk, tips, what_to_check) — твоя HR-часть.

Для каждого канала заполни интерпретацию: title, summary, where_useful, how_it_appears_at_work, risk, management_tip, what_to_check, evidence.
Технические поля канала копируй из channel_facts.`,
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
