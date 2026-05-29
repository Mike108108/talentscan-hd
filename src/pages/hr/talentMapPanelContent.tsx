import type { ReactNode } from "react";
import type {
  HrCandidateTalentMap,
  HrPersonTalentMapV1,
  HrVacancy,
  TalentMapItem,
  TalentMapRole,
} from "../../lib/hr/types";
import {
  getList,
  getText,
  mergeFlexibleItems,
  parseOnboardingTimeline,
  type FlexibleSectionItem,
} from "../../lib/hr/talentMapUiHelpers";
import { formulaToSafeHtml } from "../../lib/safeHtml";

export type TalentMapPanelKey =
  | "bestFormat"
  | "keyTalent"
  | "mainRisk"
  | "mainConclusion"
  | "profile"
  | "risks"
  | "verification"
  | "testTasks"
  | "roles"
  | "onboarding"
  | "dataQuality"
  | "nextStep";

export type PanelContext = {
  mode: "ai" | "deterministic";
  aiContent?: HrPersonTalentMapV1;
  rawContent?: unknown;
  map?: HrCandidateTalentMap;
  vacancies: HrVacancy[];
  normalizeHrCopy: (text: string) => string;
  normalizeHrMaybe: (text: string | null | undefined) => string | null;
};

function EmptyBlock({ hint }: { hint?: string }) {
  return (
    <div className="hr-tm-empty">
      <p className="hr-tm-empty-title">Данных пока недостаточно</p>
      <p className="hr-tm-empty-text">
        {hint ??
          "Этот блок появится после расширения AI-отчёта. Можно перегенерировать карту или заполнить больше данных о кандидате и вакансии."}
      </p>
    </div>
  );
}

function SectionBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="hr-tm-panel-section">
      <h3 className="hr-tm-panel-section-title">{title}</h3>
      {children}
    </section>
  );
}

function BulletList({ items }: { items: string[] }) {
  if (!items.length) return null;
  return (
    <ul className="hr-tm-bullets">
      {items.map((item, i) => (
        <li key={`${item.slice(0, 24)}-${i}`}>{item}</li>
      ))}
    </ul>
  );
}

function InsightCards({ items }: { items: FlexibleSectionItem[] }) {
  if (!items.length) return <EmptyBlock />;
  return (
    <div className="hr-tm-insight-stack">
      {items.map((item, idx) => (
        <div key={`${item.title}-${idx}`} className="hr-card hr-tm-insight-card">
          <h4 className="hr-tm-insight-card-title">{item.title}</h4>
          {item.body ? <p className="hr-tm-insight-card-body">{item.body}</p> : null}
          {item.fit ? <span className="hr-status hr-status--ok">{item.fit}</span> : null}
        </div>
      ))}
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="hr-tm-meta-row">
      <span className="hr-tm-meta-label">{label}</span>
      <p className="hr-tm-meta-value">{value}</p>
    </div>
  );
}

