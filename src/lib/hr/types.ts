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

export type HrReportType =
  | "hr_person_talent_map"
  | "hr_person_talent_map_core_layers_spike";

export type HrReportStatus = "ready" | "generating" | "error" | "draft";

export type HrTalentMapSectionItem = { title: string; body: string; fit?: string };

export type HrPersonTalentMapHero = {
  name?: string;
  subtitle?: string;
  status_label?: string;
  best_work_format?: string;
  key_talent?: string;
  main_risk?: string;
  headline?: string;
};

export type HrPersonTalentMapDataQuality = {
  completeness?: string;
  confidence?: string;
  notes?: string;
  metrics?: TalentMapMetric[];
};

export type HrPersonTalentMapExecutiveSummary = {
  text: string;
  fit_score?: number | null;
};

export type HrPersonTalentMapOnboarding = {
  day_7?: string;
  day_30?: string;
  day_90?: string;
  items?: HrTalentMapSectionItem[];
};

export type HrPersonTalentMapQaMeta = {
  hypothesis_level?: string;
  report_type_note?: string;
  next_best_report?: string;
  disclaimers?: string[];
};

export type HrTalentMapConfidence = "high" | "medium" | "low";

export type HrTalentMapExecutiveSnapshot = {
  one_sentence?: string;
  best_use?: string;
  main_value?: string;
  main_risk?: string;
  how_to_check_first?: string;
  decision_note?: string;
};

export type HrTalentMapLayer = {
  id: string;
  title: string;
  client_summary: string;
  hr_meaning: string;
  key_signal: string;
  risk_signal: string;
  how_to_check: string;
  confidence: HrTalentMapConfidence;
  ui_priority: number;
  source_layer_id: string;
};

export type HrLayerCatalogGroup =
  | "core"
  | "energy_and_decision"
  | "centers_channels_gates"
  | "main_activations"
  | "planetary_activations"
  | "environment_and_motivation"
  | "evidence_and_quality";

export type HrLayerCatalogStatus = "ready" | "partial" | "planned";

export type HrLayerCatalogEntry = {
  layer_key: string;
  hr_title: string;
  group: HrLayerCatalogGroup;
  short_description: string;
  technical_sources: string[];
  status: HrLayerCatalogStatus;
};

export type MergedLayerCatalogItem = HrLayerCatalogEntry & {
  aiLayer?: HrTalentMapLayer;
  v2LayerReport?: HrTalentMapLayerReportV2;
  resolvedStatus: HrLayerCatalogStatus;
  relatedEvidence: HrTalentMapEvidenceItem[];
};

export type HrTalentMapHypothesisType =
  | "talent"
  | "risk"
  | "condition"
  | "management"
  | "growth";

export type HrTalentMapHypothesisCard = {
  id: string;
  type: HrTalentMapHypothesisType;
  title: string;
  statement: string;
  why_it_matters: string;
  workplace_manifestation: string;
  how_to_check: string;
  good_signal: string;
  warning_signal: string;
  related_layer_ids: string[];
  confidence: HrTalentMapConfidence;
  client_visible: boolean;
};

export type HrTalentMapRiskCheck = {
  id: string;
  risk: string;
  how_it_may_show_up: string;
  interview_check: string;
  test_task_check: string;
  good_signal: string;
  warning_signal: string;
  management_prevention: string;
  related_hypothesis_ids: string[];
  confidence: HrTalentMapConfidence;
};

export type HrTalentMapManagementPlaybook = {
  how_to_set_tasks?: string;
  how_to_give_feedback?: string;
  how_to_motivate?: string;
  what_not_to_do?: string;
  best_environment?: string;
  overload_signals?: string;
  first_30_days_focus?: string;
};

export type HrTalentMapVerificationPlan = {
  first_check?: string;
  interview_focus?: string;
  test_task_focus?: string;
  what_to_observe?: string;
  decision_after_check?: string;
};

export type HrTalentMapEvidenceItem = {
  id: string;
  conclusion: string;
  based_on: string[];
  source_layer_ids: string[];
  confidence: HrTalentMapConfidence;
  client_visible: boolean;
};

/** Generation metadata for layered v2 talent map pipeline. */
export type HrTalentMapGenerationMetaV2 = {
  generated_at?: string;
  model?: string;
  prompt_version?: string;
  pipeline_stage?: string;
  input_hash?: string;
};

/** Candidate-facing snapshot in v2 (maps to legacy hero). */
export type HrTalentMapCandidateSnapshotV2 = {
  name?: string;
  subtitle?: string;
  status_label?: string;
  best_work_format?: string;
  key_talent?: string;
  main_risk?: string;
  headline?: string;
};

