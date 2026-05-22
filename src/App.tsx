import { FormEvent, useState, type JSX } from "react";
import "./App.css";

/** Splits report text into named sections by «Title» guillemet headers. */
function parseReportSections(text: string): Array<{ title: string; body: string }> {
  const parts = text.split(/(?=«[^»]+»)/);
  const sections: Array<{ title: string; body: string }> = [];

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const match = trimmed.match(/^«([^»]+)»\s*([\s\S]*)$/);
    if (match) {
      sections.push({ title: match[1].trim(), body: match[2].trim() });
    } else if (sections.length === 0) {
      sections.push({ title: "", body: trimmed });
    }
  }

  return sections.length > 0 ? sections : [{ title: "", body: text }];
}

/** Renders section body: bullet lists, ordered lists, and plain paragraphs. */
function renderSectionBody(body: string): JSX.Element {
  const lines = body.split("\n").map((l) => l.trim()).filter(Boolean);
  const nodes: JSX.Element[] = [];
  let listType: "ul" | "ol" | null = null;
  let listItems: string[] = [];
  let key = 0;

  const flushList = () => {
    if (listItems.length === 0) return;
    const Tag = listType === "ol" ? "ol" : "ul";
    nodes.push(
      <Tag key={key++} className="report-list">
        {listItems.map((item, i) => <li key={i}>{item}</li>)}
      </Tag>,
    );
    listItems = [];
    listType = null;
  };

  for (const line of lines) {
    const bulletMatch = line.match(/^[-•*]\s+(.+)/);
    const numberedMatch = line.match(/^\d+[.)]\s+(.+)/);

    if (bulletMatch) {
      if (listType === "ol") flushList();
      listType = "ul";
      listItems.push(bulletMatch[1]);
    } else if (numberedMatch) {
      if (listType === "ul") flushList();
      listType = "ol";
      listItems.push(numberedMatch[1]);
    } else {
      flushList();
      nodes.push(<p key={key++} className="report-paragraph">{line}</p>);
    }
  }

  flushList();
  return <>{nodes}</>;
}

export const testRaveChart = {
  type: "Проектор",
  profile: "1/3",
  authority: "Селезёночный",
  personalitySun: "18.1",
  personalityEarth: "17.1",
  designSun: "52.3",
  designEarth: "58.3",
} as const;

type BirthFormData = {
  birthDate: string;
  birthTime: string;
  birthCity: string;
};

type TalentReportResponse = {
  report?: string;
  error?: string;
  source?: string;
};

async function generateTalentReport(
  formData: BirthFormData,
): Promise<string> {
  try {
    const response = await fetch("/.netlify/functions/talent-report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formData),
    });

    const data = (await response.json().catch(() => null)) as
      | TalentReportResponse
      | null;

    if (!response.ok) {
      if (data?.error) {
        if (data.source === "humandesign-api") {
          return `Ошибка Human Design API: ${data.error}`;
        }
        if (data.source === "validation") {
          return data.error;
        }
        if (data.source === "config") {
          return `Настройка сервера: ${data.error}`;
        }
        return data.error;
      }

      if (response.status === 404) {
        return "Сервер функций недоступен. Перезапустите проект командой npm run dev.";
      }

      return `Не удалось получить отчёт (код ${response.status}). Попробуйте позже.`;
    }

    if (!data?.report) {
      return "Сервер вернул неожиданный ответ. Попробуйте позже.";
    }

    return data.report;
  } catch {
    return "Ошибка сети. Проверьте подключение и убедитесь, что dev-сервер запущен (npm run dev).";
  }
}

