import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase, isSupabaseConfigured } from "../../lib/supabase";
import { fetchHrProfile } from "../../lib/hr/api";
import "../../hr.css";

export default function HrLoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (!supabase) {
      setError("Supabase не настроен.");
      return;
    }
    setLoading(true);
    const { error: signErr } = await supabase.auth.signInWithPassword({ email, password });
    if (signErr) {
      setError(signErr.message);
      setLoading(false);
      return;
    }
    const profile = await fetchHrProfile();
    setLoading(false);
    if (!profile) {
      navigate("/hr/cabinet", { replace: true });
      return;
    }
    navigate("/hr/companies", { replace: true });
  };

  return (
    <div className="hr-root hr-fork">
      <div className="hr-card" style={{ width: "min(440px, 100%)" }}>
        <h2 style={{ marginTop: 0 }}>Вход в HR-кабинет</h2>
        {!isSupabaseConfigured && (
          <p className="hr-error">Авторизация недоступна: Supabase не настроен.</p>
        )}
        <form className="hr-form" onSubmit={onSubmit}>
          <div className="hr-field">
            <label>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="hr-field">
            <label>Пароль</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>
          {error && <p className="hr-error">{error}</p>}
          <button type="submit" className="hr-btn" disabled={loading}>
            {loading ? "Вход…" : "Войти"}
          </button>
        </form>
        <p style={{ marginTop: 16, color: "var(--hr-muted)" }}>
          Нет HR-кабинета? <Link to="/hr/signup">Создать</Link>
        </p>
        <p style={{ marginTop: 8 }}>
          <Link to="/" style={{ color: "var(--hr-muted)" }}>
            ← Выбор кабинета
          </Link>
        </p>
      </div>
    </div>
  );
}
