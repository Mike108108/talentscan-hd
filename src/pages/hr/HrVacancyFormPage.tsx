import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { createVacancy, fetchVacancy, updateVacancy } from "../../lib/hr/api";
import type { HrVacancyStatus, VacancyFormData } from "../../lib/hr/types";

const STATUS_OPTIONS: Array<{ value: HrVacancyStatus; label: string }> = [
  { value: "draft", label: "Черновик" },
  { value: "active", label: "Активна" },
  { value: "paused", label: "Пауза" },
  { value: "closed", label: "Закрыта" },
];

function emptyForm(): VacancyFormData {
  return {
    title: "",
    status: "draft",
    department: "",
    employment_format: "",
    work_format: "",
    location: "",
    schedule: "",
    salary_range: "",
    role_description: "",
    responsibilities: "",
    kpi: "",
    must_have: "",
    nice_to_have: "",
    working_conditions: "",
    manager_context: "",
    team_context: "",
    hiring_priorities: "",
    risks_to_check: "",
  };
}

export default function HrVacancyFormPage() {
  const { companyId, vacancyId } = useParams<{ companyId: string; vacancyId?: string }>();
  const navigate = useNavigate();
  const isEdit = Boolean(vacancyId);
  const [form, setForm] = useState<VacancyFormData>(() => emptyForm());
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);

  const title = useMemo(() => (isEdit ? "Редактирование вакансии" : "Новая вакансия"), [isEdit]);

  useEffect(() => {
    if (!companyId || !vacancyId) return;
    (async () => {
      setLoading(true);
      const v = await fetchVacancy(companyId, vacancyId);
      if (v) {
        setForm({
          title: v.title ?? "",
          status: (v.status as HrVacancyStatus) ?? "draft",
          department: v.department ?? "",
          employment_format: v.employment_format ?? "",
          work_format: v.work_format ?? "",
          location: v.location ?? "",
          schedule: v.schedule ?? "",
          salary_range: v.salary_range ?? "",
          role_description: v.role_description ?? "",
          responsibilities: v.responsibilities ?? "",
          kpi: v.kpi ?? "",
          must_have: v.must_have ?? "",
          nice_to_have: v.nice_to_have ?? "",
          working_conditions: v.working_conditions ?? "",
          manager_context: v.manager_context ?? "",
          team_context: v.team_context ?? "",
          hiring_priorities: v.hiring_priorities ?? "",
          risks_to_check: v.risks_to_check ?? "",
        });
      }
      setLoading(false);
    })();
  }, [companyId, vacancyId]);

  const set = (key: keyof VacancyFormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm((prev) => ({ ...prev, [key]: e.target.value }));
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;
    if (!form.title.trim()) {
      alert("Укажите название вакансии");
      return;
    }
    setSaving(true);
    try {
      const saved = isEdit && vacancyId
        ? await updateVacancy(companyId, vacancyId, form)
        : await createVacancy(companyId, form);
      navigate(`/hr/company/${companyId}/vacancies/${saved.id}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Не удалось сохранить вакансию");
    } finally {
      setSaving(false);
    }
  };

  if (!companyId) return null;

  return (
    <div>
      <div className="hr-hero">
        <h2>{title}</h2>
        <p>Заполните данные роли. На этом этапе мы не делаем оценку кандидата под вакансию — только структуру и связи.</p>
        <div className="hr-fork-actions" style={{ marginTop: 16 }}>
          <Link to={`/hr/company/${companyId}/vacancies`} className="hr-btn hr-btn--ghost">
            ← К списку вакансий
          </Link>
        </div>
      </div>

      {loading ? (
        <p>Загрузка…</p>
      ) : (
        <form onSubmit={onSubmit} className="hr-card hr-form">
          <div className="hr-grid-2">
            <div className="hr-field">
              <label>Название вакансии</label>
              <input value={form.title} onChange={set("title")} placeholder="Например: Product Manager" />
            </div>
            <div className="hr-field">
              <label>Статус</label>
              <select value={form.status} onChange={set("status")}>
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="hr-field">
              <label>Отдел / направление</label>
              <input value={form.department} onChange={set("department")} />
            </div>
            <div className="hr-field">
              <label>Формат занятости</label>
              <input
                value={form.employment_format}
                onChange={set("employment_format")}
                placeholder="Full-time / Part-time / Contract"
              />
            </div>

            <div className="hr-field">
              <label>Формат работы</label>
              <input value={form.work_format} onChange={set("work_format")} placeholder="Офис / Гибрид / Удалённо" />
            </div>
            <div className="hr-field">
              <label>Локация</label>
              <input value={form.location} onChange={set("location")} />
            </div>

            <div className="hr-field">
              <label>График</label>
              <input value={form.schedule} onChange={set("schedule")} />
            </div>
            <div className="hr-field">
              <label>Зарплатная вилка</label>
              <input value={form.salary_range} onChange={set("salary_range")} placeholder="например: 200–300k ₽" />
            </div>
          </div>

          <div style={{ height: 1, background: "var(--hr-line)", margin: "6px 0" }} />

          <div className="hr-grid-2">
            <div className="hr-field">
              <label>Описание роли</label>
              <textarea value={form.role_description} onChange={set("role_description")} rows={6} />
            </div>
            <div className="hr-field">
              <label>Задачи</label>
              <textarea value={form.responsibilities} onChange={set("responsibilities")} rows={6} />
            </div>

            <div className="hr-field">
              <label>KPI</label>
              <textarea value={form.kpi} onChange={set("kpi")} rows={6} />
            </div>
            <div className="hr-field">
              <label>Must-have</label>
              <textarea value={form.must_have} onChange={set("must_have")} rows={6} />
            </div>

            <div className="hr-field">
              <label>Nice-to-have</label>
              <textarea value={form.nice_to_have} onChange={set("nice_to_have")} rows={6} />
            </div>
            <div className="hr-field">
              <label>Условия работы</label>
              <textarea value={form.working_conditions} onChange={set("working_conditions")} rows={6} />
            </div>

            <div className="hr-field">
              <label>Контекст руководителя</label>
              <textarea value={form.manager_context} onChange={set("manager_context")} rows={6} />
            </div>
            <div className="hr-field">
              <label>Контекст команды</label>
              <textarea value={form.team_context} onChange={set("team_context")} rows={6} />
            </div>

            <div className="hr-field">
              <label>Приоритеты найма</label>
              <textarea value={form.hiring_priorities} onChange={set("hiring_priorities")} rows={6} />
            </div>
            <div className="hr-field">
              <label>Риски, которые нужно проверить</label>
              <textarea value={form.risks_to_check} onChange={set("risks_to_check")} rows={6} />
            </div>
          </div>

          <div className="hr-fork-actions" style={{ marginTop: 16 }}>
            <button type="submit" className="hr-btn" disabled={saving}>
              {saving ? "Сохраняем…" : "Сохранить вакансию"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

