import { Component, useEffect, useMemo, useRef, useState } from "react";
import type { ErrorInfo, ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { HrSidePanel } from "../../components/hr/HrSidePanel";
import {
  CoreLayersStatusResponse,
  fetchBestReadyCandidateReport,
  fetchBestReadyCoreLayersSpikeReport,
  fetchCandidate,
  fetchCandidateVacancies,
  fetchCoreLayersStatus,
  fetchLatestCoreLayersSpikeReport,
  HR_CORE_LAYERS_SPIKE_REPORT_TYPE,
  startCandidateCoreLayersReport,
} from "../../lib/hr/api";
import {
  canParseReportContent,
  getReportContentRoot,
  isDisplayableTalentMapReport,
  isReadyTalentMapReport,
  isTalentMapV12,
  logNormalizedWorkspaceContent,
  logReportContentShape,
  normalizeAiReportContent,
} from "../../lib/hr/normalizeAiReport";
import {
  confidenceLabelRu,
  formatReportDate,
  getText,
  sortLayersByPriority,
} from "../../lib/hr/talentMapUiHelpers";
import { hrPersonTalentMapV2Fixture } from "../../lib/hr/fixtures/hrPersonTalentMapV2Fixture";
import type {
  HrCandidate,
  HrPersonTalentMapV1,
  HrReport,
  HrReportStatus,
  HrVacancy,
  TalentMapRole,
} from "../../lib/hr/types";
import { formulaToSafeHtml } from "../../lib/safeHtml";
import {
  buildReportLists,
  buildMergedLayerCatalog,
  CatalogLayerDetailPanel,
  DataQualitySection,
  formatDataQuality,
  getCatalogLayerByKey,
  getDetailPanelTitle,
  ItemDetailPanel,
  LayerCatalogList,
  LAYER_GROUP_LABELS,
  ManagementPlaybookGrid,
  type DetailPanelState,
  type ReportContentCtx,
  VerificationPlanBlock,
} from "./talentMapPanelContent";
import type { OnboardingPhase } from "../../lib/hr/talentMapUiHelpers";
import "../../hr.css";

type SectionId =
  | "overview"
  | "formula"
  | "talents"
  | "work_env"
  | "risks"
  | "management"
  | "layers"
  | "profile"
  | "checks"
  | "interview"
  | "test"
  | "onboarding"
  | "data"
  | "roles";

const NAV_SECTIONS_V12: Array<{ id: SectionId; label: string; hint?: string }> = [
  { id: "overview", label: "Обзор" },
  { id: "formula", label: "Рабочая формула" },
  { id: "talents", label: "Таланты" },
  { id: "work_env", label: "Рабочая среда" },
  { id: "risks", label: "Риски" },
  { id: "management", label: "Управление" },
  { id: "layers", label: "Слои карты", hint: "HR-расшифровка по слоям" },
];

const CORE_LAYER_POLL_INTERVAL_MS = 2500;
const CORE_LAYER_POLL_MAX_MS = 8 * 60 * 1000;

const CORE_LAYER_UI_ORDER: Array<{ key: string; title: string }> = [
  { key: "work_format", title: "Рабочий формат" },
  { key: "task_entry", title: "Вход в задачи" },
  { key: "decision_style", title: "Принятие решений" },
  { key: "work_signature", title: "Рабочий почерк" },
  { key: "inner_coherence", title: "Внутренняя связность" },
  { key: "stable_zones", title: "Устойчивые зоны" },
  { key: "sensitive_zones", title: "Чувствительные зоны" },
  { key: "talent_links", title: "Связки талантов" },
  { key: "point_talents", title: "Точечные таланты" },
  { key: "amplified_themes", title: "Усиленные темы" },
  { key: "conscious_axis", title: "Сознательная рабочая ось" },
  { key: "background_axis", title: "Фоновая рабочая ось" },
  { key: "communication_style", title: "Коммуникация и объяснение" },
  { key: "values_and_culture", title: "Ценности и культура" },
  { key: "growth_tension", title: "Напряжение и рост" },
  { key: "responsibility_and_rules", title: "Ответственность и правила" },
  { key: "work_environment_and_recovery", title: "Среда и восстановление" },
  { key: "motivation_and_focus", title: "Мотивация и фокус" },
  { key: "team_contribution_type", title: "Тип вклада в команду" },
];

const NAV_SECTIONS_LEGACY: Array<{ id: SectionId; label: string; hint?: string }> = [
  { id: "overview", label: "Обзор" },
  { id: "formula", label: "Рабочая формула" },
  { id: "talents", label: "Таланты" },
  { id: "work_env", label: "Рабочая среда" },
  { id: "risks", label: "Риски" },
  { id: "management", label: "Управление" },
  { id: "layers", label: "Слои карты" },
];

type ReportSnapshot = {
  id?: string;
  company_id?: string;
  candidate_id?: string;
  report_type?: string;
  report_status?: string;
  has_content_json?: boolean;
  generation_error?: string | null;
};

function shouldUseV2FixturePreview(): boolean {
  const params = new URLSearchParams(window.location.search);
  const wantsV2Fixture = params.get("tm_v2_fixture") === "1";
  const canUseV2Fixture =
    import.meta.env.DEV ||
    import.meta.env.VITE_ENABLE_HR_TALENT_MAP_V2_FIXTURE === "true";
  return wantsV2Fixture && canUseV2Fixture;
}

function buildV2FixtureReport(companyId: string, candidateId: string): HrReport {
  const now = new Date().toISOString();
  return {
    id: "dev-v2-fixture",
    company_id: companyId,
    candidate_id: candidateId,
    vacancy_id: null,
    report_type: "hr_person_talent_map",
    report_status: "ready",
    title: "Dev fixture: HR Talent Map v2",
    summary: "Локальный preview content_json v2",
    fit_score: null,
    content_json: hrPersonTalentMapV2Fixture,
    input_snapshot: {},
    input_hash: "dev-v2-fixture",
    model: "fixture",
    prompt_version: "hr_person_talent_map_v2_fixture",
    generation_error: null,
    generated_at: now,
    created_at: now,
    updated_at: now,
  };
}

function snapshotReport(report: HrReport | null): ReportSnapshot | null {
  if (!report) return null;
  return {
    id: report.id,
    company_id: report.company_id,
    candidate_id: report.candidate_id ?? undefined,
    report_type: report.report_type,
    report_status: report.report_status,
    has_content_json: report.content_json != null,
    generation_error: report.generation_error || undefined,
  };
}

function isCoreLayersSpikeReport(report: HrReport | null | undefined): boolean {
  return report?.report_type === HR_CORE_LAYERS_SPIKE_REPORT_TYPE;
}

function isReportReadyForDisplay(report: HrReport | null | undefined): boolean {
  if (!report) return false;
  if (isCoreLayersSpikeReport(report)) return isDisplayableTalentMapReport(report);
  return isReadyTalentMapReport(report);
}

function formatUsageMetric(value: unknown): string {
  if (typeof value === "number" && Number.isFinite(value)) return String(Math.round(value));
  return "—";
}

function formatCostUsd(value: unknown): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return `$${value.toFixed(4)}`;
}

function getCostSummary(usageSummary: Record<string, unknown> | undefined) {
  if (!usageSummary) return null;
  const cost = usageSummary.cost_summary;
  if (!cost || typeof cost !== "object") return null;
  return cost as Record<string, unknown>;
}

function normalizeHrCopy(text: unknown): string {
  const t = getText(text);
  if (!t) return "";
  return t
    .replaceAll(
      /Wait for the Invitation/gi,
      "Лучше включается в работу, когда есть ясный запрос, понятная роль и ожидаемый результат.",
    )
    .replaceAll(/Invitation/gi, "ясный запрос");
}

function normalizeHrMaybe(text: unknown): string | null {
  const t = normalizeHrCopy(text);
  return t || null;
}

function MetaOverviewRow({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="hr-tm-snapshot-row">
      <span className="hr-tm-snapshot-label">{label}</span>
      <p className="hr-tm-snapshot-value">{value}</p>
    </div>
  );
}

