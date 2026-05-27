import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
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

  useEffect(() => {
    if (!loading && hasSession && requireProfile && !hasProfile) {
      navigate("/hr/setup", { replace: true });
    }
  }, [loading, hasSession, requireProfile, hasProfile, navigate]);

  if (loading) {
    return (
      <div className="hr-root hr-fork">
        <p>Загрузка…</p>
      </div>
    );
  }

  if (!hasSession) return null;

  if (requireProfile && !hasProfile) return null;

  return <>{children}</>;
}
