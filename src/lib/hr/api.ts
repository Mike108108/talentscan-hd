import { supabase, isSupabaseConfigured } from "../supabase";
import { getAccessToken } from "../auth";
import type {
  CandidateFormData,
  GeocodeSuggestion,
  HrCandidate,
  HrReport,
  HrReportType,
  HrVacancy,
  HrVacancyCandidate,
  VacancyFormData,
  HrCompany,
  HrProfile,
} from "./types";
import { deriveChartStatus } from "./chartStatus";
import {
  isDisplayableTalentMapReport,
  isReadyTalentMapReport,
} from "./normalizeAiReport";
import { hasCareerReadingLayers } from "./talentMapContentV2";

export const HR_CORE_LAYERS_SPIKE_REPORT_TYPE =
  "hr_person_talent_map_core_layers_spike" as const;

export type CoreLayersStartResponse = {
  report_id: string;
  report_status: string;
  report_type: string;
  prompt_version: string;
  run_mode: string;
  selected_model: string;
  model_policy: Record<string, unknown> | null;
};

export type CoreLayersLayerProgressItem = {
  layer_key: string;
  hr_title: string;
  status: string;
  progress_percent: number | null;
  started_at: string | null;
  completed_at: string | null;
  attempts: number;
  repair_attempts: number;
  error?: string | Record<string, unknown> | null;
};

/** Alias kept for types re-export compatibility after main merge. */
export type CoreLayerProgressItem = CoreLayersLayerProgressItem;

export type CoreLayersCancellationMeta = {
  requested?: boolean;
  requested_at?: string | null;
  requested_by?: string | null;
  status?: "requested" | "cancelled" | null;
  cancelled_at?: string | null;
};

export type CoreLayersStatusResponse = {
  report_id: string;
  report_status: string;
  report_type: string;
  prompt_version: string | null;
  model: string | null;
  run_mode: string | null;
  selected_model: string | null;
  model_policy: Record<string, unknown> | null;
  request_tuning: Record<string, unknown> | null;
  tuning_policy: Record<string, unknown> | null;
  usage_summary: Record<string, unknown> | null;
  tuning_fallbacks_total: number;
  max_output_tokens: number | null;
  output_token_policy: Record<string, unknown> | null;
  layer_generation_status: string | null;
  generation_error: unknown;
  layer_reports_count: number;
  ready_layer_keys: string[];
  error_layer_keys: string[];
  skipped_layer_keys: string[];
  layer_generation: Record<string, unknown> | null;
  attempts_total?: number;
  ready_count?: number;
  total_count?: number;
  progress_percent?: number;
  current_layer_key?: string | null;
  current_layer_title?: string | null;
  layers_progress?: CoreLayersLayerProgressItem[];
  cancel_requested?: boolean;
  cancelled?: boolean;
  cancellation?: CoreLayersCancellationMeta | null;
};

export type CoreLayersCancelResponse = {
  success: boolean;
  report_id: string;
  report_status: string;
  cancel_requested: boolean;
  cancellation: CoreLayersCancellationMeta | null;
};

export const DEFAULT_RUNTIME_CORE_LAYER_COUNT = 8;

export function isCoreLayersGenerationCancelled(
  status: Pick<
    CoreLayersStatusResponse,
    "generation_error" | "cancellation" | "cancelled"
  > | null | undefined,
): boolean {
  if (!status) return false;
  if (status.cancelled === true) return true;
  if (status.cancellation?.status === "cancelled") return true;
  const err = status.generation_error;
  if (typeof err === "string") {
    return err.includes("generation_cancelled_by_user");
  }
  if (err && typeof err === "object") {
    const kind = (err as Record<string, unknown>).kind;
    return kind === "generation_cancelled_by_user";
  }
  return false;
}

function isReadyReportForType(report: HrReport, reportType: HrReportType): boolean {
  if (reportType === HR_CORE_LAYERS_SPIKE_REPORT_TYPE) {
    return isDisplayableTalentMapReport(report);
  }
  if (reportType === "hr_person_talent_map" && hasCareerReadingLayers(report.content_json)) {
    return isDisplayableTalentMapReport(report);
  }
  return isReadyTalentMapReport(report);
}

