/**
 * Deterministic HR talent map builder from normalized HD chart.
 * Server-side copy — keep in sync with src/lib/hr/buildCandidateTalentMap.ts
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

function pickWorkFormat(type: string, profile: string): string {
  const t = type.toLowerCase();
  if (t.includes("generator") || t.includes("генератор")) {
    return "Ритмичная работа с видимым результатом и автономией в задачах";
  }
  if (t.includes("projector") || t.includes("проектор")) {
    return "Роль эксперта/координатора с доступом к людям и контексту";
  }
  if (t.includes("manifestor") || t.includes("манифестор")) {
    return "Инициативные проекты с полномочиями запускать изменения";
  }
  if (t.includes("reflector") || t.includes("рефлектор")) {
    return "Гибкий формат с временем на оценку среды и команды";
  }
  if (profile && profile !== "—") {
    return `Формат, согласованный с профилем ${profile}: устойчивый темп и понятные ожидания`;
  }
  return "Смешанный формат: чередование глубокой работы и коротких синхронизаций";
}

function pickKeyTalent(chart: NormalizedChart): string {
  const channels = chart.channelsShort.filter(Boolean);
  if (channels.length > 0) {
    return `Сильная связка каналов (${channels.slice(0, 2).join(", ")}): устойчивый паттерн действий`;
  }
  const defined = chart.definedCenters.filter((c) => c && c !== "—");
  if (defined.length > 0) {
    return `Выраженные центры (${defined.slice(0, 2).join(", ")}): опора на внутреннюю ясность`;
  }
  return "Гибкость к разным задачам при ясных рамках и обратной связи";
}

function pickMainRisk(chart: NormalizedChart): string {
  const open = chart.openCenters.filter(Boolean);
  if (open.length >= 4) {
    return "Чувствительность к шуму среды и давлению чужих ожиданий — нужны границы";
  }
  if (chart.notSelfTheme && chart.notSelfTheme !== "—") {
    return `Риск «не-себя»: ${chart.notSelfTheme} при перегрузе и спешке`;
  }
  return "Перегруз многозадачностью без приоритизации — падает качество решений";
}

export function buildCandidateTalentMap(
  candidateName: string,
  chart: NormalizedChart,
  vacancyTitle?: string,
): TalentMapPayload {
  const name = candidateName.trim() || "Кандидат";
  const type = chart.type !== "—" ? chart.type : "тип уточняется";
  const profile = chart.profile !== "—" ? chart.profile : "";
  const strategy = chart.strategy !== "—" ? chart.strategy : "";
  const authority = chart.authority !== "—" ? chart.authority : "";

  const best_work_format = pickWorkFormat(type, profile);
  const key_talent = pickKeyTalent(chart);
  const main_risk = pickMainRisk(chart);

  const vacancyBit = vacancyTitle?.trim()
    ? ` для роли «${vacancyTitle.trim()}»`
    : "";

  const summary =
    `${name}: предварительная карта по Human Design (${type}` +
    (profile ? `, профиль ${profile}` : "") +
    `). Это гипотезы${vacancyBit}, а не финальное решение о найме.`;

  const formula =
    `${name} сильнее раскрывается там, где есть <em>ясная зона ответственности</em>, ` +
    `<strong>регулярная обратная связь</strong> и возможность работать в ритме, ` +
    `близком к ${best_work_format.toLowerCase()}.`;

  const metrics = [
    { label: "Тип", value: type, hint: "базовый паттерн энергии" },
    { label: "Профиль", value: profile || "—", hint: "стиль взаимодействия" },
    { label: "Авторитет", value: authority || "—", hint: "как принимает решения" },
    {
      label: "Определённость",
      value: chart.definition && chart.definition !== "—" ? chart.definition : "—",
      hint: "связность центров",
    },
  ];

  const talents = [
    {
      title: "Ключевой талант",
      body: key_talent,
    },
    {
      title: "Стратегия",
      body: strategy || "Уточнить через рабочие ситуации и обратную связь на испытательном периоде.",
    },
    {
      title: "Каналы",
      body:
        chart.channelsShort.length > 0
          ? chart.channelsShort.join("; ")
          : "Каналы требуют дополнительной проверки в реальных задачах.",
    },
  ];

  const strengths = [
    {
      title: "Сильные стороны",
      body: `Опора на ${authority || "внутренний ритм"} при принятии решений; ` +
        `определённые центры: ${chart.definedCenters.slice(0, 4).join(", ") || "уточняются"}.`,
    },
    {
      title: "Рабочий формат",
      body: best_work_format,
    },
  ];

  const risks = [
    { title: "Главный риск", body: main_risk },
    {
      title: "Открытые центры",
      body:
        chart.openCenters.length > 0
          ? `Могут усиливать впечатления от среды: ${chart.openCenters.slice(0, 4).join(", ")}.`
          : "Среда и темп команды — ключевые факторы устойчивости.",
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
      note: `Сопоставить с типом ${type} и форматом: ${best_work_format.slice(0, 80)}…`,
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
          ? `По карте: ${chart.environment}. Подтвердить на интервью и стажировке.`
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
      body: "Референсы + уточнение времени рождения, если есть сомнения в точности карты.",
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
