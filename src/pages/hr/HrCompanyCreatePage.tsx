import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import HrAuthGuard from "../../components/hr/HrAuthGuard";
import { createHrCompany } from "../../lib/hr/api";
import "../../hr.css";

function HrCompanyCreateContent() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [industry, setIndustry] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const company = await createHrCompany({ name, industry: industry || undefined });
      if (!company) throw new Error("Не удалось создать компанию");
      localStorage.setItem("talentscan-hr-active-company-id", company.id);
      navigate(`/hr/company/${company.id}`, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
      setLoading(false);
    }
  };

  return (
    <div className="hr-root hr-fork">
      <div className="hr-card hr-auth-card">
        <h2 style={{ marginTop: 0 }}>Добавить компанию</h2>
        <p style={{ color: "var(--hr-muted)", marginTop: 0 }}>
          Компания — это рабочий контекст для вакансий, кандидатов и разборов.
        </p>
        <form className="hr-form" onSubmit={onSubmit}>
          <div className="hr-field">
            <label>Название компании *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="hr-field">
            <label>Сфера компании (опционально)</label>
            <input value={industry} onChange={(e) => setIndustry(e.target.value)} />
          </div>
          {error && <p className="hr-error">{error}</p>}
          <button type="submit" className="hr-btn" disabled={loading}>
            {loading ? "Создание…" : "Создать"}
          </button>
          <Link to="/hr/cabinet" className="hr-btn hr-btn--ghost">
            Назад
          </Link>
        </form>
      </div>
    </div>
  );
}

export default function HrCompanyCreatePage() {
  return (
    <HrAuthGuard>
      <HrCompanyCreateContent />
    </HrAuthGuard>
  );
}

