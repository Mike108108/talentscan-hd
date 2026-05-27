/**
 * Deterministic HR talent map builder from normalized HD chart.
 * Raw HD data stays in hr_candidate_charts; employer-facing copy uses HR language.
 */

import type { NormalizedChart } from "./hd-normalize";

export type TalentMapPayload = {
  summary: string;
  best_work_format: string;
  key_talent: string;
  main_risk: string;
  formula: string;
  metrics: Array<{ label: string; value: string; hint?: string }>;
  talents: Array<{ title: string; body: string }>;
  strengths: Array<{ title: string; body: string }>;
  risks: Array<{ title: string; body: string }>;
  directions: Array<{ title: string; body: string; fit?: string }>;
  not_fit_directions: Array<{ title: string; body: string }>;
  roles: Array<{ role: string; fit: string; note: string }>;
  conditions: Array<{ title: string; body: string }>;
  tests: Array<{ title: string; body: string }>;
  final_recommendation: string;
};

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function pickWorkFormat(chart: NormalizedChart): string {
  const type = (chart.type ?? "").toLowerCase();
  if (type.includes("generator") || type.includes("генератор")) {
    return "Ритмичная работа с видимым результатом и автономией в задачах";
  }
  if (type.includes("projector") || type.includes("проектор")) {
    return "Роль эксперта/координатора с доступом к людям и контексту";
  }
  if (type.includes("manifestor") || type.includes("манифестор")) {
    return "Инициативные проекты с полномочиями запускать изменения";
  }
  if (type.includes("reflector") || type.includes("рефлектор")) {
    return "Гибкий формат с временем на оценку среды и команды";
  }
  return "Смешанный формат: чередование глубокой работы и коротких синхронизаций";
}

function pickKeyTalent(chart: NormalizedChart): string {
  const channels = chart.channelsShort.filter(Boolean);
  if (channels.length > 0) {
    return "Устойчивый паттерн действий в связанных зонах ответственности — опора для роли";
  }
  const defined = chart.definedCenters.filter((c) => c && c !== "—");
  if (defined.length > 0) {
    return "Внутренняя ясность в ключевых рабочих ситуациях при понятных ожиданиях";
  }
  return "Гибкость к разным задачам при ясных рамках и регулярной обратной связи";
}

function pickMainRisk(chart: NormalizedChart): string {
  const open = chart.openCenters.filter(Boolean);
  if (open.length >= 4) {
    return "Чувствительность к шуму среды и давлению чужих ожиданий — нужны границы";
  }
  if (chart.notSelfTheme && chart.notSelfTheme !== "—") {
    return "Потеря качества решений при перегрузе, спешке и неясных приоритетах";
  }
  return "Перегруз многозадачностью без приоритизации — падает качество решений";
}

function dataCompleteness(chart: NormalizedChart): string {
  const parts = [
    chart.type !== "—",
    chart.profile !== "—",
    Boolean(chart.birthDateUtc),
    chart.channelsShort.length > 0,
    chart.definedCenters.some((c) => c && c !== "—"),
  ].filter(Boolean).length;
  if (parts >= 5) return "высокая";
  if (parts >= 3) return "средняя";
  return "базовая";
}

function hypothesisConfidence(chart: NormalizedChart): string {
  const def = chart.definition && chart.definition !== "—" ? chart.definition : "";
  if (def.toLowerCase().includes("single") || def.includes("един")) return "средняя–высокая";
  if (def) return "средняя";
  return "предварительная";
}