/** Source chart / input snapshot references for v2. */
export type HrTalentMapSourceSnapshotV2 = {
  candidate_chart_id?: string;
  normalized_chart_hash?: string;
  birth_data_complete?: boolean;
  analysis_packet_version?: string;
};

/** Technical chart readiness in v2. */
export type HrTalentMapTechnicalChartStatusV2 = {
  status?: CandidateChartStatus | string;
  calculated_at?: string;
  can_render_bodygraph?: boolean;
  missing_fields?: string[];
};

/** Data quality block in v2 (extends legacy metrics). */
export type HrTalentMapDataQualityV2 = {
  completeness?: string;
  confidence?: string;
  notes?: string;
  metrics?: TalentMapMetric[];
  missing?: string[];
  reduces_accuracy?: string;
  add_data?: string[];
  suggested_data?: string[];
};

/** HR-facing base layer text (no technical HD language). */
export type HrTalentMapLayerBaseV2 = {
  short_summary?: string;
  detailed_explanation?: string;
  how_it_appears_at_work?: string;
  where_useful?: string;
  risks?: string;
  management_tips?: string;
  what_to_check?: string;
};

/** Pro / technical layer details (side panel only). */
export type HrTalentMapLayerTechnicalSourceV2 = {
  source_key: string;
  source_label: string;
  raw_path: string;
  value_summary: string;
  confidence: HrTalentMapConfidence;
};

/** Pro / technical layer details (side panel only). */
export type HrTalentMapLayerProV2 = {
  technical_sources?: HrTalentMapLayerTechnicalSourceV2[] | string[];
  source_values?: Record<string, unknown> | unknown[];
  connection_logic?: string;
  confidence?: HrTalentMapConfidence;
  limitations?: string[];
  human_check?: string;
};

/** Evidence chart element reference in v2 layer report. */
export type HrTalentMapLayerSourceChartElementV2 = {
  kind: string;
  key: string;
  value: string;
  side: string | null;
  planet: string | null;
  line: string | null;
};

/** Evidence metadata for a single atomic layer report. */
export type HrTalentMapLayerEvidenceV2 = {
  source_fields?: string[];
  source_layer_keys?: string[];
  source_chart_elements?: HrTalentMapLayerSourceChartElementV2[];
  confidence?: HrTalentMapConfidence;
  limitations?: string;
  warnings?: string[];
};

/** Compact role-fit matching payload (stored, not rendered in UI yet). */
export type HrTalentMapMatchingSummaryV2 = {
  summary?: string;
  strong_match_when_role_requires?: string[];
  risk_when_role_requires?: string[];
  needs_from_role?: string[];
  what_to_check_in_role_fit?: string[];
  candidate_layer_key?: string;
  recommended_vacancy_layer_keys?: string[];
  confidence?: HrTalentMapConfidence;
};

/** Estimated OpenAI cost snapshot for core layer generation. */
export type HrTalentMapCostSummaryV2 = {
  model?: string;
  pricing_source?: string;
  input_tokens?: number;
  cached_input_tokens?: number;
  uncached_input_tokens?: number;
  output_tokens?: number;
  reasoning_tokens?: number;
  total_tokens?: number;
  estimated_input_cost_usd?: number | null;
  estimated_cached_input_cost_usd?: number | null;
  estimated_output_cost_usd?: number | null;
  estimated_total_cost_usd?: number | null;
  cost_per_ready_layer_usd?: number | null;
  projected_34_layers_cost_usd?: number | null;
  budget_target_usd?: number;
  budget_warning?: string | null;
  budget_warnings?: string[];
};

/** Atomic layer report in v2 pipeline. */
export type HrTalentMapLayerReportV2 = {
  layer_key: string;
  hr_title?: string;
  group?: HrLayerCatalogGroup;
  status?: HrLayerCatalogStatus;
  ui_priority?: number;
  base?: HrTalentMapLayerBaseV2;
  pro?: HrTalentMapLayerProV2;
  evidence?: HrTalentMapLayerEvidenceV2;
  matching_summary?: HrTalentMapMatchingSummaryV2;
};

/** Generic synthesis block payload (section-specific fields vary). */
export type HrTalentMapSynthesisBlockV2 = {
  text?: string;
  summary?: string;
  one_sentence?: string;
  best_use?: string;
  main_value?: string;
  main_risk?: string;
  how_to_check_first?: string;
  decision_note?: string;
  items?: HrTalentMapSectionItem[];
  cards?: HrTalentMapHypothesisCard[];
  checks?: HrTalentMapRiskCheck[];
  playbook?: HrTalentMapManagementPlaybook;
};

