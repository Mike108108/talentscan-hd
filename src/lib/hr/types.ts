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
