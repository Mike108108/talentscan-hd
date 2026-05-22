import type { Handler, HandlerEvent, HandlerContext } from "@netlify/functions";

type AnalysisType = "talent_map" | "current_role" | "vacancy_assessment";

type BirthRequest = {
  birthDate: string;
  birthTime: string;
  birthCity: string;
  analysisType: AnalysisType;
  currentRoleDescription?: string;
  vacancyDescription?: string;
};

type HdChartCoordinatesRequest = {
  birthdate: string;
  birthtime: string;
  lat: number;
  lng: number;
};

const HD_CHARTS_COORDINATES_URL =
  "https://api.humandesignapi.nl/v2/charts/coordinates";

/** Fallback: Moscow (no HD-Geocode-Key required for /v2/charts/coordinates). */
const DEFAULT_COORDINATES = { lat: 55.7558, lng: 37.6173 };

type ChartData = {
  type: string;
  profile: string;
  strategy: string;
  authority: string;
  incarnationCross: string;
  definedCenters: string[];
  undefinedCenters: string[];
  gates: string[];
  channels: string[];
};

const ALL_CENTERS = [
  "Head",
  "Ajna",
  "Throat",
  "G",
  "Heart",
  "Ego",
  "Sacral",
  "Solar Plexus",
  "Spleen",
  "Root",
];

const CITY_COORDINATES: Record<string, { lat: number; lng: number }> = {
  москва: { lat: 55.7558, lng: 37.6173 },
  moscow: { lat: 55.7558, lng: 37.6173 },
  "санкт-петербург": { lat: 59.9311, lng: 30.3609 },
  "saint petersburg": { lat: 59.9311, lng: 30.3609 },
  spb: { lat: 59.9311, lng: 30.3609 },
  киев: { lat: 50.4501, lng: 30.5234 },
  kyiv: { lat: 50.4501, lng: 30.5234 },
  минск: { lat: 53.9006, lng: 27.559 },
  алматы: { lat: 43.222, lng: 76.8512 },
  астана: { lat: 51.1694, lng: 71.4491 },
  ташкент: { lat: 41.2995, lng: 69.2401 },
  екатеринбург: { lat: 56.8389, lng: 60.6057 },
  новосибирск: { lat: 55.0084, lng: 82.9357 },
  красноярск: { lat: 56.0153, lng: 92.8932 },
  владивосток: { lat: 43.1155, lng: 131.8855 },
};

function jsonResponse(statusCode: number, body: unknown) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function asString(value: unknown, fallback = ""): string {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number") return String(value);
  return fallback;
}

function extractApiError(data: unknown, status: number): string {
  const record = asRecord(data);
  const message = asString(
    record.message ??
      record.error ??
      record.detail ??
      record.title ??
      (Array.isArray(record.errors) ? record.errors[0] : ""),
  );
  if (message) return message;
  return `HTTP ${status}`;
}

function parseBirthRequest(body: string | null): BirthRequest {
  const parsed: unknown = JSON.parse(body ?? "{}");
  const record = asRecord(parsed);

  const birthDate = asString(record.birthDate ?? record.birthdate);
  const birthTime = asString(record.birthTime ?? record.birthtime);
  const birthCity = asString(
    record.birthCity ?? record.birthcity ?? record.birthplace ?? record.city,
  );

  if (!birthDate || !birthTime || !birthCity) {
    throw new Error(
      "Укажите дату рождения, время рождения и город рождения.",
    );
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) {
    throw new Error("Неверный формат даты. Ожидается YYYY-MM-DD.");
  }

  const normalizedTime = normalizeBirthTime(birthTime);

  const rawAnalysisType = asString(record.analysisType ?? record.analysis_type);
  const validTypes: AnalysisType[] = ["talent_map", "current_role", "vacancy_assessment"];
  const analysisType: AnalysisType = validTypes.includes(rawAnalysisType as AnalysisType)
    ? (rawAnalysisType as AnalysisType)
    : "talent_map";

  const currentRoleDescription = asString(
    record.currentRoleDescription ?? record.current_role_description,
  ) || undefined;
  const vacancyDescription = asString(
    record.vacancyDescription ?? record.vacancy_description,
  ) || undefined;

  return {
    birthDate,
    birthTime: normalizedTime,
    birthCity,
    analysisType,
    currentRoleDescription,
    vacancyDescription,
  };
}