function ConfidencePill({ confidence }: { confidence?: string }) {
  const label = confidenceLabelRu(confidence);
  const mod =
    confidence === "high"
      ? "hr-tm-confidence--high"
      : confidence === "low"
        ? "hr-tm-confidence--low"
        : "hr-tm-confidence--medium";
  return <span className={`hr-tm-confidence hr-tm-confidence--compact ${mod}`}>{label}</span>;
}

function HypothesisCardRow({
  title,
  statement,
  manifestation,
  confidence,
  onClick,
}: {
  title: string;
  statement: string;
  manifestation?: string;
  confidence?: string;
  onClick?: () => void;
}) {
  return (
    <CompactRow
      title={title}
      subtitle={statement || manifestation}
      onClick={onClick}
      badge={confidence ? <ConfidencePill confidence={confidence} /> : undefined}
    />
  );
}

function RiskCheckCardRow({
  risk,
  showUp,
  confidence,
  onClick,
}: {
  risk: string;
  showUp?: string;
  confidence?: string;
  onClick?: () => void;
}) {
  return (
    <CompactRow
      title={risk}
      subtitle={showUp}
      onClick={onClick}
      badge={confidence ? <ConfidencePill confidence={confidence} /> : undefined}
    />
  );
}
function CompactRow({
  title,
  subtitle,
  onClick,
  badge,
}: {
  title: unknown;
  subtitle?: unknown;
  onClick?: () => void;
  badge?: ReactNode;
}) {
  const safeTitle = getText(title, "—");
  const safeSubtitle = subtitle != null ? getText(subtitle) || null : null;
  const body = (
    <>
      <span className="hr-tm-row-body">
        <span className="hr-tm-row-title">{safeTitle}</span>
        {safeSubtitle ? <span className="hr-tm-row-sub">{safeSubtitle}</span> : null}
        {badge ? <span className="hr-tm-row-badge">{badge}</span> : null}
      </span>
      {onClick ? <span className="hr-tm-row-chevron" aria-hidden>→</span> : null}
    </>
  );
  if (onClick) {
    return (
      <button type="button" className="hr-tm-row hr-tm-row--clickable" onClick={onClick}>
        {body}
      </button>
    );
  }
  return <div className="hr-tm-row">{body}</div>;
}

function StatPill({
  label,
  value,
  onClick,
}: {
  label: string;
  value: string;
  onClick?: () => void;
}) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      className={`hr-tm-stat-pill${onClick ? " hr-tm-stat-pill--clickable" : ""}`}
      onClick={onClick}
    >
      <span className="hr-tm-stat-pill-label">{label}</span>
      <span className="hr-tm-stat-pill-value">{value}</span>
    </Tag>
  );
}