export type HrReportFetchResult = {
  report: HrReport | null;
  error: string | null;
};

/** Extract report from Netlify/client JSON shapes. */
export function extractGeneratedReport(payload: unknown): HrReport | null {
  if (!payload || typeof payload !== "object") return null;
  const root = payload as Record<string, unknown>;
  const nested = root.report;
  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    return nested as HrReport;
  }
  const data = root.data;
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const dataRec = data as Record<string, unknown>;
    const dataReport = dataRec.report;
    if (dataReport && typeof dataReport === "object" && !Array.isArray(dataReport)) {
      return dataReport as HrReport;
    }
  }
  if ("report_status" in root && "company_id" in root) {
    return root as HrReport;
  }
  return null;
}

export function reportMatchesCandidate(
  report: HrReport,
  companyId: string,
  candidateId: string,
): boolean {
  return (
    String(report.company_id) === String(companyId) &&
    String(report.candidate_id) === String(candidateId)
  );
}

export async function searchBirthCities(q: string): Promise<GeocodeSuggestion[]> {
  if (q.length < 2) return [];
  const token = await getAccessToken();
  if (!token) return [];
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

export async function fetchHrProfile(): Promise<HrProfile | null> {
  if (!supabase) return null;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from("hr_profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();
  if (error) {
    console.error("[hr] profile load:", error.message);
    return null;
  }
  return data as HrProfile | null;
}

export async function createHrProfile(payload: {
  full_name: string;
  role_title?: string;
}): Promise<HrProfile | null> {
  if (!supabase) return null;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const row = {
    id: user.id,
    full_name: payload.full_name.trim(),
    role_title: payload.role_title?.trim() || null,
    demo_access: true,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase.from("hr_profiles").upsert(row).select().single();
  if (error) {
    console.error("[hr] profile create:", error.message);
    throw new Error(error.message);
  }
  return data as HrProfile;
}

export async function fetchHrCompanies(): Promise<HrCompany[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("hr_companies")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) {
    console.error("[hr] companies:", error.message);
    return [];
  }
  return (data ?? []) as HrCompany[];
}

export async function createHrCompany(payload: {
  name: string;
  industry?: string;
}): Promise<HrCompany | null> {
  if (!supabase) return null;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from("hr_companies")
    .insert({
      owner_user_id: user.id,
      name: payload.name.trim(),
      industry: payload.industry?.trim() || null,
      is_demo: false,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as HrCompany;
}

export async function fetchHrCompany(companyId: string): Promise<HrCompany | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("hr_companies")
    .select("*")
    .eq("id", companyId)
    .maybeSingle();
  if (error) return null;
  return data as HrCompany | null;
}

export async function fetchCandidates(companyId: string): Promise<HrCandidate[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("hr_candidates")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });
  if (error) return [];
  return (data ?? []) as HrCandidate[];
}

export async function fetchCandidate(
  companyId: string,
  candidateId: string,
): Promise<HrCandidate | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("hr_candidates")
    .select("*")
    .eq("company_id", companyId)
    .eq("id", candidateId)
    .maybeSingle();
  if (error) return null;
  return data as HrCandidate | null;
}

function vacancyFormToRow(companyId: string, form: VacancyFormData, userId: string | undefined) {
  return {
    company_id: companyId,
    created_by_user_id: userId ?? null,
    title: form.title.trim(),
    status: form.status,
    department: form.department.trim() || null,
    employment_format: form.employment_format.trim() || null,
    work_format: form.work_format.trim() || null,
    location: form.location.trim() || null,
    schedule: form.schedule.trim() || null,
    salary_range: form.salary_range.trim() || null,
    role_description: form.role_description.trim() || null,
    responsibilities: form.responsibilities.trim() || null,
    kpi: form.kpi.trim() || null,
    must_have: form.must_have.trim() || null,
    nice_to_have: form.nice_to_have.trim() || null,
    working_conditions: form.working_conditions.trim() || null,
    manager_context: form.manager_context.trim() || null,
    team_context: form.team_context.trim() || null,
    hiring_priorities: form.hiring_priorities.trim() || null,
    risks_to_check: form.risks_to_check.trim() || null,
    updated_at: new Date().toISOString(),
  };
}