function normalizeBirthTime(time: string): string {
  const match = time.match(/^(\d{2}):(\d{2})/);
  if (!match) {
    throw new Error("Неверный формат времени. Ожидается HH:MM.");
  }
  return `${match[1]}:${match[2]}`;
}

function resolveCoordinates(city: string): { lat: number; lng: number } {
  const normalized = city.trim().toLowerCase();
  const coords = CITY_COORDINATES[normalized];
  if (coords) return coords;

  console.log(
    `HD coordinates: city "${city}" not in map, using Moscow defaults`,
  );
  return DEFAULT_COORDINATES;
}

function buildHdChartRequest(input: BirthRequest): HdChartCoordinatesRequest {
  const { lat, lng } = resolveCoordinates(input.birthCity);
  return {
    birthdate: input.birthDate,
    birthtime: normalizeBirthTime(input.birthTime),
    lat,
    lng,
  };
}

function normalizeCenterName(name: string): string {
  return name.trim();
}

function extractCenters(root: Record<string, unknown>): {
  definedCenters: string[];
  undefinedCenters: string[];
} {
  const centers = root.centers ?? root.Centers;

  if (Array.isArray(centers)) {
    const definedCenters = centers
      .map((c) => asString(c))
      .filter(Boolean)
      .map(normalizeCenterName);
    const definedSet = new Set(definedCenters.map((c) => c.toLowerCase()));
    const undefinedCenters = ALL_CENTERS.filter(
      (c) => !definedSet.has(c.toLowerCase()),
    );
    return { definedCenters, undefinedCenters };
  }

  const centersObj = asRecord(centers);
  const definedRaw =
    centersObj.defined ??
    centersObj.definedCenters ??
    centersObj.defined_centers ??
    root.definedCenters ??
    root.defined_centers;
  const undefinedRaw =
    centersObj.undefined ??
    centersObj.undefinedCenters ??
    centersObj.undefined_centers ??
    root.undefinedCenters ??
    root.undefined_centers;

  const definedCenters = Array.isArray(definedRaw)
    ? definedRaw.map((c) => normalizeCenterName(asString(c))).filter(Boolean)
    : [];
  const undefinedCenters = Array.isArray(undefinedRaw)
    ? undefinedRaw.map((c) => normalizeCenterName(asString(c))).filter(Boolean)
    : ALL_CENTERS.filter(
        (c) =>
          !definedCenters.some((d) => d.toLowerCase() === c.toLowerCase()),
      );

  return { definedCenters, undefinedCenters };
}

function extractGates(root: Record<string, unknown>): string[] {
  const gatesRaw =
    root.gates ?? root.Gates ?? root.active_gates ?? root.activeGates;
  if (!gatesRaw) return [];

  if (Array.isArray(gatesRaw)) {
    return gatesRaw.map((g) => asString(g)).filter(Boolean);
  }

  const gatesObj = asRecord(gatesRaw);
  return Object.keys(gatesObj)
    .filter((k) => gatesObj[k])
    .map((k) => asString(k))
    .filter(Boolean);
}

function extractChannels(root: Record<string, unknown>): string[] {
  const channelsRaw =
    root.channels ??
    root.Channels ??
    root.channels_short ??
    root.channelsShort ??
    root.channel_list ??
    root.channelList;

  if (!channelsRaw) return [];

  if (Array.isArray(channelsRaw)) {
    return channelsRaw.map((c) => asString(c)).filter(Boolean);
  }

  const channelsObj = asRecord(channelsRaw);
  return Object.keys(channelsObj)
    .filter((key) => {
      const value = channelsObj[key];
      if (typeof value === "boolean") return value;
      if (value && typeof value === "object") {
        const channel = value as Record<string, unknown>;
        return channel.defined !== false;
      }
      return true;
    })
    .map((c) => asString(c))
    .filter(Boolean);
}

