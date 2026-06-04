export const HD_METHODOLOGY_BLUEPRINT_VERSION_V1 = "hd_methodology_blueprint_v1" as const;

export const HD_METHODOLOGY_BLUEPRINT_V1 = {
  version: HD_METHODOLOGY_BLUEPRINT_VERSION_V1,
  reading_hierarchy: [
    "Type / Тип",
    "Strategy / Стратегия",
    "Authority / Авторитет",
    "Definition / Определение",
    "Centers / Центры",
    "Channels / Каналы",
    "Gates + Lines / Ворота и линии",
    "Planets / Планеты",
    "Profile / Профиль",
    "Variables / PHS / Motivation / Perspective",
  ],
  inference_bridge: [
    "HD-факт",
    "классическая механика",
    "рабочее проявление",
    "ограничение вывода",
  ],
  dangerous_distortions: [
    "Проектор = пассивный сотрудник, который ждёт приглашения на каждую мелкую задачу.",
    "Открытый центр = слабость.",
    "Определённый центр = автоматический талант.",
    "Ворота = профессия.",
    "Канал = любая красивая фантазия модели.",
    "Личность и Дизайн = одно и то же.",
    "Variables / PHS = грубые карьерные выводы.",
  ],
  hr_translation_rules: [
    "рабочий формат",
    "вход в задачи",
    "вклад",
    "роль",
    "условия раскрытия",
    "сильные стороны",
    "риски",
    "проверка гипотезы",
    "управление",
  ],
} as const;

export function buildHdMethodologyBlueprintPromptBlockV1(): string {
  const b = HD_METHODOLOGY_BLUEPRINT_V1;
  return `HD Methodology Blueprint v1 (${b.version})

Иерархия чтения карты (от опорных к уточняющим):
${b.reading_hierarchy.map((item, i) => `${i + 1}. ${item}`).join("\n")}

Мост вывода (каждый вывод проходит цепочку):
${b.inference_bridge.map((step, i) => `${i + 1}. ${step}`).join(" → ")}

Методологически опасные искажения (запрещено подменять механику карты):
${b.dangerous_distortions.map((d) => `- ${d}`).join("\n")}

Правила перевода в HR-язык (Base для клиента):
- внутренний слой может опираться на HD, но Base говорит про: ${b.hr_translation_rules.join(", ")};
- не делать из открытого центра «слабость», из определённого — «автоматический талант»;
- не смешивать Personality и Design в один вывод без явного разделения;
- Variables/PHS — только уточняющий контекст, не главный карьерный вердикт.`;
}
