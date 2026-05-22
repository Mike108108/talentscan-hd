import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured =
  Boolean(supabaseUrl?.trim()) && Boolean(supabaseAnonKey?.trim());

/**
 * Supabase client. `null` when env vars are missing (local dev without .env.local).
 * All callers must check `isSupabaseConfigured` before using this.
 */
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!)
  : null;

if (!isSupabaseConfigured) {
  console.warn(
    "[TalentScan] Supabase не настроен: VITE_SUPABASE_URL или VITE_SUPABASE_ANON_KEY отсутствуют. " +
      "Авторизация и сохранение разборов недоступны. Генерация отчётов работает в обычном режиме.",
  );
}

export type AnalysisType = "talent_map" | "current_role" | "vacancy_assessment";

export type Report = {
  id: string;
  user_id: string;
  analysis_type: AnalysisType;
  person_name: string | null;
  birth_date: string;
  birth_time: string;
  birth_place: string;
  current_role_description: string | null;
  vacancy_description: string | null;
  result_text: string;
  input_data: Record<string, unknown>;
  created_at: string;
};