function buildChartData(hdChart: unknown): ChartData {
  const outer = asRecord(hdChart);
  const root = asRecord(outer.data ?? outer.chart ?? outer.bodygraph ?? outer);

  const { definedCenters, undefinedCenters } = extractCenters(root);

  return {
    type: asString(root.type ?? root.Type, "—"),
    profile: asString(root.profile ?? root.Profile, "—"),
    strategy: asString(root.strategy ?? root.Strategy, "—"),
    authority: asString(root.authority ?? root.Authority, "—"),
    incarnationCross: asString(
      root.incarnationCross ??
        root.incarnation_cross ??
        root.IncarnationCross ??
        root.cross,
      "—",
    ),
    definedCenters,
    undefinedCenters,
    gates: extractGates(root),
    channels: extractChannels(root),
  };
}

async function fetchHumanDesignChart(
  input: BirthRequest,
): Promise<unknown> {
  const apiKey = process.env.HD_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Ключ Human Design API не настроен (HD_API_KEY). Добавьте его в .env для локальной разработки.",
    );
  }

  const payload = buildHdChartRequest(input);
  console.log("HD API endpoint:", HD_CHARTS_COORDINATES_URL);
  console.log("HD API request body:", JSON.stringify(payload, null, 2));

  const response = await fetch(HD_CHARTS_COORDINATES_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  const data: unknown = await response.json().catch(() => null);
  console.log("HD API status:", response.status);

  if (!response.ok) {
    const details = extractApiError(data, response.status);
    console.error("HD API error response:", JSON.stringify(data, null, 2));
    throw new Error(
      `Human Design API (${response.status}): ${details}`,
    );
  }

  if (!data) {
    throw new Error("Human Design API вернул пустой ответ.");
  }

  return data;
}

function buildChartSummary(chart: ChartData): string {
  const gatesText = chart.gates.length > 0 ? chart.gates.join(", ") : "не указаны";
  const channelsText = chart.channels.length > 0 ? chart.channels.join(", ") : "не указаны";
  const definedCentersText = chart.definedCenters.length > 0 ? chart.definedCenters.join(", ") : "не указаны";
  const undefinedCentersText = chart.undefinedCenters.length > 0 ? chart.undefinedCenters.join(", ") : "не указаны";

  return `Тип: ${chart.type}
Профиль: ${chart.profile}
Стратегия: ${chart.strategy}
Авторитет: ${chart.authority}
Инкарнационный крест: ${chart.incarnationCross}
Определённые центры: ${definedCentersText}
Неопределённые центры: ${undefinedCentersText}
Ворота: ${gatesText}
Каналы: ${channelsText}`;
}

function buildPrompt(chart: ChartData, request: BirthRequest): string {
  const chartSummary = buildChartSummary(chart);
  const gatesText = chart.gates.length > 0 ? chart.gates.join(", ") : "не указаны";
  const channelsText = chart.channels.length > 0 ? chart.channels.join(", ") : "не указаны";

  const intro = `Ты — эксперт по карьере, который использует данные Human Design как инструмент самопознания. Пиши простым русским языком, без лишних терминов. Давай практичные выводы. Используй заголовки строго в формате «...» — фронтенд разбивает отчёт по ним.

Данные рейв-карты:
${chartSummary}

`;

  if (request.analysisType === "current_role") {
    const roleDesc = request.currentRoleDescription ?? "не указано";
    return `${intro}Клиент описывает свою текущую роль:
«${roleDesc}»

Проанализируй, насколько эта роль подходит человеку с такой картой. Дай честный и практичный ответ.

Верни ответ строго в пяти блоках с такими заголовками (сохрани формулировки):

«Быстрый ответ по текущей роли»
1–2 предложения: общий вывод — подходит ли эта роль человеку с такими данными.

«Что подходит»
Маркированный список: что в описанной роли хорошо совпадает с сильными сторонами человека.

«Где может быть перегруз»
Маркированный список: что в этой роли может забирать энергию или идти вразрез с природой человека.

«Что изменить в условиях»
Маркированный список из 2–3 практичных советов: как скорректировать условия работы, чтобы роль стала комфортнее.

«Итоговая рекомендация»
2–3 предложения: стоит ли оставаться в этой роли, что менять, куда двигаться дальше.

Не добавляй текст вне этих пяти блоков. Не используй # заголовки.`;
  }

  if (request.analysisType === "vacancy_assessment") {
    const vacancyDesc = request.vacancyDescription ?? "не указано";
    return `${intro}Клиент рассматривает вакансию и хочет понять, стоит ли изучить её глубже.

Описание вакансии:
«${vacancyDesc}»

Проанализируй, насколько эта вакансия подходит человеку с такой картой.

Верни ответ строго в шести блоках с такими заголовками (сохрани формулировки):

«Быстрый ответ по вакансии»
1–2 предложения: общий вывод — стоит ли рассматривать эту вакансию дальше.

«Где есть совпадение»
Маркированный список: что в вакансии хорошо совпадает с природой и сильными сторонами человека.

«Где есть риски»
Маркированный список: что в вакансии может быть энергозатратным или проблемным.

«Что уточнить у работодателя»
Маркированный список из 2–4 конкретных вопросов, которые стоит задать на собеседовании.

«Как преподнести себя на собеседовании»
Маркированный список из 2–3 советов: на что делать акцент, как говорить о своих сильных сторонах.

«Итоговая рекомендация»
2–3 предложения: финальный вывод — идти или нет, и на что обратить внимание при принятии решения.

Не добавляй текст вне этих шести блоков. Не используй # заголовки.`;
  }

  // Default: talent_map
  return `${intro}Составь карьерный отчёт: карта талантов человека, его сильные стороны и подходящие направления в работе.

Верни ответ строго в трёх блоках с такими заголовками (сохрани формулировки):

«Лучшее направление»
2–3 предложения: куда двигаться в карьере с учётом типа ${chart.type}, профиля ${chart.profile}, стратегии ${chart.strategy} и авторитета ${chart.authority}.

«Сильные рабочие образы»
Маркированный список из 4–6 конкретных ролей или форматов работы, опираясь на определённые центры, ворота (${gatesText}) и каналы (${channelsText}).

«Как использовать»
Маркированный список из 2–3 практичных советов: как применять эти данные в поиске работы, переговорах о роли и ежедневных решениях.

Не добавляй текст вне этих трёх блоков. Не используй # заголовки.`;
}

