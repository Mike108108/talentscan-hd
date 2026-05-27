import { Link } from "react-router-dom";
import "../../hr.css";

export default function HrLandingPage() {
  return (
    <div className="hr-root hr-fork">
      <div className="hr-fork-inner hr-fork-inner--left">
        <div className="hr-hero">
          <span className="hr-eyebrow">
            <span className="hr-dot" />
            TalentScan HR
          </span>
          <h2>Кабинет работодателя</h2>
          <p>
            Кандидаты, карты талантов и первые HR-гипотезы для найма — в одном рабочем
            пространстве.
          </p>
          <div className="hr-fork-actions hr-fork-actions--spaced">
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