export async function fetchVacancies(companyId: string): Promise<HrVacancy[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("hr_vacancies")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });
  if (error) return [];
  return (data ?? []) as HrVacancy[];
}

export async function fetchVacancy(companyId: string, vacancyId: string): Promise<HrVacancy | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("hr_vacancies")
    .select("*")
    .eq("company_id", companyId)
    .eq("id", vacancyId)
    .maybeSingle();
  if (error) return null;
  return data as HrVacancy | null;
}

export async function createVacancy(companyId: string, form: VacancyFormData): Promise<HrVacancy> {
  if (!supabase) throw new Error("Supabase не настроен");
  const { data: { user } } = await supabase.auth.getUser();
  const row = vacancyFormToRow(companyId, form, user?.id);
  const { data, error } = await supabase.from("hr_vacancies").insert(row).select().single();
  if (error) throw new Error(error.message);
  return data as HrVacancy;
}

export async function updateVacancy(
  companyId: string,
  vacancyId: string,
  form: VacancyFormData,
): Promise<HrVacancy> {
  if (!supabase) throw new Error("Supabase не настроен");
  const row = vacancyFormToRow(companyId, form, undefined);
  const { data, error } = await supabase
    .from("hr_vacancies")
    .update(row)
    .eq("company_id", companyId)
    .eq("id", vacancyId)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as HrVacancy;
}

export async function fetchVacancyCandidates(companyId: string, vacancyId: string) {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("hr_vacancy_candidates")
    .select("*, candidate:hr_candidates(*)")
    .eq("company_id", companyId)
    .eq("vacancy_id", vacancyId)
    .order("created_at", { ascending: false });
  if (error) return [];
  return (data ?? []) as Array<HrVacancyCandidate & { candidate: HrCandidate }>;
}

export async function fetchCandidateVacancies(companyId: string, candidateId: string) {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("hr_vacancy_candidates")
    .select("*, vacancy:hr_vacancies(*)")
    .eq("company_id", companyId)
    .eq("candidate_id", candidateId)
    .order("created_at", { ascending: false });
  if (error) return [];
  return (data ?? []) as Array<HrVacancyCandidate & { vacancy: HrVacancy }>;
}

export async function linkCandidateToVacancy(
  companyId: string,
  vacancyId: string,
  candidateId: string,
  payload?: Partial<Pick<HrVacancyCandidate, "stage" | "status" | "source" | "recruiter_comment">>,
): Promise<HrVacancyCandidate | null> {
  if (!supabase) return null;
  const row = {
    company_id: companyId,
    vacancy_id: vacancyId,
    candidate_id: candidateId,
    stage: payload?.stage ?? "new",
    status: payload?.status ?? "active",
    source: payload?.source ?? "manual",
    recruiter_comment: payload?.recruiter_comment ?? null,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase
    .from("hr_vacancy_candidates")
    .upsert(row, { onConflict: "vacancy_id,candidate_id" })
    .select()
    .maybeSingle();
  if (error) {
    console.error("[hr] vacancy link:", error.message);
    return null;
  }
  return data as HrVacancyCandidate | null;
}

export async function unlinkCandidateFromVacancy(
  companyId: string,
  vacancyId: string,
  candidateId: string,
): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase
    .from("hr_vacancy_candidates")
    .delete()
    .eq("company_id", companyId)
    .eq("vacancy_id", vacancyId)
    .eq("candidate_id", candidateId);
  return !error;
}

export async function fetchVacancyCandidateLinks(companyId: string): Promise<HrVacancyCandidate[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("hr_vacancy_candidates")
    .select("*")
    .eq("company_id", companyId);
  if (error) return [];
  return (data ?? []) as HrVacancyCandidate[];
}

