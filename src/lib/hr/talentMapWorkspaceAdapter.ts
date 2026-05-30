import type {
  HrPersonTalentMapV1,
  HrPersonTalentMapV2,
  HrTalentMapConfidence,
  HrTalentMapEvidenceItem,
  HrTalentMapHypothesisCard,
  HrTalentMapLayer,
  HrTalentMapLayerReportV2,
  HrTalentMapManagementPlaybook,
  HrTalentMapRiskCheck,
  HrTalentMapSectionItem,
  HrTalentMapSynthesisBlockV2,
  HrTalentMapSynthesisBlocksV2,
} from "./types";

function asString(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return fallback;
}

function asObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function normalizeConfidence(raw: unknown): HrTalentMapConfidence {
  const v = asString(raw).toLowerCase();
  if (v === "high" || v === "medium" || v === "low") return v;
  return "medium";
}

function normalizeSectionItems(raw: unknown): HrTalentMapSectionItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (typeof item === "string") {
        const t = item.trim();
        return t ? { title: "—", body: t } : null;
      }
      const rec = asObject(item);
      const title = asString(rec.title, "—");
      const body = asString(rec.body ?? rec.text ?? rec.summary);
      if (!title && !body) return null;
      return { title: title || "—", body };
    })
    .filter((item): item is HrTalentMapSectionItem => item != null);
}

function blockText(block: HrTalentMapSynthesisBlockV2 | undefined): string {
  if (!block) return "";
  return asString(block.text) || asString(block.summary) || asString(block.one_sentence);
}

function mapExecutiveFromBlock(
  block: HrTalentMapSynthesisBlockV2 | undefined,
): Pick<HrPersonTalentMapV1, "executive_summary" | "executive_snapshot" | "final_hr_recommendation"> {
  if (!block) {
    return {
      executive_summary: { text: "" },
      final_hr_recommendation: { text: "" },
    };
  }

  const text =
    blockText(block) ||
    asString(block.one_sentence) ||
    asString(block.decision_note);

  const snapshot = {
    one_sentence: asString(block.one_sentence),
    best_use: asString(block.best_use),
    main_value: asString(block.main_value),
    main_risk: asString(block.main_risk),
    how_to_check_first: asString(block.how_to_check_first),
    decision_note: asString(block.decision_note),
  };
  const hasSnapshot = Object.values(snapshot).some(Boolean);

  return {
    executive_summary: { text },
    ...(hasSnapshot ? { executive_snapshot: snapshot } : {}),
    final_hr_recommendation: {
      text: asString(block.decision_note) || text,
    },
  };
}

function mapTalentsFromBlock(block: HrTalentMapSynthesisBlockV2 | undefined): {
  talents: HrTalentMapSectionItem[];
  strengths: HrTalentMapSectionItem[];
  hypothesis_cards: HrTalentMapHypothesisCard[];
} {
  if (!block) {
    return { talents: [], strengths: [], hypothesis_cards: [] };
  }
  const items = normalizeSectionItems(block.items);
  const cards = Array.isArray(block.cards)
    ? block.cards.filter((c) => c && typeof c === "object")
    : [];
  return {
    talents: items,
    strengths: [],
    hypothesis_cards: cards,
  };
}

function mapRisksFromBlock(block: HrTalentMapSynthesisBlockV2 | undefined): {
  risks: HrTalentMapSectionItem[];
  risk_checks: HrTalentMapRiskCheck[];
} {
  if (!block) {
    return { risks: [], risk_checks: [] };
  }
  return {
    risks: normalizeSectionItems(block.items),
    risk_checks: Array.isArray(block.checks)
      ? block.checks.filter((c) => c && typeof c === "object")
      : [],
  };
}

function mapManagementFromBlock(block: HrTalentMapSynthesisBlockV2 | undefined): {
  management_style: HrTalentMapSectionItem[];
  management_playbook?: HrTalentMapManagementPlaybook;
} {
  if (!block) {
    return { management_style: [] };
  }
  const playbook =
    block.playbook && typeof block.playbook === "object" ? block.playbook : undefined;
  return {
    management_style: normalizeSectionItems(block.items),
    ...(playbook ? { management_playbook: playbook } : {}),
  };
}

function mapLayerReportToLayer(report: HrTalentMapLayerReportV2, idx: number): HrTalentMapLayer {
  const base = report.base ?? {};
  const pro = report.pro ?? {};
  const evidence = report.evidence ?? {};
  const confidence =
    pro.confidence ?? evidence.confidence ?? ("medium" as HrTalentMapConfidence);

  return {
    id: report.layer_key,
    title: asString(report.hr_title, report.layer_key),
    client_summary: asString(base.short_summary),
    hr_meaning: asString(base.detailed_explanation),
    key_signal: asString(base.how_it_appears_at_work),
    risk_signal: asString(base.risks),
    how_to_check: asString(base.what_to_check),
    confidence: normalizeConfidence(confidence),
    ui_priority:
      typeof report.ui_priority === "number" && Number.isFinite(report.ui_priority)
        ? report.ui_priority
        : idx + 1,
    source_layer_id: report.layer_key,
  };
}

