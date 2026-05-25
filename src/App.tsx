import { FormEvent, useCallback, useEffect, useRef, useState, type JSX } from "react";
import "./App.css";
import {
  supabase,
  isSupabaseConfigured,
  type AnalysisType,
  type Report,
} from "./lib/supabase";
import type { HdChartRecord as BgHdChartRecord } from "./components/BodyGraphViewer";
import MyMapScreen from "./components/MyMapScreen";
import TodayScreen from "./components/TodayScreen";

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------

async function getAccessToken(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

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
// Types
// ---------------------------------------------------------------------------

type Tab =
  | "overview"
  | "career-map"
  | "roles-vacancies"
  | "ai-assistant"
  | "new-report"
  | "my-reports"
  | "data";

type UserProfile = {
  displayName: string;
  birthDate: string;
  birthTime: string;
  birthPlace: string;
  birthTimeAccuracy: string;
  // Geocoded birth place (coordinates)
  birthPlaceInput: string;
  birthPlaceLabel: string;
  birthLatitude: number | null;
  birthLongitude: number | null;
  birthPlaceSource: string;
  currentCity: string;
  currentRoleTitle: string;
  currentCompanyOrSphere: string;
  workFormat: string;
  schedule: string;
  currentTasks: string;
  likesAtWork: string;
  drainsAtWork: string;
  experience: string;
  skills: string;
  education: string;
  languages: string;
  portfolioLinks: string;
  resumeText: string;
  desiredRoles: string;
  desiredWorkFormat: string;
  salaryExpectations: string;
  careerGoals: string;
  preferredManagerStyle: string;
  workRestrictions: string;
  redFlags: string;
  vacancyNotes: string;
};

const EMPTY_PROFILE: UserProfile = {
  displayName: "",
  birthDate: "",
  birthTime: "",
  birthPlace: "",
  birthTimeAccuracy: "",
  birthPlaceInput: "",
  birthPlaceLabel: "",
  birthLatitude: null,
  birthLongitude: null,
  birthPlaceSource: "",
  currentCity: "",
  currentRoleTitle: "",
  currentCompanyOrSphere: "",
  workFormat: "",
  schedule: "",
  currentTasks: "",
  likesAtWork: "",
  drainsAtWork: "",
  experience: "",
  skills: "",
  education: "",
  languages: "",
  portfolioLinks: "",
  resumeText: "",
  desiredRoles: "",
  desiredWorkFormat: "",
  salaryExpectations: "",
  careerGoals: "",
  preferredManagerStyle: "",
  workRestrictions: "",
  redFlags: "",
  vacancyNotes: "",
};

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

const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Сегодня" },
  { id: "career-map", label: "Моя карта" },
  { id: "roles-vacancies", label: "Роли и вакансии" },
  { id: "ai-assistant", label: "ИИ-помощник" },
  { id: "new-report", label: "Новый разбор" },
  { id: "my-reports", label: "Мои разборы" },
  { id: "data", label: "Данные" },
];

// ---------------------------------------------------------------------------
// Cabinet config
// ---------------------------------------------------------------------------

const ROLES_SECTIONS: {
  icon: string;
  title: string;
  desc: string;
  action?: { label: string; type: AnalysisType };
  comingSoon?: boolean;
}[] = [
  {
    icon: "🧭",
    title: "Текущая роль",
    desc: "Как ваша нынешняя работа совпадает с вашим дизайном",
    action: { label: "Анализировать", type: "current_role" },
  },
  {
    icon: "📄",
    title: "Оценка вакансии",
    desc: "Вставьте описание — получите разбор совместимости",
    action: { label: "Оценить", type: "vacancy_assessment" },
  },
  {
    icon: "⚖️",
    title: "Сравнение вариантов",
    desc: "Сравните несколько вакансий по критериям дизайна",
    comingSoon: true,
  },
  {
    icon: "❓",
    title: "Вопросы к работодателю",
    desc: "Персональные вопросы для интервью по вашему Human Design",
    comingSoon: true,
  },
];

// ---------------------------------------------------------------------------
// Geocode + HD chart types
// ---------------------------------------------------------------------------

type GeocodeSuggestion = {
  id: string;
  label: string;
  city: string;
  region: string;
  country: string;
  lat: number;
  lng: number;
  source: "nominatim";
};

// Re-use the full HdChartRecord from BodyGraphViewer (includes normalized_chart_json etc.)
type HdChartRecord = BgHdChartRecord;

type HdChartStatus = "none" | "ok" | "outdated" | "no_coords" | "error";

// ---------------------------------------------------------------------------
// Transit Debug types (temporary QA tool)
// ---------------------------------------------------------------------------

type TransitDebugResult = {
  diagnosticsSummary: {
    currentMomentLikelyAccurate: boolean;
    reason: string;
  };
  debug: {
    timeDiagnostics: {
      nowUtcIso: string;
      inputDate: string;
      inputTime: string;
      inputTimeBasis: string;
      coordinatesPurpose: string;
      resolvedTimezone: string | null;
      coordinatesSource: string;
      lat: number;
      lng: number;
      apiReturnedBirthDateUtc: string | null;
      differenceMinutesBetweenNowUtcAndApiBirthDateUtc: number | null;
      possibleTimezoneShiftDetected: boolean;
    };
  };
  currentMoment: {
    type?: string;
    profile?: string;
    authority?: string;
    strategy?: string;
    gatesAll: string[];
    channelsShort: string[];
    definedCenters: string[];
    activations?: Record<string, unknown>;
  };
  overlay: {
    addedGates: string[];
    addedChannels: string[];
    addedDefinedCenters: string[];
    sharedGates: string[];
    sharedChannels: string[];
    sharedDefinedCenters: string[];
  };
};

type TransitDebugError = { status: number; message: string; source?: string };

function getHdChartStatus(
  chart: HdChartRecord | null,
  profile: UserProfile,
): HdChartStatus {
  if (!chart) return "none";
  if (chart.calculation_status === "error") return "error";
  const coordsOk = !!profile.birthPlaceLabel && profile.birthLatitude !== null;
  if (!coordsOk) return "no_coords";
  const dateChanged = chart.birth_date !== profile.birthDate;
  const timeChanged = chart.birth_time !== profile.birthTime;
  const accChanged = (chart.birth_time_accuracy ?? "") !== profile.birthTimeAccuracy;
  const labelChanged =
    chart.birth_place_label.trim().toLowerCase() !==
    profile.birthPlaceLabel.trim().toLowerCase();
  const latChanged =
    profile.birthLatitude !== null &&
    Math.abs(chart.birth_latitude - profile.birthLatitude) > 0.0001;
  const lngChanged =
    profile.birthLongitude !== null &&
    Math.abs(chart.birth_longitude - profile.birthLongitude) > 0.0001;
  if (dateChanged || timeChanged || accChanged || labelChanged || latChanged || lngChanged) {
    return "outdated";
  }
  return "ok";
}