function formToRow(companyId: string, form: CandidateFormData, userId: string | undefined) {
  const chart_status = deriveChartStatus({
    name: form.name,
    birth_date: form.birth_date || null,
    birth_time: form.birth_time || null,
    birth_place_text: form.birth_place_text || null,
    birth_place_lat: form.birth_place_lat,
    birth_place_lon: form.birth_place_lon,
  });
  return {
    company_id: companyId,
    created_by_user_id: userId ?? null,
    name: form.name.trim(),
    email: form.email.trim() || null,
    phone: form.phone.trim() || null,
    vacancy_title: form.vacancy_title.trim() || null,
    hr_comment: form.hr_comment.trim() || null,
    birth_date: form.birth_date || null,
    birth_time: form.birth_time || null,
    birth_place_text: form.birth_place_text.trim() || null,
    birth_place_lat: form.birth_place_lat,
    birth_place_lon: form.birth_place_lon,
    birth_timezone: form.birth_timezone.trim() || null,
    chart_status,
    updated_at: new Date().toISOString(),
  };
}

export async function saveCandidate(
  companyId: string,
  form: CandidateFormData,
  opts?: { vacancyId?: string | null },
): Promise<HrCandidate> {
  if (!supabase) throw new Error("Supabase не настроен");
  const { data: { user } } = await supabase.auth.getUser();
  const vacancyId = opts?.vacancyId ?? null;
  let vacancyTitle: string | null = null;
  if (vacancyId) {
    const vacancy = await fetchVacancy(companyId, vacancyId);
    vacancyTitle = vacancy?.title ?? null;
  }
  const row = formToRow(
    companyId,
    { ...form, vacancy_title: vacancyTitle ?? form.vacancy_title },
    user?.id,
  );
  const { data, error } = await supabase.from("hr_candidates").insert(row).select().single();
  if (error) throw new Error(error.message);
  if (vacancyId) {
    await linkCandidateToVacancy(companyId, vacancyId, (data as HrCandidate).id, {
      source: "manual",
    });
  }
  return data as HrCandidate;
}

export async function updateCandidate(
  companyId: string,
  candidateId: string,
  form: CandidateFormData,
): Promise<HrCandidate> {
  if (!supabase) throw new Error("Supabase не настроен");
  const row = formToRow(companyId, form, undefined);
  const { data, error } = await supabase
    .from("hr_candidates")
    .update(row)
    .eq("id", candidateId)
    .eq("company_id", companyId)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as HrCandidate;
}

export async function calculateCandidateChart(
  companyId: string,
  candidateId: string,
): Promise<{
  candidate: HrCandidate;
  talent_map: Record<string, unknown>;
}> {
  const token = await getAccessToken();
  if (!token) throw new Error("Требуется вход");
  const resp = await fetch("/.netlify/functions/hr-candidate-chart-calculate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ candidate_id: candidateId, company_id: companyId }),
  });
  const data = (await resp.json()) as {
    error?: string;
    candidate?: HrCandidate;
    talent_map?: Record<string, unknown>;
  };
  if (!resp.ok) {
    throw new Error(data.error ?? "Ошибка расчёта карты");
  }
  if (!data.candidate) throw new Error("Пустой ответ сервера");
  return {
    candidate: data.candidate,
    talent_map: data.talent_map ?? {},
  };
}

export async function fetchTalentMap(
  companyId: string,
  candidateId: string,
) {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("hr_candidate_talent_maps")
    .select("*")
    .eq("company_id", companyId)
    .eq("candidate_id", candidateId)
    .maybeSingle();
  if (error) return null;
  return data;
}

export async function fetchTalentMapsForCompany(companyId: string) {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("hr_candidate_talent_maps")
    .select("id, candidate_id, report_status, best_work_format, key_talent, main_risk, created_at, updated_at")
    .eq("company_id", companyId);
  if (error) return [];
  return data ?? [];
}

