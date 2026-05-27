import { supabase, isSupabaseConfigured } from "../supabase";
import { getAccessToken } from "../auth";
import type {
  CandidateFormData,
  GeocodeSuggestion,
  HrCandidate,
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
): Promise<HrCandidate> {
  if (!supabase) throw new Error("Supabase не настроен");
  const { data: { user } } = await supabase.auth.getUser();
  const row = formToRow(companyId, form, user?.id);
  const { data, error } = await supabase.from("hr_candidates").insert(row).select().single();
  if (error) throw new Error(error.message);
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
  if (!token) throw new Error("Требуется вход в HR-кабинет");
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
    .select("candidate_id, best_work_format, key_talent, main_risk")
    .eq("company_id", companyId);
  if (error) return [];
  return data ?? [];
}

export { isSupabaseConfigured };