export default function App() {
  const [who, setWho] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [birthTime, setBirthTime] = useState("");
  const [birthCity, setBirthCity] = useState("");
  const [showResult, setShowResult] = useState(false);
  const [talentReport, setTalentReport] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setShowResult(false);

    try {
      const report = await generateTalentReport({
        birthDate,
        birthTime,
        birthCity,
      });
      setTalentReport(report);
      setShowResult(true);
      document.getElementById("result")?.scrollIntoView({ behavior: "smooth" });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="app">
      <header className="header">
        <div className="logo">TalentScan</div>
        <nav className="nav" aria-label="Основное меню">
          <a href="#about">О проекте</a>
          <a href="#pricing">Тарифы</a>
          <a href="#guide">Инструкция</a>
          <a href="#demo">Демо</a>
        </nav>
      </header>

      <section className="hero" id="demo">
        <h1>Рейв-карта Human Design для вашей карьеры</h1>
        <p>
          Узнайте свои врождённые таланты и оптимальную роль в работе — по дате,
          времени и месту рождения.
        </p>
      </section>

      <main className="main">
        <form className="form-card" onSubmit={handleSubmit}>
          <h2>Данные для расчёта</h2>

          <div className="field">
            <label htmlFor="who">Кто вы?</label>
            <select
              id="who"
              value={who}
              onChange={(e) => setWho(e.target.value)}
              required
            >
              <option value="">Выберите вариант</option>
              <option value="specialist">Специалист</option>
              <option value="manager">Руководитель</option>
              <option value="founder">Предприниматель</option>
              <option value="student">Студент / в поиске</option>
            </select>
          </div>

          <div className="field-row">
            <div className="field">
              <label htmlFor="birth-date">Дата рождения</label>
              <input
                id="birth-date"
                type="date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="birth-time">Время рождения</label>
              <input
                id="birth-time"
                type="time"
                value={birthTime}
                onChange={(e) => setBirthTime(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="field">
            <label htmlFor="birth-city">Город рождения</label>
            <input
              id="birth-city"
              type="text"
              placeholder="Например, Москва"
              value={birthCity}
              onChange={(e) => setBirthCity(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="submit-btn" disabled={isLoading}>
            {isLoading ? "Формируем отчёт…" : "Рассчитать рейв‑карту"}
          </button>
        </form>

        {showResult && (
          <section className="result" id="result" aria-live="polite">
            <h2 className="result-heading">Ваша карта талантов</h2>

            {(birthDate || birthTime || birthCity) && (
              <div className="report-badges">
                {birthDate && <span className="report-badge">{birthDate}</span>}
                {birthTime && <span className="report-badge">{birthTime}</span>}
                {birthCity && <span className="report-badge">{birthCity}</span>}
              </div>
            )}

            {talentReport ? (
              <div className="report-sections">
                {parseReportSections(talentReport).map((section, i) => (
                  <div
                    key={i}
                    className={`report-section${section.title ? "" : " report-section--plain"}`}
                  >
                    {section.title && (
                      <div className="report-section-title">{section.title}</div>
                    )}
                    <div className="report-section-body">
                      {renderSectionBody(section.body)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="report-empty">Результат пуст. Попробуйте ещё раз.</p>
            )}
          </section>
        )}
      </main>

      <section className="section-anchor" id="about">
        <h2>О проекте</h2>
        <p>
          TalentScan помогает связать Human Design с карьерными решениями:
          понять свои сильные стороны и выбрать среду, где они раскрываются.
        </p>
      </section>

      <section className="section-anchor" id="pricing">
        <h2>Тарифы</h2>
        <p>
          Базовый расчёт — бесплатно. Расширенный отчёт с воротами, каналами и
          рекомендациями по профессиям — в разработке.
        </p>
      </section>

      <section className="section-anchor" id="guide">
        <h2>Инструкция</h2>
        <p>
          Укажите точное время рождения из свидетельства или выписки из роддома.
          Город нужен для часового пояса. Нажмите «Рассчитать рейв‑карту».
        </p>
      </section>

      <footer className="footer">
        © {new Date().getFullYear()} TalentScan. Human Design для карьеры.
      </footer>
    </div>
  );
}
