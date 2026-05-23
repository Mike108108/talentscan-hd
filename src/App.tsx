import { FormEvent, useCallback, useEffect, useState, type JSX } from "react";
import "./App.css";
import {
  supabase,
  isSupabaseConfigured,
  type AnalysisType,
  type Report,
} from "./lib/supabase";

// ---------------------------------------------------------------------------
// Report rendering helpers
// ---------------------------------------------------------------------------

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

function renderSectionBody(body: string): JSX.Element {
  const lines = body
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const nodes: JSX.Element[] = [];
  let listType: "ul" | "ol" | null = null;
  let listItems: string[] = [];
  let key = 0;

  const flushList = () => {
    if (listItems.length === 0) return;
    const Tag = listType === "ol" ? "ol" : "ul";
    nodes.push(
      <Tag key={key++} className="report-list">
        {listItems.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
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
      nodes.push(
        <p key={key++} className="report-paragraph">
          {line}
        </p>,
      );
    }
  }

  flushList();
  return <>{nodes}</>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ANALYSIS_OPTIONS: { id: AnalysisType; icon: string; label: string }[] = [
  { id: "talent_map", icon: "✨", label: "Карта талантов" },
  { id: "current_role", icon: "🧭", label: "Моя текущая роль" },
  { id: "vacancy_assessment", icon: "📄", label: "Оценить вакансию" },
];

const RESULT_HEADING: Record<AnalysisType, string> = {
  talent_map: "Ваша карта талантов",
  current_role: "Анализ текущей роли",
  vacancy_assessment: "Оценка вакансии",
};

const ANALYSIS_TYPE_LABEL: Record<AnalysisType, string> = {
  talent_map: "✨ Карта талантов",
  current_role: "🧭 Текущая роль",
  vacancy_assessment: "📄 Вакансия",
};

// ---------------------------------------------------------------------------
// API helper
// ---------------------------------------------------------------------------

type BirthFormData = {
  birthDate: string;
  birthTime: string;
  birthCity: string;
  analysisType: AnalysisType;
  currentRoleDescription?: string;
  vacancyDescription?: string;
};

type TalentReportResponse = {
  report?: string;
  error?: string;
  source?: string;
};

async function generateTalentReport(formData: BirthFormData): Promise<string> {
  try {
    const response = await fetch("/.netlify/functions/talent-report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formData),
    });

    const data = (await response
      .json()
      .catch(() => null)) as TalentReportResponse | null;

    if (!response.ok) {
      if (data?.error) {
        if (data.source === "humandesign-api")
          return `Ошибка Human Design API: ${data.error}`;
        if (data.source === "validation") return data.error;
        if (data.source === "config") return `Настройка сервера: ${data.error}`;
        return data.error;
      }
      if (response.status === 404)
        return "Сервер функций недоступен. Перезапустите проект командой npm run dev.";
      return `Не удалось получить отчёт (код ${response.status}). Попробуйте позже.`;
    }

    if (!data?.report) return "Сервер вернул неожиданный ответ. Попробуйте позже.";
    return data.report;
  } catch {
    return "Ошибка сети. Проверьте подключение и убедитесь, что dev-сервер запущен (npm run dev).";
  }
}

// ---------------------------------------------------------------------------
// Cabinet types & config
// ---------------------------------------------------------------------------

type Tab = "overview" | "new-report" | "my-reports" | "data";

const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Обзор" },
  { id: "new-report", label: "Новый разбор" },
  { id: "my-reports", label: "Мои разборы" },
  { id: "data", label: "Данные" },
];

const OVERVIEW_CARDS: {
  icon: string;
  title: string;
  desc: string;
  analysisType: AnalysisType | null;
}[] = [
  {
    icon: "✨",
    title: "Карта талантов",
    desc: "Врождённые сильные стороны и природная стратегия",
    analysisType: "talent_map",
  },
  {
    icon: "🧭",
    title: "Текущая роль",
    desc: "Как ваша работа совпадает с вашим Human Design",
    analysisType: "current_role",
  },
  {
    icon: "📄",
    title: "Оценка вакансии",
    desc: "Подходит ли вакансия вашему дизайну",
    analysisType: "vacancy_assessment",
  },
  {
    icon: "📚",
    title: "Мои сохранённые разборы",
    desc: "Все ваши отчёты в одном месте",
    analysisType: null,
  },
];

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

