import { useMemo, useState } from "react";
import {
  CAREER_READING_LAYER_CATALOG_V1,
  CAREER_READING_LAYER_KEYS_V1,
} from "../../lib/hr/careerReadingLayersV1";
import {
  CareerReadingPromptLabError,
  previewCareerReadingPromptLab,
  testCareerReadingPromptLab,
  type CareerReadingPromptLabFailedRequest,
  type CareerReadingPromptLabPreviewResponse,
  type CareerReadingPromptLabTestResponse,
} from "../../lib/hr/api";

type Props = {
  companyId: string;
  candidateId: string;
};

type LabResult =
  | { kind: "preview"; data: CareerReadingPromptLabPreviewResponse }
  | { kind: "test"; data: CareerReadingPromptLabTestResponse };

type LoadingMode = "preview" | "test" | null;

function formatJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function resolveFailedRequest(
  err: unknown,
  fallback: CareerReadingPromptLabFailedRequest,
): CareerReadingPromptLabFailedRequest {
  if (err instanceof CareerReadingPromptLabError) {
    return err.failedRequest;
  }
  return fallback;
}

function FailedRequestMeta({ request }: { request: CareerReadingPromptLabFailedRequest }) {
  return (
    <dl className="prompt-lab__failed-meta">
      <div>
        <dt>layer_key</dt>
        <dd>{request.layerKey}</dd>
      </div>
      <div>
        <dt>reasoning_effort</dt>
        <dd>{request.reasoningEffort}</dd>
      </div>
      <div>
        <dt>max_output_tokens</dt>
        <dd>{request.maxOutputTokens}</dd>
      </div>
      <div>
        <dt>verbosity</dt>
        <dd>{request.verbosity}</dd>
      </div>
      <div>
        <dt>include_methodology_context</dt>
        <dd>{request.includeMethodologyContext ? "true" : "false"}</dd>
      </div>
      <div>
        <dt>status_code</dt>
        <dd>{request.statusCode}</dd>
      </div>
    </dl>
  );
}

