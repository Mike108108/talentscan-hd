import type { HrPersonTalentMapV2 } from "../types";

/** Local-only fixture for type-check and manual v2 workspace validation. Not used in production. */
export const hrPersonTalentMapV2Fixture = {
  schema_version: "hr_person_talent_map_v2",
  report_type: "hr_person_talent_map",
  generation_meta: {
    generated_at: "2026-05-30T12:00:00.000Z",
    model: "gpt-4.1",
    prompt_version: "hr_person_talent_map_v2_fixture",
    pipeline_stage: "synthesis_complete",
    input_hash: "fixture-input-hash",
  },
  candidate_snapshot: {
    name: "Алексей Иванов",
    subtitle: "Product Manager · карта талантов",
    status_label: "Готово",
    best_work_format: "Гибрид с короткими синхронными окнами",
    key_talent: "Быстро связывает продуктовые цели с командной динамикой",
    main_risk: "Может перегружаться, если задачи приходят без приоритетов",
    headline: "Системный PM с сильной коммуникацией и фокусом на результат",
  },
  source_snapshot: {
    candidate_chart_id: "fixture-chart-id",
    normalized_chart_hash: "fixture-chart-hash",
    birth_data_complete: true,
    analysis_packet_version: "2026-05",
  },
  technical_chart_status: {
    status: "calculated",
    calculated_at: "2026-05-30T11:30:00.000Z",
    can_render_bodygraph: true,
    missing_fields: [],
  },
  data_quality: {
    completeness: "Достаточно данных для HR-гипотез по рабочему стилю",
    confidence: "medium",
    notes: "Нет контекста команды и опыта — выводы носят гипотетический характер",
    metrics: [
      { label: "Полнота birth data", value: "100%", hint: "fixture" },
      { label: "Контекст HR", value: "частичный" },
    ],
    missing: ["опыт работы", "контекст команды"],
    add_data: ["комментарий HR", "описание роли в прошлых командах"],
  },
  layer_reports: [
    {
      layer_key: "work_format",
      hr_title: "Рабочий формат",
      group: "energy_and_decision",
      status: "ready",
      ui_priority: 1,
      base: {
        short_summary: "Лучше работает в ритме с короткими синхронными точками и ясными приоритетами.",
        detailed_explanation:
          "Человеку комфортнее включаться в работу через понятный фокус дня, а не через постоянный поток мелких запросов.",
        how_it_appears_at_work: "Быстро берёт ownership, если задача сформулирована и есть критерий готовности.",
        where_useful: "Кросс-функциональные инициативы, где нужна связка продукт ↔ команда.",
        risks: "При хаотичном потоке задач теряет темп и уходит в микроменеджмент деталей.",
        management_tips: "Фиксируйте 2–3 приоритета на неделю и защищайте время на глубокую работу.",
        what_to_check: "Как человек планирует неделю и что делает, когда приходит 5 срочных запросов.",
      },
      pro: {
        technical_sources: ["type", "strategy"],
        source_values: { type: "MG", strategy: "wait_for_invitation" },
        connection_logic: "Стратегия входа в задачи + тип энергии → предпочтение ясного фокуса.",
        confidence: "medium",
        human_check: "Сверить с примерами из интервью о рабочем ритме.",
      },
      evidence: {
        source_fields: ["normalized_chart_data.type", "normalized_chart_data.strategy"],
        source_layer_keys: ["task_entry"],
        confidence: "medium",
        limitations: "Нет данных об опыте в высоконагруженных командах.",
        warnings: ["Не интерпретировать как отказ от инициативы"],
      },
    },
    {
      layer_key: "decision_style",
      hr_title: "Принятие решений",
      group: "energy_and_decision",
      status: "ready",
      ui_priority: 2,
      base: {
        short_summary: "Решения созревают через обсуждение и короткую паузу на проверку альтернатив.",
        detailed_explanation:
          "Человеку важно услышать разные точки зрения, после чего он быстро фиксирует решение.",
        how_it_appears_at_work: "На встречах задаёт уточняющие вопросы, затем предлагает чёткий next step.",
        where_useful: "Продуктовые развилки с неполной информацией.",
        risks: "Может затягивать решение, если нет дедлайна.",
        management_tips: "Задавайте timebox на обсуждение и явный критерий «достаточно данных».",
        what_to_check: "Пример спорного решения: как собирал аргументы и когда зафиксировал выбор.",
      },
      pro: {
        technical_sources: ["authority"],
        source_values: { authority: "emotional" },
        connection_logic: "Authority → потребность в эмоциональной ясности перед финальным решением.",
        confidence: "high",
        human_check: "Проверить на кейсе с конфликтом приоритетов.",
      },
      evidence: {
        source_fields: ["normalized_chart_data.authority"],
        confidence: "high",
        limitations: "Fixture-only evidence.",
      },
    },
    {
      layer_key: "talent_links",
      hr_title: "Связки талантов",
      group: "centers_channels_gates",
      status: "partial",
      ui_priority: 3,
      base: {
        short_summary: "Сильная связка «структура + коммуникация» помогает переводить идеи в план.",
        how_it_appears_at_work: "Умеет упрощать сложные темы для разных аудиторий.",
        what_to_check: "Попросить объяснить техническую тему нетехнической аудитории.",
      },
      pro: {
        technical_sources: ["channelsShort"],
        confidence: "medium",
      },
    },
    {
      layer_key: "communication_style",
      hr_title: "Коммуникация и объяснение",
      group: "planetary_activations",
      status: "ready",
      ui_priority: 4,
      base: {
        short_summary: "Коммуникация ясная, с акцентом на логику и практический смысл.",
        detailed_explanation: "Хорошо структурирует аргументы и связывает их с целями команды.",
        how_it_appears_at_work: "На статусах даёт контекст «зачем», а не только «что сделано».",
        management_tips: "Давайте площадку для презентаций решений стейкхолдерам.",
        what_to_check: "Как объясняет trade-off между скоростью и качеством.",
      },
      pro: {
        technical_sources: ["activations.personality.mercury"],
        confidence: "medium",
      },
    },
    {
      layer_key: "data_quality",
      hr_title: "Надёжность данных",
      group: "evidence_and_quality",
      status: "ready",
      ui_priority: 5,
      base: {
        short_summary: "Birth data полные; HR-контекст частичный — выводы как гипотезы.",
        what_to_check: "Дополнить интервью и комментарий HR перед финальным решением.",
      },
      pro: {
        technical_sources: ["birthDateUtc", "canRenderBodygraph"],
        confidence: "high",
      },
      evidence: {
        source_fields: ["data_quality.completeness"],
        confidence: "high",
        limitations: "Fixture — не production data.",
      },
    },
  ],
  synthesis_blocks: {
    executive_summary: {
      one_sentence: "Системный PM, который усиливает команду через ясную коммуникацию и фокус.",
      best_use: "Продуктовые инициативы со сложной кросс-функциональной координацией",
      main_value: "Связывает цели, людей и приоритеты в понятный план действий",
      main_risk: "Перегруз при отсутствии приоритизации входящего потока",
      how_to_check_first: "Разбор кейса «5 срочных задач за день»",
      decision_note: "Имеет смысл двигаться дальше при подтверждении навыков приоритизации",
      text: "Кандидат выглядит сильным для роли PM в продуктовой команде средней сложности.",
    },
    work_formula: {
      text: "Ясный фокус → обсуждение → <strong>быстрое решение</strong> → доведение до команды",
    },
    talents: {
      items: [
        {
          title: "Связка продукт и команда",
          body: "Переводит цели в понятные задачи для разных ролей.",
        },
        {
          title: "Структурная коммуникация",
          body: "Объясняет сложное простым языком без потери смысла.",
        },
      ],
      cards: [
        {
          id: "hyp-talent-1",
          type: "talent",
          title: "Кросс-функциональный мост",
          statement: "Может быть естественным связующим между продуктом, разработкой и бизнесом.",
          why_it_matters: "Снижает friction в принятии решений.",
          workplace_manifestation: "На встречах фиксирует общий next step.",
          how_to_check: "Кейс координации между двумя командами с разными KPI.",
          good_signal: "Все участники понимают приоритет после встречи.",
          warning_signal: "Решения остаются «висящими» без owner.",
          related_layer_ids: ["work_format", "communication_style"],
          confidence: "medium",
          client_visible: true,
        },
      ],
    },
    work_environment: {
      items: [
        {
          title: "Ритм",
          body: "Короткие синхронные окна + защищённое время на глубокую работу.",
        },
        {
          title: "Культура",
          body: "Открытое обсуждение trade-off без обесценивания альтернатив.",
        },
      ],
    },
    risks: {
      items: [
        {
          title: "Перегруз входящим потоком",
          body: "Без приоритетов темп падает, растёт микроменеджмент.",
        },
      ],
      checks: [
        {
          id: "risk-check-1",
          risk: "Перегруз входящим потоком",
          how_it_may_show_up: "Много параллельных задач без явного owner по приоритетам.",
          interview_check: "Как выглядел ваш самый хаотичный рабочий день?",
          test_task_check: "Дайте 5 входящих запросов — попросите расставить приоритеты.",
          good_signal: "Называет критерии отсечения и защищает фокус.",
          warning_signal: "Берёт всё сразу без рамок.",
          management_prevention: "Еженедельный приоритетный список от руководителя.",
          related_hypothesis_ids: ["hyp-talent-1"],
          confidence: "medium",
        },
      ],
    },
    management: {
      items: [
        {
          title: "Постановка задач",
          body: "Формулируйте outcome и критерий готовности, а не только список действий.",
        },
      ],
      playbook: {
        how_to_set_tasks: "Outcome + deadline + критерий «готово».",
        how_to_give_feedback: "Сначала контекст цели, затем конкретика по поведению.",
        how_to_motivate: "Показывайте влияние решений на продукт и команду.",
        what_not_to_do: "Не засыпать мелкими срочными запросами без приоритета.",
        best_environment: "Кросс-функциональная продуктовая команда с уважением к фокусу.",
        overload_signals: "Рост времени ответа, уход в детали без делегирования.",
        first_30_days_focus: "Согласовать ритм приоритизации и формат статусов.",
      },
    },
  },
  derived_action_sources: {
    layer_keys: ["work_format", "decision_style", "communication_style"],
    synthesis_keys: ["executive_summary", "management"],
    notes: "Fixture-only derived sources map.",
  },
  ui: {
    default_section: "overview",
    show_layer_catalog: true,
    layer_catalog_version: "2026-05-v2-fixture",
  },
  qa_meta: {
    hypothesis_level: "HR-гипотезы, требуют проверки на интервью",
    report_type_note: "general_candidate_talent_map",
    next_best_report: "hr_candidate_role_fit",
    disclaimers: [
      "Карта описывает рабочий стиль, а не пригодность к конкретной вакансии.",
      "Fixture — только для разработки UI v2.",
    ],
  },
} satisfies HrPersonTalentMapV2;