export async function fetchCandidateReports(
  companyId: string,
  candidateId: string,
  reportType?: HrReportType,
): Promise<HrReport[]> {
  if (!supabase) return [];
  let query = supabase
    .from("hr_reports")
    .select("*")
    .eq("company_id", companyId)
    .eq("candidate_id", candidateId)
    .order("generated_at", { ascending: false, nullsFirst: false });
  if (reportType) {
    query = query.eq("report_type", reportType);
  }
  const { data, error } = await query;
  if (error) {
    console.error("[hr] reports:", error.message);
    return [];
  }
  return (data ?? []) as HrReport[];
}

export async function fetchReadyTalentMapReportsForCompany(companyId: string) {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("hr_reports")
    .select(
      "id, candidate_id, summary, fit_score, generated_at, updated_at, content_json, report_status",
    )
    .eq("company_id", companyId)
    .eq("report_type", "hr_person_talent_map")
    .eq("report_status", "ready")
    .order("generated_at", { ascending: false, nullsFirst: false });
  if (error) {
    console.error("[hr] company reports:", error.message);
    return [];
  }
  return data ?? [];
}

/** Latest ready report — list query (avoids maybeSingle edge cases). */
export async function fetchBestReadyCandidateReport(
  companyId: string,
  candidateId: string,
  reportType: HrReportType = "hr_person_talent_map",
): Promise<HrReportFetchResult> {
  if (!supabase) {
    return { report: null, error: "Supabase не настроен" };
  }

  const { data, error } = await supabase
    .from("hr_reports")
    .select("*")
    .eq("company_id", companyId)
    .eq("candidate_id", candidateId)
    .eq("report_type", reportType)
    .eq("report_status", "ready")
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) {
    console.error("[fetchBestReadyCandidateReport] Supabase error", error);
    return { report: null, error: error.message };
  }

  const rows = (data ?? []) as HrReport[];
  const ready = rows.find((row) => isReadyReportForType(row, reportType)) ?? null;
  return { report: ready, error: null };
}

export async function fetchLatestCandidateReport(
  companyId: string,
  candidateId: string,
  reportType: HrReportType = "hr_person_talent_map",
): Promise<HrReport | null> {
  const { report, error } = await fetchBestReadyCandidateReport(
    companyId,
    candidateId,
    reportType,
  );
  if (error) {
    console.error("[fetchLatestCandidateReport]", error);
  }
  return report;
}

/** Latest report row regardless of status (for post-generate diagnostics). */
export async function fetchLatestHrReport(
  companyId: string,
  candidateId: string,
  reportType: HrReportType = "hr_person_talent_map",
): Promise<HrReportFetchResult> {
  if (!supabase) {
    return { report: null, error: "Supabase не настроен" };
  }

  const { data, error } = await supabase
    .from("hr_reports")
    .select("*")
    .eq("company_id", companyId)
    .eq("candidate_id", candidateId)
    .eq("report_type", reportType)
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) {
    console.error("[fetchLatestHrReport] Supabase error", error);
    return { report: null, error: error.message };
  }

  const row = ((data ?? []) as HrReport[])[0] ?? null;
  return { report: row, error: null };
}

export async function generateCandidateReport(
  companyId: string,
  candidateId: string,
  opts?: {
    vacancyId?: string | null;
    reportType?: HrReportType;
    forceRegenerate?: boolean;
  },
): Promise<HrReport> {
  const token = await getAccessToken();
  if (!token) throw new Error("Требуется вход");
  const resp = await fetch("/.netlify/functions/hr-generate-candidate-report", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      company_id: companyId,
      candidate_id: candidateId,
      vacancy_id: opts?.vacancyId ?? null,
      report_type: opts?.reportType ?? "hr_person_talent_map",
      force_regenerate: opts?.forceRegenerate ?? false,
    }),
  });

  const rawBody = await resp.text();
  let parsed: unknown = {};
  if (rawBody) {
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      const preview = rawBody.replace(/\s+/g, " ").slice(0, 160);
      throw new Error(
        `Сервер вернул не-JSON ответ (${resp.status}). ${preview || "Пустое тело ответа."}`,
      );
    }
  }

  const payload = parsed as { error?: string; source?: string };
  if (!resp.ok) {
    throw new Error(payload.error ?? `Ошибка генерации отчёта (${resp.status})`);
  }

  const report = extractGeneratedReport(parsed);
  if (!report) {
    throw new Error("Пустой ответ сервера: отчёт не возвращён");
  }

  console.info("[HR report generate] response", {
    status: report.report_status,
    id: report.id,
    company_id: report.company_id,
    candidate_id: report.candidate_id,
    hasContent: report.content_json != null,
  });

  return report;
}

