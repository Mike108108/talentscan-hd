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

export async function fetchLatestCandidateReport(
  companyId: string,
  candidateId: string,
  reportType: HrReportType = "hr_person_talent_map",
): Promise<HrReport | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("hr_reports")
    .select("*")
    .eq("company_id", companyId)
    .eq("candidate_id", candidateId)
    .eq("report_type", reportType)
    .eq("report_status", "ready")
    .order("generated_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error("[hr] latest ready report:", error.message);
    return null;
  }
  return data as HrReport | null;
}

/** Latest report row regardless of status (for post-generate diagnostics). */
export async function fetchLatestHrReport(
  companyId: string,
  candidateId: string,
  reportType: HrReportType = "hr_person_talent_map",
): Promise<HrReport | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("hr_reports")
    .select("*")
    .eq("company_id", companyId)
    .eq("candidate_id", candidateId)
    .eq("report_type", reportType)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error("[hr] latest report (any status):", error.message);
    return null;
  }
  return data as HrReport | null;
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
  let data: { error?: string; report?: HrReport; source?: string } = {};
  if (rawBody) {
    try {
      data = JSON.parse(rawBody) as { error?: string; report?: HrReport; source?: string };
    } catch {
      const preview = rawBody.replace(/\s+/g, " ").slice(0, 160);
      throw new Error(
        `Сервер вернул не-JSON ответ (${resp.status}). ${preview || "Пустое тело ответа."}`,
      );
    }
  }

  if (!resp.ok) {
    throw new Error(data.error ?? `Ошибка генерации отчёта (${resp.status})`);
  }
  if (!data.report) {
    throw new Error("Пустой ответ сервера: отчёт не возвращён");
  }
  if (import.meta.env.DEV) {
    console.info("[HR report generate] response", {
      status: data.report.report_status,
      id: data.report.id,
      hasContent: data.report.content_json != null,
    });
  }
  return data.report;
}

export { isSupabaseConfigured };