async function searchBirthCities(q: string, token: string): Promise<GeocodeSuggestion[]> {
  if (q.length < 2) return [];
  try {
    const resp = await fetch(
      `/.netlify/functions/geocode-city?q=${encodeURIComponent(q)}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!resp.ok) return [];
    const data = (await resp.json()) as { suggestions?: GeocodeSuggestion[] };
    return data.suggestions ?? [];
  } catch {
    return [];
  }
}

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
  const token = await getAccessToken();
  if (!token) {
    return "AUTH_ERROR:Войдите в кабинет, чтобы запустить разбор.";
  }

  try {
    const response = await fetch("/.netlify/functions/talent-report", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(formData),
    });

    const data = (await response
      .json()
      .catch(() => null)) as TalentReportResponse | null;

    if (!response.ok) {
      if (response.status === 401 || data?.source === "auth") {
        return "AUTH_ERROR:Сессия истекла. Войдите заново.";
      }
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
// Profile completeness helper — weighted scoring
// ---------------------------------------------------------------------------

/** Binary: full weight if non-empty, 0 otherwise. */
function bin(value: string, weight: number): number {
  return value.trim() ? weight : 0;
}

/**
 * Graduated text score: rewards length/detail.
 * empty → 0 · <20 chars → 30% · 20–79 chars → 70% · 80+ chars → 100%
 */
function txt(value: string, weight: number): number {
  const len = value.trim().length;
  if (len === 0) return 0;
  if (len < 20) return weight * 0.3;
  if (len < 80) return weight * 0.7;
  return weight;
}

function getProfileCompleteness(profile: UserProfile): {
  percent: number;
  label: string;
} {
  let score = 0;

  // Group A — Личные данные (max 10 %)
  score += bin(profile.displayName, 5);
  score += bin(profile.currentCity, 5);

  // Group B — Данные рождения (max 20 %)
  score += bin(profile.birthDate, 5);
  score += bin(profile.birthTime, 5);
  score += bin(profile.birthPlace, 5);
  score += bin(profile.birthTimeAccuracy, 5);

  // Group C — Текущая роль (max 20 %)
  score += bin(profile.currentRoleTitle, 4);
  score += bin(profile.currentCompanyOrSphere, 3);
  score += bin(profile.workFormat, 3);
  score += bin(profile.schedule, 2);
  score += txt(profile.currentTasks, 4);
  score += txt(profile.likesAtWork, 2);
  score += txt(profile.drainsAtWork, 2);

  // Group D — Опыт и навыки (max 20 %)
  score += txt(profile.experience, 5);
  score += txt(profile.skills, 6);
  score += bin(profile.education, 3);
  score += bin(profile.languages, 2);
  score += bin(profile.portfolioLinks, 2);
  score += txt(profile.resumeText, 2);

  // Group E — Цели и желаемые роли (max 20 %)
  score += txt(profile.desiredRoles, 6);
  score += bin(profile.desiredWorkFormat, 4);
  score += bin(profile.salaryExpectations, 2);
  score += txt(profile.careerGoals, 6);
  score += txt(profile.vacancyNotes, 2);

  // Group F — Рабочая среда (max 10 %)
  score += txt(profile.preferredManagerStyle, 3);
  score += txt(profile.workRestrictions, 3);
  score += txt(profile.redFlags, 4);

  const percent = Math.round(score);

  let label: string;
  if (percent <= 15) label = "Профиль почти пустой";
  else if (percent <= 35) label = "Есть базовые данные";
  else if (percent <= 60) label = "Профиль частично заполнен";
  else if (percent <= 80) label = "Профиль достаточно точный";
  else label = "Профиль хорошо заполнен";

  return { percent, label };
}

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
  const [authPassword, setAuthPassword] = useState("");
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
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

  async function handleEmailAuth(e: FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setAuthSending(true);
    setAuthError("");
    setAuthMessage("");

    if (authMode === "register") {
      const { error } = await supabase.auth.signUp({
        email: authEmail,
        password: authPassword,
      });
      setAuthSending(false);
      if (error) {
        if (error.message.includes("already registered") || error.message.includes("already exists")) {
          setAuthError("Аккаунт с таким email уже существует. Войдите.");
        } else if (error.message.includes("password")) {
          setAuthError("Пароль слишком короткий. Минимум 6 символов.");
        } else {
          setAuthError(`Ошибка регистрации: ${error.message}`);
        }
      } else {
        setAuthMessage("Аккаунт создан. Проверьте почту для подтверждения или войдите.");
        setAuthMode("login");
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email: authEmail,
        password: authPassword,
      });
      setAuthSending(false);
      if (error) {
        if (error.message.includes("Invalid login credentials") || error.message.includes("invalid")) {
          setAuthError("Неверный email или пароль. Попробуйте ещё раз.");
        } else if (error.message.includes("Email not confirmed")) {
          setAuthError("Email не подтверждён. Проверьте почту и перейдите по ссылке.");
        } else {
          setAuthError(`Ошибка входа: ${error.message}`);
        }
      }
    }
  }

  async function handleSignOut() {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) {
      setAuthError(`Ошибка выхода: ${error.message}`);
    } else {
      setAuthEmail("");
      setAuthPassword("");
      setAuthMessage("");
      setReports([]);
      setUserProfile(EMPTY_PROFILE);
      setProfileInitialLoaded(false);
      setHdChart(null);
      setHdChartError("");
      setBirthSuggestions([]);
      setBirthSuggestionsOpen(false);
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

  // ---- User profile ---------------------------------------------------------
  const [userProfile, setUserProfile] = useState<UserProfile>(EMPTY_PROFILE);
  // profileLoading = true during any fetch (initial or background refresh).
  // profileInitialLoaded = true once the first fetch completes successfully.
  // The "Данные" tab shows the spinner only on the very first load;
  // subsequent background refreshes (e.g. on token refresh / tab focus) keep
  // the form visible and show only a subtle "Синхронизация…" badge.
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileInitialLoaded, setProfileInitialLoaded] = useState(false);
  const [profileSaveStatus, setProfileSaveStatus] = useState<
    "idle" | "saving" | "success" | "error"
  >("idle");
  const [profileSaveError, setProfileSaveError] = useState("");

  // ---- HD chart -------------------------------------------------------------
  const [hdChart, setHdChart] = useState<HdChartRecord | null>(null);
  const [hdChartLoading, setHdChartLoading] = useState(false);
  const [hdChartCalculating, setHdChartCalculating] = useState(false);
  const [hdChartError, setHdChartError] = useState("");

  // ---- Transit debug (temporary QA) ----------------------------------------
  const [transitDebugLoading, setTransitDebugLoading] = useState(false);
  const [transitDebugResult, setTransitDebugResult] = useState<TransitDebugResult | null>(null);
  const [transitDebugError, setTransitDebugError] = useState<TransitDebugError | null>(null);
  const [transitCopyStatus, setTransitCopyStatus] = useState<"idle" | "copied">("idle");

  // ---- Birth city autocomplete (Данные tab) ---------------------------------
  const [birthSuggestions, setBirthSuggestions] = useState<GeocodeSuggestion[]>([]);
  const [birthSuggestionsOpen, setBirthSuggestionsOpen] = useState(false);
  const [birthSuggestionsLoading, setBirthSuggestionsLoading] = useState(false);
  const birthSuggestTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---- Load reports ---------------------------------------------------------
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

  // ---- Load profile ---------------------------------------------------------
  const loadProfile = useCallback(async () => {
    if (!supabase || !authUser) return;
    setProfileLoading(true);
    try {
      const { data, error } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("user_id", authUser.id)
        .maybeSingle();

      if (error) {
        console.warn("[TalentScan] Не удалось загрузить профиль:", error.message);
        return;
      }

      if (data) {
        const pd = (data.profile_data as Record<string, string>) ?? {};
        const rawLat = data.birth_latitude as number | null | undefined;
        const rawLng = data.birth_longitude as number | null | undefined;
        const storedLabel = (data.birth_place_label as string) ?? "";
        setUserProfile({
          displayName: (data.display_name as string) ?? "",
          birthDate: (data.birth_date as string) ?? "",
          birthTime: (data.birth_time as string) ?? "",
          birthPlace: (data.birth_place as string) ?? "",
          birthTimeAccuracy: (data.birth_time_accuracy as string) ?? "",
          birthPlaceInput:
            (data.birth_place_input as string) ?? storedLabel ?? (data.birth_place as string) ?? "",
          birthPlaceLabel: storedLabel,
          birthLatitude: typeof rawLat === "number" ? rawLat : null,
          birthLongitude: typeof rawLng === "number" ? rawLng : null,
          birthPlaceSource: (data.birth_place_source as string) ?? "",
          currentCity: pd.currentCity ?? "",
          currentRoleTitle: pd.currentRoleTitle ?? "",
          currentCompanyOrSphere: pd.currentCompanyOrSphere ?? "",
          workFormat: pd.workFormat ?? "",
          schedule: pd.schedule ?? "",
          currentTasks: pd.currentTasks ?? "",
          likesAtWork: pd.likesAtWork ?? "",
          drainsAtWork: pd.drainsAtWork ?? "",
          experience: pd.experience ?? "",
          skills: pd.skills ?? "",
          education: pd.education ?? "",
          languages: pd.languages ?? "",
          portfolioLinks: pd.portfolioLinks ?? "",
          resumeText: pd.resumeText ?? "",
          desiredRoles: pd.desiredRoles ?? "",
          desiredWorkFormat: pd.desiredWorkFormat ?? "",
          salaryExpectations: pd.salaryExpectations ?? "",
          careerGoals: pd.careerGoals ?? "",
          preferredManagerStyle: pd.preferredManagerStyle ?? "",
          workRestrictions: pd.workRestrictions ?? "",
          redFlags: pd.redFlags ?? "",
          vacancyNotes: pd.vacancyNotes ?? "",
        });
      }
    } catch (e) {
      console.warn("[TalentScan] Ошибка загрузки профиля:", e);
    } finally {
      setProfileLoading(false);
      setProfileInitialLoaded(true);
    }
  }, [authUser]);

  // ---- Load active HD chart -------------------------------------------------
  const loadHdChart = useCallback(async () => {
    if (!supabase || !authUser) return;
    setHdChartLoading(true);
    try {
      const { data, error } = await supabase
        .from("hd_charts")
        .select("*")
        .eq("user_id", authUser.id)
        .eq("is_active", true)
        .maybeSingle();
      if (error) {
        console.warn("[TalentScan] Не удалось загрузить HD карту:", error.message);
      } else {
        setHdChart((data as HdChartRecord) ?? null);
      }
    } catch (e) {
      console.warn("[TalentScan] Ошибка загрузки HD карты:", e);
    } finally {
      setHdChartLoading(false);
    }
  }, [authUser]);

  useEffect(() => {
    if (authUser) {
      loadReports();
      loadProfile();
      loadHdChart();
    } else {
      setReports([]);
      setUserProfile(EMPTY_PROFILE);
      setProfileInitialLoaded(false);
      setHdChart(null);
      setHdChartError("");
    }
  }, [authUser, loadReports, loadProfile, loadHdChart]);

  // Pre-fill birth fields in New Report form from profile (if form fields are empty)
  useEffect(() => {
    if (activeTab !== "new-report") return;
    if (!birthDate && userProfile.birthDate) setBirthDate(userProfile.birthDate);
    if (!birthTime && userProfile.birthTime) setBirthTime(userProfile.birthTime);
    const preferredCity = userProfile.birthPlaceLabel || userProfile.birthPlace;
    if (!birthCity && preferredCity) setBirthCity(preferredCity);
  // Only run when switching to the tab or when profile birth data loads
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, userProfile.birthDate, userProfile.birthTime, userProfile.birthPlace, userProfile.birthPlaceLabel]);

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

      if (report.startsWith("AUTH_ERROR:")) {
        setSaveError(report.slice("AUTH_ERROR:".length));
        setIsLoading(false);
        return;
      }

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

  // ---- Navigate helpers ------------------------------------------------------
  function goToNewReport(type: AnalysisType) {
    setAnalysisType(type);
    setValidationError("");
    setActiveTab("new-report");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // ---- Profile save ----------------------------------------------------------
  async function saveProfile() {
    if (!supabase || !authUser) return;
    setProfileSaveStatus("saving");
    setProfileSaveError("");

    try {
      const profileData: Record<string, string> = {
        currentCity: userProfile.currentCity,
        currentRoleTitle: userProfile.currentRoleTitle,
        currentCompanyOrSphere: userProfile.currentCompanyOrSphere,
        workFormat: userProfile.workFormat,
        schedule: userProfile.schedule,
        currentTasks: userProfile.currentTasks,
        likesAtWork: userProfile.likesAtWork,
        drainsAtWork: userProfile.drainsAtWork,
        experience: userProfile.experience,
        skills: userProfile.skills,
        education: userProfile.education,
        languages: userProfile.languages,
        portfolioLinks: userProfile.portfolioLinks,
        resumeText: userProfile.resumeText,
        desiredRoles: userProfile.desiredRoles,
        desiredWorkFormat: userProfile.desiredWorkFormat,
        salaryExpectations: userProfile.salaryExpectations,
        careerGoals: userProfile.careerGoals,
        preferredManagerStyle: userProfile.preferredManagerStyle,
        workRestrictions: userProfile.workRestrictions,
        redFlags: userProfile.redFlags,
        vacancyNotes: userProfile.vacancyNotes,
      };

      const { error } = await supabase.from("user_profiles").upsert(
        {
          user_id: authUser.id,
          display_name: userProfile.displayName || null,
          birth_date: userProfile.birthDate || null,
          birth_time: userProfile.birthTime || null,
          birth_place: userProfile.birthPlace || null,
          birth_time_accuracy: userProfile.birthTimeAccuracy || null,
          birth_place_input: userProfile.birthPlaceInput || null,
          birth_place_label: userProfile.birthPlaceLabel || null,
          birth_latitude: userProfile.birthLatitude,
          birth_longitude: userProfile.birthLongitude,
          birth_place_source: userProfile.birthPlaceSource || null,
          profile_data: profileData,
        },
        { onConflict: "user_id" },
      );

      if (error) {
        setProfileSaveStatus("error");
        setProfileSaveError(`Не удалось сохранить профиль: ${error.message}`);
      } else {
        setProfileSaveStatus("success");
        setTimeout(() => setProfileSaveStatus("idle"), 3500);
      }
    } catch {
      setProfileSaveStatus("error");
      setProfileSaveError("Ошибка при сохранении профиля.");
    }
  }

  // ---- Profile field helper --------------------------------------------------
  function setProfileField(field: keyof UserProfile, value: string) {
    setUserProfile((prev) => ({ ...prev, [field]: value }));
  }

  // ---- Calculate / recalculate HD chart ------------------------------------
  async function calculateHdChart() {
    if (!authUser) return;
    setHdChartCalculating(true);
    setHdChartError("");
    try {
      const token = await getAccessToken();
      if (!token) {
        setHdChartError("Сессия истекла. Войдите заново.");
        return;
      }
      const resp = await fetch("/.netlify/functions/hd-chart-calculate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({}),
      });
      const data = (await resp.json().catch(() => null)) as {
        chart?: HdChartRecord;
        error?: string;
        source?: string;
      } | null;
      if (!resp.ok) {
        const msg = data?.error ?? `Ошибка сервера (${resp.status})`;
        setHdChartError(msg);
        return;
      }
      if (data?.chart) {
        setHdChart(data.chart as HdChartRecord);
      }
    } catch {
      setHdChartError("Ошибка сети. Попробуйте позже.");
    } finally {
      setHdChartCalculating(false);
    }
  }

  // ---- Transit debug (temporary QA tool) ------------------------------------
  async function checkTransitDebug() {
    const token = await getAccessToken();
    if (!token) {
      setTransitDebugError({ status: 401, message: "Сессия истекла. Войдите заново." });
      return;
    }
    setTransitDebugLoading(true);
    setTransitDebugResult(null);
    setTransitDebugError(null);
    try {
      const resp = await fetch("/.netlify/functions/hd-transit-debug", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({}),
      });
      const data = (await resp.json().catch(() => null)) as TransitDebugResult & {
        error?: string;
        source?: string;
      } | null;
      if (!resp.ok) {
        setTransitDebugError({
          status: resp.status,
          message: data?.error ?? `Ошибка сервера (${resp.status})`,
          source: data?.source,
        });
      } else {
        setTransitDebugResult(data as TransitDebugResult);
      }
    } catch {
      setTransitDebugError({ status: 0, message: "Ошибка сети. Проверьте подключение." });
    } finally {
      setTransitDebugLoading(false);
    }
  }

  async function copyTransitDebugForChatGPT() {
    if (!transitDebugResult) return;
    const { diagnosticsSummary, debug, currentMoment, overlay } = transitDebugResult;
    const payload = {
      diagnosticsSummary,
      timeDiagnostics: debug.timeDiagnostics,
      currentMomentSummary: {
        type: currentMoment.type,
        profile: currentMoment.profile,
        authority: currentMoment.authority,
        strategy: currentMoment.strategy,
        gatesCount: currentMoment.gatesAll.length,
        channelsCount: currentMoment.channelsShort.length,
        definedCentersCount: currentMoment.definedCenters.length,
        hasActivations:
          !!currentMoment.activations &&
          Object.keys(currentMoment.activations).length > 0,
      },
      overlaySummary: {
        addedGatesCount: overlay.addedGates.length,
        addedChannelsCount: overlay.addedChannels.length,
        addedDefinedCentersCount: overlay.addedDefinedCenters.length,
        addedGates: overlay.addedGates,
        addedChannels: overlay.addedChannels,
        addedDefinedCenters: overlay.addedDefinedCenters,
      },
    };
    try {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      setTransitCopyStatus("copied");
      setTimeout(() => setTransitCopyStatus("idle"), 2500);
    } catch {
      setTransitCopyStatus("idle");
    }
  }

  // ---- Birth city autocomplete handlers (Данные tab) -----------------------
  function handleBirthPlaceInput(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    // Invalidate confirmed coords when user edits the text
    setUserProfile((prev) => ({
      ...prev,
      birthPlaceInput: val,
      birthPlaceLabel: "",
      birthLatitude: null,
      birthLongitude: null,
      birthPlaceSource: "",
    }));
    setBirthSuggestionsOpen(false);
    setBirthSuggestions([]);

    if (birthSuggestTimerRef.current) clearTimeout(birthSuggestTimerRef.current);
    if (val.trim().length < 2) return;

    birthSuggestTimerRef.current = setTimeout(async () => {
      setBirthSuggestionsLoading(true);
      const token = await getAccessToken();
      if (!token) { setBirthSuggestionsLoading(false); return; }
      const results = await searchBirthCities(val.trim(), token);
      setBirthSuggestions(results);
      setBirthSuggestionsOpen(results.length > 0);
      setBirthSuggestionsLoading(false);
    }, 400);
  }

  function handleBirthPlaceSelect(suggestion: GeocodeSuggestion) {
    setUserProfile((prev) => ({
      ...prev,
      birthPlaceInput: suggestion.label,
      birthPlaceLabel: suggestion.label,
      birthLatitude: suggestion.lat,
      birthLongitude: suggestion.lng,
      birthPlaceSource: suggestion.source,
      // keep birth_place in sync for legacy report pre-fill
      birthPlace: suggestion.city || suggestion.label,
    }));
    setBirthSuggestions([]);
    setBirthSuggestionsOpen(false);
  }

  // ---- Profile completeness --------------------------------------------------
  const completeness = getProfileCompleteness(userProfile);

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

      {/* ===== Auth gate: show login screen when not authenticated ===== */}
      {!authLoading && !authUser && (
        <main className="auth-gate">
          <div className="auth-gate-card">
            <div className="auth-gate-logo">TalentScan</div>
            <h1 className="auth-gate-title">
              TalentScan — личный кабинет соискателя
            </h1>
            <p className="auth-gate-subtitle">
              Войдите, чтобы получить доступ к карьерной карте, оценке ролей,
              вакансиям и сохранённым разборам.
            </p>

            {!isSupabaseConfigured ? (
              <p className="auth-gate-unavailable">
                Авторизация временно недоступна: Supabase не настроен.
              </p>
            ) : (
              <>
                <form className="auth-gate-form" onSubmit={handleEmailAuth}>
                  <div className="auth-gate-field">
                    <label htmlFor="gate-email" className="auth-gate-label">
                      Email
                    </label>
                    <input
                      id="gate-email"
                      className="auth-gate-input"
                      type="email"
                      placeholder="you@example.com"
                      value={authEmail}
                      onChange={(e) => {
                        setAuthEmail(e.target.value);
                        setAuthError("");
                        setAuthMessage("");
                      }}
                      required
                      autoComplete="email"
                    />
                  </div>
                  <div className="auth-gate-field">
                    <label htmlFor="gate-password" className="auth-gate-label">
                      Пароль
                    </label>
                    <input
                      id="gate-password"
                      className="auth-gate-input"
                      type="password"
                      placeholder="••••••••"
                      value={authPassword}
                      onChange={(e) => {
                        setAuthPassword(e.target.value);
                        setAuthError("");
                        setAuthMessage("");
                      }}
                      required
                      autoComplete={authMode === "login" ? "current-password" : "new-password"}
                      minLength={6}
                    />
                  </div>

                  {authError && (
                    <p className="auth-gate-error" role="alert">
                      {authError}
                    </p>
                  )}
                  {authMessage && (
                    <p className="auth-gate-message">{authMessage}</p>
                  )}

                  <button
                    type="submit"
                    className="auth-gate-submit"
                    disabled={authSending}
                  >
                    {authSending
                      ? "Подождите…"
                      : authMode === "login"
                      ? "Войти"
                      : "Создать аккаунт"}
                  </button>
                </form>

                <div className="auth-gate-toggle">
                  {authMode === "login" ? (
                    <>
                      <span className="auth-gate-toggle-text">
                        Нет аккаунта?
                      </span>
                      <button
                        className="auth-gate-toggle-btn"
                        onClick={() => {
                          setAuthMode("register");
                          setAuthError("");
                          setAuthMessage("");
                        }}
                      >
                        Создать аккаунт
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="auth-gate-toggle-text">
                        Уже есть аккаунт?
                      </span>
                      <button
                        className="auth-gate-toggle-btn"
                        onClick={() => {
                          setAuthMode("login");
                          setAuthError("");
                          setAuthMessage("");
                        }}
                      >
                        Войти
                      </button>
                    </>
                  )}
                </div>

                <p className="auth-gate-hint">
                  Кабинет хранит ваши личные разборы по Human Design. Данные
                  доступны только вам.
                </p>
              </>
            )}
          </div>
        </main>
      )}

      {/* ===== Loading state ===== */}
      {authLoading && (
        <main className="auth-gate">
          <div className="auth-gate-card auth-gate-card--loading">
            <p className="auth-gate-loading-text">Загрузка…</p>
          </div>
        </main>
      )}

      {/* ===== Authenticated cabinet ===== */}
      {!authLoading && authUser && (
        <>
          {/* Account bar */}
          <div className="account-bar">
            <div className="account-logged-in">
              <span className="account-email">
                {userProfile.displayName
                  ? `${userProfile.displayName} · ${authUser.email}`
                  : authUser.email}
              </span>
              <button
                className="account-btn account-btn--secondary"
                onClick={handleSignOut}
              >
                Выйти
              </button>
            </div>
          </div>

          {/* Cabinet navigation */}
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

          {/* Main content */}
          <main
            className={`cabinet-content${
              activeTab === "career-map" ? " cabinet-content--wide" : ""
            }${
              activeTab === "overview" ? " cabinet-content--today" : ""
            }`}
          >

        {/* ══════════════════════════════════════
            Tab: Сегодня
        ══════════════════════════════════════ */}
        {activeTab === "overview" && (
          <TodayScreen
            profile={userProfile}
            profileCompleteness={completeness}
            hdChart={hdChart}
            hdChartStatus={getHdChartStatus(hdChart, userProfile)}
            hdChartLoading={hdChartLoading}
            hdChartCalculating={hdChartCalculating}
            reportsCount={reports.length}
            onGoToCareerMap={() => setActiveTab("career-map")}
            onGoToData={() => setActiveTab("data")}
            onGoToNewReport={goToNewReport}
            onGoToAiAssistant={() => setActiveTab("ai-assistant")}
            calculateHdChart={calculateHdChart}
          />
        )}

        {/* ══════════════════════════════════════
            Tab: Моя карта
        ══════════════════════════════════════ */}
        {activeTab === "career-map" && (
          <MyMapScreen
            hdChart={hdChart}
            hdChartStatus={getHdChartStatus(hdChart, userProfile)}
            hdChartLoading={hdChartLoading}
            hdChartCalculating={hdChartCalculating}
            calculateHdChart={calculateHdChart}
            profile={userProfile}
            profileCompleteness={completeness}
            onGoToData={() => setActiveTab("data")}
            onGoToNewReport={goToNewReport}
          />
        )}

        {/* ══════════════════════════════════════
            Tab: Роли и вакансии
        ══════════════════════════════════════ */}
        {activeTab === "roles-vacancies" && (
          <div className="tab-screen">
            <div className="screen-header">
              <h1 className="screen-title">Роли и вакансии</h1>
              <p className="screen-subtitle">
                Проверьте, подходит ли работа вашему Human Design
              </p>
            </div>

            <div className="profile-sections">
              {ROLES_SECTIONS.map((sec) => (
                <div key={sec.title} className="profile-section">
                  <div className="profile-section-header">
                    <span className="profile-section-icon" aria-hidden="true">
                      {sec.icon}
                    </span>
                    <div className="profile-section-meta">
                      <span className="profile-section-title">{sec.title}</span>
                      <span className="profile-section-desc">{sec.desc}</span>
                    </div>
                    {sec.action ? (
                      <button
                        className="profile-action-btn"
                        onClick={() => goToNewReport(sec.action!.type)}
                      >
                        {sec.action.label} →
                      </button>
                    ) : (
                      <span className="coming-soon-badge">В разработке</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════
            Tab: ИИ-помощник
        ══════════════════════════════════════ */}
        {activeTab === "ai-assistant" && (
          <div className="tab-screen">

            {/* Hero */}
            <div className="ai-hero">
              <div className="ai-hero-icon" aria-hidden="true">🤖</div>
              <h1 className="ai-hero-title">ИИ-помощник TalentScan</h1>
              <p className="ai-hero-subtitle">
                Поможет разобраться с карьерной картой, текущей ролью, вакансиями,
                резюме и собеседованиями.
              </p>
            </div>

            {/* Quick actions */}
            <section>
              <p className="dash-section-label">Быстрые действия</p>
              <div className="ai-actions-grid">
                <button
                  className="ai-action-card"
                  onClick={() => goToNewReport("vacancy_assessment")}
                >
                  <span className="ai-action-icon" aria-hidden="true">📄</span>
                  <span className="ai-action-label">Оценить вакансию</span>
                </button>
                <button
                  className="ai-action-card"
                  onClick={() => goToNewReport("current_role")}
                >
                  <span className="ai-action-icon" aria-hidden="true">🧭</span>
                  <span className="ai-action-label">Разобрать текущую роль</span>
                </button>
                <button
                  className="ai-action-card"
                  onClick={() => goToNewReport("talent_map")}
                >
                  <span className="ai-action-icon" aria-hidden="true">✨</span>
                  <span className="ai-action-label">Собрать карьерную карту</span>
                </button>
                <button className="ai-action-card ai-action-card--disabled" disabled>
                  <span className="ai-action-icon" aria-hidden="true">📝</span>
                  <span className="ai-action-label">Помочь с резюме</span>
                  <span className="ai-action-soon">Скоро</span>
                </button>
                <button className="ai-action-card ai-action-card--disabled" disabled>
                  <span className="ai-action-icon" aria-hidden="true">🎤</span>
                  <span className="ai-action-label">Подготовиться к собеседованию</span>
                  <span className="ai-action-soon">Скоро</span>
                </button>
                <button className="ai-action-card ai-action-card--disabled" disabled>
                  <span className="ai-action-icon" aria-hidden="true">🔍</span>
                  <span className="ai-action-label">Найти подходящие роли</span>
                  <span className="ai-action-soon">Скоро</span>
                </button>
              </div>
            </section>

            {/* What assistant knows */}
            <section className="ai-knows">
              <p className="dash-section-label">Что помощник уже знает обо мне</p>
              <div className="ai-knows-grid">
                <div className="ai-knows-item">
                  <span className="ai-knows-item-label">Имя</span>
                  <span className="ai-knows-item-value">
                    {userProfile.displayName || (
                      <span className="ai-knows-empty">Не указано</span>
                    )}
                  </span>
                </div>
                <div className="ai-knows-item">
                  <span className="ai-knows-item-label">Дата рождения</span>
                  <span className="ai-knows-item-value">
                    {userProfile.birthDate || (
                      <span className="ai-knows-empty">Не указана</span>
                    )}
                  </span>
                </div>
                <div className="ai-knows-item">
                  <span className="ai-knows-item-label">Время рождения</span>
                  <span className="ai-knows-item-value">
                    {userProfile.birthTime || (
                      <span className="ai-knows-empty">Не указано</span>
                    )}
                  </span>
                </div>
                <div className="ai-knows-item">
                  <span className="ai-knows-item-label">Место рождения</span>
                  <span className="ai-knows-item-value">
                    {userProfile.birthPlace || (
                      <span className="ai-knows-empty">Не указано</span>
                    )}
                  </span>
                </div>
                <div className="ai-knows-item">
                  <span className="ai-knows-item-label">Текущая роль</span>
                  <span className="ai-knows-item-value">
                    {userProfile.currentRoleTitle || (
                      <span className="ai-knows-empty">Не указана</span>
                    )}
                  </span>
                </div>
                <div className="ai-knows-item">
                  <span className="ai-knows-item-label">Желаемые роли</span>
                  <span className="ai-knows-item-value">
                    {userProfile.desiredRoles || (
                      <span className="ai-knows-empty">Не указаны</span>
                    )}
                  </span>
                </div>
                <div className="ai-knows-item">
                  <span className="ai-knows-item-label">Сохранено разборов</span>
                  <span className="ai-knows-item-value">
                    {reportsLoading ? "…" : reports.length}
                  </span>
                </div>
                <div className="ai-knows-item">
                  <span className="ai-knows-item-label">Заполненность</span>
                  <span className="ai-knows-item-value">
                    {completeness.percent}% — {completeness.label}
                  </span>
                </div>
              </div>
              {completeness.percent < 50 && (
                <p className="ai-knows-hint">
                  Заполните вкладку{" "}
                  <button
                    className="dash-link-btn"
                    onClick={() => setActiveTab("data")}
                  >
                    Данные
                  </button>
                  , чтобы помощник знал о вас больше.
                </p>
              )}
            </section>

            {/* Chat placeholder */}
            <section className="ai-chat-placeholder">
              <p className="dash-section-label">Чат с ИИ-помощником</p>
              <div className="ai-chat-box">
                <textarea
                  className="ai-chat-input"
                  disabled
                  placeholder="Чат с ИИ-помощником появится на следующем этапе. Сейчас можно использовать быстрые действия."
                  rows={3}
                />
                <button className="ai-chat-send" disabled>
                  Отправить
                </button>
              </div>
            </section>
          </div>
        )}

        {/* ══════════════════════════════════════
            Tab: Новый разбор
        ══════════════════════════════════════ */}
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

        {/* ══════════════════════════════════════
            Tab: Мои разборы
        ══════════════════════════════════════ */}
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

        {/* ══════════════════════════════════════
            Tab: Данные — профиль пользователя
        ══════════════════════════════════════ */}
        {activeTab === "data" && (
          <div className="tab-screen">
            <div className="screen-header">
              <h1 className="screen-title">Данные профиля</h1>
              <p className="screen-subtitle">
                Заполните анкету — ИИ-помощник и разборы станут точнее
              </p>
            </div>

            {profileLoading && !profileInitialLoaded ? (
              <p className="history-hint">Загружаем профиль…</p>
            ) : (
              <>
                {profileLoading && profileInitialLoaded && (
                  <p className="pf-refresh-hint" aria-live="polite">Синхронизация…</p>
                )}
                {/* Profile completeness */}
                <div className="profile-completeness-card">
                  <div className="profile-completeness-header">
                    <span className="profile-completeness-title">{completeness.label}</span>
                    <span className="profile-completeness-pct">{completeness.percent}%</span>
                  </div>
                  <div className="profile-completeness-track">
                    <div
                      className="profile-completeness-fill"
                      style={{ width: `${completeness.percent}%` }}
                    />
                  </div>
                  <p className="profile-completeness-hint">
                    Показывает, насколько данных достаточно для точных карьерных рекомендаций
                  </p>
                </div>

                {/* Section 1: Личные данные */}
                <div className="pf-section">
                  <div className="pf-section-title">
                    <span aria-hidden="true">👤</span> Личные данные
                  </div>
                  <div className="pf-fields pf-fields--grid">
                    <div className="field">
                      <label htmlFor="pf-display-name">Имя (как вас называть)</label>
                      <input
                        id="pf-display-name"
                        type="text"
                        placeholder="Например, Александра"
                        value={userProfile.displayName}
                        onChange={(e) => setProfileField("displayName", e.target.value)}
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="pf-current-city">Текущий город</label>
                      <input
                        id="pf-current-city"
                        type="text"
                        placeholder="Например, Москва"
                        value={userProfile.currentCity}
                        onChange={(e) => setProfileField("currentCity", e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                {/* Section 2: Данные рождения */}
                <div className="pf-section">
                  <div className="pf-section-title">
                    <span aria-hidden="true">🌟</span> Данные рождения
                  </div>
                  <div className="data-accuracy-note pf-accuracy-note">
                    <span className="data-accuracy-icon" aria-hidden="true">🎯</span>
                    <div>
                      <p className="data-accuracy-title">Почему точность важна</p>
                      <p className="data-accuracy-text">
                        Разница в 1–2 часа меняет тип, авторитет и профиль.
                        Используйте данные из свидетельства о рождении.
                      </p>
                    </div>
                  </div>
                  <div className="pf-fields pf-fields--grid">
                    <div className="field">
                      <label htmlFor="pf-birth-date">Дата рождения</label>
                      <input
                        id="pf-birth-date"
                        type="date"
                        value={userProfile.birthDate}
                        onChange={(e) => setProfileField("birthDate", e.target.value)}
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="pf-birth-time">Время рождения</label>
                      <input
                        id="pf-birth-time"
                        type="time"
                        value={userProfile.birthTime}
                        onChange={(e) => setProfileField("birthTime", e.target.value)}
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="pf-birth-place">Город рождения</label>
                      <div className="autocomplete-wrap">
                        <input
                          id="pf-birth-place"
                          type="text"
                          placeholder="Начните вводить город…"
                          value={userProfile.birthPlaceInput}
                          onChange={handleBirthPlaceInput}
                          onBlur={() =>
                            setTimeout(() => setBirthSuggestionsOpen(false), 150)
                          }
                          autoComplete="off"
                          aria-autocomplete="list"
                          aria-expanded={birthSuggestionsOpen}
                          aria-controls="birth-suggestions"
                        />
                        {birthSuggestionsLoading && (
                          <span className="autocomplete-spinner" aria-hidden="true">⏳</span>
                        )}
                        {birthSuggestionsOpen && birthSuggestions.length > 0 && (
                          <ul
                            id="birth-suggestions"
                            className="autocomplete-dropdown"
                            role="listbox"
                          >
                            {birthSuggestions.map((s) => (
                              <li
                                key={s.id}
                                role="option"
                                className="autocomplete-option"
                                onMouseDown={() => handleBirthPlaceSelect(s)}
                              >
                                {s.label}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                      {userProfile.birthPlaceLabel ? (
                        <p className="autocomplete-confirmed">
                          ✓ {userProfile.birthLatitude?.toFixed(4)}, {userProfile.birthLongitude?.toFixed(4)}
                        </p>
                      ) : userProfile.birthPlaceInput.trim().length > 0 ? (
                        <p className="autocomplete-warning">
                          Выберите город из подсказки — только тогда доступен расчёт карты
                        </p>
                      ) : null}
                    </div>
                    <div className="field">
                      <label htmlFor="pf-birth-time-accuracy">Точность времени</label>
                      <select
                        id="pf-birth-time-accuracy"
                        value={userProfile.birthTimeAccuracy}
                        onChange={(e) => setProfileField("birthTimeAccuracy", e.target.value)}
                      >
                        <option value="">Выберите…</option>
                        <option value="exact">Точное (из документа)</option>
                        <option value="approximate">Примерное (±1–2 ч)</option>
                        <option value="unknown">Неизвестно</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Section 3: Профессиональная анкета */}
                <div className="pf-section">
                  <div className="pf-section-title">
                    <span aria-hidden="true">💼</span> Профессиональная анкета
                  </div>
                  <div className="pf-fields pf-fields--grid">
                    <div className="field">
                      <label htmlFor="pf-role-title">Текущая должность / роль</label>
                      <input
                        id="pf-role-title"
                        type="text"
                        placeholder="Например, Product Manager"
                        value={userProfile.currentRoleTitle}
                        onChange={(e) => setProfileField("currentRoleTitle", e.target.value)}
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="pf-company">Компания / сфера</label>
                      <input
                        id="pf-company"
                        type="text"
                        placeholder="Например, IT, финансы, образование"
                        value={userProfile.currentCompanyOrSphere}
                        onChange={(e) =>
                          setProfileField("currentCompanyOrSphere", e.target.value)
                        }
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="pf-work-format">Формат работы</label>
                      <select
                        id="pf-work-format"
                        value={userProfile.workFormat}
                        onChange={(e) => setProfileField("workFormat", e.target.value)}
                      >
                        <option value="">Выберите…</option>
                        <option value="office">Офис</option>
                        <option value="remote">Удалённо</option>
                        <option value="hybrid">Гибрид</option>
                        <option value="field">На выезде</option>
                      </select>
                    </div>
                    <div className="field">
                      <label htmlFor="pf-schedule">График</label>
                      <select
                        id="pf-schedule"
                        value={userProfile.schedule}
                        onChange={(e) => setProfileField("schedule", e.target.value)}
                      >
                        <option value="">Выберите…</option>
                        <option value="5-2">5/2 стандартный</option>
                        <option value="flexible">Гибкий</option>
                        <option value="shift">Сменный</option>
                        <option value="freelance">Проектный / фриланс</option>
                      </select>
                    </div>
                    <div className="field field--full">
                      <label htmlFor="pf-current-tasks">Основные задачи и обязанности</label>
                      <textarea
                        id="pf-current-tasks"
                        className="field-textarea"
                        rows={3}
                        placeholder="Кратко опишите, чем занимаетесь на текущей роли"
                        value={userProfile.currentTasks}
                        onChange={(e) => setProfileField("currentTasks", e.target.value)}
                      />
                    </div>
                    <div className="field field--full">
                      <label htmlFor="pf-likes">Что нравится в работе</label>
                      <textarea
                        id="pf-likes"
                        className="field-textarea"
                        rows={2}
                        placeholder="Что даёт энергию и удовольствие"
                        value={userProfile.likesAtWork}
                        onChange={(e) => setProfileField("likesAtWork", e.target.value)}
                      />
                    </div>
                    <div className="field field--full">
                      <label htmlFor="pf-drains">Что забирает энергию</label>
                      <textarea
                        id="pf-drains"
                        className="field-textarea"
                        rows={2}
                        placeholder="Что утомляет или вызывает сопротивление"
                        value={userProfile.drainsAtWork}
                        onChange={(e) => setProfileField("drainsAtWork", e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                {/* Section 4: Опыт и навыки */}
                <div className="pf-section">
                  <div className="pf-section-title">
                    <span aria-hidden="true">🧠</span> Опыт и навыки
                  </div>
                  <div className="pf-fields pf-fields--grid">
                    <div className="field field--full">
                      <label htmlFor="pf-experience">Опыт работы (кратко)</label>
                      <textarea
                        id="pf-experience"
                        className="field-textarea"
                        rows={3}
                        placeholder="Сколько лет опыта, в каких сферах, ключевые компании/проекты"
                        value={userProfile.experience}
                        onChange={(e) => setProfileField("experience", e.target.value)}
                      />
                    </div>
                    <div className="field field--full">
                      <label htmlFor="pf-skills">Ключевые навыки</label>
                      <textarea
                        id="pf-skills"
                        className="field-textarea"
                        rows={2}
                        placeholder="Через запятую или по строкам: Python, управление командой, переговоры…"
                        value={userProfile.skills}
                        onChange={(e) => setProfileField("skills", e.target.value)}
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="pf-education">Образование</label>
                      <input
                        id="pf-education"
                        type="text"
                        placeholder="Специальность, ВУЗ, год"
                        value={userProfile.education}
                        onChange={(e) => setProfileField("education", e.target.value)}
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="pf-languages">Языки</label>
                      <input
                        id="pf-languages"
                        type="text"
                        placeholder="Русский (родной), English B2"
                        value={userProfile.languages}
                        onChange={(e) => setProfileField("languages", e.target.value)}
                      />
                    </div>
                    <div className="field field--full">
                      <label htmlFor="pf-portfolio">Портфолио / ссылки</label>
                      <input
                        id="pf-portfolio"
                        type="text"
                        placeholder="GitHub, LinkedIn, личный сайт…"
                        value={userProfile.portfolioLinks}
                        onChange={(e) => setProfileField("portfolioLinks", e.target.value)}
                      />
                    </div>
                    <div className="field field--full">
                      <label htmlFor="pf-resume">Краткое резюме / о себе</label>
                      <textarea
                        id="pf-resume"
                        className="field-textarea"
                        rows={4}
                        placeholder="Короткий текст о себе — как будто для резюме или LinkedIn"
                        value={userProfile.resumeText}
                        onChange={(e) => setProfileField("resumeText", e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                {/* Section 5: Цели и желаемые роли */}
                <div className="pf-section">
                  <div className="pf-section-title">
                    <span aria-hidden="true">🎯</span> Цели и желаемые роли
                  </div>
                  <div className="pf-fields pf-fields--grid">
                    <div className="field field--full">
                      <label htmlFor="pf-desired-roles">Желаемые роли и направления</label>
                      <textarea
                        id="pf-desired-roles"
                        className="field-textarea"
                        rows={2}
                        placeholder="Например: Head of Product, инди-разработчик, карьерный консультант"
                        value={userProfile.desiredRoles}
                        onChange={(e) => setProfileField("desiredRoles", e.target.value)}
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="pf-desired-format">Желаемый формат</label>
                      <select
                        id="pf-desired-format"
                        value={userProfile.desiredWorkFormat}
                        onChange={(e) => setProfileField("desiredWorkFormat", e.target.value)}
                      >
                        <option value="">Выберите…</option>
                        <option value="office">Офис</option>
                        <option value="remote">Удалённо</option>
                        <option value="hybrid">Гибрид</option>
                        <option value="any">Не важно</option>
                      </select>
                    </div>
                    <div className="field">
                      <label htmlFor="pf-salary">Ожидания по зарплате</label>
                      <input
                        id="pf-salary"
                        type="text"
                        placeholder="Например: от 200к ₽ gross"
                        value={userProfile.salaryExpectations}
                        onChange={(e) => setProfileField("salaryExpectations", e.target.value)}
                      />
                    </div>
                    <div className="field field--full">
                      <label htmlFor="pf-career-goals">Карьерные цели</label>
                      <textarea
                        id="pf-career-goals"
                        className="field-textarea"
                        rows={3}
                        placeholder="Что хотите достичь в профессии через 1–3 года"
                        value={userProfile.careerGoals}
                        onChange={(e) => setProfileField("careerGoals", e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                {/* Section 6: Рабочая среда и ограничения */}
                <div className="pf-section">
                  <div className="pf-section-title">
                    <span aria-hidden="true">🏡</span> Рабочая среда и ограничения
                  </div>
                  <div className="pf-fields">
                    <div className="field">
                      <label htmlFor="pf-manager-style">
                        Предпочтительный стиль руководителя
                      </label>
                      <textarea
                        id="pf-manager-style"
                        className="field-textarea"
                        rows={2}
                        placeholder="Например: автономия с чёткими целями, менторство, без микроменеджмента"
                        value={userProfile.preferredManagerStyle}
                        onChange={(e) =>
                          setProfileField("preferredManagerStyle", e.target.value)
                        }
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="pf-restrictions">Ограничения и условия</label>
                      <textarea
                        id="pf-restrictions"
                        className="field-textarea"
                        rows={2}
                        placeholder="Нет командировок, нет ночных смен, только удалёнка и т.п."
                        value={userProfile.workRestrictions}
                        onChange={(e) => setProfileField("workRestrictions", e.target.value)}
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="pf-red-flags">Красные флаги в вакансиях</label>
                      <textarea
                        id="pf-red-flags"
                        className="field-textarea"
                        rows={2}
                        placeholder="Что сразу настораживает в описании вакансии или компании"
                        value={userProfile.redFlags}
                        onChange={(e) => setProfileField("redFlags", e.target.value)}
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="pf-vacancy-notes">Заметки по вакансиям</label>
                      <textarea
                        id="pf-vacancy-notes"
                        className="field-textarea"
                        rows={2}
                        placeholder="Что важно учитывать при оценке вакансий"
                        value={userProfile.vacancyNotes}
                        onChange={(e) => setProfileField("vacancyNotes", e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                {/* HD chart status */}
                {isSupabaseConfigured && (
                  <div className="hd-chart-status-block">
                    <div className="pf-section-title">
                      <span aria-hidden="true">🔮</span> Human Design карта
                    </div>
                    {hdChartLoading ? (
                      <p className="hd-chart-status hd-chart-status--loading">Загрузка карты…</p>
                    ) : (() => {
                      const status = getHdChartStatus(hdChart, userProfile);
                      return (
                        <>
                          {status === "none" && (
                            <p className="hd-chart-status hd-chart-status--none">
                              Карта ещё не рассчитана
                            </p>
                          )}
                          {status === "no_coords" && (
                            <p className="hd-chart-status hd-chart-status--warning">
                              Выберите город рождения из подсказки, чтобы рассчитать карту
                            </p>
                          )}
                          {status === "ok" && hdChart && (
                            <p className="hd-chart-status hd-chart-status--ok">
                              ✓ Карта рассчитана:{" "}
                              <strong>{hdChart.type}</strong>, профиль {hdChart.profile}
                            </p>
                          )}
                          {status === "outdated" && (
                            <p className="hd-chart-status hd-chart-status--outdated">
                              Данные рождения изменились — карту нужно пересчитать
                            </p>
                          )}
                          {status === "error" && hdChart && (
                            <p className="hd-chart-status hd-chart-status--error">
                              Ошибка расчёта карты:{" "}
                              {hdChart.calculation_error ?? "неизвестная ошибка"}
                            </p>
                          )}
                          {hdChartError && (
                            <p className="hd-chart-status hd-chart-status--error" role="alert">
                              {hdChartError}
                            </p>
                          )}
                          {(status === "none" || status === "outdated" || status === "error") &&
                            userProfile.birthPlaceLabel &&
                            userProfile.birthLatitude !== null && (
                              <button
                                className="hd-chart-calc-btn"
                                onClick={calculateHdChart}
                                disabled={hdChartCalculating}
                              >
                                {hdChartCalculating
                                  ? "Рассчитываем…"
                                  : status === "outdated"
                                  ? "Пересчитать карту"
                                  : "Рассчитать мою карту"}
                              </button>
                            )}
                        </>
                      );
                    })()}
                  </div>
                )}

                {/* Transit Debug (temporary QA tool) */}
                {isSupabaseConfigured && (
                  <div className="transit-debug-card">
                    <div className="transit-debug-header">
                      <span className="transit-debug-badge">DEBUG</span>
                      <span className="transit-debug-title">Транзит debug</span>
                    </div>
                    <p className="transit-debug-desc">
                      Временная проверка: можно ли использовать текущий Human Design API как карту
                      текущего момента. Ничего не сохраняется.
                    </p>
                    <button
                      className="transit-debug-btn"
                      onClick={checkTransitDebug}
                      disabled={transitDebugLoading}
                    >
                      {transitDebugLoading ? "Проверяем транзит…" : "Проверить транзит"}
                    </button>

                    {transitDebugError && (
                      <div className="transit-debug-error">
                        {transitDebugError.status > 0 && (
                          <span className="transit-debug-error-status">
                            HTTP {transitDebugError.status}
                          </span>
                        )}
                        <span className="transit-debug-error-msg">
                          {transitDebugError.message}
                        </span>
                        {transitDebugError.source && (
                          <span className="transit-debug-error-source">
                            source: {transitDebugError.source}
                          </span>
                        )}
                      </div>
                    )}

                    {transitDebugResult && (
                      <div className="transit-debug-result">
                        <div
                          className={`transit-debug-summary${
                            transitDebugResult.diagnosticsSummary.currentMomentLikelyAccurate
                              ? " transit-debug-summary--ok"
                              : " transit-debug-summary--warn"
                          }`}
                        >
                          <span aria-hidden="true">
                            {transitDebugResult.diagnosticsSummary.currentMomentLikelyAccurate
                              ? "✓"
                              : "⚠"}
                          </span>
                          <span>{transitDebugResult.diagnosticsSummary.reason}</span>
                        </div>

                        <div className="transit-debug-grid">
                          <div className="transit-debug-row">
                            <span className="transit-debug-label">Сейчас UTC</span>
                            <span className="transit-debug-value">
                              {transitDebugResult.debug.timeDiagnostics.nowUtcIso}
                            </span>
                          </div>
                          <div className="transit-debug-row">
                            <span className="transit-debug-label">Дата запроса</span>
                            <span className="transit-debug-value">
                              {transitDebugResult.debug.timeDiagnostics.inputDate}
                            </span>
                          </div>
                          <div className="transit-debug-row">
                            <span className="transit-debug-label">Время запроса (UTC)</span>
                            <span className="transit-debug-value">
                              {transitDebugResult.debug.timeDiagnostics.inputTime}
                            </span>
                          </div>
                          <div className="transit-debug-row">
                            <span className="transit-debug-label">API birthDateUtc</span>
                            <span className="transit-debug-value">
                              {transitDebugResult.debug.timeDiagnostics.apiReturnedBirthDateUtc ??
                                "—"}
                            </span>
                          </div>
                          <div className="transit-debug-row">
                            <span className="transit-debug-label">Разница (мин)</span>
                            <span className="transit-debug-value">
                              {transitDebugResult.debug.timeDiagnostics
                                .differenceMinutesBetweenNowUtcAndApiBirthDateUtc ?? "—"}
                            </span>
                          </div>
                          <div className="transit-debug-row">
                            <span className="transit-debug-label">Сдвиг TZ</span>
                            <span
                              className={`transit-debug-value${
                                transitDebugResult.debug.timeDiagnostics
                                  .possibleTimezoneShiftDetected
                                  ? " transit-debug-value--warn"
                                  : " transit-debug-value--ok"
                              }`}
                            >
                              {transitDebugResult.debug.timeDiagnostics
                                .possibleTimezoneShiftDetected
                                ? "ДА"
                                : "НЕТ"}
                            </span>
                          </div>
                          <div className="transit-debug-row">
                            <span className="transit-debug-label">Ворот (тек. момент)</span>
                            <span className="transit-debug-value">
                              {transitDebugResult.currentMoment.gatesAll.length}
                            </span>
                          </div>
                          <div className="transit-debug-row">
                            <span className="transit-debug-label">Каналов (тек. момент)</span>
                            <span className="transit-debug-value">
                              {transitDebugResult.currentMoment.channelsShort.length}
                            </span>
                          </div>
                          <div className="transit-debug-row">
                            <span className="transit-debug-label">Центров (тек. момент)</span>
                            <span className="transit-debug-value">
                              {transitDebugResult.currentMoment.definedCenters.length}
                            </span>
                          </div>
                          <div className="transit-debug-row">
                            <span className="transit-debug-label">Добавлено ворот</span>
                            <span className="transit-debug-value">
                              {transitDebugResult.overlay.addedGates.length}
                            </span>
                          </div>
                          <div className="transit-debug-row">
                            <span className="transit-debug-label">Добавлено каналов</span>
                            <span className="transit-debug-value">
                              {transitDebugResult.overlay.addedChannels.length}
                            </span>
                          </div>
                          <div className="transit-debug-row">
                            <span className="transit-debug-label">Добавлено центров</span>
                            <span className="transit-debug-value">
                              {transitDebugResult.overlay.addedDefinedCenters.length}
                            </span>
                          </div>
                        </div>

                        <button
                          className="transit-debug-copy-btn"
                          onClick={copyTransitDebugForChatGPT}
                        >
                          {transitCopyStatus === "copied"
                            ? "✓ Скопировано"
                            : "Скопировать результат для ChatGPT"}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Save */}
                {!isSupabaseConfigured ? (
                  <p className="data-coming-soon">
                    ⚠️ Сохранение недоступно: Supabase не настроен
                  </p>
                ) : (
                  <div className="pf-save-row">
                    {profileSaveStatus === "success" && (
                      <p className="pf-save-success" role="status">
                        ✓ Профиль сохранён
                      </p>
                    )}
                    {profileSaveStatus === "error" && (
                      <p className="account-error" role="alert">
                        {profileSaveError}
                      </p>
                    )}
                    <button
                      className="submit-btn"
                      onClick={saveProfile}
                      disabled={profileSaveStatus === "saving"}
                    >
                      {profileSaveStatus === "saving" ? "Сохраняем…" : "Сохранить данные"}
                    </button>
                  </div>
                )}

              </>
            )}
          </div>
        )}
          </main>
        </>
      )}

      <footer className="footer">
        © {new Date().getFullYear()} TalentScan. Human Design для карьеры.
      </footer>
    </div>
  );
}
