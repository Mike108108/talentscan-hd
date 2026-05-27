import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import HrAuthGuard from "../../components/hr/HrAuthGuard";
import { createHrCompany, fetchHrCompanies } from "../../lib/hr/api";
import type { HrCompany } from "../../lib/hr/types";
import "../../hr.css";

function CompaniesContent() {
  const [companies, setCompanies] = useState<HrCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setCompanies(await fetchHrCompanies());
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const onCreate = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await createHrCompany({ name });
      setName("");
      setShowForm(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    }
  };

  return (
    <div className="hr-root">
      <div className="hr-app" style={{ minHeight: "100vh", paddingTop: 40 }}>
        <div style={{ maxWidth: 880, margin: "0 auto", textAlign: "center" }}>
          <h2 style={{ fontSize: "clamp(36px, 6vw, 56px)", letterSpacing: "-0.05em" }}>
            Выберите компанию
          </h2>
          <p style={{ color: "var(--hr-muted)", lineHeight: 1.5, maxWidth: 720, margin: "0 auto" }}>
            Сегодня не угадываем людей по впечатлению — собираем ясные HR-решения: кого смотреть
            глубже, как проверять, с кем сравнивать и как потом управлять.
          </p>
          {loading ? (
            <p style={{ marginTop: 32 }}>Загрузка…</p>
          ) : (
            <div className="hr-grid-2" style={{ marginTop: 28, textAlign: "left" }}>
              {companies.map((c) => (
                <Link key={c.id} to={`/hr/company/${c.id}`} className="hr-card" style={{ display: "block" }}>
                  <h3 style={{ margin: "0 0 8px", fontSize: 26 }}>{c.name}</h3>
                  <p style={{ margin: 0, color: "var(--hr-muted)" }}>
                    {c.industry || "Рабочее пространство компании"}
                  </p>
                </Link>
              ))}
              <div className="hr-card" style={{ borderStyle: "dashed" }}>
                {showForm ? (
                  <form onSubmit={onCreate} className="hr-form">
                    <div className="hr-field">
                      <label>Название компании</label>
                      <input value={name} onChange={(e) => setName(e.target.value)} required />
                    </div>
                    {error && <p className="hr-error">{error}</p>}
                    <button type="submit" className="hr-btn">
                      Создать
                    </button>
                    <button
                      type="button"
                      className="hr-btn hr-btn--ghost"
                      onClick={() => setShowForm(false)}
                    >
                      Отмена
                    </button>
                  </form>
                ) : (
                  <>
                    <h3 style={{ margin: "0 0 8px" }}>Добавить компанию</h3>
                    <p style={{ color: "var(--hr-muted)" }}>Новое рабочее пространство для кандидатов и команды.</p>
                    <button
                      type="button"
                      className="hr-btn"
                      style={{ marginTop: 16 }}
                      onClick={() => setShowForm(true)}
                    >
                      + Добавить компанию
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
          {companies.length === 0 && !loading && !showForm && (
            <p style={{ marginTop: 24 }}>
              <button type="button" className="hr-btn" onClick={() => setShowForm(true)}>
                Создать первую компанию
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function HrCompaniesPage() {
  return (
    <HrAuthGuard>
      <CompaniesContent />
    </HrAuthGuard>
  );
}
