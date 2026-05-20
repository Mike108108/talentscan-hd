import type { Handler, HandlerEvent, HandlerContext } from "@netlify/functions";

type BirthRequest = {
  birthDate: string;
  birthTime: string;
  birthCity: string;
};

type HdChartRequest = {
  birthdate: string;
  birthtime: string;
  birthplace: string;
  timezone: string;
};

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

const CITY_TIMEZONE: Record<string, string> = {
  москва: "Europe/Moscow",
  moscow: "Europe/Moscow",
  "санкт-петербург": "Europe/Moscow",
  "saint petersburg": "Europe/Moscow",
  spb: "Europe/Moscow",
  киев: "Europe/Kyiv",
  kyiv: "Europe/Kyiv",
  минск: "Europe/Minsk",
  алматы: "Asia/Almaty",
  астана: "Asia/Almaty",
  ташкент: "Asia/Tashkent",
  екатеринбург: "Asia/Yekaterinburg",
  новосибирск: "Asia/Novosibirsk",
  красноярск: "Asia/Krasnoyarsk",
  владивосток: "Asia/Vladivostok",
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

  if (!/^\d{2}:\d{2}(:\d{2})?$/.test(birthTime)) {
    throw new Error("Неверный формат времени. Ожидается HH:MM.");
  }

  return { birthDate, birthTime, birthCity };
}

function resolveTimezone(city: string): string {
  const normalized = city.trim().toLowerCase();
  return CITY_TIMEZONE[normalized] ?? "Europe/Moscow";
}

function buildHdChartRequest(input: BirthRequest): HdChartRequest {
  const birthtime =
    input.birthTime.length === 5 ? `${input.birthTime}:00` : input.birthTime;

  return {
    birthdate: input.birthDate,
    birthtime,
    birthplace: input.birthCity.trim(),
    timezone: resolveTimezone(input.birthCity),
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
  console.log("HD API request body:", JSON.stringify(payload, null, 2));

  const response = await fetch("https://api.humandesignapi.nl/v2/charts", {
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

function buildPrompt(chart: ChartData): string {
  const gatesText =
    chart.gates.length > 0 ? chart.gates.join(", ") : "не указаны";
  const channelsText =
    chart.channels.length > 0 ? chart.channels.join(", ") : "не указаны";
  const definedCentersText =
    chart.definedCenters.length > 0
      ? chart.definedCenters.join(", ")
      : "не указаны";
  const undefinedCentersText =
    chart.undefinedCenters.length > 0
      ? chart.undefinedCenters.join(", ")
      : "не указаны";

  return `Ты — эксперт по Human Design в контексте карьеры. Ниже данные рейв-карты клиента из Human Design API.

Тип: ${chart.type}
Профиль: ${chart.profile}
Стратегия: ${chart.strategy}
Авторитет: ${chart.authority}
Инкарнационный крест: ${chart.incarnationCross}
Определённые центры: ${definedCentersText}
Неопределённые центры: ${undefinedCentersText}
Ворота: ${gatesText}
Каналы: ${channelsText}

Объясни себе (внутренне), что это показатели Human Design: тип, профиль, стратегия, авторитет, центры, ворота и каналы.

Верни ответ на русском языке строго в трёх блоках с такими заголовками (сохрани формулировки заголовков):

«Лучшее направление»
2–3 предложения: куда двигаться в карьере с учётом типа ${chart.type}, профиля ${chart.profile}, стратегии ${chart.strategy} и авторитета ${chart.authority}.

«Сильные рабочие образы»
Список из 4–6 конкретных ролей или форматов работы (маркированный список), опираясь на определённые центры, ворота (${gatesText}) и каналы (${channelsText}).

«Как использовать»
2–3 практичных совета, как применять эти данные в поиске работы, переговорах о роли и ежедневных решениях.

Не добавляй вступлений и заключений вне этих трёх блоков. Не используй markdown-заголовки с # — только указанные названия блоков в кавычках «».`;
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
              content: buildPrompt(chartData),
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
