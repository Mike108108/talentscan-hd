type ThemeToggleSwitchProps = {
  theme: "dark" | "light";
  onToggle: () => void;
  className?: string;
};

export default function ThemeToggleSwitch({
  theme,
  onToggle,
  className = "",
}: ThemeToggleSwitchProps) {
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      className={`ts-theme-switch${isDark ? " ts-theme-switch--dark" : ""}${className ? ` ${className}` : ""}`}
      onClick={onToggle}
      role="switch"
      aria-checked={isDark}
      aria-label={isDark ? "Переключить на светлую тему" : "Переключить на тёмную тему"}
    >
      <span className="ts-theme-switch__icon ts-theme-switch__icon--sun" aria-hidden="true">
        ☀
      </span>
      <span className="ts-theme-switch__track" aria-hidden="true">
        <span className="ts-theme-switch__thumb" />
      </span>
      <span className="ts-theme-switch__icon ts-theme-switch__icon--moon" aria-hidden="true">
        ☾
      </span>
    </button>
  );
}