function RolesTable({ roles }: { roles: TalentMapRole[] }) {
  if (!roles.length) return <p className="hr-muted">Нет данных</p>;
  return (
    <div className="hr-tm-table-wrap">
      <table className="hr-tm-roles-table">
        <thead>
          <tr>
            <th>Роль</th>
            <th>Соответствие</th>
            <th>Заметка</th>
          </tr>
        </thead>
        <tbody>
          {roles.map((r, idx) => (
            <tr key={`${getText(r.role)}-${idx}`}>
              <td>{getText(r.role)}</td>
              <td>{getText(r.fit)}</td>
              <td>{normalizeHrCopy(r.note)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type WorkspaceProps = {
  candidate: HrCandidate;
  companyId: string;
  candidateId: string;
  vacancies: HrVacancy[];
  aiContent: HrPersonTalentMapV1;
  rawAiContent: unknown;
  aiReport: HrReport;
  onRegenerate: () => void;
  generating: boolean;
  genError: string | null;
  isFixturePreview?: boolean;
};

function TalentMapWorkspace({
  candidate,
  companyId,
  candidateId,
  vacancies,
  aiContent,
  rawAiContent,
  aiReport,
  onRegenerate,
  generating,
  genError,
  isFixturePreview = false,
}: WorkspaceProps) {
  const isCoreLayersSpike = aiReport.report_type === HR_CORE_LAYERS_SPIKE_REPORT_TYPE;
  const [section, setSection] = useState<SectionId>(
    isCoreLayersSpike ? "layers" : "overview",
  );
  const [detail, setDetail] = useState<DetailPanelState | null>(null);

  useEffect(() => {
    if (isCoreLayersSpike) {
      setSection("layers");
    }
  }, [aiReport.id, isCoreLayersSpike]);

  useEffect(() => {
    if (generating) setDetail(null);
  }, [generating]);

  const ctx: ReportContentCtx = {
    aiContent,
    rawContent: rawAiContent,
    vacancies,
    normalizeHrCopy,
    normalizeHrMaybe,
  };

  const isV12 = useMemo(
    () => isTalentMapV12(getReportContentRoot(rawAiContent)),
    [rawAiContent],
  );
  const navSections = isV12 ? NAV_SECTIONS_V12 : NAV_SECTIONS_LEGACY;

  const lists = useMemo(() => {
    try {
      return buildReportLists(ctx);
    } catch (err) {
      console.error("[TalentMapWorkspace] buildReportLists failed", err);
      return {
        layers: [],
        hypothesisCards: [],
        talentHypotheses: [],
        riskChecks: [],
        risks: [],
        interviews: [],
        tests: [],
        talents: [],
        strengths: [],
        directions: [],
        questionable: [],
        workEnv: [],
        mgmt: [],
        roles: [],
        onboardingPhases: [],
        managementPlaybook: undefined,
        verificationPlan: undefined,
        executiveSnapshot: undefined,
        evidenceMap: [],
      };
    }
  }, [aiContent, rawAiContent, vacancies]);

  const sortedLayers = useMemo(
    () => sortLayersByPriority(lists.layers ?? []),
    [lists.layers],
  );

  const mergedCatalog = useMemo(
    () => buildMergedLayerCatalog(lists.layers ?? [], lists.evidenceMap ?? [], rawAiContent),
    [lists.layers, lists.evidenceMap, rawAiContent],
  );

  const hero = aiContent.hero;
  const snapshot = lists.executiveSnapshot ?? aiContent.executive_snapshot;
  const bestWorkFormat = normalizeHrMaybe(snapshot?.best_use ?? hero?.best_work_format);
  const keyTalent = normalizeHrMaybe(snapshot?.main_value ?? hero?.key_talent);
  const mainRisk = normalizeHrMaybe(snapshot?.main_risk ?? hero?.main_risk);
  const summaryText = normalizeHrMaybe(
    snapshot?.one_sentence ??
      aiContent.executive_summary?.text ??
      hero?.headline,
  );
  const finalRec = normalizeHrMaybe(
    snapshot?.decision_note ?? aiContent.final_hr_recommendation?.text,
  );
  const formulaText = getText(aiContent.working_formula?.text);
  const formulaHtml = formulaText ? formulaToSafeHtml(formulaText) : "";

  const confidenceLabel = formatDataQuality(aiContent.data_quality?.confidence);

  const updatedLabel = formatReportDate(
    aiReport.generated_at ?? aiReport.updated_at,
  );
  const vacancyLabel =
    vacancies.length === 1
      ? vacancies[0].title
      : vacancies.length > 1
        ? `${vacancies.length} вакансии`
        : candidate.vacancy_title || "не привязана";

  const checkHint =
    lists.interviews.length > 0
      ? `${lists.interviews.length} вопросов`
      : lists.tests.length > 0
        ? "тестовое задание"
        : "кейс + встреча";

  const nextStep =
    normalizeHrMaybe(snapshot?.how_to_check_first) ??
    finalRec ??
    (lists.interviews.length > 0
      ? "Провести интервью по вопросам из раздела «Интервью»."
      : "Уточнить опыт и мотивацию на встрече.");

  const mainConclusion = summaryText ?? finalRec ?? "Разбор готов — откройте разделы ниже для деталей.";

  const showDataQualityWarn =
    (aiContent.data_quality?.confidence ?? "").trim().toLowerCase() === "low" ||
    confidenceLabel === "низкая" ||
    /низк|мало|огранич|неполн/i.test(getText(aiContent.data_quality?.completeness));

  const formatSection: SectionId = isV12 ? "formula" : "profile";
  const checkSection: SectionId = isV12 ? "risks" : "checks";

  const topHypotheses = (lists.hypothesisCards ?? []).slice(0, 5);

  const detailLists = {
    risks: lists.risks,
    riskChecks: lists.riskChecks ?? [],
    interviews: lists.interviews,
    tests: lists.tests,
    talents: lists.talents,
    hypothesisCards: lists.hypothesisCards ?? [],
    layers: sortedLayers,
    strengths: lists.strengths,
    directions: lists.directions,
    roles: lists.roles,
  };

  const onboardingPhaseKey = (phase: OnboardingPhase, idx: number): "7" | "30" | "90" => {
    const label = phase.label ?? "";
    if (label.includes("7")) return "7";
    if (label.includes("30")) return "30";
    if (label.includes("90")) return "90";
    return (["7", "30", "90"] as const)[idx] ?? "7";
  };

  const renderSection = () => {
    switch (section) {
      case "overview":
        if (isV12) {
          return (
            <div className="hr-tm-section-stack">
              {summaryText ? (
                <div className="hr-tm-snapshot-block">
                  <h3 className="hr-tm-section-h">Главный вывод</h3>
                  <p className="hr-tm-section-lead">{summaryText}</p>
                </div>
              ) : null}
              {bestWorkFormat ? (
                <MetaOverviewRow label="Где даст максимум пользы" value={bestWorkFormat} />
              ) : null}
              {keyTalent ? (
                <MetaOverviewRow label="Главная ценность" value={keyTalent} />
              ) : null}
              {mainRisk ? (
                <MetaOverviewRow label="Главный риск" value={mainRisk} />
              ) : null}
              {snapshot?.how_to_check_first ? (
                <MetaOverviewRow label="Что проверить первым" value={snapshot.how_to_check_first} />
              ) : null}
              {finalRec ? (
                <MetaOverviewRow label="Заметка для решения" value={finalRec} />
              ) : null}
              {topHypotheses.length > 0 ? (
                <div>
                  <h3 className="hr-tm-section-h">Быстрые выводы</h3>
                  {topHypotheses.map((h, i) => {
                    const fullIndex = (lists.hypothesisCards ?? []).findIndex((x) => x.id === h.id);
                    return (
                    <HypothesisCardRow
                      key={h.id || `${h.title}-${i}`}
                      title={h.title}
                      statement={h.statement}
                      manifestation={h.workplace_manifestation}
                      confidence={h.confidence}
                      onClick={() =>
                        setDetail({
                          kind: "hypothesis",
                          index: fullIndex >= 0 ? fullIndex : i,
                        })
                      }
                    />
                    );
                  })}
                </div>
              ) : null}
            </div>
          );
        }
        return (
          <div className="hr-tm-section-stack">
            {formulaHtml ? (
              <div>
                <h3 className="hr-tm-section-h">Условия раскрытия</h3>
                <div
                  className="hr-tm-overview-formula"
                  dangerouslySetInnerHTML={{ __html: formulaHtml }}
                />
              </div>
            ) : null}
            {keyTalent ? (
              <div>
                <h3 className="hr-tm-section-h">Ключевой талант</h3>
                <p className="hr-muted">{keyTalent}</p>
              </div>
            ) : null}
            {mainRisk ? (
              <div>
                <h3 className="hr-tm-section-h">Главный риск</h3>
                <p className="hr-muted">{mainRisk}</p>
              </div>
            ) : null}
          </div>
        );
      case "formula":
        return (
          <div className="hr-tm-section-stack">
            {formulaHtml ? (
              <div>
                <h3 className="hr-tm-section-h">Как человек работает</h3>
                <div
                  className="hr-tm-overview-formula"
                  dangerouslySetInnerHTML={{ __html: formulaHtml }}
                />
              </div>
            ) : summaryText ? (
              <p className="hr-tm-section-lead">{summaryText}</p>
            ) : null}
            {bestWorkFormat ? (
              <MetaOverviewRow label="Как включается в задачи" value={bestWorkFormat} />
            ) : null}
            {keyTalent ? (
              <MetaOverviewRow label="Как проявляет пользу" value={keyTalent} />
            ) : null}
            {snapshot?.decision_note ? (
              <MetaOverviewRow label="Как принимает решения" value={snapshot.decision_note} />
            ) : null}
            {!formulaHtml && !summaryText && !bestWorkFormat && !keyTalent ? (
              <p className="hr-muted">Рабочая формула появится после генерации карты.</p>
            ) : null}
          </div>
        );
      case "work_env":
        return (
          <div className="hr-tm-section-stack">
            {lists.managementPlaybook?.best_environment ? (
              <div className="hr-tm-playbook-card">
                <h4 className="hr-tm-playbook-card-title">Подходящая среда</h4>
                <p>{normalizeHrCopy(lists.managementPlaybook.best_environment)}</p>
              </div>
            ) : null}
            {lists.workEnv.length === 0 && !lists.managementPlaybook?.best_environment ? (
              <p className="hr-muted">Нет данных о рабочей среде</p>
            ) : null}
            {lists.workEnv.map((c, i) => (
              <CompactRow key={`${c.title}-${i}`} title={c.title} subtitle={c.body} />
            ))}
            {lists.managementPlaybook?.overload_signals ? (
              <div className="hr-tm-playbook-card">
                <h4 className="hr-tm-playbook-card-title">Что может перегружать</h4>
                <p>{normalizeHrCopy(lists.managementPlaybook.overload_signals)}</p>
              </div>
            ) : null}
          </div>
        );
      case "layers":
        return (
          <LayerCatalogList
            catalog={mergedCatalog}
            onSelectLayer={(layerKey) => setDetail({ kind: "catalog_layer", layerKey })}
          />
        );
      case "talents": {
        const talentItems = lists.talentHypotheses?.length
          ? lists.talentHypotheses
          : null;
        if (talentItems && talentItems.length > 0) {
          return (
            <div className="hr-tm-section-stack">
              {talentItems.map((h, i) => (
                <HypothesisCardRow
                  key={h.id || `${h.title}-${i}`}
                  title={h.title}
                  statement={h.statement}
                  manifestation={h.workplace_manifestation}
                  confidence={h.confidence}
                  onClick={() => setDetail({ kind: "talent", index: i })}
                />
              ))}
            </div>
          );
        }
        return (
          <div className="hr-tm-section-stack">
            {lists.talents.length === 0 && lists.strengths.length === 0 ? (
              <p className="hr-muted">Нет данных</p>
            ) : null}
            {lists.talents.map((t, i) => (
              <CompactRow
                key={`${t.title}-${i}`}
                title={t.title}
                subtitle={t.body}
                onClick={() => setDetail({ kind: "talent", index: i })}
              />
            ))}
            {lists.strengths.length > 0 ? (
              <>
                <h3 className="hr-tm-section-h">Сильные стороны</h3>
                {lists.strengths.map((s, i) => (
                  <CompactRow
                    key={`${s.title}-${i}`}
                    title={s.title}
                    subtitle={s.body}
                    onClick={() => setDetail({ kind: "strength", index: i })}
                  />
                ))}
              </>
            ) : null}
          </div>
        );
      }
      case "management":
        if (lists.managementPlaybook) {
          const pb = lists.managementPlaybook;
          const playbookForMgmt = {
            ...pb,
            best_environment: undefined,
            overload_signals: undefined,
          };
          return (
            <div className="hr-tm-section-stack">
              <ManagementPlaybookGrid
                playbook={playbookForMgmt}
                normalizeHrCopy={normalizeHrCopy}
              />
              {lists.mgmt.map((c, i) => (
                <CompactRow key={`${c.title}-${i}`} title={c.title} subtitle={c.body} />
              ))}
            </div>
          );
        }
        return (
          <div className="hr-tm-section-stack">
            <h3 className="hr-tm-section-h">Управление</h3>
            {lists.mgmt.map((c, i) => (
              <CompactRow key={`${c.title}-${i}`} title={c.title} subtitle={c.body} />
            ))}
            {lists.mgmt.length === 0 ? <p className="hr-muted">Нет данных</p> : null}
          </div>
        );
      case "profile":
        return (
          <div className="hr-tm-section-stack">
            {bestWorkFormat ? (
              <p>
                <strong>Рабочий формат:</strong> {bestWorkFormat}
              </p>
            ) : null}
            {formulaHtml ? (
              <div
                className="hr-tm-overview-formula"
                dangerouslySetInnerHTML={{ __html: formulaHtml }}
              />
            ) : null}
            <h3 className="hr-tm-section-h">Таланты</h3>
            {lists.talents.length === 0 ? (
              <p className="hr-muted">Нет данных</p>
            ) : (
              lists.talents.map((t, i) => (
                <CompactRow
                  key={`${t.title}-${i}`}
                  title={t.title}
                  subtitle={t.body}
                  onClick={() => setDetail({ kind: "talent", index: i })}
                />
              ))
            )}
            <h3 className="hr-tm-section-h">Сильные стороны</h3>
            {lists.strengths.map((s, i) => (
              <CompactRow
                key={`${s.title}-${i}`}
                title={s.title}
                subtitle={s.body}
                onClick={() => setDetail({ kind: "strength", index: i })}
              />
            ))}
            <h3 className="hr-tm-section-h">Подходящие направления</h3>
            {lists.directions.map((d, i) => (
              <CompactRow
                key={`${d.title}-${i}`}
                title={d.title}
                subtitle={d.body}
                onClick={() => setDetail({ kind: "direction", index: i })}
              />
            ))}
          </div>
        );
      case "risks":
        if (isV12 && (lists.riskChecks?.length ?? 0) > 0) {
          return (
            <div className="hr-tm-section-stack">
              <VerificationPlanBlock
                plan={lists.verificationPlan}
                normalizeHrCopy={normalizeHrCopy}
              />
              {lists.riskChecks?.map((check, i) => (
                <RiskCheckCardRow
                  key={check.id || `${check.risk}-${i}`}
                  risk={check.risk}
                  showUp={check.how_it_may_show_up}
                  confidence={check.confidence}
                  onClick={() => setDetail({ kind: "risk_check", index: i })}
                />
              ))}
            </div>
          );
        }
        return (
          <div className="hr-tm-section-stack">
            {mainRisk ? <p className="hr-tm-section-lead">{mainRisk}</p> : null}
            {lists.risks.map((r, i) => (
              <CompactRow
                key={`${r.title}-${i}`}
                title={r.title}
                subtitle={r.body}
                onClick={() => setDetail({ kind: "risk", index: i })}
              />
            ))}
            {!isV12 ? (
              <>
                <h3 className="hr-tm-section-h">Среда и управление</h3>
                {[...lists.workEnv, ...lists.mgmt].map((c, i) => (
                  <CompactRow key={`${c.title}-${i}`} title={c.title} subtitle={c.body} />
                ))}
                <h3 className="hr-tm-section-h">Спорные направления</h3>
                {lists.questionable.map((q, i) => (
                  <CompactRow key={`${q.title}-${i}`} title={q.title} subtitle={q.body} />
                ))}
              </>
            ) : null}
          </div>
        );
      case "checks":
        return (
          <div className="hr-tm-section-stack">
            <p className="hr-muted">
              Краткий план: интервью для проверки гипотез и короткое тестовое по роли.
            </p>
            <CompactRow
              title="Интервью"
              subtitle={`${lists.interviews.length} вопросов`}
              onClick={() => setSection("interview")}
            />
            <CompactRow
              title="Тестовое"
              subtitle={`${lists.tests.length} заданий`}
              onClick={() => setSection("test")}
            />
          </div>
        );
      case "interview":
        return lists.interviews.length === 0 ? (
          <p className="hr-muted">
            Вопросы появятся после генерации карты с достаточным контекстом.
          </p>
        ) : (
          lists.interviews.map((q, i) => (
            <CompactRow
              key={`${q.title}-${i}`}
              title={q.title}
              subtitle={q.checks || q.body}
              onClick={() => setDetail({ kind: "interview", index: i })}
            />
          ))
        );
      case "test":
        return lists.tests.length === 0 ? (
          <p className="hr-muted">Практические задания появятся в полном разборе.</p>
        ) : (
          lists.tests.map((t, i) => (
            <CompactRow
              key={`${t.title}-${i}`}
              title={t.title}
              subtitle={t.checks || t.body}
              onClick={() => setDetail({ kind: "test", index: i })}
            />
          ))
        );
      case "onboarding":
        return lists.onboardingPhases.length === 0 ? (
          <p className="hr-muted">План адаптации появится при достаточном контексте роли.</p>
        ) : (
          lists.onboardingPhases.map((phase, i) => (
            <CompactRow
              key={`${getText(phase.label, "phase")}-${i}`}
              title={getText(phase.label, "Этап")}
              subtitle={getText(phase.summary ?? phase.focus, "Открыть этап")}
              onClick={() =>
                setDetail({ kind: "onboarding", phase: onboardingPhaseKey(phase, i) })
              }
            />
          ))
        );
      case "data":
        return <DataQualitySection ctx={ctx} />;
      case "roles":
        return (
          <div className="hr-tm-section-stack">
            {vacancies.length === 0 ? (
              <p className="hr-muted">Вакансия не привязана — привяжите кандидата для оценки под роль.</p>
            ) : (
              vacancies.map((v) => (
                <div key={v.id} className="hr-tm-row">
                  <span className="hr-tm-row-title">{v.title}</span>
                  <span className="hr-tm-row-sub">{v.status}</span>
                  <Link
                    to={`/hr/company/${companyId}/vacancies/${v.id}`}
                    className="hr-btn hr-btn--ghost"
                    style={{ marginLeft: "auto", flexShrink: 0 }}
                  >
                    Открыть
                  </Link>
                </div>
              ))
            )}
            <h3 className="hr-tm-section-h">Подходящие роли</h3>
            {lists.roles.map((r, i) => (
              <CompactRow
                key={`${r.role}-${i}`}
                title={r.role}
                subtitle={`${r.fit ?? "—"} · ${normalizeHrCopy(r.note ?? "")}`}
                onClick={() => setDetail({ kind: "role", index: i })}
              />
            ))}
            {lists.roles.length > 3 ? (
              <RolesTable roles={lists.roles} />
            ) : null}
          </div>
        );
      default:
        return null;
    }
  };

  const contentRoot = getReportContentRoot(rawAiContent);
  const generationMeta =
    contentRoot.generation_meta && typeof contentRoot.generation_meta === "object"
      ? (contentRoot.generation_meta as Record<string, unknown>)
      : {};
  const layerGeneration =
    generationMeta.layer_generation && typeof generationMeta.layer_generation === "object"
      ? (generationMeta.layer_generation as Record<string, unknown>)
      : null;
  const layerSummary =
    layerGeneration?.summary && typeof layerGeneration.summary === "object"
      ? (layerGeneration.summary as Record<string, unknown>)
      : null;
  const usageSummary =
    (layerSummary?.usage_summary as Record<string, unknown> | undefined) ??
    (generationMeta.usage_summary as Record<string, unknown> | undefined);
  const costSummary = getCostSummary(usageSummary);
  const budgetWarnings = Array.isArray(costSummary?.budget_warnings)
    ? (costSummary.budget_warnings as unknown[]).map((w) => getText(w)).filter(Boolean)
    : [];
  const layerReportsCount = Array.isArray(contentRoot.layer_reports)
    ? contentRoot.layer_reports.length
    : sortedLayers.length;
  const spikeReadyCount =
    typeof layerSummary?.ready === "number" ? layerSummary.ready : layerReportsCount;
  const spikeTotal =
    typeof layerSummary?.total === "number" ? layerSummary.total : CORE_LAYER_UI_ORDER.length;

  const catalogLayerDetail =
    detail?.kind === "catalog_layer"
      ? getCatalogLayerByKey(mergedCatalog, detail.layerKey)
      : null;

  const sidePanelTitle =
    detail?.kind === "catalog_layer"
      ? (catalogLayerDetail?.hr_title ?? "Слой карты")
      : detail
        ? getDetailPanelTitle(detail, detailLists)
        : "";

  return (
    <div className={`hr-tm-page hr-tm-page--workspace${isV12 ? " hr-tm-page--v12" : ""}`}>
      <div className="hr-tm-header">
        <div className="hr-tm-header-top">
          <Link to={`/hr/company/${companyId}/candidates/${candidateId}`} className="hr-tm-back">
            ← К кандидату
          </Link>
          {!isFixturePreview ? (
            <button
              type="button"
              className="hr-btn hr-btn--ghost"
              disabled={generating}
              onClick={onRegenerate}
            >
              {generating
                ? "Генерируем послойную карту…"
                : isCoreLayersSpike
                  ? "Перегенерировать послойную карту"
                  : "Создать послойную карту v2"}
            </button>
          ) : null}
        </div>

        {isFixturePreview ? (
          <p className="hr-tm-dev-fixture-pill">DEV: показан content_json v2 fixture</p>
        ) : null}

        {isCoreLayersSpike ? (
          <div className="hr-tm-spike-banner" role="status">
            <p className="hr-tm-spike-banner-title">Product layers v0.2 · послойная карта</p>
            <p className="hr-tm-spike-banner-text">
              Synthesis-блоки ещё не собраны, поэтому верхние блоки могут быть неполными. Основной
              результат сейчас — раздел «Слои карты» с продуктовой структурой v0.2 (16 слоёв +
              надёжность данных).
            </p>
            <div className="hr-tm-spike-meta-grid">
              <span>run_mode: {getText(generationMeta.run_mode) || "—"}</span>
              <span>
                model: {getText(generationMeta.selected_model ?? aiReport.model) || "—"}
              </span>
              <span>prompt: {aiReport.prompt_version || "—"}</span>
              <span>
                готово: {spikeReadyCount}/{spikeTotal}
              </span>
              <span>слои в отчёте: {layerReportsCount}</span>
              {typeof layerSummary?.attempts_total === "number" ? (
                <span>attempts: {layerSummary.attempts_total}</span>
              ) : null}
              {usageSummary ? (
                <span>
                  tokens: in {formatUsageMetric(usageSummary.input_tokens_total)} · out{" "}
                  {formatUsageMetric(usageSummary.output_tokens_total)} · total{" "}
                  {formatUsageMetric(usageSummary.total_tokens_total)}
                </span>
              ) : null}
              {costSummary ? (
                <span>
                  est. cost: {formatCostUsd(costSummary.estimated_total_cost_usd)} · 34-layer
                  proj: {formatCostUsd(costSummary.projected_34_layers_cost_usd)}
                </span>
              ) : null}
              {budgetWarnings.length > 0 ? (
                <span>warnings: {budgetWarnings.join("; ")}</span>
              ) : null}
            </div>
          </div>
        ) : null}

        {generating && (
          <p className="hr-tm-banner hr-tm-banner--info">Генерируем послойную карту…</p>
        )}
        {genError && (
          <p className="hr-tm-banner hr-tm-banner--error">
            {genError}
            <button type="button" className="hr-btn hr-btn--ghost" onClick={onRegenerate}>
              Повторить генерацию
            </button>
          </p>
        )}

        <h2 className="hr-tm-title">Карта талантов</h2>
        <p className="hr-tm-subtitle">
          <b>{candidate.name}</b>
        </p>
        <p className="hr-tm-meta-line">
          <span className="hr-status hr-status--ok">Разбор готов</span>
          {updatedLabel ? <span>· обновлено {updatedLabel}</span> : null}
          <span>· вакансия {vacancyLabel}</span>
        </p>

        <div className="hr-tm-conclusion">
          <h3 className="hr-tm-conclusion-title">Главный HR-вывод</h3>
          <p className="hr-tm-conclusion-text">{mainConclusion}</p>
          <p className="hr-tm-conclusion-next">
            <span className="hr-tm-conclusion-next-label">Следующий шаг:</span> {nextStep}
          </p>
          {showDataQualityWarn ? (
            <p className="hr-tm-conclusion-warn">
              Данных пока мало — выводы предварительные. Добавьте контекст вакансии и перегенерируйте
              карту.
            </p>
          ) : null}
        </div>

        <div className="hr-tm-stat-row">
          <StatPill
            label="Точность данных"
            value={confidenceLabel}
            onClick={() => setSection("data")}
          />
          <StatPill
            label="Лучший формат"
            value={bestWorkFormat ?? "—"}
            onClick={() => setSection(formatSection)}
          />
          <StatPill
            label="Главный риск"
            value={mainRisk ?? "—"}
            onClick={() => setSection("risks")}
          />
          <StatPill
            label="Что проверить"
            value={checkHint}
            onClick={() => setSection(checkSection)}
          />
        </div>
      </div>

      <div className="hr-tm-workspace">
        <nav className="hr-tm-nav" aria-label="Разделы карты">
          <div className="hr-tm-nav-chips" role="tablist">
            {navSections.map((s) => (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={section === s.id}
                className={section === s.id ? "hr-tm-nav-item hr-tm-nav-item--active" : "hr-tm-nav-item"}
                onClick={() => setSection(s.id)}
              >
                {s.label}
              </button>
            ))}
          </div>
          <ul className="hr-tm-nav-list">
            {navSections.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  className={
                    section === s.id ? "hr-tm-nav-item hr-tm-nav-item--active" : "hr-tm-nav-item"
                  }
                  onClick={() => setSection(s.id)}
                >
                  <span>{s.label}</span>
                  {s.hint ? <small>{s.hint}</small> : null}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <div className="hr-tm-section-panel" role="tabpanel">
          <h3 className="hr-tm-section-panel-title">
            {navSections.find((s) => s.id === section)?.label}
          </h3>
          <SectionErrorBoundary
            key={section}
            title={navSections.find((s) => s.id === section)?.label ?? section}
          >
            {renderSection()}
          </SectionErrorBoundary>
        </div>
      </div>

      <HrSidePanel
        open={detail !== null}
        onClose={() => setDetail(null)}
        title={sidePanelTitle}
        description={
          detail?.kind === "catalog_layer"
            ? catalogLayerDetail
              ? LAYER_GROUP_LABELS[catalogLayerDetail.group]
              : undefined
            : "Детали для проверки на интервью"
        }
      >
        {detail?.kind === "catalog_layer" && catalogLayerDetail ? (
          <SectionErrorBoundary title="Слой карты">
            <CatalogLayerDetailPanel item={catalogLayerDetail} />
          </SectionErrorBoundary>
        ) : detail ? (
          <SectionErrorBoundary title="Детали">
            <ItemDetailPanel
              detail={detail}
              ctx={ctx}
              risks={lists.risks}
              riskChecks={lists.riskChecks ?? []}
              interviews={lists.interviews}
              tests={lists.tests}
              talents={lists.talents}
              hypothesisCards={lists.hypothesisCards ?? []}
              layers={sortedLayers}
              strengths={lists.strengths}
              directions={lists.directions}
              roles={lists.roles}
            />
          </SectionErrorBoundary>
        ) : null}
      </HrSidePanel>
    </div>
  );
}

type BrokenReportDiagnostic = {
  reportId?: string;
  reportStatus?: string;
  reportType?: string;
  contentType?: string;
  topLevelKeys?: string[] | null;
  parseError?: string | null;
  renderError?: string | null;
  renderErrorName?: string;
  renderErrorMessage?: string;
  renderErrorStack?: string[];
  componentStack?: string | null;
};

function buildRenderDiagnostic(
  error: Error | null,
  errorInfo: ErrorInfo | null,
  base: Omit<
    BrokenReportDiagnostic,
    "renderErrorName" | "renderErrorMessage" | "renderErrorStack" | "componentStack"
  >,
): BrokenReportDiagnostic {
  return {
    ...base,
    renderError: error?.message ?? "Неизвестная ошибка render",
    renderErrorName: error?.name,
    renderErrorMessage: error?.message,
    renderErrorStack: error?.stack?.split("\n").slice(0, 8),
    componentStack: errorInfo?.componentStack ?? null,
  };
}

function BrokenReportState({
  candidate,
  companyId,
  candidateId,
  diagnostic,
}: {
  candidate: HrCandidate;
  companyId: string;
  candidateId: string;
  onRegenerate?: () => void;
  generating?: boolean;
  diagnostic?: BrokenReportDiagnostic | null;
}) {
  return (
    <div className="hr-tm-page">
      <Link to={`/hr/company/${companyId}/candidates/${candidateId}`} className="hr-tm-back">
        ← К кандидату
      </Link>
      <h2 className="hr-tm-title">Карта талантов</h2>
      <p className="hr-tm-subtitle">
        <b>{candidate.name}</b>
      </p>
      <div className="hr-card hr-tm-empty-card">
        <p className="hr-tm-empty-title">Разбор создан, но интерфейс пока не смог прочитать его структуру</p>
        <p className="hr-muted" style={{ lineHeight: 1.55, maxWidth: 520 }}>
          Это не ошибка генерации — отчёт сохранён в базе. Нужно адаптировать отображение под формат
          данных. Перегенерация создаст новую запись, но не исправит чтение уже сохранённого отчёта.
        </p>
        {diagnostic ? (
          <pre
            className="hr-muted"
            style={{
              marginTop: 12,
              padding: 10,
              borderRadius: 8,
              background: "rgba(0,0,0,0.2)",
              fontSize: 11,
              overflow: "auto",
              maxWidth: 560,
            }}
          >
            {JSON.stringify(diagnostic, null, 2)}
          </pre>
        ) : null}
        <button
          type="button"
          className="hr-btn hr-btn--ghost"
          style={{ marginTop: 16 }}
          onClick={() => window.location.reload()}
        >
          Обновить страницу
        </button>
      </div>
    </div>
  );
}

type WorkspaceErrorBoundaryProps = {
  children: ReactNode;
  fallback: (error: Error | null, errorInfo: ErrorInfo | null) => ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
};

type WorkspaceErrorBoundaryState = {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
};

class WorkspaceErrorBoundary extends Component<
  WorkspaceErrorBoundaryProps,
  WorkspaceErrorBoundaryState
> {
  state: WorkspaceErrorBoundaryState = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  static getDerivedStateFromError(error: Error): Partial<WorkspaceErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error("[WorkspaceErrorBoundary]", err, info);
    this.setState({ error: err, errorInfo: info });
    this.props.onError?.(err, info);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback(this.state.error, this.state.errorInfo);
    }
    return this.props.children;
  }
}

type SectionErrorBoundaryProps = {
  title: string;
  children: ReactNode;
};

type SectionErrorBoundaryState = {
  hasError: boolean;
  message: string | null;
  stack: string[] | null;
  componentStack: string | null;
};

class SectionErrorBoundary extends Component<
  SectionErrorBoundaryProps,
  SectionErrorBoundaryState
> {
  state: SectionErrorBoundaryState = {
    hasError: false,
    message: null,
    stack: null,
    componentStack: null,
  };

  static getDerivedStateFromError(error: Error): SectionErrorBoundaryState {
    return {
      hasError: true,
      message: error.message,
      stack: error.stack?.split("\n").slice(0, 8) ?? null,
      componentStack: null,
    };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error(`[SectionErrorBoundary:${this.props.title}]`, err, info.componentStack);
    this.setState({
      message: err.message,
      stack: err.stack?.split("\n").slice(0, 8) ?? null,
      componentStack: info.componentStack ?? null,
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="hr-muted" style={{ margin: 0 }}>
          <p style={{ margin: "0 0 8px" }}>
            Не удалось отобразить раздел «{this.props.title}»: {this.state.message}
          </p>
          {this.state.stack?.length || this.state.componentStack ? (
            <pre
              style={{
                margin: 0,
                padding: 8,
                fontSize: 11,
                borderRadius: 6,
                background: "rgba(0,0,0,0.2)",
                overflow: "auto",
              }}
            >
              {JSON.stringify(
                {
                  section: this.props.title,
                  stack: this.state.stack,
                  componentStack: this.state.componentStack,
                },
                null,
                2,
              )}
            </pre>
          ) : null}
        </div>
      );
    }
    return this.props.children;
  }
}

function DisplayDiagnosticBlock({
  companyId,
  candidateId,
  candidateName,
  fetchError,
  debug,
}: {
  companyId: string;
  candidateId: string;
  candidateName: string;
  fetchError: string | null;
  debug: {
    generated: ReportSnapshot | null;
    refetchedReady: ReportSnapshot | null;
    latestAny: ReportSnapshot | null;
  } | null;
}) {
  if (!fetchError && !debug) return null;
  return (
    <div
      className="hr-card"
      style={{ marginTop: 12, fontSize: 13, color: "var(--hr-muted)", lineHeight: 1.5 }}
    >
      <p style={{ margin: "0 0 6px", color: "var(--hr-text)", fontWeight: 600 }}>
        Диагностика отображения
      </p>
      <p style={{ margin: 0 }}>
        Кандидат: <strong>{candidateName}</strong> · {candidateId}
        <br />
        Компания: {companyId}
      </p>
      {fetchError ? (
        <p style={{ margin: "8px 0 0", color: "var(--hr-soft)" }}>
          Ошибка чтения из Supabase: {fetchError}
        </p>
      ) : null}
      {debug ? (
        <pre
          style={{
            margin: "8px 0 0",
            padding: 10,
            borderRadius: 8,
            background: "rgba(0,0,0,0.2)",
            overflow: "auto",
            fontSize: 11,
          }}
        >
          {JSON.stringify(debug, null, 2)}
        </pre>
      ) : null}
    </div>
  );
}

function PendingReportState({
  candidate,
  companyId,
  candidateId,
  report,
  onGenerate,
  generating,
  error,
  fetchError,
  debug,
}: {
  candidate: HrCandidate;
  companyId: string;
  candidateId: string;
  report: HrReport;
  onGenerate: () => void;
  generating: boolean;
  error: string | null;
  fetchError: string | null;
  debug: {
    generated: ReportSnapshot | null;
    refetchedReady: ReportSnapshot | null;
    latestAny: ReportSnapshot | null;
  } | null;
}) {
  return (
    <div className="hr-tm-page">
      <Link to={`/hr/company/${companyId}/candidates/${candidateId}`} className="hr-tm-back">
        ← К кандидату
      </Link>
      <h2 className="hr-tm-title">Карта талантов</h2>
      <p className="hr-tm-subtitle">
        <b>{candidate.name}</b>
      </p>
      <div className="hr-card hr-tm-empty-card">
        <p className="hr-tm-empty-title">Карта пока не отобразилась</p>
        <p className="hr-muted" style={{ lineHeight: 1.55, maxWidth: 560 }}>
          {error ??
            "Мы запустили генерацию, но готовый отчёт ещё не доступен для отображения."}
        </p>
        <p className="hr-muted" style={{ marginTop: 10, fontSize: 13 }}>
          Статус отчёта: <strong>{report.report_status}</strong>
          {report.generation_error ? (
            <>
              <br />
              Ошибка: {report.generation_error}
            </>
          ) : null}
        </p>
        <DisplayDiagnosticBlock
          companyId={companyId}
          candidateId={candidateId}
          candidateName={candidate.name}
          fetchError={fetchError}
          debug={debug}
        />
        <button
          type="button"
          className="hr-btn"
          style={{ marginTop: 16 }}
          disabled={generating}
          onClick={onGenerate}
        >
          {generating ? "Генерируем карту…" : "Повторить генерацию"}
        </button>
      </div>
    </div>
  );
}

function CoreLayersProgressState({
  candidate,
  companyId,
  candidateId,
  status,
  report,
  onRetry,
  generating,
  error,
}: {
  candidate: HrCandidate;
  companyId: string;
  candidateId: string;
  status: CoreLayersStatusResponse | null;
  report: HrReport | null;
  onRetry: () => void;
  generating: boolean;
  error: string | null;
}) {
  const layerGeneration = status?.layer_generation ?? null;
  const layersRaw =
    layerGeneration?.layers && typeof layerGeneration.layers === "object"
      ? (layerGeneration.layers as Record<string, Record<string, unknown>>)
      : {};
  const readyKeys = new Set(status?.ready_layer_keys ?? []);
  const errorKeys = new Set(status?.error_layer_keys ?? []);
  const skippedKeys = new Set(status?.skipped_layer_keys ?? []);
  const total = CORE_LAYER_UI_ORDER.length;
  const readyCount = status?.ready_layer_keys.length ?? 0;
  const usageSummary = status?.usage_summary;
  const costSummary = getCostSummary(
    usageSummary && typeof usageSummary === "object"
      ? (usageSummary as Record<string, unknown>)
      : undefined,
  );
  const budgetWarnings = Array.isArray(costSummary?.budget_warnings)
    ? (costSummary.budget_warnings as unknown[]).map((w) => getText(w)).filter(Boolean)
    : [];

  return (
    <div className="hr-tm-page">
      <Link to={`/hr/company/${companyId}/candidates/${candidateId}`} className="hr-tm-back">
        ← К кандидату
      </Link>
      <h2 className="hr-tm-title">Карта талантов</h2>
      <p className="hr-tm-subtitle">
        <b>{candidate.name}</b>
      </p>

      <div className="hr-card hr-tm-core-layers-progress">
        <p className="hr-tm-empty-title">Генерируем послойную карту…</p>
        <p className="hr-muted">Собираем 19 AI-слоёв кандидата</p>

        <div className="hr-tm-spike-meta-grid" style={{ marginTop: 12 }}>
          <span>status: {status?.report_status ?? report?.report_status ?? "generating"}</span>
          <span>готово: {readyCount}/{total}</span>
          <span>run_mode: {status?.run_mode ?? "—"}</span>
          <span>model: {status?.selected_model ?? status?.model ?? "—"}</span>
          <span>prompt: {status?.prompt_version ?? report?.prompt_version ?? "—"}</span>
          <span>max_output_tokens: {status?.max_output_tokens ?? "—"}</span>
          <span>attempts: {status?.attempts_total ?? "—"}</span>
          {usageSummary ? (
            <span>
              tokens in {formatUsageMetric(usageSummary.input_tokens_total)} · cached{" "}
              {formatUsageMetric(usageSummary.cached_input_tokens_total)} · out{" "}
              {formatUsageMetric(usageSummary.output_tokens_total)}
            </span>
          ) : null}
          {costSummary ? (
            <span>
              est. cost {formatCostUsd(costSummary.estimated_total_cost_usd)} · 34-layer proj{" "}
              {formatCostUsd(costSummary.projected_34_layers_cost_usd)}
            </span>
          ) : null}
          {budgetWarnings.length > 0 ? (
            <span>warnings: {budgetWarnings.join("; ")}</span>
          ) : null}
        </div>

        {status?.generation_error ? (
          <p className="hr-tm-banner hr-tm-banner--error" style={{ marginTop: 12 }}>
            {typeof status.generation_error === "string"
              ? status.generation_error
              : JSON.stringify(status.generation_error)}
          </p>
        ) : null}
        {error ? (
          <p className="hr-tm-banner hr-tm-banner--error" style={{ marginTop: 12 }}>
            {error}
          </p>
        ) : null}

        <ul className="hr-tm-layer-status-list" aria-label="Статусы слоёв">
          {CORE_LAYER_UI_ORDER.map(({ key, title }) => {
            const layerState = layersRaw[key];
            const layerStatus = getText(layerState?.status);
            let visualStatus = layerStatus;
            if (!visualStatus) {
              if (readyKeys.has(key)) visualStatus = "ready";
              else if (errorKeys.has(key)) visualStatus = "error";
              else if (skippedKeys.has(key)) visualStatus = "skipped";
              else visualStatus = "pending";
            }
            return (
              <li
                key={key}
                className={`hr-tm-layer-status-row hr-tm-layer-status-row--${visualStatus}`}
              >
                <span className="hr-tm-layer-status-title">{title}</span>
                <span className="hr-tm-layer-status-key">{key}</span>
                <span className="hr-tm-layer-status-badge">
                  {visualStatus}
                  {layerState?.forbidden_terms_repair_success === true ? " · repaired" : null}
                </span>
              </li>
            );
          })}
        </ul>

        <button
          type="button"
          className="hr-btn hr-btn--ghost"
          style={{ marginTop: 16 }}
          disabled={generating}
          onClick={onRetry}
        >
          {generating ? "Генерация…" : "Обновить / повторить"}
        </button>
      </div>
    </div>
  );
}

function EmptyReportState({
  candidate,
  companyId,
  candidateId,
  onGenerate,
  generating,
  error,
  fetchError,
  debug,
}: {
  candidate: HrCandidate;
  companyId: string;
  candidateId: string;
  onGenerate: () => void;
  generating: boolean;
  error: string | null;
  fetchError: string | null;
  debug: {
    generated: ReportSnapshot | null;
    refetchedReady: ReportSnapshot | null;
    latestAny: ReportSnapshot | null;
  } | null;
}) {
  return (
    <div className="hr-tm-page">
      <Link to={`/hr/company/${companyId}/candidates/${candidateId}`} className="hr-tm-back">
        ← К кандидату
      </Link>
      <h2 className="hr-tm-title">Карта талантов</h2>
      <p className="hr-tm-subtitle">
        <b>{candidate.name}</b>
      </p>

      {generating ? (
        <div className="hr-card hr-tm-empty-card">
          <p className="hr-tm-empty-title">Генерируем послойную карту…</p>
          <p className="hr-muted">Собираем 19 AI-слоёв кандидата. Обычно это занимает несколько минут.</p>
        </div>
      ) : (
        <div className="hr-card hr-tm-empty-card">
          <p className="hr-tm-empty-title">Разбор ещё не создан</p>
          <p className="hr-muted" style={{ lineHeight: 1.55, maxWidth: 520 }}>
            Сгенерируйте послойную карту кандидата, чтобы увидеть 19 рабочих AI-слоёв: базовые
            source-слои, merged product-слои и 7 продуктовых narrative-слоёв v0.2.
          </p>
          {error ? (
            <p className="hr-tm-banner hr-tm-banner--error" style={{ marginTop: 12 }}>
              {error}
            </p>
          ) : null}
          <DisplayDiagnosticBlock
            companyId={companyId}
            candidateId={candidateId}
            candidateName={candidate.name}
            fetchError={fetchError}
            debug={debug}
          />
          <button
            type="button"
            className="hr-btn"
            style={{ marginTop: 16 }}
            disabled={generating}
            onClick={onGenerate}
          >
            {error ? "Повторить генерацию" : "Сгенерировать послойную карту"}
          </button>
        </div>
      )}
    </div>
  );
}

function renderTalentMapWorkspace(
  candidate: HrCandidate,
  companyId: string,
  candidateId: string,
  vacancies: HrVacancy[],
  report: HrReport,
  opts: {
    onRegenerate: () => void;
    generating: boolean;
    genError: string | null;
    isFixturePreview?: boolean;
  },
) {
  logReportContentShape(report.content_json, report.id);
  const contentRoot = getReportContentRoot(report.content_json);
  const safeContent = normalizeAiReportContent(report.content_json);
  const contentKeys = Object.keys(contentRoot);

  if (!canParseReportContent(report.content_json)) {
    return (
      <BrokenReportState
        candidate={candidate}
        companyId={companyId}
        candidateId={candidateId}
        diagnostic={{
          reportId: report.id,
          reportStatus: report.report_status,
          reportType: report.report_type,
          contentType: typeof report.content_json,
          topLevelKeys: contentKeys,
          parseError: "content_json не является объектом или валидной JSON-строкой",
        }}
      />
    );
  }

  const diagnosticBase = {
    reportId: report.id,
    reportStatus: report.report_status,
    reportType: report.report_type,
    contentType: typeof report.content_json,
    topLevelKeys: contentKeys,
  };

  logNormalizedWorkspaceContent(safeContent);

  return (
    <WorkspaceErrorBoundary
      fallback={(error, errorInfo) => (
        <BrokenReportState
          candidate={candidate}
          companyId={companyId}
          candidateId={candidateId}
          diagnostic={buildRenderDiagnostic(error, errorInfo, diagnosticBase)}
        />
      )}
    >
      <TalentMapWorkspace
        candidate={candidate}
        companyId={companyId}
        candidateId={candidateId}
        vacancies={vacancies}
        aiContent={safeContent}
        rawAiContent={contentRoot}
        aiReport={report}
        onRegenerate={opts.onRegenerate}
        generating={opts.generating}
        genError={opts.genError}
        isFixturePreview={opts.isFixturePreview}
      />
    </WorkspaceErrorBoundary>
  );
}

export default function CandidateTalentMapPage() {
  const { companyId, candidateId } = useParams<{ companyId: string; candidateId: string }>();
  const useV2Fixture = useMemo(() => shouldUseV2FixturePreview(), []);
  const [candidate, setCandidate] = useState<HrCandidate | null>(null);
  const [aiReport, setAiReport] = useState<HrReport | null>(null);
  const [vacancies, setVacancies] = useState<HrVacancy[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [displayDebug, setDisplayDebug] = useState<{
    generated: ReportSnapshot | null;
    refetchedReady: ReportSnapshot | null;
    latestAny: ReportSnapshot | null;
  } | null>(null);
  const [coreLayersPollStatus, setCoreLayersPollStatus] =
    useState<CoreLayersStatusResponse | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollStartedAtRef = useRef<number | null>(null);

  const stopCoreLayersPolling = () => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    pollStartedAtRef.current = null;
  };

  useEffect(() => () => stopCoreLayersPolling(), []);

  const resolveDisplayReport = (
    spikeReady: HrReport | null,
    spikeLatest: HrReport | null,
    legacyReady: HrReport | null,
  ): HrReport | null => {
    if (spikeReady && isDisplayableTalentMapReport(spikeReady)) return spikeReady;
    if (
      spikeLatest &&
      (spikeLatest.report_status === "generating" || spikeLatest.report_status === "error")
    ) {
      return spikeLatest;
    }
    if (legacyReady && isReadyTalentMapReport(legacyReady)) return legacyReady;
    return null;
  };

  const load = async (opts?: { silent?: boolean }) => {
    if (!companyId || !candidateId) return;
    if (!opts?.silent) setLoading(true);
    const [c, links, spikeReadyResult, spikeLatestResult, legacyReadyResult] =
      await Promise.all([
        fetchCandidate(companyId, candidateId),
        fetchCandidateVacancies(companyId, candidateId),
        fetchBestReadyCoreLayersSpikeReport(companyId, candidateId),
        fetchLatestCoreLayersSpikeReport(companyId, candidateId),
        fetchBestReadyCandidateReport(companyId, candidateId, "hr_person_talent_map"),
      ]);
    setCandidate(c);
    setVacancies((links ?? []).map((l: { vacancy: HrVacancy }) => l.vacancy).filter(Boolean));

    const displayReport = resolveDisplayReport(
      spikeReadyResult.report,
      spikeLatestResult.report,
      legacyReadyResult.report,
    );
    setAiReport(displayReport);
    setFetchError(
      spikeReadyResult.error ?? spikeLatestResult.error ?? legacyReadyResult.error ?? null,
    );

    if (displayReport?.report_status === "generating" && displayReport.id) {
      setGenerating(true);
      startCoreLayersPolling(displayReport.id);
    }

    if (!opts?.silent) setLoading(false);

    console.info("[CandidateTalentMapPage] context", {
      companyId,
      candidateId,
      candidateName: c?.name,
      loadedReport: snapshotReport(displayReport),
      spikeReady: snapshotReport(spikeReadyResult.report),
      spikeLatest: snapshotReport(spikeLatestResult.report),
      legacyReady: snapshotReport(legacyReadyResult.report),
    });
  };

  useEffect(() => {
    load();
  }, [companyId, candidateId]);

  const handleCoreLayersPollTick = async (reportId: string) => {
    if (!companyId || !candidateId) return;

    if (
      pollStartedAtRef.current &&
      Date.now() - pollStartedAtRef.current > CORE_LAYER_POLL_MAX_MS
    ) {
      stopCoreLayersPolling();
      setGenerating(false);
      setGenError(
        "Генерация ещё идёт — обновите страницу через минуту или повторите запуск.",
      );
      return;
    }

    try {
      const status = await fetchCoreLayersStatus(reportId);
      setCoreLayersPollStatus(status);

      if (status.report_status === "ready") {
        stopCoreLayersPolling();
        const readyResult = await fetchBestReadyCoreLayersSpikeReport(companyId, candidateId);
        if (readyResult.report) {
          setAiReport(readyResult.report);
          setGenError(null);
        }
        setGenerating(false);
        return;
      }

      if (status.report_status === "error") {
        stopCoreLayersPolling();
        const latestResult = await fetchLatestCoreLayersSpikeReport(companyId, candidateId);
        if (latestResult.report) setAiReport(latestResult.report);
        setGenError(
          typeof status.generation_error === "string"
            ? status.generation_error
            : "Не удалось сгенерировать послойную карту.",
        );
        setGenerating(false);
      }
    } catch (err) {
      console.error("[hr] core layers poll failed", err);
    }
  };

  const startCoreLayersPolling = (reportId: string) => {
    stopCoreLayersPolling();
    pollStartedAtRef.current = Date.now();
    void handleCoreLayersPollTick(reportId);
    pollTimerRef.current = setInterval(() => {
      void handleCoreLayersPollTick(reportId);
    }, CORE_LAYER_POLL_INTERVAL_MS);
  };

  const onGenerateCoreLayers = async () => {
    if (!companyId || !candidateId) return;
    const previousReady = isReportReadyForDisplay(aiReport) ? aiReport : null;
    setGenerating(true);
    setGenError(null);
    setFetchError(null);
    setDisplayDebug(null);
    setCoreLayersPollStatus(null);

    try {
      const started = await startCandidateCoreLayersReport(companyId, candidateId);
      console.info("[CandidateTalentMapPage] core layers started", {
        report_id: started.report_id,
        report_status: started.report_status,
        report_type: started.report_type,
        run_mode: started.run_mode,
        selected_model: started.selected_model,
      });

      const latestResult = await fetchLatestCoreLayersSpikeReport(companyId, candidateId);
      const placeholderReport: HrReport = {
        id: started.report_id,
        company_id: companyId,
        candidate_id: candidateId,
        vacancy_id: null,
        report_type: HR_CORE_LAYERS_SPIKE_REPORT_TYPE,
        report_status: (started.report_status === "ready" ||
        started.report_status === "error" ||
        started.report_status === "draft"
          ? started.report_status
          : "generating") as HrReportStatus,
        title: null,
        summary: null,
        fit_score: null,
        content_json: null,
        input_snapshot: {},
        input_hash: "",
        model: started.selected_model,
        prompt_version: started.prompt_version,
        generation_error: null,
        generated_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      setAiReport(latestResult.report ?? placeholderReport);

      startCoreLayersPolling(started.report_id);
    } catch (err) {
      console.error("[hr] core layers generate failed", err);
      setGenError(
        err instanceof Error ? err.message : "Не удалось запустить послойную генерацию",
      );
      if (previousReady) setAiReport(previousReady);
      setGenerating(false);
    }
  };

  if (loading || !candidate || !companyId || !candidateId) {
    return <p>Загрузка…</p>;
  }

  if (useV2Fixture) {
    const fixtureReport = buildV2FixtureReport(companyId, candidateId);
    return renderTalentMapWorkspace(candidate, companyId, candidateId, vacancies, fixtureReport, {
      onRegenerate: () => {},
      generating: false,
      genError: null,
      isFixturePreview: true,
    });
  }

  const hasDisplayableReport = isReportReadyForDisplay(aiReport);
  const isSpikeInProgress =
    isCoreLayersSpikeReport(aiReport) &&
    aiReport != null &&
    (aiReport.report_status === "generating" || generating);

  if (hasDisplayableReport && aiReport) {
    return renderTalentMapWorkspace(candidate, companyId, candidateId, vacancies, aiReport, {
      onRegenerate: () => void onGenerateCoreLayers(),
      generating,
      genError,
    });
  }

  if (isSpikeInProgress && aiReport) {
    return (
      <CoreLayersProgressState
        candidate={candidate}
        companyId={companyId}
        candidateId={candidateId}
        status={coreLayersPollStatus}
        report={aiReport}
        onRetry={() => void onGenerateCoreLayers()}
        generating={generating}
        error={genError}
      />
    );
  }

  if (aiReport && !hasDisplayableReport) {
    return (
      <PendingReportState
        candidate={candidate}
        companyId={companyId}
        candidateId={candidateId}
        report={aiReport}
        onGenerate={() => void onGenerateCoreLayers()}
        generating={generating}
        error={genError}
        fetchError={fetchError}
        debug={displayDebug}
      />
    );
  }

  return (
    <EmptyReportState
      candidate={candidate}
      companyId={companyId}
      candidateId={candidateId}
      onGenerate={() => onGenerateCoreLayers()}
      generating={generating}
      error={genError}
      fetchError={fetchError}
      debug={displayDebug}
    />
  );
}