export function CareerReadingPromptLabPanel({ companyId, candidateId }: Props) {
  const [open, setOpen] = useState(false);
  const [layerKey, setLayerKey] = useState<string>(CAREER_READING_LAYER_KEYS_V1[0]);
  const [reasoningEffort, setReasoningEffort] = useState<"low" | "medium">("low");
  const [verbosity, setVerbosity] = useState<"low" | "medium" | "high">("medium");
  const [maxOutputTokens, setMaxOutputTokens] = useState<8000 | 12000 | 16000>(8000);
  const [includeMethodology, setIncludeMethodology] = useState(true);
  const [loadingMode, setLoadingMode] = useState<LoadingMode>(null);
  const [error, setError] = useState<string | null>(null);
  const [failedRequest, setFailedRequest] = useState<CareerReadingPromptLabFailedRequest | null>(
    null,
  );
  const [result, setResult] = useState<LabResult | null>(null);

  const layerOptions = useMemo(
    () =>
      CAREER_READING_LAYER_KEYS_V1.map((key) => ({
        key,
        title: CAREER_READING_LAYER_CATALOG_V1[key].title,
      })),
    [],
  );

  const sharedParams = () => ({
    companyId,
    candidateId,
    layerKey,
    reasoningEffort,
    verbosity,
    maxOutputTokens,
    includeMethodologyContext: includeMethodology,
  });

  const beginRun = (mode: LoadingMode) => {
    setLoadingMode(mode);
    setError(null);
    setFailedRequest(null);
    setResult(null);
  };

  const onPreview = async () => {
    const params = sharedParams();
    beginRun("preview");
    try {
      const data = await previewCareerReadingPromptLab(params);
      setResult({ kind: "preview", data });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setFailedRequest(resolveFailedRequest(err, { ...params, statusCode: 0 }));
    } finally {
      setLoadingMode(null);
    }
  };

  const onTest = async () => {
    const params = sharedParams();
    beginRun("test");
    try {
      const data = await testCareerReadingPromptLab(params);
      setResult({ kind: "test", data });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setFailedRequest(resolveFailedRequest(err, { ...params, statusCode: 0 }));
    } finally {
      setLoadingMode(null);
    }
  };

  const onCopyPrompt = async () => {
    if (!result) return;
    const req = result.data.request;
    const text = `INSTRUCTIONS:\n${req.instructions}\n\nINPUT:\n${req.input}`;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      setError("Не удалось скопировать prompt в буфер.");
      setFailedRequest(null);
    }
  };

  const showMediumWarning = reasoningEffort === "medium";
  const showMediumHighTokenWarning =
    reasoningEffort === "medium" && (maxOutputTokens === 12000 || maxOutputTokens === 16000);

  const qualityScan =
    result?.kind === "test" && result.data.quality_scan
      ? (result.data.quality_scan as {
          status?: string;
          issue_count?: number;
          error_count?: number;
          warning_count?: number;
          summary?: Record<string, unknown>;
          checks?: Record<
            string,
            { issues?: Array<{ severity: string; path: string; message: string }> }
          >;
        })
      : null;

  return (
    <section className="prompt-lab">
      <button
        type="button"
        className="prompt-lab__header"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        Prompt Lab · dev {open ? "▾" : "▸"}
      </button>

      {open ? (
        <>
          <p className="prompt-lab__notice">
            Dev-инструмент. Не сохраняет результат в отчёт.
          </p>

          <div className="prompt-lab__controls">
            <label>
              layer_key
              <select value={layerKey} onChange={(e) => setLayerKey(e.target.value)}>
                {layerOptions.map((opt) => (
                  <option key={opt.key} value={opt.key}>
                    {opt.key} — {opt.title}
                  </option>
                ))}
              </select>
            </label>

            <label>
              reasoning_effort
              <select
                value={reasoningEffort}
                onChange={(e) => setReasoningEffort(e.target.value as "low" | "medium")}
              >
                <option value="low">low</option>
                <option value="medium">medium</option>
              </select>
            </label>

            <label>
              max_output_tokens
              <select
                value={maxOutputTokens}
                onChange={(e) =>
                  setMaxOutputTokens(Number(e.target.value) as 8000 | 12000 | 16000)
                }
              >
                <option value={8000}>8000</option>
                <option value={12000}>12000</option>
                <option value={16000}>16000</option>
              </select>
            </label>

            <label>
              verbosity
              <select
                value={verbosity}
                onChange={(e) =>
                  setVerbosity(e.target.value as "low" | "medium" | "high")
                }
              >
                <option value="low">low</option>
                <option value="medium">medium</option>
                <option value="high">high</option>
              </select>
            </label>

            <label className="prompt-lab__checkbox">
              <input
                type="checkbox"
                checked={includeMethodology}
                onChange={(e) => setIncludeMethodology(e.target.checked)}
              />
              include_methodology_context
            </label>

            {showMediumWarning ? (
              <p
                className={
                  showMediumHighTokenWarning
                    ? "prompt-lab__warn prompt-lab__warn--strong"
                    : "prompt-lab__warn"
                }
                role="status"
              >
                Medium reasoning может занять дольше и упереться в timeout синхронной функции.
                Для первичного сравнения попробуйте medium / 8000. Для medium / 12000–16000
                позже нужен background-mode.
              </p>
            ) : null}

            <div className="prompt-lab__actions">
              <button
                type="button"
                className="hr-btn hr-btn--ghost"
                disabled={loadingMode !== null}
                onClick={onPreview}
              >
                {loadingMode === "preview" ? "Preview…" : "Preview prompt"}
              </button>
              <button
                type="button"
                className="hr-btn"
                disabled={loadingMode !== null}
                onClick={onTest}
              >
                {loadingMode === "test" ? "Test layer…" : "Test layer"}
              </button>
              <button
                type="button"
                className="hr-btn hr-btn--ghost"
                disabled={!result || loadingMode !== null}
                onClick={() => {
                  setResult(null);
                  setError(null);
                  setFailedRequest(null);
                }}
              >
                Clear
              </button>
              {result ? (
                <button type="button" className="hr-btn hr-btn--ghost" onClick={onCopyPrompt}>
                  Copy prompt
                </button>
              ) : null}
            </div>
          </div>

          {loadingMode ? (
            <p className="prompt-lab__loading" role="status">
              {loadingMode === "test"
                ? "Запуск Test layer… предыдущий результат очищен."
                : "Запуск Preview prompt… предыдущий результат очищен."}
            </p>
          ) : null}

          {error ? (
            <div className="prompt-lab__error-block" role="alert">
              <p className="prompt-lab__error">{error}</p>
              {failedRequest ? <FailedRequestMeta request={failedRequest} /> : null}
            </div>
          ) : null}

          {result && !error ? (
            <div className="prompt-lab__result">
              <p className="prompt-lab__meta">
                mode: {result.data.mode} · layer: {result.data.layer_key} · model:{" "}
                {result.data.request.model} · reasoning: {result.data.request.reasoning_effort} ·
                tokens: {result.data.request.max_output_tokens}
              </p>

              {result.kind === "test" && result.data.duration_ms != null ? (
                <p className="prompt-lab__meta">
                  duration_ms: {result.data.duration_ms}
                  {result.data.usage ? (
                    <>
                      {" "}
                      · usage: {formatJson(result.data.usage)}
                    </>
                  ) : null}
                  {result.data.estimated_cost ? (
                    <>
                      {" "}
                      · est. cost: {formatJson(result.data.estimated_cost)}
                    </>
                  ) : null}
                </p>
              ) : null}

              {result.kind === "test" && result.data.validation ? (
                <p className="prompt-lab__meta">
                  validation: {result.data.validation.ok ? "ok" : "fail"}
                  {!result.data.validation.ok && result.data.validation.message
                    ? ` — ${result.data.validation.message}`
                    : ""}
                </p>
              ) : null}

              {qualityScan ? (
                <div className="prompt-lab__issues">
                  <p className="prompt-lab__meta">
                    quality_scan: {qualityScan.status ?? "—"} · issues:{" "}
                    {qualityScan.issue_count ?? 0} (errors: {qualityScan.error_count ?? 0},
                    warnings: {qualityScan.warning_count ?? 0})
                  </p>
                  {qualityScan.checks
                    ? Object.entries(qualityScan.checks).flatMap(([checkName, check]) =>
                        (check.issues ?? []).map((issue, idx) => (
                          <div
                            key={`${checkName}-${idx}`}
                            className={`prompt-lab__issue prompt-lab__issue--${issue.severity}`}
                          >
                            <strong>
                              [{checkName}] {issue.severity}
                            </strong>{" "}
                            {issue.path}: {issue.message}
                          </div>
                        )),
                      )
                    : null}
                </div>
              ) : null}

              <details>
                <summary>instructions</summary>
                <pre className="prompt-lab__pre">{result.data.request.instructions}</pre>
              </details>

              <details>
                <summary>input</summary>
                <pre className="prompt-lab__pre">{result.data.request.input}</pre>
              </details>

              <details>
                <summary>schema</summary>
                <pre className="prompt-lab__pre">{formatJson(result.data.request.schema)}</pre>
              </details>

              <details>
                <summary>compact_input</summary>
                <pre className="prompt-lab__pre">
                  {formatJson(
                    result.kind === "preview"
                      ? result.data.compact_input
                      : undefined,
                  )}
                </pre>
              </details>

              {result.kind === "test" && result.data.output?.layer ? (
                <details open>
                  <summary>output.layer</summary>
                  <pre className="prompt-lab__pre">{formatJson(result.data.output.layer)}</pre>
                </details>
              ) : null}

              {Array.isArray(result.data.warnings) && result.data.warnings.length > 0 ? (
                <pre className="prompt-lab__pre">warnings: {result.data.warnings.join("\n")}</pre>
              ) : null}
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
