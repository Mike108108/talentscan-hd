import { Component, useEffect, useMemo, useState } from "react";
import type { ErrorInfo, ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { HrSidePanel } from "../../components/hr/HrSidePanel";
import {
  fetchBestReadyCandidateReport,
  fetchCandidate,
  fetchCandidateVacancies,
  fetchLatestHrReport,
  generateCandidateReport,
  reportMatchesCandidate,
} from "../../lib/hr/api";
import {
  canParseReportContent,
  getReportContentRoot,
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
import type { HrCandidate, HrPersonTalentMapV1, HrReport, HrVacancy, TalentMapRole } from "../../lib/hr/types";
import { formulaToSafeHtml } from "../../lib/safeHtml";
import {
  buildReportLists,
  DataQualitySection,
  getDetailPanelTitle,
  ItemDetailPanel,
  ManagementPlaybookGrid,
  type DetailPanelState,
  type ReportContentCtx,
  VerificationPlanBlock,
} from "./talentMapPanelContent";
import type { OnboardingPhase } from "../../lib/hr/talentMapUiHelpers";
import "../../hr.css";

type SectionId =
  | "overview"
  | "layers"
  | "talents"
  | "profile"
  | "risks"
  | "management"
  | "checks"
  | "interview"
  | "test"
  | "onboarding"
  | "data"
  | "roles";

const NAV_SECTIONS_V12: Array<{ id: SectionId; label: string; hint?: string }> = [
  { id: "overview", label: "Обзор" },
  { id: "layers", label: "Слои карты", hint: "HR-расшифровка по слоям" },
  { id: "talents", label: "Таланты" },
  { id: "risks", label: "Риски и проверки" },
  { id: "management", label: "Управление и среда" },
  { id: "interview", label: "Интервью" },
  { id: "test", label: "Тестовое" },
  { id: "onboarding", label: "Адаптация" },
  { id: "data", label: "Данные" },
  { id: "roles", label: "Роли" },
];

const NAV_SECTIONS_LEGACY: Array<{ id: SectionId; label: string; hint?: string }> = [
  { id: "overview", label: "Обзор" },
  { id: "profile", label: "Рабочий профиль", hint: "Формула и таланты" },
  { id: "risks", label: "Риски и условия" },
  { id: "checks", label: "Проверка" },
  { id: "interview", label: "Интервью" },
  { id: "test", label: "Тестовое" },
  { id: "onboarding", label: "Адаптация" },
  { id: "data", label: "Данные" },
  { id: "roles", label: "Роли и вакансии" },
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

function logReportStep(step: string, report: HrReport | null) {
  console.info(`[CandidateTalentMapPage] ${step}`, snapshotReport(report));
}

function pickReadyReportForContext(
  companyId: string,
  candidateId: string,
  ...candidates: Array<HrReport | null | undefined>
): { report: HrReport | null; mismatch: HrReport | null } {
  let mismatch: HrReport | null = null;
  for (const r of candidates) {
    if (!r) continue;
    if (!reportMatchesCandidate(r, companyId, candidateId)) {
      if (!mismatch && isReadyTalentMapReport(r)) mismatch = r;
      continue;
    }
    if (isReadyTalentMapReport(r)) return { report: r, mismatch: null };
  }
  return { report: null, mismatch };
}

function buildMismatchMessage(
  companyId: string,
  candidateId: string,
  candidateName: string,
  report: HrReport,
): string {
  return `Отчёт создан, но не совпал с текущим кандидатом. Текущий: ${candidateName} (${candidateId}). В отчёте: кандидат ${report.candidate_id}, компания ${report.company_id}. Ожидалась компания ${companyId}.`;
}

function buildGenerationFailureMessage(
  generated: HrReport | null,
  latestAny: HrReport | null,
): string {
  const r = latestAny ?? generated;
  if (!r) {
    return "Генерация завершилась, но готовый отчёт не найден. Попробуйте обновить страницу или повторить генерацию.";
  }
  if (r.report_status === "ready" && r.content_json == null) {
    return "Разбор создан, но данные отчёта не удалось прочитать. Попробуйте перегенерировать карту.";
  }
  if (r.report_status === "error") {
    return r.generation_error
      ? `Не удалось сгенерировать карту. ${r.generation_error}`
      : "Не удалось сгенерировать карту.";
  }
  if (r.report_status === "generating") {
    return "Отчёт создан, но пока не готов к отображению. Статус: generating";
  }
  return `Отчёт создан, но пока не готов к отображению. Статус: ${r.report_status}`;
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

function LayerCard({
  title,
  summary,
  confidence,
  onClick,
}: {
  title: string;
  summary: string;
  confidence?: string;
  onClick?: () => void;
}) {
  const body = (
    <>
      <div className="hr-tm-layer-card-head">
        <span className="hr-tm-layer-card-title">{title}</span>
        {confidence ? <ConfidencePill confidence={confidence} /> : null}
      </div>
      {summary ? <p className="hr-tm-layer-card-summary">{summary}</p> : null}
      {onClick ? <span className="hr-tm-row-chevron" aria-hidden>→</span> : null}
    </>
  );
  if (onClick) {
    return (
      <button type="button" className="hr-tm-layer-card hr-tm-layer-card--clickable" onClick={onClick}>
        {body}
      </button>
    );
  }
  return <div className="hr-tm-layer-card">{body}</div>;
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
}: WorkspaceProps) {
  const [section, setSection] = useState<SectionId>("overview");
  const [detail, setDetail] = useState<DetailPanelState | null>(null);

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

  const confidenceLabel = aiContent.data_quality?.confidence
    ? normalizeHrCopy(aiContent.data_quality.confidence).replace(/\d{1,3}\s*%/g, "").trim() ||
      "уточняется"
    : "уточняется";

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
    /низк|мало|огранич|неполн|предварит/i.test(confidenceLabel) ||
    /низк|мало|огранич|неполн/i.test(getText(aiContent.data_quality?.completeness));

  const formatSection = isV12 ? "layers" : "profile";
  const checkSection: SectionId = isV12 ? "risks" : "checks";

  const topHypotheses = (lists.hypothesisCards ?? []).slice(0, 3);

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
                  <h3 className="hr-tm-section-h">Ключевые HR-гипотезы</h3>
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
      case "layers":
        return sortedLayers.length === 0 ? (
          <p className="hr-muted">Слои HR-расшифровки появятся после генерации карты v1.2.</p>
        ) : (
          <div className="hr-tm-layer-grid">
            {sortedLayers.map((layer, i) => (
              <LayerCard
                key={layer.id || `${layer.title}-${i}`}
                title={layer.title}
                summary={layer.client_summary}
                confidence={layer.confidence}
                onClick={() => setDetail({ kind: "layer", index: i })}
              />
            ))}
          </div>
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
          return (
            <div className="hr-tm-section-stack">
              <ManagementPlaybookGrid
                playbook={lists.managementPlaybook}
                normalizeHrCopy={normalizeHrCopy}
              />
            </div>
          );
        }
        return (
          <div className="hr-tm-section-stack">
            <h3 className="hr-tm-section-h">Среда</h3>
            {lists.workEnv.map((c, i) => (
              <CompactRow key={`${c.title}-${i}`} title={c.title} subtitle={c.body} />
            ))}
            <h3 className="hr-tm-section-h">Управление</h3>
            {lists.mgmt.map((c, i) => (
              <CompactRow key={`${c.title}-${i}`} title={c.title} subtitle={c.body} />
            ))}
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

  return (
    <div className={`hr-tm-page hr-tm-page--workspace${isV12 ? " hr-tm-page--v12" : ""}`}>
      <div className="hr-tm-header">
        <div className="hr-tm-header-top">
          <Link to={`/hr/company/${companyId}/candidates/${candidateId}`} className="hr-tm-back">
            ← К кандидату
          </Link>
          <button
            type="button"
            className="hr-btn hr-btn--ghost"
            disabled={generating}
            onClick={onRegenerate}
          >
            {generating ? "Генерируем карту…" : "Перегенерировать карту"}
          </button>
        </div>

        {generating && (
          <p className="hr-tm-banner hr-tm-banner--info">Генерируем карту кандидата…</p>
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
        title={detail ? getDetailPanelTitle(detail, detailLists) : ""}
        description="Детали для проверки на интервью"
      >
        {detail ? (
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
          <p className="hr-tm-empty-title">Генерируем карту кандидата…</p>
          <p className="hr-muted">Обычно это занимает 15–40 секунд.</p>
        </div>
      ) : (
        <div className="hr-card hr-tm-empty-card">
          <p className="hr-tm-empty-title">Разбор ещё не создан</p>
          <p className="hr-muted" style={{ lineHeight: 1.55, maxWidth: 520 }}>
            Сначала сгенерируйте карту кандидата, чтобы увидеть рабочий профиль, риски, вопросы
            интервью, тестовое и план адаптации.
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
            {error ? "Повторить генерацию" : "Сгенерировать карту"}
          </button>
        </div>
      )}
    </div>
  );
}

export default function CandidateTalentMapPage() {
  const { companyId, candidateId } = useParams<{ companyId: string; candidateId: string }>();
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

  const load = async (opts?: { silent?: boolean }) => {
    if (!companyId || !candidateId) return;
    if (!opts?.silent) setLoading(true);
    const [c, links, readyResult] = await Promise.all([
      fetchCandidate(companyId, candidateId),
      fetchCandidateVacancies(companyId, candidateId),
      fetchBestReadyCandidateReport(companyId, candidateId, "hr_person_talent_map"),
    ]);
    setCandidate(c);
    setVacancies((links ?? []).map((l: { vacancy: HrVacancy }) => l.vacancy).filter(Boolean));
    setAiReport(readyResult.report);
    setFetchError(readyResult.error);
    if (!opts?.silent) setLoading(false);

    console.info("[CandidateTalentMapPage] context", {
      companyId,
      candidateId,
      candidateName: c?.name,
      loadedReport: snapshotReport(readyResult.report),
      fetchError: readyResult.error,
    });
  };

  useEffect(() => {
    load();
  }, [companyId, candidateId]);

  const onGenerate = async (forceRegenerate = false) => {
    if (!companyId || !candidateId) return;
    const previousReady = isReadyTalentMapReport(aiReport) ? aiReport : null;
    setGenerating(true);
    setGenError(null);
    setFetchError(null);
    setDisplayDebug(null);

    try {
      const primaryVacancyId = vacancies.length === 1 ? vacancies[0].id : null;
      const generated = await generateCandidateReport(companyId, candidateId, {
        vacancyId: primaryVacancyId,
        reportType: "hr_person_talent_map",
        forceRegenerate,
      });
      logReportStep("generated report", generated);

      const readyResult = await fetchBestReadyCandidateReport(
        companyId,
        candidateId,
        "hr_person_talent_map",
      );
      logReportStep("refetched ready report", readyResult.report);
      if (readyResult.error) setFetchError(readyResult.error);

      const latestAnyResult = await fetchLatestHrReport(
        companyId,
        candidateId,
        "hr_person_talent_map",
      );
      logReportStep("latest any report", latestAnyResult.report);
      if (latestAnyResult.error && !readyResult.error) {
        setFetchError(latestAnyResult.error);
      }

      setDisplayDebug({
        generated: snapshotReport(generated),
        refetchedReady: snapshotReport(readyResult.report),
        latestAny: snapshotReport(latestAnyResult.report),
      });

      const { report: resolved, mismatch } = pickReadyReportForContext(
        companyId,
        candidateId,
        generated,
        readyResult.report,
        latestAnyResult.report,
      );

      if (resolved) {
        setAiReport(resolved);
        setGenError(null);
        return;
      }

      if (mismatch && candidate) {
        setGenError(buildMismatchMessage(companyId, candidateId, candidate.name, mismatch));
      } else if (readyResult.error) {
        setGenError(
          `Не удалось прочитать отчёт из базы: ${readyResult.error}. Отчёт мог быть создан — попробуйте обновить страницу.`,
        );
      } else {
        setGenError(buildGenerationFailureMessage(generated, latestAnyResult.report));
      }

      if (forceRegenerate && previousReady) {
        setAiReport(previousReady);
      } else {
        setAiReport(latestAnyResult.report ?? generated ?? readyResult.report);
      }
    } catch (err) {
      console.error("[hr] generate talent map failed", err);
      setGenError(err instanceof Error ? err.message : "Не удалось сгенерировать карту");
      try {
        const readyResult = await fetchBestReadyCandidateReport(
          companyId,
          candidateId,
          "hr_person_talent_map",
        );
        if (readyResult.error) setFetchError(readyResult.error);
        const { report: resolved } = pickReadyReportForContext(
          companyId,
          candidateId,
          readyResult.report,
        );
        if (resolved) {
          setAiReport(resolved);
        } else if (forceRegenerate && previousReady) {
          setAiReport(previousReady);
        } else if (readyResult.report) {
          setAiReport(readyResult.report);
        }
      } catch {
        if (forceRegenerate && previousReady) setAiReport(previousReady);
      }
    } finally {
      setGenerating(false);
    }
  };

  if (loading || !candidate || !companyId || !candidateId) {
    return <p>Загрузка…</p>;
  }

  const hasReadyReport = isReadyTalentMapReport(aiReport);

  if (hasReadyReport && aiReport) {
    logReportContentShape(aiReport.content_json, aiReport.id);
    const contentRoot = getReportContentRoot(aiReport.content_json);
    const safeContent = normalizeAiReportContent(aiReport.content_json);
    const contentKeys = Object.keys(contentRoot);

    if (!canParseReportContent(aiReport.content_json)) {
      return (
        <BrokenReportState
          candidate={candidate}
          companyId={companyId}
          candidateId={candidateId}
          onRegenerate={() => onGenerate(true)}
          generating={generating}
          diagnostic={{
            reportId: aiReport.id,
            reportStatus: aiReport.report_status,
            reportType: aiReport.report_type,
            contentType: typeof aiReport.content_json,
            topLevelKeys: contentKeys,
            parseError: "content_json не является объектом или валидной JSON-строкой",
          }}
        />
      );
    }

    const diagnosticBase = {
      reportId: aiReport.id,
      reportStatus: aiReport.report_status,
      reportType: aiReport.report_type,
      contentType: typeof aiReport.content_json,
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
          aiReport={aiReport}
          onRegenerate={() => onGenerate(true)}
          generating={generating}
          genError={genError}
        />
      </WorkspaceErrorBoundary>
    );
  }

  if (aiReport && !hasReadyReport) {
    return (
      <PendingReportState
        candidate={candidate}
        companyId={companyId}
        candidateId={candidateId}
        report={aiReport}
        onGenerate={() => onGenerate(true)}
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
      onGenerate={() => onGenerate(false)}
      generating={generating}
      error={genError}
      fetchError={fetchError}
      debug={displayDebug}
    />
  );
}