type AuthUser = { id: string; email?: string };

export default function App() {
  // ---- Theme ----------------------------------------------------------------
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    const saved = localStorage.getItem("talentscan-theme");
    const initial: "dark" | "light" = saved === "light" ? "light" : "dark";
    document.documentElement.dataset.theme = initial;
    return initial;
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("talentscan-theme", theme);
  }, [theme]);

  // ---- Active tab -----------------------------------------------------------
  const [activeTab, setActiveTab] = useState<Tab>("overview");

  // ---- Auth state -----------------------------------------------------------
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(isSupabaseConfigured);
  const [authEmail, setAuthEmail] = useState("");
  const [authSending, setAuthSending] = useState(false);
  const [authMessage, setAuthMessage] = useState("");
  const [authError, setAuthError] = useState("");

  useEffect(() => {
    if (!supabase) return;

    supabase.auth.getSession().then(({ data: { session } }) => {
      setAuthUser(
        session?.user ? { id: session.user.id, email: session.user.email } : null,
      );
      setAuthLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthUser(
        session?.user ? { id: session.user.id, email: session.user.email } : null,
      );
      setAuthLoading(false);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  async function handleMagicLink(e: FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setAuthSending(true);
    setAuthError("");
    setAuthMessage("");

    const { error } = await supabase.auth.signInWithOtp({
      email: authEmail,
      options: { emailRedirectTo: window.location.origin },
    });
    setAuthSending(false);
    if (error) {
      setAuthError(`Ошибка входа: ${error.message}`);
    } else {
      setAuthMessage(`Ссылка для входа отправлена на ${authEmail}. Проверьте почту.`);
    }
  }

  async function handleSignOut() {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) setAuthError(`Ошибка выхода: ${error.message}`);
    else {
      setAuthEmail("");
      setAuthMessage("");
      setReports([]);
    }
  }

  // ---- Form state -----------------------------------------------------------
  const [who, setWho] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [birthTime, setBirthTime] = useState("");
  const [birthCity, setBirthCity] = useState("");
  const [analysisType, setAnalysisType] = useState<AnalysisType>("talent_map");
  const [currentRoleDescription, setCurrentRoleDescription] = useState("");
  const [vacancyDescription, setVacancyDescription] = useState("");
  const [validationError, setValidationError] = useState("");

  // ---- Result state ---------------------------------------------------------
  const [showResult, setShowResult] = useState(false);
  const [talentReport, setTalentReport] = useState("");
  const [resultHeading, setResultHeading] = useState(RESULT_HEADING["talent_map"]);
  const [resultBirthDate, setResultBirthDate] = useState("");
  const [resultBirthTime, setResultBirthTime] = useState("");
  const [resultBirthCity, setResultBirthCity] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [saveError, setSaveError] = useState("");

  // ---- Reports history ------------------------------------------------------
  const [reports, setReports] = useState<Report[]>([]);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [reportsError, setReportsError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadReports = useCallback(async () => {
    if (!supabase || !authUser) return;
    setReportsLoading(true);
    setReportsError("");

    const { data, error } = await supabase
      .from("reports")
      .select("*")
      .eq("user_id", authUser.id)
      .order("created_at", { ascending: false });

    setReportsLoading(false);
    if (error) {
      setReportsError(`Не удалось загрузить историю: ${error.message}`);
    } else {
      setReports((data as Report[]) ?? []);
    }
  }, [authUser]);

  useEffect(() => {
    if (authUser) loadReports();
    else setReports([]);
  }, [authUser, loadReports]);

  // ---- Validation -----------------------------------------------------------
  function validate(): boolean {
    if (analysisType === "current_role" && !currentRoleDescription.trim()) {
      setValidationError("Опишите вашу текущую роль, чтобы продолжить.");
      return false;
    }
    if (analysisType === "vacancy_assessment" && !vacancyDescription.trim()) {
      setValidationError("Вставьте описание вакансии, чтобы продолжить.");
      return false;
    }
    setValidationError("");
    return true;
  }

  // ---- Submit ---------------------------------------------------------------
  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setIsLoading(true);
    setShowResult(false);
    setSaveError("");
    setResultHeading(RESULT_HEADING[analysisType]);

    try {
      const report = await generateTalentReport({
        birthDate,
        birthTime,
        birthCity,
        analysisType,
        currentRoleDescription: currentRoleDescription.trim() || undefined,
        vacancyDescription: vacancyDescription.trim() || undefined,
      });

      setTalentReport(report);
      setResultBirthDate(birthDate);
      setResultBirthTime(birthTime);
      setResultBirthCity(birthCity);
      setShowResult(true);

      setTimeout(() => {
        document.getElementById("result")?.scrollIntoView({ behavior: "smooth" });
      }, 100);

      // Auto-save if logged in
      if (supabase && authUser) {
        const { error: saveErr } = await supabase.from("reports").insert({
          user_id: authUser.id,
          analysis_type: analysisType,
          person_name: null,
          birth_date: birthDate,
          birth_time: birthTime,
          birth_place: birthCity,
          current_role_description: currentRoleDescription.trim() || null,
          vacancy_description: vacancyDescription.trim() || null,
          result_text: report,
          input_data: {
            who,
            birthDate,
            birthTime,
            birthCity,
            analysisType,
            currentRoleDescription: currentRoleDescription.trim() || null,
            vacancyDescription: vacancyDescription.trim() || null,
          },
        });
        if (saveErr) {
          setSaveError(`Разбор сгенерирован, но не сохранился: ${saveErr.message}`);
        } else {
          loadReports();
        }
      }
    } finally {
      setIsLoading(false);
    }
  }

  // ---- History actions -------------------------------------------------------
  function openReport(r: Report) {
    setTalentReport(r.result_text);
    setResultHeading(RESULT_HEADING[r.analysis_type] ?? "Разбор");
    setResultBirthDate(r.birth_date);
    setResultBirthTime(r.birth_time);
    setResultBirthCity(r.birth_place);
    setShowResult(true);
    setActiveTab("new-report");
    setTimeout(() => {
      document.getElementById("result")?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  }

  async function deleteReport(id: string) {
    if (!supabase) return;
    setDeletingId(id);
    const { error } = await supabase.from("reports").delete().eq("id", id);
    setDeletingId(null);
    if (error) {
      setReportsError(`Не удалось удалить разбор: ${error.message}`);
    } else {
      setReports((prev) => prev.filter((r) => r.id !== id));
    }
  }

  // ---- Navigate to new report with preset analysis type ----------------------
  function goToNewReport(type: AnalysisType) {
    setAnalysisType(type);
    setValidationError("");
    setActiveTab("new-report");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // ---- Render ---------------------------------------------------------------
  return (
    <div className="app">
      {/* ===== Header ===== */}
      <header className="header">
        <div className="logo">TalentScan</div>
        <button
          className="theme-toggle"
          onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
          aria-label={
            theme === "dark"
              ? "Переключить на светлую тему"
              : "Переключить на тёмную тему"
          }
        >
          {theme === "dark" ? "☀️" : "🌙"}
        </button>
      </header>

      {/* ===== Account bar ===== */}
      <div className="account-bar">
        {!isSupabaseConfigured ? (
          <p className="account-notice">Сохранение разборов временно недоступно.</p>
        ) : authLoading ? (
          <p className="account-notice account-notice--muted">Загрузка…</p>
        ) : authUser ? (
          <div className="account-logged-in">
            <span className="account-email">{authUser.email}</span>
            <button
              className="account-btn account-btn--secondary"
              onClick={handleSignOut}
            >
              Выйти
            </button>
          </div>
        ) : (
          <form className="account-login-form" onSubmit={handleMagicLink}>
            <input
              className="account-email-input"
              type="email"
              placeholder="your@email.com"
              value={authEmail}
              onChange={(e) => {
                setAuthEmail(e.target.value);
                setAuthError("");
                setAuthMessage("");
              }}
              required
              aria-label="Email для входа"
            />
            <button
              className="account-btn account-btn--primary"
              type="submit"
              disabled={authSending}
            >
              {authSending ? "Отправляем…" : "Войти, чтобы сохранять разборы"}
            </button>
            {authMessage && <p className="account-message">{authMessage}</p>}
            {authError && (
              <p className="account-error" role="alert">
                {authError}
              </p>
            )}
          </form>
        )}
      </div>

      {/* ===== Cabinet navigation ===== */}
      <nav className="cabinet-nav" aria-label="Навигация кабинета">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={`cabinet-tab${activeTab === tab.id ? " cabinet-tab--active" : ""}`}
            onClick={() => setActiveTab(tab.id)}
            aria-current={activeTab === tab.id ? "page" : undefined}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {/* ===== Main content ===== */}
      <main className="cabinet-content">

        {/* ──────────────────────────────────────
            Tab: Обзор
        ────────────────────────────────────── */}
        {activeTab === "overview" && (
          <div className="tab-screen">
            <div className="overview-header">
              <h1 className="overview-title">Кабинет соискателя</h1>
              <p className="overview-subtitle">
                Human Design для карьеры — выберите тип анализа
              </p>
            </div>
            <div className="overview-grid">
              {OVERVIEW_CARDS.map((card) => (
                <button
                  key={card.title}
                  className="overview-card"
                  onClick={() =>
                    card.analysisType
                      ? goToNewReport(card.analysisType)
                      : setActiveTab("my-reports")
                  }
                >
                  <span className="overview-card-icon" aria-hidden="true">
                    {card.icon}
                  </span>
                  <span className="overview-card-title">{card.title}</span>
                  <span className="overview-card-desc">{card.desc}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ──────────────────────────────────────
            Tab: Новый разбор
        ────────────────────────────────────── */}
        {activeTab === "new-report" && (
          <div className="tab-screen">
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

              <div className="field">
                <span className="field-label">Тип анализа</span>
                <div
                  className="analysis-type-grid"
                  role="group"
                  aria-label="Тип анализа"
                >
                  {ANALYSIS_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      className={`analysis-type-card${
                        analysisType === opt.id ? " analysis-type-card--active" : ""
                      }`}
                      onClick={() => {
                        setAnalysisType(opt.id);
                        setValidationError("");
                      }}
                      aria-pressed={analysisType === opt.id}
                    >
                      <span className="analysis-type-icon" aria-hidden="true">
                        {opt.icon}
                      </span>
                      <span className="analysis-type-label">{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {analysisType === "current_role" && (
                <div className="field">
                  <label htmlFor="current-role-desc">
                    Опишите вашу текущую роль
                  </label>
                  <textarea
                    id="current-role-desc"
                    className="field-textarea"
                    rows={4}
                    placeholder="Например: я работаю администратором в котокафе, общаюсь с гостями, слежу за порядком, решаю конфликты…"
                    value={currentRoleDescription}
                    onChange={(e) => {
                      setCurrentRoleDescription(e.target.value);
                      if (e.target.value.trim()) setValidationError("");
                    }}
                  />
                </div>
              )}

              {analysisType === "vacancy_assessment" && (
                <div className="field">
                  <label htmlFor="vacancy-desc">
                    Вставьте описание вакансии
                  </label>
                  <textarea
                    id="vacancy-desc"
                    className="field-textarea"
                    rows={5}
                    placeholder="Вставьте сюда текст вакансии, обязанности, условия, требования…"
                    value={vacancyDescription}
                    onChange={(e) => {
                      setVacancyDescription(e.target.value);
                      if (e.target.value.trim()) setValidationError("");
                    }}
                  />
                </div>
              )}

              {validationError && (
                <p className="form-validation-error" role="alert">
                  {validationError}
                </p>
              )}

              <button type="submit" className="submit-btn" disabled={isLoading}>
                {isLoading ? "Формируем отчёт…" : "Рассчитать рейв‑карту"}
              </button>
            </form>

            {/* Result card */}
            {showResult && (
              <section className="result" id="result" aria-live="polite">
                <h2 className="result-heading">{resultHeading}</h2>

                {(resultBirthDate || resultBirthTime || resultBirthCity) && (
                  <div className="report-badges">
                    {resultBirthDate && (
                      <span className="report-badge">{resultBirthDate}</span>
                    )}
                    {resultBirthTime && (
                      <span className="report-badge">{resultBirthTime}</span>
                    )}
                    {resultBirthCity && (
                      <span className="report-badge">{resultBirthCity}</span>
                    )}
                  </div>
                )}

                {saveError && (
                  <p
                    className="account-error"
                    role="alert"
                    style={{ marginBottom: "1rem" }}
                  >
                    {saveError}
                  </p>
                )}

                {talentReport ? (
                  <div className="report-sections">
                    {parseReportSections(talentReport).map((section, i) => (
                      <div
                        key={i}
                        className={`report-section${
                          section.title ? "" : " report-section--plain"
                        }`}
                      >
                        {section.title && (
                          <div className="report-section-title">
                            {section.title}
                          </div>
                        )}
                        <div className="report-section-body">
                          {renderSectionBody(section.body)}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="report-empty">
                    Результат пуст. Попробуйте ещё раз.
                  </p>
                )}
              </section>
            )}
          </div>
        )}

        {/* ──────────────────────────────────────
            Tab: Мои разборы
        ────────────────────────────────────── */}
        {activeTab === "my-reports" && (
          <div className="tab-screen">
            <section className="history-section">
              <h2 className="history-heading">Мои разборы</h2>

              {!isSupabaseConfigured || !authUser ? (
                <p className="history-hint">
                  Войдите по email, чтобы сохранять историю разборов.
                </p>
              ) : reportsLoading ? (
                <p className="history-hint">Загружаем историю…</p>
              ) : reportsError ? (
                <p className="account-error" role="alert">
                  {reportsError}
                </p>
              ) : reports.length === 0 ? (
                <p className="history-hint">
                  Разборов пока нет. Сделайте первый расчёт!
                </p>
              ) : (
                <ul className="history-list">
                  {reports.map((r) => (
                    <li key={r.id} className="history-item">
                      <div className="history-item-meta">
                        <span className="history-item-type">
                          {ANALYSIS_TYPE_LABEL[r.analysis_type]}
                        </span>
                        <span className="history-item-details">
                          {r.birth_place && <span>{r.birth_place}</span>}
                          {r.birth_date && <span>{r.birth_date}</span>}
                        </span>
                        <span className="history-item-date">
                          {new Date(r.created_at).toLocaleString("ru-RU", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      <div className="history-item-actions">
                        <button
                          className="history-btn history-btn--open"
                          onClick={() => openReport(r)}
                        >
                          Открыть
                        </button>
                        <button
                          className="history-btn history-btn--delete"
                          onClick={() => deleteReport(r.id)}
                          disabled={deletingId === r.id}
                        >
                          {deletingId === r.id ? "…" : "Удалить"}
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}

        {/* ──────────────────────────────────────
            Tab: Данные
        ────────────────────────────────────── */}
        {activeTab === "data" && (
          <div className="tab-screen">
            <div className="data-screen">
              <h2 className="data-heading">Мои данные</h2>
              <p className="data-hint">
                Профиль соискателя — в разработке. Данные пока не сохраняются.
              </p>
              <div className="data-fields-grid">
                <div className="field">
                  <label htmlFor="data-birth-date">Дата рождения</label>
                  <input
                    id="data-birth-date"
                    type="date"
                    defaultValue=""
                    disabled
                  />
                </div>
                <div className="field">
                  <label htmlFor="data-birth-time">Время рождения</label>
                  <input
                    id="data-birth-time"
                    type="time"
                    defaultValue=""
                    disabled
                  />
                </div>
                <div className="field">
                  <label htmlFor="data-birth-city">Город рождения</label>
                  <input
                    id="data-birth-city"
                    type="text"
                    placeholder="—"
                    disabled
                  />
                </div>
                <div className="field">
                  <label htmlFor="data-user-type">Тип пользователя</label>
                  <select id="data-user-type" disabled>
                    <option value="">—</option>
                    <option value="specialist">Специалист</option>
                    <option value="manager">Руководитель</option>
                    <option value="founder">Предприниматель</option>
                    <option value="student">Студент / в поиске</option>
                  </select>
                </div>
              </div>
              <p className="data-coming-soon">
                🚧 Сохранение данных профиля будет доступно в следующей версии
              </p>
            </div>
          </div>
        )}
      </main>

      <footer className="footer">
        © {new Date().getFullYear()} TalentScan. Human Design для карьеры.
      </footer>
    </div>
  );
}
