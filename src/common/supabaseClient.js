// /front/src/common/supabaseClient.js
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // PKCE 플로우 명시적으로 사용
    flowType: "pkce",
    // 세션 유지/자동 갱신 켜기
    persistSession: true,
    autoRefreshToken: true,
    // 우리가 /auth/callback에서 직접 교환하므로 자동 감지 비활성화
    detectSessionInUrl: false,
  },
});