export function InterviewScorecards({ items }: { items: FlexibleSectionItem[] }) {
  if (!items.length) {
    return (
      <EmptyBlock hint="Добавьте вопросы через перегенерацию карты или используйте вкладку «Проверка»." />
    );
  }
  return (
    <div className="hr-tm-scorecard-stack">
      {items.map((q, idx) => (
        <article key={`${q.title}-${idx}`} className="hr-card hr-tm-scorecard">
          <h4 className="hr-tm-scorecard-question">{q.title}</h4>
          <MetaRow label="Что проверяет" value={q.checks || q.body} />
          {q.checks && q.body && q.body !== q.checks ? (
            <MetaRow label="Контекст" value={q.body} />
          ) : null}
          <MetaRow label="Хороший ответ" value={q.goodAnswer ?? ""} />
          <MetaRow label="Тревожный сигнал" value={q.warningSign ?? ""} />
          <MetaRow label="Как оценивать" value={q.howToEvaluate ?? q.fit ?? ""} />
          <div className="hr-tm-hr-note" aria-label="Заметка HR (не сохраняется)">
            <span className="hr-tm-hr-note-label">Заметка HR</span>
            <div className="hr-tm-hr-note-field" contentEditable suppressContentEditableWarning>
              {/* placeholder for future notes */}
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

export function TestTaskCards({ items }: { items: FlexibleSectionItem[] }) {
  if (!items.length) return <EmptyBlock />;
  return (
    <div className="hr-tm-scorecard-stack">
      {items.map((t, idx) => (
        <article key={`${t.title}-${idx}`} className="hr-card hr-tm-scorecard">
          <h4 className="hr-tm-scorecard-question">{t.title}</h4>
          <MetaRow label="Что проверяет" value={t.checks || t.body} />
          <MetaRow label="Сколько времени дать" value={t.timeEstimate ?? ""} />
          <MetaRow label="Критерии хорошего результата" value={t.criteria ?? t.goodAnswer ?? ""} />
          <MetaRow label="Тревожные сигналы" value={t.warningSign ?? ""} />
          <MetaRow label="Следующий шаг" value={t.nextStep ?? t.fit ?? ""} />
        </article>
      ))}
    </div>
  );
}

export function OnboardingTimeline({
  aiContent,
  rawContent,
}: {
  aiContent?: HrPersonTalentMapV1;
  rawContent?: unknown;
}) {
  const phases = aiContent
    ? parseOnboardingTimeline(aiContent.onboarding_7_30_90, rawContent)
    : [];
  if (!phases.length) return <EmptyBlock />;
  return (
    <div className="hr-tm-onboarding-timeline">
      {phases.map((phase, idx) => (
        <article key={`${phase.label}-${idx}`} className="hr-card hr-tm-onboarding-card">
          <p className="hr-tm-step-kicker">{phase.label}</p>
          {phase.summary ? <p className="hr-tm-onboarding-summary">{phase.summary}</p> : null}
          <MetaRow label="Фокус" value={phase.focus ?? ""} />
          <MetaRow label="Что дать" value={phase.give ?? ""} />
          <MetaRow label="Что проверить" value={phase.verify ?? ""} />
          <MetaRow label="Сигнал успеха" value={phase.successSignal ?? ""} />
          <MetaRow label="Риск" value={phase.risk ?? ""} />
        </article>
      ))}
    </div>
  );
}

function RolesTable({ roles }: { roles: TalentMapRole[] }) {
  if (!roles.length) return <EmptyBlock />;
  return (
    <div className="hr-card" style={{ overflow: "auto" }}>
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
            <tr key={`${r.role}-${idx}`}>
              <td>{r.role}</td>
              <td>{r.fit}</td>
              <td>{r.note}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function getPanelMeta(
  key: TalentMapPanelKey,
): { title: string; description?: string; eyebrow?: string } {
  const map: Record<TalentMapPanelKey, { title: string; description?: string; eyebrow?: string }> =
    {
      bestFormat: {
        title: "Лучший рабочий формат",
        description: "Условия, в которых кандидат раскрывается сильнее всего.",
        eyebrow: "Рабочая среда",
      },
      keyTalent: {
        title: "Ключевой талант",
        description: "Главная сильная сторона и как её использовать в работе.",
        eyebrow: "Сильные стороны",
      },
      mainRisk: {
        title: "Главный риск",
        description: "Что может мешать и как проверить на интервью и в первые 30 дней.",
        eyebrow: "Риски",
      },
      mainConclusion: {
        title: "Главный вывод",
        description: "Сводка для HR и рекомендуемые следующие шаги.",
        eyebrow: "Итог",
      },
      profile: {
        title: "Рабочий профиль",
        description: "Формула человека, таланты и рабочий стиль.",
      },
      risks: {
        title: "Риски и условия",
        description: "Что может мешать и какая среда нужна.",
      },
      verification: {
        title: "Проверка",
        description: "Вопросы интервью и что именно проверять.",
      },
      testTasks: {
        title: "Тестовое",
        description: "Практические задания и критерии оценки.",
      },
      roles: {
        title: "Роли и вакансии",
        description: "Подходящие роли, спорные направления и связь с вакансиями.",
      },
      onboarding: {
        title: "Адаптация 7 / 30 / 90",
        description: "Как вводить человека в роль по этапам.",
      },
      dataQuality: {
        title: "Точность данных",
        description: "Полнота контекста и уверенность выводов.",
      },
      nextStep: {
        title: "Следующий шаг HR",
        description: "Что сделать после просмотра карты.",
      },
    };
  return map[key];
}

export function renderPanelContent(key: TalentMapPanelKey, ctx: PanelContext): ReactNode {
  const { mode, aiContent, rawContent, map, vacancies, normalizeHrCopy, normalizeHrMaybe } = ctx;
  const raw = (rawContent && typeof rawContent === "object" ? rawContent : {}) as Record<
    string,
    unknown
  >;

  const hero = mode === "ai" ? aiContent?.hero : null;
  const bestWorkFormat =
    mode === "ai"
      ? normalizeHrMaybe(hero?.best_work_format)
      : normalizeHrMaybe(map?.best_work_format);
  const keyTalent =
    mode === "ai" ? normalizeHrMaybe(hero?.key_talent) : normalizeHrMaybe(map?.key_talent);
  const mainRisk =
    mode === "ai" ? normalizeHrMaybe(hero?.main_risk) : normalizeHrMaybe(map?.main_risk);
  const summaryText =
    mode === "ai"
      ? normalizeHrMaybe(aiContent?.executive_summary?.text ?? hero?.headline)
      : normalizeHrMaybe(map?.summary);

  const formulaRaw =
    mode === "ai" ? aiContent?.working_formula?.text ?? "" : map?.formula ?? "";
  const formulaHtml = formulaRaw ? formulaToSafeHtml(formulaRaw) : "";

  const strengths =
    mode === "ai"
      ? mergeFlexibleItems(aiContent?.strengths ?? [], raw.strengths)
      : itemsFromMap(map?.strengths);
  const talents =
    mode === "ai"
      ? mergeFlexibleItems(aiContent?.talents ?? [], raw.talents)
      : itemsFromMap(map?.talents);
  const risks =
    mode === "ai"
      ? mergeFlexibleItems(aiContent?.risks ?? [], raw.risks)
      : itemsFromMap(map?.risks);
  const workEnv =
    mode === "ai"
      ? mergeFlexibleItems(aiContent?.work_environment ?? [], raw.work_environment)
      : itemsFromMap(map?.conditions);
  const mgmt =
    mode === "ai"
      ? mergeFlexibleItems(aiContent?.management_style ?? [], raw.management_style)
      : [];
  const interview =
    mode === "ai"
      ? mergeFlexibleItems(aiContent?.interview_questions ?? [], raw.interview_questions)
      : [];
  const tests =
    mode === "ai"
      ? mergeFlexibleItems(aiContent?.test_tasks ?? [], raw.test_tasks)
      : itemsFromMap(map?.tests);
  const directions =
    mode === "ai"
      ? mergeFlexibleItems(aiContent?.suitable_directions ?? [], raw.suitable_directions)
      : itemsFromMap(map?.directions);
  const questionable =
    mode === "ai"
      ? mergeFlexibleItems(aiContent?.questionable_directions ?? [], raw.questionable_directions)
      : itemsFromMap(map?.not_fit_directions);
  const roles = mode === "ai" ? aiContent?.roles ?? [] : map?.roles ?? [];
  const finalRec =
    mode === "ai"
      ? normalizeHrMaybe(aiContent?.final_hr_recommendation?.text)
      : normalizeHrMaybe(map?.final_recommendation);

  switch (key) {
    case "bestFormat":
      return (
        <>
          <SectionBlock title="Короткий вывод">
            <p className="hr-tm-panel-lead">{bestWorkFormat ?? "—"}</p>
          </SectionBlock>
          <SectionBlock title="Среда и условия">
            <InsightCards items={[...workEnv, ...mgmt]} />
          </SectionBlock>
          {formulaHtml ? (
            <SectionBlock title="Условия раскрытия">
              <div
                className="hr-tm-overview-formula"
                dangerouslySetInnerHTML={{ __html: formulaHtml }}
              />
            </SectionBlock>
          ) : null}
          <SectionBlock title="Что проверить на интервью">
            <InterviewScorecards items={interview.slice(0, 4)} />
          </SectionBlock>
        </>
      );

    case "keyTalent":
      return (
        <>
          <SectionBlock title="Короткий вывод">
            <p className="hr-tm-panel-lead">{keyTalent ?? "—"}</p>
          </SectionBlock>
          <SectionBlock title="Как проявляется в задачах">
            <InsightCards items={talents} />
          </SectionBlock>
          <SectionBlock title="Сильные стороны">
            <InsightCards items={strengths} />
          </SectionBlock>
          {formulaHtml ? (
            <SectionBlock title="Рабочая формула">
              <div
                className="hr-tm-overview-formula"
                dangerouslySetInnerHTML={{ __html: formulaHtml }}
              />
            </SectionBlock>
          ) : null}
          <SectionBlock title="Подходящие направления">
            <InsightCards items={directions.slice(0, 4)} />
          </SectionBlock>
        </>
      );

    case "mainRisk":
      return (
        <>
          <SectionBlock title="Короткий вывод">
            <p className="hr-tm-panel-lead">{mainRisk ?? "—"}</p>
          </SectionBlock>
          <SectionBlock title="Когда риск проявляется">
            <InsightCards items={risks} />
          </SectionBlock>
          <SectionBlock title="Среда, которая снижает риск">
            <InsightCards items={workEnv.slice(0, 4)} />
          </SectionBlock>
          <SectionBlock title="Проверка на интервью">
            <InterviewScorecards items={interview.slice(0, 5)} />
          </SectionBlock>
          <SectionBlock title="Первые 30 дней">
            <OnboardingTimeline aiContent={aiContent} rawContent={rawContent} />
          </SectionBlock>
        </>
      );

    case "mainConclusion":
      return (
        <>
          <SectionBlock title="Сводка">
            <p className="hr-tm-panel-lead">{summaryText ?? "—"}</p>
          </SectionBlock>
          {finalRec ? (
            <SectionBlock title="Рекомендация HR">
              <p className="hr-tm-panel-lead">{finalRec}</p>
            </SectionBlock>
          ) : null}
          {mode === "ai" && aiContent?.data_quality ? (
            <SectionBlock title="Качество данных">
              {aiContent.data_quality.completeness ? (
                <p>Данные: {normalizeHrCopy(aiContent.data_quality.completeness)}</p>
              ) : null}
              {aiContent.data_quality.confidence ? (
                <p>Точность: {normalizeHrCopy(aiContent.data_quality.confidence)}</p>
              ) : null}
              {aiContent.data_quality.notes ? (
                <p className="hr-muted">{normalizeHrCopy(aiContent.data_quality.notes)}</p>
              ) : null}
            </SectionBlock>
          ) : null}
          {aiContent?.qa_meta?.disclaimers?.length ? (
            <SectionBlock title="Оговорки">
              <BulletList items={aiContent.qa_meta.disclaimers.map(normalizeHrCopy)} />
            </SectionBlock>
          ) : null}
        </>
      );

    case "profile":
      return (
        <>
          {formulaHtml ? (
            <SectionBlock title="Рабочая формула">
              <div
                className="hr-tm-overview-formula"
                dangerouslySetInnerHTML={{ __html: formulaHtml }}
              />
            </SectionBlock>
          ) : (
            <EmptyBlock />
          )}
          <SectionBlock title="Таланты">
            <InsightCards items={talents} />
          </SectionBlock>
          <SectionBlock title="Сильные стороны">
            <InsightCards items={strengths} />
          </SectionBlock>
          <SectionBlock title="Лучший рабочий формат">
            <p className="hr-tm-panel-lead">{bestWorkFormat ?? "—"}</p>
          </SectionBlock>
        </>
      );

    case "risks":
      return (
        <>
          <SectionBlock title="Главный риск">
            <p className="hr-tm-panel-lead">{mainRisk ?? "—"}</p>
          </SectionBlock>
          <SectionBlock title="Что может мешать">
            <InsightCards items={risks} />
          </SectionBlock>
          <SectionBlock title="Среда и управление">
            <InsightCards items={[...workEnv, ...mgmt]} />
          </SectionBlock>
          <SectionBlock title="Спорные направления">
            <InsightCards items={questionable} />
          </SectionBlock>
        </>
      );

    case "verification":
      return (
        <SectionBlock title="Вопросы и проверка гипотез">
          <InterviewScorecards items={interview} />
        </SectionBlock>
      );

    case "testTasks":
      return (
        <SectionBlock title="Практические задания">
          <TestTaskCards items={tests} />
        </SectionBlock>
      );

    case "roles":
      return (
        <>
          <SectionBlock title="Связанные вакансии">
            {vacancies.length === 0 ? (
              <p className="hr-muted">Вакансия: не привязана. Привяжите кандидата к вакансии для точнее оценки.</p>
            ) : (
              <ul className="hr-tm-bullets">
                {vacancies.map((v) => (
                  <li key={v.id}>
                    <strong>{v.title}</strong> · {v.status}
                  </li>
                ))}
              </ul>
            )}
          </SectionBlock>
          <SectionBlock title="Подходящие роли">
            <RolesTable roles={roles} />
          </SectionBlock>
          <SectionBlock title="Спорные направления">
            <InsightCards items={questionable} />
          </SectionBlock>
          <SectionBlock title="Подходящие направления">
            <InsightCards items={directions} />
          </SectionBlock>
        </>
      );

    case "onboarding":
      return (
        <SectionBlock title="План адаптации">
          <OnboardingTimeline aiContent={aiContent} rawContent={rawContent} />
        </SectionBlock>
      );

    case "dataQuality": {
      const dq = aiContent?.data_quality;
      const metrics = mode === "ai" ? dq?.metrics ?? [] : map?.metrics ?? [];
      const missing = getList(raw.data_quality && asRec(raw.data_quality).missing);
      const reduces = getText(
        raw.data_quality && asRec(raw.data_quality).reduces_accuracy,
      );

      if (!dq?.completeness && !dq?.notes && !metrics.length) {
        return (
          <EmptyBlock hint="Пока доступна базовая оценка полноты. Чем больше контекста по кандидату, вакансии и компании, тем точнее будут рекомендации." />
        );
      }

      return (
        <>
          {dq?.completeness ? (
            <SectionBlock title="Полнота данных">
              <p className="hr-tm-panel-lead">{normalizeHrCopy(dq.completeness)}</p>
            </SectionBlock>
          ) : null}
          {dq?.confidence ? (
            <SectionBlock title="Уверенность выводов">
              <p className="hr-tm-panel-lead">{normalizeHrCopy(dq.confidence)}</p>
            </SectionBlock>
          ) : null}
          {metrics.length > 0 ? (
            <SectionBlock title="Показатели">
              <div className="hr-tm-metrics-list">
                {metrics.map((m, idx) => (
                  <div key={`${m.label}-${idx}`} className="hr-tm-metrics-item">
                    <span className="hr-tm-metrics-label">
                      {m.label}
                      {m.hint ? <span className="hr-tm-metrics-hint"> · {m.hint}</span> : null}
                    </span>
                    <b className="hr-tm-metrics-value">{m.value}</b>
                  </div>
                ))}
              </div>
            </SectionBlock>
          ) : null}
          {dq?.notes ? (
            <SectionBlock title="Комментарий">
              <p>{normalizeHrCopy(dq.notes)}</p>
            </SectionBlock>
          ) : null}
          {missing.length > 0 ? (
            <SectionBlock title="Чего не хватает">
              <BulletList items={missing} />
            </SectionBlock>
          ) : null}
          {reduces ? (
            <SectionBlock title="Что снижает точность">
              <p>{reduces}</p>
            </SectionBlock>
          ) : null}
          {aiContent?.qa_meta?.hypothesis_level ? (
            <SectionBlock title="Уровень гипотез">
              <p>{normalizeHrCopy(aiContent.qa_meta.hypothesis_level)}</p>
            </SectionBlock>
          ) : null}
        </>
      );
    }

    case "nextStep": {
      const steps: string[] = [];
      if (finalRec) steps.push(finalRec);
      if (interview.length > 0) {
        steps.push("Провести интервью по вопросам из блока «Проверка».");
      }
      if (tests.length > 0) {
        steps.push("Дать короткое тестовое задание и оценить по критериям из карты.");
      }
      if (vacancies.length === 0) {
        steps.push("Привязать кандидата к вакансии для оценки соответствия роли.");
      } else if (vacancies.length > 1) {
        steps.push("Уточнить целевую вакансию — у кандидата несколько связей.");
      }
      steps.push("При уточнении данных — перегенерировать карту.");

      const unique = [...new Set(steps)].slice(0, 5);

      return (
        <SectionBlock title="Рекомендуемые действия">
          <ol className="hr-tm-action-steps">
            {unique.map((step, i) => (
              <li key={`${i}-${step.slice(0, 20)}`}>{normalizeHrCopy(step)}</li>
            ))}
          </ol>
        </SectionBlock>
      );
    }

    default:
      return <EmptyBlock />;
  }
}

function itemsFromMap(items: TalentMapItem[] | null | undefined): FlexibleSectionItem[] {
  if (!items?.length) return [];
  return items.map((item) => ({
    title: item.title,
    body: item.body,
    ...(item.fit ? { fit: item.fit } : {}),
  }));
}

function asRec(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}
