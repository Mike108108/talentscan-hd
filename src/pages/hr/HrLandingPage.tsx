import { Link } from "react-router-dom";
import "../../hr.css";

export default function HrLandingPage() {
  return (
    <div className="hr-root hr-fork">
      <div className="hr-fork-inner" style={{ textAlign: "left", maxWidth: 720 }}>
        <div className="hr-hero">
          <span className="hr-eyebrow">
            <span className="hr-dot" />
            TalentScan HR
          </span>
          <h2 style={{ margin: 0 }}>Кабинет работодателя</h2>
          <p style={{ marginTop: 12 }}>
            Кандидаты, карты талантов, вакансии и HR-решения — без угадывания по первому впечатлению.
          </p>
          <div className="hr-fork-actions" style={{ marginTop: 20 }}>
            <Link to="/hr/login" className="hr-btn">
              Войти
            </Link>
            <Link to="/hr/signup" className="hr-btn hr-btn--ghost">
              Создать кабинет
            </Link>
            <Link to="/" className="hr-btn hr-btn--secondary">
              ← Выбор кабинета
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
