export const CAREER_READING_WRITING_STANDARD_VERSION_V1 =
  "career_reading_writing_standard_v1" as const;

export const CAREER_READING_WRITING_STANDARD_V1 = {
  version: CAREER_READING_WRITING_STANDARD_VERSION_V1,
  intent:
    "Не копировать карту Дарьи один в один. Не переносить проценты, профориентационные вердикты и «подходит / не подходит».",
  quality_targets: [
    "образ человека",
    "главная формула",
    "талант в переводе на задачи",
    "риск живым языком",
    "среда",
    "управленческие рекомендации",
    "практическая проверка гипотез",
  ],
  base_format: [
    "суть",
    "как проявляется",
    "где полезно",
    "риск",
    "что делать",
    "как проверить",
  ],
  pro_format: [
    "технический факт",
    "классическая механика HD",
    "рабочий перевод",
    "ограничение вывода",
    "проверка в реальности",
  ],
  forbidden_in_card: [
    "проценты соответствия вакансии",
    "fit_score",
    "подходит на N%",
    "брать / не брать",
    "нанять / не нанимать",
    "финальное решение о найме",
  ],
} as const;

export function buildCareerReadingWritingStandardPromptBlockV1(): string {
  const s = CAREER_READING_WRITING_STANDARD_V1;
  return `Darya-like HR Card Writing Standard v1 (${s.version})

Смысл: ${s.intent}

Качество подачи (ориентиры, не шаблон копирования):
${s.quality_targets.map((t) => `- ${t}`).join("\n")}

Base-формат (HR/work language):
${s.base_format.map((f, i) => `${i + 1}. ${f}`).join("\n")}

Pro-формат (русское экспертное HD-основание):
${s.pro_format.map((f, i) => `${i + 1}. ${f}`).join("\n")}

Pro не должен быть сухим «source_values + connection_logic» — объясни:
- на каких данных карты построен HR-вывод;
- классическую HD-механику;
- рабочее проявление и ограничение вывода;
- что проверить в реальности.

Запрещено в общей карте кандидата: ${s.forbidden_in_card.join("; ")}.`;
}