export const handler: Handler = async (
  event: HandlerEvent,
  _context: HandlerContext,
) => {
  if (event.httpMethod !== "POST") {
    return jsonResponse(405, { error: "Разрешён только метод POST." });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return jsonResponse(500, {
      error: "Ключ OpenAI не настроен (OPENAI_API_KEY).",
      source: "config",
    });
  }

  let birthInput: BirthRequest;
  try {
    birthInput = parseBirthRequest(event.body);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Некорректные данные формы.";
    return jsonResponse(400, { error: message, source: "validation" });
  }

  const model = process.env.OPENAI_MODEL ?? "gpt-4o";

  try {
    const hdChart = await fetchHumanDesignChart(birthInput);
    console.log("HD chart response:", JSON.stringify(hdChart, null, 2));

    const chartData = buildChartData(hdChart);
    console.log("Chart data for OpenAI:", JSON.stringify(chartData, null, 2));
    console.log("Analysis type:", birthInput.analysisType);

    const openAiResponse = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          temperature: 0.7,
          messages: [
            {
              role: "system",
              content:
                "Ты помощник TalentScan. Пишешь только на русском, структурированно и по делу.",
            },
            {
              role: "user",
              content: buildPrompt(chartData, birthInput),
            },
          ],
        }),
      },
    );

    if (!openAiResponse.ok) {
      const errText = await openAiResponse.text();
      console.error("OpenAI API error:", openAiResponse.status, errText);
      return jsonResponse(502, {
        error: `OpenAI API вернул ошибку (${openAiResponse.status}).`,
        source: "openai",
      });
    }

    const data = (await openAiResponse.json()) as {
      choices?: { message?: { content?: string | null } }[];
    };

    const report = data.choices?.[0]?.message?.content?.trim();
    if (!report) {
      return jsonResponse(502, {
        error: "OpenAI вернул пустой ответ.",
        source: "openai",
      });
    }

    return jsonResponse(200, { report });
  } catch (error) {
    console.error("talent-report function error:", error);
    const message =
      error instanceof Error ? error.message : "Внутренняя ошибка сервера.";
    const isHd =
      message.includes("Human Design API") || message.includes("HD_API_KEY");
    const isConfig = message.includes("не настроен");
    const statusCode = isConfig ? 500 : isHd ? 502 : 500;

    return jsonResponse(statusCode, {
      error: message,
      source: isHd ? "humandesign-api" : "server",
    });
  }
};