export async function startCandidateCoreLayersReport(
  companyId: string,
  candidateId: string,
): Promise<CoreLayersStartResponse> {
  const token = await getAccessToken();
  if (!token) throw new Error("Требуется вход");

  const resp = await fetch("/.netlify/functions/hr-talent-map-v2-core-layers-start", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      company_id: companyId,
      candidate_id: candidateId,
    }),
  });

  const rawBody = await resp.text();
  let parsed: Record<string, unknown> = {};
  if (rawBody) {
    try {
      parsed = JSON.parse(rawBody) as Record<string, unknown>;
    } catch {
      throw new Error(`Сервер вернул не-JSON ответ (${resp.status}).`);
    }
  }

  if (!resp.ok) {
    throw new Error(asString(parsed.error) || `Ошибка запуска послойной карты (${resp.status})`);
  }

  const reportId =
    asString(parsed.report_id) || asString(parsed.reportId) || asString(parsed.id);
  if (!reportId) {
    throw new Error("Пустой ответ: report_id не возвращён");
  }

  return {
    report_id: reportId,
    report_status: asString(parsed.report_status, "generating"),
    report_type: asString(parsed.report_type, HR_CORE_LAYERS_SPIKE_REPORT_TYPE),
    prompt_version: asString(parsed.prompt_version),
    run_mode: asString(parsed.run_mode),
    selected_model: asString(parsed.selected_model),
    model_policy:
      parsed.model_policy && typeof parsed.model_policy === "object"
        ? (parsed.model_policy as Record<string, unknown>)
        : null,
  };
}

function asString(value: unknown, fallback = ""): string {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return fallback;
}

