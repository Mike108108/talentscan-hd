import { Link } from "react-router-dom";
import "../hr.css";

export default function CabinetForkPage() {
  return (
    <div className="hr-root hr-fork">
      <div className="hr-fork-inner">
        <h1>TalentScan</h1>
        <p style={{ color: "var(--hr-muted)", fontSize: 18 }}>Выберите кабинет</p>
        <div className="hr-fork-cards">
          <div className="hr-fork-card">
            <h2>Личный кабинет</h2>
            <p>
              Для себя: карта, таланты, карьерные роли и личные рекомендации.
            </p>
            <div className="hr-fork-actions">
              <Link to="/app" className="hr-btn">
                Войти в Личный кабинет
              </Link>
            </div>
          </div>
          <div className="hr-fork-card">
            <h2>HR-кабинет</h2>
            <p>
              Для бизнеса: кандидаты, вакансии, сотрудники, совместимость и решения по найму.
            </p>
            <div className="hr-fork-actions">
              <Link to="/hr/login" className="hr-btn">
                Войти в HR-кабинет
              </Link>
              <Link to="/hr/signup" className="hr-btn hr-btn--ghost">
                Создать HR-кабинет
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