function mapLayerReportToEvidence(report: HrTalentMapLayerReportV2): HrTalentMapEvidenceItem | null {
  const evidence = report.evidence;
  if (!evidence) return null;

  const sourceFields = Array.isArray(evidence.source_fields)
    ? evidence.source_fields.map((f) => asString(f)).filter(Boolean)
    : [];
  const sourceLayerKeys = Array.isArray(evidence.source_layer_keys)
    ? evidence.source_layer_keys.map((k) => asString(k)).filter(Boolean)
    : [];
  const warnings = Array.isArray(evidence.warnings)
    ? evidence.warnings.map((w) => asString(w)).filter(Boolean)
    : [];

  if (
    !sourceFields.length &&
    !sourceLayerKeys.length &&
    !asString(evidence.limitations) &&
    !warnings.length
  ) {
    return null;
  }

  const conclusion =
    asString(evidence.limitations) ||
    (warnings.length ? warnings.join("; ") : "") ||
    "Техническое основание слоя";

  return {
    id: `${report.layer_key}-evidence`,
    conclusion,
    based_on: sourceFields,
    source_layer_ids: [report.layer_key, ...sourceLayerKeys],
    confidence: normalizeConfidence(evidence.confidence),
    client_visible: false,
  };
}

function mapSynthesisBlocks(blocks: HrTalentMapSynthesisBlocksV2 | undefined) {
  const executive = mapExecutiveFromBlock(blocks?.executive_summary);
  const formulaText = blockText(blocks?.work_formula);
  const talents = mapTalentsFromBlock(blocks?.talents);
  const risks = mapRisksFromBlock(blocks?.risks);
  const management = mapManagementFromBlock(blocks?.management);
  const workEnv = normalizeSectionItems(blocks?.work_environment?.items);

  return {
    ...executive,
    working_formula: { text: formulaText },
    talents: talents.talents,
    strengths: talents.strengths,
    hypothesis_cards: talents.hypothesis_cards,
    work_environment: workEnv,
    risks: risks.risks,
    risk_checks: risks.risk_checks,
    management_style: management.management_style,
    management_playbook: management.management_playbook,
  };
}

/** Map v2 content_json to legacy workspace view-model (HrPersonTalentMapV1). */
export function mapV2ToLegacyWorkspaceContent(root: HrPersonTalentMapV2): HrPersonTalentMapV1 {
  const snapshot = root.candidate_snapshot ?? {};
  const dq = root.data_quality ?? {};
  const layerReports = Array.isArray(root.layer_reports) ? root.layer_reports : [];
  const synthesis = mapSynthesisBlocks(root.synthesis_blocks);

  const layerMap = layerReports.map(mapLayerReportToLayer);
  const evidenceMap = layerReports
    .map(mapLayerReportToEvidence)
    .filter((item): item is HrTalentMapEvidenceItem => item != null);

  const metrics = Array.isArray(dq.metrics)
    ? dq.metrics.filter((m) => m && typeof m === "object")
    : [];

  return {
    schema_version: root.schema_version,
    hero: {
      name: asString(snapshot.name),
      subtitle: asString(snapshot.subtitle),
      status_label: asString(snapshot.status_label),
      best_work_format: asString(snapshot.best_work_format),
      key_talent: asString(snapshot.key_talent),
      main_risk: asString(snapshot.main_risk),
      headline: asString(snapshot.headline),
    },
    data_quality: {
      completeness: asString(dq.completeness),
      confidence: asString(dq.confidence),
      notes: asString(dq.notes),
      metrics,
    },
    executive_summary: synthesis.executive_summary,
    working_formula: synthesis.working_formula,
    talents: synthesis.talents,
    strengths: synthesis.strengths,
    risks: synthesis.risks,
    suitable_directions: [],
    questionable_directions: [],
    roles: [],
    work_environment: synthesis.work_environment,
    management_style: synthesis.management_style,
    interview_questions: [],
    test_tasks: [],
    onboarding_7_30_90: {},
    final_hr_recommendation: synthesis.final_hr_recommendation,
    ...(root.qa_meta ? { qa_meta: root.qa_meta } : {}),
    ...(synthesis.executive_snapshot ? { executive_snapshot: synthesis.executive_snapshot } : {}),
    ...(layerMap.length > 0 ? { layer_map: layerMap } : {}),
    ...(synthesis.hypothesis_cards.length > 0
      ? { hypothesis_cards: synthesis.hypothesis_cards }
      : {}),
    ...(synthesis.risk_checks.length > 0 ? { risk_checks: synthesis.risk_checks } : {}),
    ...(synthesis.management_playbook
      ? { management_playbook: synthesis.management_playbook }
      : {}),
    ...(evidenceMap.length > 0 ? { evidence_map: evidenceMap } : {}),
    ...(root.ui !== undefined ? { ui: root.ui } : {}),
  };
}
