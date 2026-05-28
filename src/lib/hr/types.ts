export type HrProfile = {
  id: string;
  full_name: string;
  role_title: string | null;
  demo_access: boolean;
  created_at: string;
  updated_at: string;
};

export type HrCompany = {
  id: string;
  owner_user_id: string;
  name: string;
  industry: string | null;
  is_demo: boolean;
  created_at: string;
  updated_at: string;
};

export type CandidateChartStatus =
  | "draft"
  | "birth_data_incomplete"
  | "ready_to_calculate"
  | "calculating"
  | "calculated"
  | "calculation_error";

export type HrCandidate = {
  id: string;
  company_id: string;
  created_by_user_id: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  vacancy_title: string | null;
  status: string;
  hr_comment: string | null;
  birth_date: string | null;
  birth_time: string | null;
  birth_place_text: string | null;
  birth_place_lat: number | null;
  birth_place_lon: number | null;
  birth_timezone: string | null;
  chart_status: CandidateChartStatus;
  created_at: string;
  updated_at: string;
};

export type HrCandidateChart = {
  id: string;
  candidate_id: string;
  company_id: string;
  calculation_status: string;
  raw_chart_data: Record<string, unknown> | null;
  normalized_chart_data: Record<string, unknown> | null;
  birth_data_snapshot: Record<string, unknown> | null;
  calculated_at: string | null;
  calculation_error: string | null;
  created_at: string;
  updated_at: string;
};

export type TalentMapMetric = { label: string; value: string; hint?: string };
export type TalentMapItem = { title: string; body: string; fit?: string };
export type TalentMapRole = { role: string; fit: string; note: string };

export type HrCandidateTalentMap = {
  id: string;
  candidate_id: string;
  company_id: string;
  candidate_chart_id: string | null;
  report_status: string;
  summary: string | null;
  best_work_format: string | null;
  key_talent: string | null;
  main_risk: string | null;
  formula: string | null;
  metrics: TalentMapMetric[] | null;
  talents: TalentMapItem[] | null;
  strengths: TalentMapItem[] | null;
  risks: TalentMapItem[] | null;
  directions: TalentMapItem[] | null;
  not_fit_directions: TalentMapItem[] | null;
  roles: TalentMapRole[] | null;
  conditions: TalentMapItem[] | null;
  tests: TalentMapItem[] | null;
  final_recommendation: string | null;
  created_at: string;
  updated_at: string;
};

export type HrVacancyStatus = "draft" | "active" | "paused" | "closed";

export type HrVacancy = {
  id: string;
  company_id: string;
  created_by_user_id: string | null;
  title: string;
  status: HrVacancyStatus;
  source: string;
  department: string | null;
  employment_format: string | null;
  work_format: string | null;
  location: string | null;
  schedule: string | null;
  salary_range: string | null;
  role_description: string | null;
  responsibilities: string | null;
  kpi: string | null;
  must_have: string | null;
  nice_to_have: string | null;
  working_conditions: string | null;
  manager_context: string | null;
  team_context: string | null;
  hiring_priorities: string | null;
  risks_to_check: string | null;
  created_at: string;
  updated_at: string;
};

export type HrVacancyCandidateStage = "new" | "screening" | "interview" | "offer" | "hired" | "rejected";
export type HrVacancyCandidateStatus = "active" | "archived";

export type HrVacancyCandidate = {
  id: string;
  company_id: string;
  vacancy_id: string;
  candidate_id: string;
  stage: string;
  status: string;
  source: string;
  recruiter_comment: string | null;
  created_at: string;
  updated_at: string;
};

export type HrVacancyCandidateWithCandidate = HrVacancyCandidate & {
  candidate: HrCandidate;
  talent_map?: Pick<HrCandidateTalentMap, "id" | "report_status" | "key_talent" | "main_risk"> | null;
};

export type GeocodeSuggestion = {
  id: string;
  label: string;
  city: string;
  region: string;
  country: string;
  lat: number;
  lng: number;
  source: "nominatim";
};

export type CandidateFormData = {
  name: string;
  email: string;
  phone: string;
  vacancy_title: string;
  hr_comment: string;
  birth_date: string;
  birth_time: string;
  birth_place_text: string;
  birth_place_lat: number | null;
  birth_place_lon: number | null;
  birth_timezone: string;
};

export type VacancyFormData = {
  title: string;
  status: HrVacancyStatus;
  department: string;
  employment_format: string;
  work_format: string;
  location: string;
  schedule: string;
  salary_range: string;
  role_description: string;
  responsibilities: string;
  kpi: string;
  must_have: string;
  nice_to_have: string;
  working_conditions: string;
  manager_context: string;
  team_context: string;
  hiring_priorities: string;
  risks_to_check: string;
};
