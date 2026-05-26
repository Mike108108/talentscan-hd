export type AppSection =
  | "today"
  | "my-map"
  | "career"
  | "compatibility"
  | "reports"
  | "data"
  | "ai"
  | "new-report"
  | "settings";

export type MainNavSection = Exclude<AppSection, "new-report" | "settings">;

export const MAIN_NAV_ITEMS = [
  { id: "today" as const, label: "Сегодня", icon: "◌" },
  { id: "my-map" as const, label: "Моя карта", icon: "◇" },
  { id: "career" as const, label: "Карьера", icon: "⌁" },
  {
    id: "compatibility" as const,
    label: "Совместимость",
    icon: "◎",
    soon: true,
  },
  { id: "reports" as const, label: "Разборы", icon: "▤" },
  { id: "data" as const, label: "Данные", icon: "◫" },
  { id: "ai" as const, label: "AI-помощник", icon: "✦" },
] as const;
