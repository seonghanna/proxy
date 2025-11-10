import { createClient } from "@supabase/supabase-js";

// 환경변수
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// ✅ PKCE 전용 Supabase 클라이언트 생성
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // 🔹 PKCE 방식으로 구글 로그인 처리 (해시 안 씀)
    flowType: "pkce",

    // 🔹 토큰 자동 새로고침 + 브라우저에 세션 유지
    autoRefreshToken: true,
    persistSession: true,

    // 🔹 URL에 code가 있으면 자동으로 세션 교환 시도
    detectSessionInUrl: true,
  },
});
