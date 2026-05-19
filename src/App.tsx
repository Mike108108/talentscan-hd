import { FormEvent, useState } from "react";
import "./App.css";

type Role = "Генератор" | "Проектор" | "Манифестор" | "Рефлектор";

const ROLES: Role[] = ["Генератор", "Проектор", "Манифестор", "Рефлектор"];

const TALENTS_BY_ROLE: Record<Role, string[]> = {
  Генератор: [
    "Устойчивая энергия для долгих проектов",
    "Мастерство через практику и отклик",
    "Создание материального результата в команде",
  ],
  Проектор: [
    "Видение систем и людей",
    "Наставничество и управление энергией других",
    "Стратегическое направление без выгорания",
  ],
  Манифестор: [
    "Инициатива и запуск новых направлений",
    "Влияние через информирование",
    "Лидерство в кризисных точках изменений",
  ],
  Рефлектор: [
    "Объективная оценка среды и команды",
    "Чувствительность к циклам и трендам",
    "Уникальный взгляд на культуру организации",
  ],
};

function pickRole(seed: string): Role {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash + seed.charCodeAt(i) * (i + 1)) % 1000;
  }
  return ROLES[hash % ROLES.length];
}

export default function App() {
  const [who, setWho] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [birthTime, setBirthTime] = useState("");
  const [birthCity, setBirthCity] = useState("");
  const [showResult, setShowResult] = useState(false);
  const [resultRole, setResultRole] = useState<Role>("Генератор");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const seed = `${who}|${birthDate}|${birthTime}|${birthCity}`;
    setResultRole(pickRole(seed));
    setShowResult(true);
    document.getElementById("result")?.scrollIntoView({ behavior: "smooth" });
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

          <button type="submit" className="submit-btn">
            Рассчитать рейв‑карту
          </button>
        </form>

        {showResult && (
          <section className="result" id="result" aria-live="polite">
            <h2>Ваша рейв-карта для карьеры</h2>
            <p className="result-meta">
              {birthDate && birthTime && birthCity
                ? `Расчёт по данным: ${birthDate}, ${birthTime}, ${birthCity}`
                : "Демонстрационный результат"}
            </p>

            <h3>Тип и роль в работе</h3>
            <p>
              В Human Design ваш карьерный профиль ближе к типу{" "}
              <strong>{resultRole}</strong>. Это определяет, как вы лучше всего
              взаимодействуете с энергией задач, командой и принятием решений.
            </p>

            <h3>Ключевые таланты</h3>
            <ul>
              {TALENTS_BY_ROLE[resultRole].map((talent) => (
                <li key={talent}>{talent}</li>
              ))}
            </ul>

            <h3>Рекомендуемые роли</h3>
            <p>
              {resultRole === "Генератор" &&
                "Операционные роли, продакшн, craft-специализации, где важен стабильный ритм и видимый результат."}
              {resultRole === "Проектор" &&
                "Консалтинг, HR, agile-коучинг, архитектура процессов — там, где вы направляете, а не «тащите» сами."}
              {resultRole === "Манифестор" &&
                "Запуск продуктов, кризис-менеджмент, роли с высокой автономией и правом инициировать изменения."}
              {resultRole === "Рефлектор" &&
                "Аналитика культуры, UX-исследования, advisory — роли, где ценится взгляд со стороны и пауза перед решением."}
            </p>

            <p>
              <em>
                Это демо-версия с примерным текстом. Для точного расчёта
                рейв-карты нужна профессиональная эфемерида и время рождения с
                точностью до минуты.
              </em>
            </p>
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