export async function fetchCoreLayersStatus(
  reportId: string,
): Promise<CoreLayersStatusResponse> {
  const token = await getAccessToken();
  if (!token) throw new Error("Требуется вход");

  const resp = await fetch(
    `/.netlify/functions/hr-talent-map-v2-core-layers-status?report_id=${encodeURIComponent(reportId)}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    },
  );

  const rawBody = await resp.text();
  let parsed: Record<string, unknown> = {};
  if (rawBody) {
    try {
      parsed = JSON.parse(rawBody) as Record<string, unknown>;
    } catch {
      throw new Error(`Сервер вернул не-JSON ответ (${resp.status}).`);
    }
  }

  if (!resp.ok) {
    throw new Error(asString(parsed.error) || `Ошибка статуса послойной карты (${resp.status})`);
  }

  const layerGeneration =
    parsed.layer_generation && typeof parsed.layer_generation === "object"
      ? (parsed.layer_generation as Record<string, unknown>)
      : null;
  const summary =
    layerGeneration?.summary && typeof layerGeneration.summary === "object"
      ? (layerGeneration.summary as Record<string, unknown>)
      : null;
  const cancellationRaw =
    parsed.cancellation && typeof parsed.cancellation === "object"
      ? (parsed.cancellation as Record<string, unknown>)
      : null;
  const layersProgressRaw = Array.isArray(parsed.layers_progress)
    ? parsed.layers_progress
    : [];

  const layersProgress: CoreLayersLayerProgressItem[] = layersProgressRaw
    .filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
    .map((item) => ({
      layer_key: asString(item.layer_key),
      hr_title: asString(item.hr_title),
      status: asString(item.status, "pending"),
      progress_percent:
        typeof item.progress_percent === "number" ? item.progress_percent : null,
      started_at: asString(item.started_at) || null,
      completed_at: asString(item.completed_at) || null,
      attempts: typeof item.attempts === "number" ? item.attempts : 0,
      repair_attempts:
        typeof item.repair_attempts === "number" ? item.repair_attempts : 0,
      error:
        typeof item.error === "string" ||
        (item.error && typeof item.error === "object")
          ? (item.error as string | Record<string, unknown>)
          : null,
    }));

  const readyCountFromProgress = layersProgress.filter(
    (item) => item.status === "ready",
  ).length;
  const totalCount =
    typeof parsed.total_count === "number"
      ? parsed.total_count
      : layersProgress.length > 0
        ? layersProgress.length
        : DEFAULT_RUNTIME_CORE_LAYER_COUNT;
  const readyCount =
    typeof parsed.ready_count === "number"
      ? parsed.ready_count
      : readyCountFromProgress > 0
        ? readyCountFromProgress
        : Array.isArray(parsed.ready_layer_keys)
          ? parsed.ready_layer_keys.length
          : 0;
  const progressPercent =
    typeof parsed.progress_percent === "number" && Number.isFinite(parsed.progress_percent)
      ? Math.min(100, Math.max(0, parsed.progress_percent))
      : totalCount > 0
        ? Math.min(100, Math.max(0, Math.round((readyCount / totalCount) * 100)))
        : 0;

  return {
    report_id: asString(parsed.report_id, reportId),
    report_status: asString(parsed.report_status),
    report_type: asString(parsed.report_type, HR_CORE_LAYERS_SPIKE_REPORT_TYPE),
    prompt_version: asString(parsed.prompt_version) || null,
    model: asString(parsed.model) || null,
    run_mode: asString(parsed.run_mode) || null,
    selected_model: asString(parsed.selected_model) || null,
    model_policy:
      parsed.model_policy && typeof parsed.model_policy === "object"
        ? (parsed.model_policy as Record<string, unknown>)
        : null,
    request_tuning:
      parsed.request_tuning && typeof parsed.request_tuning === "object"
        ? (parsed.request_tuning as Record<string, unknown>)
        : null,
    tuning_policy:
      parsed.tuning_policy && typeof parsed.tuning_policy === "object"
        ? (parsed.tuning_policy as Record<string, unknown>)
        : null,
    usage_summary:
      parsed.usage_summary && typeof parsed.usage_summary === "object"
        ? (parsed.usage_summary as Record<string, unknown>)
        : null,
    tuning_fallbacks_total:
      typeof parsed.tuning_fallbacks_total === "number" ? parsed.tuning_fallbacks_total : 0,
    max_output_tokens:
      typeof parsed.max_output_tokens === "number" ? parsed.max_output_tokens : null,
    output_token_policy:
      parsed.output_token_policy && typeof parsed.output_token_policy === "object"
        ? (parsed.output_token_policy as Record<string, unknown>)
        : null,
    layer_generation_status: asString(parsed.layer_generation_status) || null,
    generation_error: parsed.generation_error ?? null,
    layer_reports_count:
      typeof parsed.layer_reports_count === "number" ? parsed.layer_reports_count : 0,
    ready_layer_keys: Array.isArray(parsed.ready_layer_keys)
      ? parsed.ready_layer_keys.map((k) => asString(k)).filter(Boolean)
      : [],
    error_layer_keys: Array.isArray(parsed.error_layer_keys)
      ? parsed.error_layer_keys.map((k) => asString(k)).filter(Boolean)
      : [],
    skipped_layer_keys: Array.isArray(parsed.skipped_layer_keys)
      ? parsed.skipped_layer_keys.map((k) => asString(k)).filter(Boolean)
      : [],
    layer_generation: layerGeneration,
    attempts_total:
      typeof summary?.attempts_total === "number" ? summary.attempts_total : undefined,
    ready_count: readyCount,
    total_count: totalCount,
    progress_percent: progressPercent,
    current_layer_key: asString(parsed.current_layer_key) || null,
    current_layer_title: asString(parsed.current_layer_title) || null,
    layers_progress: layersProgress,
    cancel_requested: parsed.cancel_requested === true,
    cancelled: parsed.cancelled === true,
    cancellation: cancellationRaw
      ? {
          requested: cancellationRaw.requested === true,
          requested_at: asString(cancellationRaw.requested_at) || null,
          requested_by: asString(cancellationRaw.requested_by) || null,
          status:
            cancellationRaw.status === "requested" ||
            cancellationRaw.status === "cancelled"
              ? cancellationRaw.status
              : null,
          cancelled_at: asString(cancellationRaw.cancelled_at) || null,
        }
      : null,
  };
}

export async function cancelHrTalentMapCoreLayersGeneration(
  reportId: string,
): Promise<CoreLayersCancelResponse> {
  const token = await getAccessToken();
  if (!token) throw new Error("Требуется вход");

  const resp = await fetch("/.netlify/functions/hr-talent-map-v2-core-layers-cancel", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ report_id: reportId }),
  });

  const rawBody = await resp.text();
  let parsed: Record<string, unknown> = {};
  if (rawBody) {
    try {
      parsed = JSON.parse(rawBody) as Record<string, unknown>;
    } catch {
      throw new Error(`Сервер вернул не-JSON ответ (${resp.status}).`);
    }
  }

  if (!resp.ok) {
    throw new Error(asString(parsed.error) || `Ошибка отмены генерации (${resp.status})`);
  }

  const ok = parsed.ok === true || parsed.success === true;
  if (!ok) {
    throw new Error(asString(parsed.error) || "Сервер не подтвердил отмену генерации.");
  }

  const cancellationRaw =
    parsed.cancellation && typeof parsed.cancellation === "object"
      ? (parsed.cancellation as Record<string, unknown>)
      : null;

  return {
    success: true,
    report_id: asString(parsed.report_id, reportId),
    report_status: asString(parsed.report_status, "generating"),
    cancel_requested: parsed.cancel_requested === true,
    cancellation: cancellationRaw
      ? {
          requested: cancellationRaw.requested === true,
          requested_at: asString(cancellationRaw.requested_at) || null,
          requested_by: asString(cancellationRaw.requested_by) || null,
          status:
            cancellationRaw.status === "requested" ||
            cancellationRaw.status === "cancelled"
              ? cancellationRaw.status
              : null,
          cancelled_at: asString(cancellationRaw.cancelled_at) || null,
        }
      : null,
  };
}

export async function fetchBestReadyCoreLayersSpikeReport(
  companyId: string,
  candidateId: string,
): Promise<HrReportFetchResult> {
  const careerResult = await fetchBestReadyCandidateReport(
    companyId,
    candidateId,
    "hr_person_talent_map",
  );
  if (careerResult.report && hasCareerReadingLayers(careerResult.report.content_json)) {
    return careerResult;
  }

  return fetchBestReadyCandidateReport(
    companyId,
    candidateId,
    HR_CORE_LAYERS_SPIKE_REPORT_TYPE,
  );
}

export async function fetchLatestCoreLayersSpikeReport(
  companyId: string,
  candidateId: string,
): Promise<HrReportFetchResult> {
  const [careerLatest, spikeLatest] = await Promise.all([
    fetchLatestHrReport(companyId, candidateId, "hr_person_talent_map"),
    fetchLatestHrReport(companyId, candidateId, HR_CORE_LAYERS_SPIKE_REPORT_TYPE),
  ]);

  const candidates = [careerLatest.report, spikeLatest.report].filter(Boolean) as HrReport[];
  if (candidates.length === 0) {
    return { report: null, error: careerLatest.error ?? spikeLatest.error ?? null };
  }

  const sorted = candidates.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
  const newest = sorted[0];
  if (
    newest.report_type === "hr_person_talent_map" &&
    !hasCareerReadingLayers(newest.content_json) &&
    sorted.length > 1
  ) {
    const careerOrSpike = sorted.find(
      (row) =>
        hasCareerReadingLayers(row.content_json) ||
        row.report_type === HR_CORE_LAYERS_SPIKE_REPORT_TYPE,
    );
    return { report: careerOrSpike ?? newest, error: null };
  }

  return { report: newest, error: null };
}

export { isSupabaseConfigured };
