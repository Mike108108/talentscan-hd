import { Link } from "react-router-dom";
import "../hr.css";

export default function CabinetForkPage() {
  return (
    <div className="hr-root hr-fork">
      <div className="hr-fork-inner">
        <h1>TalentScan</h1>
        <p className="hr-fork-subtitle">Выберите рабочее пространство</p>
        <div className="hr-fork-cards">
          <div className="hr-fork-card">
            <h2>Личный кабинет</h2>
            <p>Для себя: карта, таланты, рекомендации и личные разборы.</p>
            <div className="hr-fork-actions">
              <Link to="/app" className="hr-btn">
                Открыть личный кабинет
              </Link>
            </div>
          </div>
          <div className="hr-fork-card">
            <h2>HR-кабинет</h2>
            <p>
              Для бизнеса: кандидаты, карта талантов кандидата и первые HR-гипотезы для
              найма.
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
