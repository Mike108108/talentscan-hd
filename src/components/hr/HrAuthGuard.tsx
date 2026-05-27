import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { fetchHrProfile } from "../../lib/hr/api";

type Props = { children: ReactNode; requireProfile?: boolean };

export default function HrAuthGuard({ children, requireProfile = true }: Props) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [hasProfile, setHasProfile] = useState(false);

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
        setHasSession(false);
        setLoading(false);
        navigate("/hr/login", { replace: true });
        return;
      }
      setHasSession(true);
      if (requireProfile) {
        const profile = await fetchHrProfile();
        if (cancelled) return;
        setHasProfile(Boolean(profile));
      } else {
        setHasProfile(true);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate, requireProfile]);

  if (loading) {
    return (
      <div className="hr-root hr-fork">
        <p>Загрузка…</p>
      </div>
    );
  }

  if (!hasSession) return null;

  if (requireProfile && !hasProfile) {
    return (
      <div className="hr-root hr-fork">
        <div className="hr-fork-inner">
          <div className="hr-card" style={{ maxWidth: 520, margin: "0 auto", textAlign: "center" }}>
            <h2 style={{ marginTop: 0 }}>HR-доступ не активирован</h2>
            <p style={{ color: "var(--hr-muted)" }}>
              У этого аккаунта нет HR-профиля. Создайте HR-кабинет или войдите с другим email.
            </p>
            <div className="hr-fork-actions" style={{ justifyContent: "center", marginTop: 20 }}>
              <Link to="/hr/signup" className="hr-btn">
                Создать HR-кабинет
              </Link>
              <Link to="/hr/login" className="hr-btn hr-btn--ghost">
                Другой вход
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
