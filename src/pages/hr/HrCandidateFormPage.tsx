import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import BirthPlaceField from "../../components/hr/BirthPlaceField";
import {
  calculateCandidateChart,
  fetchCandidate,
  saveCandidate,
  updateCandidate,
} from "../../lib/hr/api";
import { canCalculateChart } from "../../lib/hr/chartStatus";
import type { CandidateFormData } from "../../lib/hr/types";

const EMPTY: CandidateFormData = {
  name: "",
  email: "",
  phone: "",
  vacancy_title: "",
  hr_comment: "",
  birth_date: "",
  birth_time: "",
  birth_place_text: "",
  birth_place_lat: null,
  birth_place_lon: null,
  birth_timezone: "",
};

export default function HrCandidateFormPage() {
  const { companyId, candidateId } = useParams<{ companyId: string; candidateId?: string }>();
  const navigate = useNavigate();
  const isEdit = Boolean(candidateId);
  const [form, setForm] = useState<CandidateFormData>(EMPTY);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!candidateId || !companyId) return;
    (async () => {
      const c = await fetchCandidate(companyId, candidateId);
      if (!c) return;
      setForm({
        name: c.name,
        email: c.email ?? "",
        phone: c.phone ?? "",
        vacancy_title: c.vacancy_title ?? "",
        hr_comment: c.hr_comment ?? "",
        birth_date: c.birth_date ?? "",
        birth_time: c.birth_time ? String(c.birth_time).slice(0, 5) : "",
        birth_place_text: c.birth_place_text ?? "",
        birth_place_lat: c.birth_place_lat,
        birth_place_lon: c.birth_place_lon,
        birth_timezone: c.birth_timezone ?? "",
      });
    })();
  }, [candidateId, companyId]);

  const set = (key: keyof CandidateFormData, value: string | number | null) => {
    setForm((f) => ({ ...f, [key]: value }));
  };

  const canCalc = canCalculateChart({
    name: form.name,
    birth_date: form.birth_date,
    birth_time: form.birth_time,
    birth_place_text: form.birth_place_text,
    birth_place_lat: form.birth_place_lat,
    birth_place_lon: form.birth_place_lon,
  });

  const persist = async () => {
    if (!companyId) throw new Error("Компания не указана");
    if (isEdit && candidateId) {
      return updateCandidate(companyId, candidateId, form);
    }
    return saveCandidate(companyId, form);
  };

  const onSave = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (!form.name.trim()) {
      setError("Укажите имя кандидата.");
      return;
    }
    setLoading(true);
    try {
      const c = await persist();
      navigate(`/hr/company/${companyId}/candidates/${c.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка сохранения");
    } finally {
      setLoading(false);
    }
  };

  const onSaveAndCalculate = async (e: FormEvent) => {
    e.preventDefault();
    if (!canCalc || !companyId) return;
    setError("");
    setLoading(true);
    try {
      const c = await persist();
      await calculateCandidateChart(companyId, c.id);
      navigate(`/hr/company/${companyId}/candidates/${c.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setLoading(false);
    }
  };

  if (!companyId) return null;

  return (
    <div>
      <div className="hr-hero">
        <h2>{isEdit ? "Дополнить данные" : "Добавить кандидата"}</h2>
        <p>
          Для точного расчёта карты нужны дата, город и время рождения. Если времени нет,
          кандидата можно сохранить, но карта останется в статусе «нужно уточнить данные».
        </p>
      </div>

      <form className="hr-card hr-form" onSubmit={onSave}>
        <h3 style={{ marginTop: 0 }}>Основные</h3>
        <div className="hr-field">
          <label>Имя кандидата *</label>
          <input value={form.name} onChange={(e) => set("name", e.target.value)} required />
        </div>
        <div className="hr-grid-2">
          <div className="hr-field">
            <label>Email</label>
            <input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
          </div>
          <div className="hr-field">
            <label>Телефон</label>
            <input value={form.phone} onChange={(e) => set("phone", e.target.value)} />
          </div>
        </div>
        <div className="hr-field">
          <label>Вакансия / роль</label>
          <input value={form.vacancy_title} onChange={(e) => set("vacancy_title", e.target.value)} />
        </div>
        <div className="hr-field">
          <label>Комментарий HR</label>
          <textarea value={form.hr_comment} onChange={(e) => set("hr_comment", e.target.value)} />
        </div>

        <h3>Данные рождения</h3>
        <div className="hr-grid-2">
          <div className="hr-field">
            <label>Дата рождения *</label>
            <input
              type="date"
              value={form.birth_date}
              onChange={(e) => set("birth_date", e.target.value)}
            />
          </div>
          <div className="hr-field">
            <label>Время рождения *</label>
            <input
              type="time"
              value={form.birth_time}
              onChange={(e) => set("birth_time", e.target.value)}
            />
          </div>
        </div>
        <BirthPlaceField
          value={form.birth_place_text}
          lat={form.birth_place_lat}
          lng={form.birth_place_lon}
          onChange={(place, lat, lng) => {
            setForm((f) => ({
              ...f,
              birth_place_text: place,
              birth_place_lat: lat,
              birth_place_lon: lng,
            }));
          }}
          required
        />

        {error && <p className="hr-error">{error}</p>}

        <div className="hr-fork-actions">
          <button type="submit" className="hr-btn hr-btn--secondary" disabled={loading}>
            Сохранить кандидата
          </button>
          <button
            type="button"
            className="hr-btn"
            disabled={loading || !canCalc}
            onClick={onSaveAndCalculate}
          >
            Сохранить и рассчитать карту
          </button>
          <Link to={`/hr/company/${companyId}/candidates`} className="hr-btn hr-btn--ghost">
            Отмена
          </Link>
        </div>
      </form>
    </div>
  );
}