export function buildCandidateTalentMap(
  candidateName: string,
  chart: NormalizedChart,
  vacancyTitle?: string,
): TalentMapPayload {
  const name = escapeHtml(candidateName.trim() || "Кандидат");
  const vacancyBit = vacancyTitle?.trim()
    ? ` для роли «${escapeHtml(vacancyTitle.trim())}»`
    : "";

  const best_work_format = pickWorkFormat(chart);
  const key_talent = pickKeyTalent(chart);
  const main_risk = pickMainRisk(chart);

  const summary =
    `${name}: предварительная карта талантов по данным рождения` +
    `${vacancyBit}. Это рабочие гипотезы для HR, а не финальное решение о найме.`;

  const formula =
    `${name} сильнее раскрывается там, где есть <em>ясная зона ответственности</em>, ` +
    `<strong>регулярная обратная связь</strong> и возможность работать в ритме, ` +
    `близком к ${escapeHtml(best_work_format.toLowerCase())}.`;

  const metrics = [
    { label: "Полнота данных", value: dataCompleteness(chart), hint: "дата, время, место" },
    {
      label: "Уверенность гипотезы",
      value: hypothesisConfidence(chart),
      hint: "до интервью и кейсов",
    },
    { label: "Рабочий формат", value: best_work_format.slice(0, 48) + (best_work_format.length > 48 ? "…" : ""), hint: "предварительно" },
    {
      label: "Что проверить",
      value: "кейс + встреча",
      hint: "структурированная проверка",
    },
  ];

  const talents = [
    { title: "Ключевой талант", body: key_talent },
    {
      title: "Стиль взаимодействия",
      body:
        chart.strategy !== "—" && chart.strategy
          ? `Предпочтительный ритм: ${chart.strategy}. Уточнить на испытательном периоде.`
          : "Уточнить через рабочие ситуации и обратную связь на испытательном периоде.",
    },
    {
      title: "Зоны силы в задачах",
      body:
        chart.channelsShort.length > 0
          ? "Есть устойчивые связки компетенций — проверить на реальных задачах роли."
          : "Сильные стороны проявятся в кейсах — зафиксировать на интервью.",
    },
  ];

  const strengths = [
    {
      title: "Сильные стороны",
      body:
        chart.authority !== "—" && chart.authority
          ? `Опора на внутренний ритм решений; предпочтительно давать время на обдумывание.`
          : "Стабильность при понятных критериях успеха и предсказуемом темпе.",
    },
    { title: "Рабочий формат", body: best_work_format },
  ];

  const risks = [
    { title: "Главный риск", body: main_risk },
    {
      title: "Условия раскрытия",
      body:
        chart.openCenters.length > 0
          ? "Среда и темп команды сильно влияют на продуктивность — проверить на стажировке."
          : "Ключевые факторы: ясные приоритеты, уважение к границам, предсказуемый ритм встреч.",
    },
  ];

  const directions = [
    {
      title: "Подходящие направления",
      body: "Роли с понятным результатом, измеримыми критериями и регулярной обратной связью.",
      fit: "высокая гипотеза",
    },
    {
      title: "Проверить глубже",
      body: "Задачи на автономию vs. жёсткий контроль — через короткий тестовый период.",
      fit: "средняя гипотеза",
    },
  ];

  const not_fit_directions = [
    {
      title: "Спорные зоны",
      body: "Хаотичная среда без приоритетов и постоянные срочные «пожары» без пауз на восстановление.",
    },
  ];

  const roles = [
    {
      role: vacancyTitle?.trim() || "Целевая роль",
      fit: "предварительно",
      note: `Сопоставить с рабочим форматом: ${best_work_format.slice(0, 80)}${best_work_format.length > 80 ? "…" : ""}`,
    },
    {
      role: "Смежные роли",
      fit: "проверить",
      note: "Задачи на координацию, аналитику или клиентский контакт — через пробные кейсы.",
    },
  ];

  const conditions = [
    {
      title: "Среда",
      body:
        chart.environment && chart.environment !== "—"
          ? `Предпочтительная среда по карте требует проверки на интервью и стажировке.`
          : "Спокойная среда с уважением к границам и предсказуемым ритмом встреч.",
    },
    {
      title: "Менеджмент",
      body: "Чёткие ожидания, договорённости письменно, обратная связь по фактам, не по давлению.",
    },
  ];

  const tests = [
    {
      title: "Проверка 1",
      body: "Кейс на 2–3 часа с реальной задачей роли + разбор решения с нанимающим менеджером.",
    },
    {
      title: "Проверка 2",
      body: "Наблюдение в командной встрече: как реагирует на срочность и многозадачность.",
    },
    {
      title: "Проверка 3",
      body: "Референсы + уточнение времени рождения, если есть сомнения в точности данных.",
    },
  ];

  const final_recommendation =
    `Рекомендуем рассматривать ${name} как сильную гипотезу${vacancyBit}: ` +
    `провести структурированное интервью и короткий оплачиваемый тест. ` +
    `Не принимать решение только по карте — без опыта, вакансии и интервью выводы предварительные.`;

  return {
    summary,
    best_work_format,
    key_talent,
    main_risk,
    formula,
    metrics,
    talents,
    strengths,
    risks,
    directions,
    not_fit_directions,
    roles,
    conditions,
    tests,
    final_recommendation,
  };
}
