import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { fetchHrCompanies } from "../../lib/hr/api";

export default function HrCabinetRedirect() {
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      const companies = await fetchHrCompanies();
      if (companies.length === 1) {
        navigate(`/hr/company/${companies[0].id}`, { replace: true });
      } else {
        navigate("/hr/companies", { replace: true });
      }
    })();
  }, [navigate]);

  return (
    <div className="hr-root hr-fork">
      <p>Загрузка кабинета…</p>
    </div>
  );
}
