import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import {
  createHrCompany,
  createHrProfile,
  fetchHrCompanies,
  fetchHrProfile,
} from "../../lib/hr/api";
import "../../hr.css";

/**
 * Completes HR onboarding when auth user exists but hr_profile/company were not
 * created (e.g. email confirmation required before first session).
 */
export default function HrSetupPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [roleTitle, setRoleTitle] = useState("");
  const [industry, setIndustry] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!supabase) {
        setLoading(false);
        return;
      }
      const { data: { session } } = await supabase.auth.getSession();
      if (cancelled) return;
      if (!session) {
        navigate("/hr/login", { replace: true });
        return;
      }
      const profile = await fetchHrProfile();
      if (cancelled) return;
      if (profile) {
        const companies = await fetchHrCompanies();
        if (cancelled) return;
        if (companies.length > 0) {
          const nextId = companies[0].id;
          localStorage.setItem("talentscan-hr-active-company-id", nextId);
          navigate(`/hr/company/${nextId}`, { replace: true });
        } else {
          navigate("/hr/cabinet", { replace: true });
        }
        return;
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (!companyName.trim()) {
      setError("Укажите название компании.");
      return;
    }
    setSubmitting(true);
    try {
      await createHrProfile({ full_name: fullName, role_title: roleTitle });
      const company = await createHrCompany({
        name: companyName,
        industry: industry || undefined,
      });
      if (company) {
        localStorage.setItem("talentscan-hr-active-company-id", company.id);
        navigate(`/hr/company/${company.id}`, { replace: true });
      } else {
        navigate("/hr/cabinet", { replace: true });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка настройки HR-кабинета");
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="hr-root hr-fork">
        <p>Загрузка…</p>
      </div>
    );
  }

  return (
    <div className="hr-root hr-fork">
      <div className="hr-card hr-auth-card">
        <h2 style={{ marginTop: 0 }}>Завершить настройку HR-кабинета</h2>
        <p style={{ color: "var(--hr-muted)", marginTop: 0 }}>
          Аккаунт подтверждён. Создайте HR-профиль и первую компанию, чтобы открыть рабочее
          пространство.
        </p>
        <form className="hr-form" onSubmit={onSubmit}>
          <div className="hr-field">
            <label>Имя *</label>
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          </div>
          <div className="hr-field">
            <label>Название компании *</label>
            <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} required />
          </div>
          <div className="hr-field">
            <label>Должность / роль (опционально)</label>
            <input value={roleTitle} onChange={(e) => setRoleTitle(e.target.value)} />
          </div>
          <div className="hr-field">
            <label>Сфера компании (опционально)</label>
            <input value={industry} onChange={(e) => setIndustry(e.target.value)} />
          </div>
          {error && <p className="hr-error">{error}</p>}
          <button type="submit" className="hr-btn" disabled={submitting}>
            {submitting ? "Сохранение…" : "Открыть HR-кабинет"}
          </button>
        </form>
        <div className="hr-auth-footer">
          <p>
            <Link to="/hr/login">Другой вход</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
