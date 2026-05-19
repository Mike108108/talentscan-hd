import type { Handler, HandlerEvent, HandlerContext } from "@netlify/functions";

type RaveChart = {
  type: string;
  profile: string;
  authority: string;
  personalitySun: string;
  personalityEarth: string;
  designSun: string;
  designEarth: string;
};

const RAVE_CHART_KEYS: (keyof RaveChart)[] = [
  "type",
  "profile",
  "authority",
  "personalitySun",
  "personalityEarth",
  "designSun",
  "designEarth",
];

function jsonResponse(statusCode: number, body: unknown) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  };
}

function isRaveChart(value: unknown): value is RaveChart {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return RAVE_CHART_KEYS.every(
    (key) => typeof record[key] === "string" && record[key].trim() !== "",
  );
}

function buildPrompt(chart: RaveChart): string {
  return `Ты — эксперт по Human Design в контексте карьеры. Ниже данные рейв-карты клиента.

Тип: ${chart.type}
Профиль: ${chart.profile}
Авторитет: ${chart.authority}
Личность — Солнце: ворота ${chart.personalitySun}, Земля: ворота ${chart.personalityEarth}
Дизайн — Солнце: ворота ${chart.designSun}, Земля: ворота ${chart.designEarth}

Объясни себе (внутренне), что это показатели Human Design: тип, профиль, авторитет и положения Солнца/Земли для личности и дизайна.

Верни ответ на русском языке строго в трёх блоках с такими заголовками (сохрани формулировки заголовков):

«Лучшее направление»
2–3 предложения: куда двигаться в карьере с учётом типа ${chart.type}, профиля ${chart.profile} и авторитета ${chart.authority}.

«Сильные рабочие образы»
Список из 4–6 конкретных ролей или форматов работы (маркированный список), опираясь на ворота личности ${chart.personalitySun}, ${chart.personalityEarth} и дизайна ${chart.designSun}, ${chart.designEarth}.

«Как использовать»
2–3 практичных совета, как применять эти данные в поиске работы, переговорах о роли и ежедневных решениях.

Не добавляй вступлений и заключений вне этих трёх блоков. Не используй markdown-заголовки с # — только указанные названия блоков в кавычках «».`;
}

export const handler: Handler = async (
  event: HandlerEvent,
  _context: HandlerContext,
) => {
  if (event.httpMethod !== "POST") {
    return jsonResponse(405, { error: "Method not allowed. Use POST." });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return jsonResponse(500, { error: "OPENAI_API_KEY is not configured." });
  }

  let chart: RaveChart;
  try {
    const parsed: unknown = JSON.parse(event.body ?? "");
    if (!isRaveChart(parsed)) {
      return jsonResponse(400, {
        error:
          "Invalid body. Expected JSON with type, profile, authority, personalitySun, personalityEarth, designSun, designEarth.",
      });
    }
    chart = parsed;
  } catch {
    return jsonResponse(400, { error: "Invalid JSON body." });
  }

  const model = process.env.OPENAI_MODEL ?? "gpt-4o";

  try {
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
              content: buildPrompt(chart),
            },
          ],
        }),
      },
    );

    if (!openAiResponse.ok) {
      const errText = await openAiResponse.text();
      console.error("OpenAI API error:", openAiResponse.status, errText);
      return jsonResponse(502, { error: "OpenAI API request failed." });
    }

    const data = (await openAiResponse.json()) as {
      choices?: { message?: { content?: string | null } }[];
    };

    const report = data.choices?.[0]?.message?.content?.trim();
    if (!report) {
      return jsonResponse(502, { error: "Empty response from OpenAI." });
    }

    return jsonResponse(200, { report });
  } catch (error) {
    console.error("talent-report function error:", error);
    return jsonResponse(500, { error: "Internal server error." });
  }
};
