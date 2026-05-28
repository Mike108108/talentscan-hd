import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase, isSupabaseConfigured } from "../../lib/supabase";
import { createHrCompany, createHrProfile } from "../../lib/hr/api";
import "../../hr.css";

export default function HrSignupPage() {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [roleTitle, setRoleTitle] = useState("");
  const [industry, setIndustry] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");
    if (!supabase) {
      setError("Supabase не настроен.");
      return;
    }
    if (!companyName.trim()) {
      setError("Укажите название компании.");
      return;
    }
    setLoading(true);
    const { data, error: signErr } = await supabase.auth.signUp({ email, password });
    if (signErr) {
      setError(signErr.message);
      setLoading(false);
      return;
    }
    if (!data.session) {
      setMessage(
        "Проверьте почту для подтверждения email. После подтверждения войдите в HR-кабинет — мы предложим завершить настройку профиля и компании.",
      );
      setLoading(false);
      return;
    }
    try {
      await createHrProfile({ full_name: fullName, role_title: roleTitle });
      const company = await createHrCompany({
        name: companyName,
        industry: industry || undefined,
      });
      setLoading(false);
      if (company) {
        localStorage.setItem("talentscan-hr-active-company-id", company.id);
        navigate(`/hr/company/${company.id}`, { replace: true });
      } else {
        navigate("/hr/cabinet", { replace: true });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка создания HR-профиля");
      setLoading(false);
    }
  };

  return (
    <div className="hr-root hr-fork">
      <div className="hr-card hr-auth-card">
        <h2 style={{ marginTop: 0 }}>Создать HR-кабинет</h2>
        <p style={{ color: "var(--hr-muted)", marginTop: 0 }}>
          Рабочее пространство для HR: кандидаты и карты талантов.
        </p>
        {!isSupabaseConfigured && (
          <p className="hr-error">Авторизация недоступна: Supabase не настроен.</p>
        )}
        <form className="hr-form" onSubmit={onSubmit}>
          <div className="hr-field">
            <label>Имя *</label>
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          </div>
          <div className="hr-field">
            <label>Email *</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="hr-field">
            <label>Пароль *</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
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
          {message && <p className="hr-message">{message}</p>}
          <button type="submit" className="hr-btn" disabled={loading}>
            {loading ? "Создание…" : "Создать HR-кабинет"}
          </button>
        </form>
        <div className="hr-auth-footer">
          <p>
            <Link to="/hr/login">Уже есть аккаунт — войти</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