/** Six top-level synthesis sections assembled from atomic layer reports. */
export type HrTalentMapSynthesisBlocksV2 = {
  executive_summary?: HrTalentMapSynthesisBlockV2;
  work_formula?: HrTalentMapSynthesisBlockV2;
  talents?: HrTalentMapSynthesisBlockV2;
  work_environment?: HrTalentMapSynthesisBlockV2;
  risks?: HrTalentMapSynthesisBlockV2;
  management?: HrTalentMapSynthesisBlockV2;
};

/** References to layers/hypotheses used for derived HR actions (future pipeline). */
export type HrTalentMapDerivedActionSourcesV2 = {
  layer_keys?: string[];
  synthesis_keys?: string[];
  notes?: string;
};

/** UI hints for v2 workspace shell. */
export type HrTalentMapUiMetaV2 = {
  default_section?: string;
  show_layer_catalog?: boolean;
  layer_catalog_version?: string;
  [key: string]: unknown;
};

/** QA / disclaimer metadata for v2. */
export type HrTalentMapQaMetaV2 = HrPersonTalentMapQaMeta;

/** Layered content_json v2 for hr_person_talent_map. */
export type HrPersonTalentMapV2 = {
  schema_version: "hr_person_talent_map_v2";
  report_type: "hr_person_talent_map";
  generation_meta?: HrTalentMapGenerationMetaV2;
  candidate_snapshot?: HrTalentMapCandidateSnapshotV2;
  source_snapshot?: HrTalentMapSourceSnapshotV2;
  technical_chart_status?: HrTalentMapTechnicalChartStatusV2;
  data_quality?: HrTalentMapDataQualityV2;
  layer_reports?: HrTalentMapLayerReportV2[];
  synthesis_blocks?: HrTalentMapSynthesisBlocksV2;
  derived_action_sources?: HrTalentMapDerivedActionSourcesV2;
  ui?: HrTalentMapUiMetaV2;
  qa_meta?: HrTalentMapQaMetaV2;
};

/** Parsed talent map content (v1 legacy or v2 layered). */
export type HrPersonTalentMapContent = HrPersonTalentMapV1 | HrPersonTalentMapV2;

/**
 * Raw DB/API content_json — may be object, stringified JSON, partial v1/v2, or unknown shape.
 * Prefer parseReportContentJson + normalizeAiReportContent at runtime.
 */
export type HrReportContentJson =
  | HrPersonTalentMapContent
  | Record<string, unknown>
  | string
  | null;

/** Structured JSON for hr_person_talent_map AI reports (client-facing HR language). */
export type HrPersonTalentMapV1 = {
  schema_version?: string;
  hero: HrPersonTalentMapHero;
  data_quality: HrPersonTalentMapDataQuality;
  executive_summary: HrPersonTalentMapExecutiveSummary;
  working_formula: { text: string };
  talents: HrTalentMapSectionItem[];
  strengths: HrTalentMapSectionItem[];
  risks: HrTalentMapSectionItem[];
  suitable_directions: HrTalentMapSectionItem[];
  questionable_directions: HrTalentMapSectionItem[];
  roles: TalentMapRole[];
  work_environment: HrTalentMapSectionItem[];
  management_style: HrTalentMapSectionItem[];
  interview_questions: HrTalentMapSectionItem[];
  test_tasks: HrTalentMapSectionItem[];
  onboarding_7_30_90: HrPersonTalentMapOnboarding;
  final_hr_recommendation: { text: string };
  qa_meta?: HrPersonTalentMapQaMeta;
  executive_snapshot?: HrTalentMapExecutiveSnapshot;
  layer_map?: HrTalentMapLayer[];
  hypothesis_cards?: HrTalentMapHypothesisCard[];
  risk_checks?: HrTalentMapRiskCheck[];
  management_playbook?: HrTalentMapManagementPlaybook;
  verification_plan?: HrTalentMapVerificationPlan;
  evidence_map?: HrTalentMapEvidenceItem[];
  ui?: unknown;
};

export type HrReport = {
  id: string;
  company_id: string;
  candidate_id: string | null;
  vacancy_id: string | null;
  report_type: HrReportType;
  report_status: HrReportStatus;
  title: string | null;
  summary: string | null;
  fit_score: number | null;
  content_json: HrReportContentJson;
  input_snapshot: Record<string, unknown>;
  input_hash: string;
  model: string | null;
  prompt_version: string;
  generation_error: string | null;
  generated_at: string | null;
  created_at: string;
  updated_at: string;
};
