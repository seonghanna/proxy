// /front/src/pages/AuthCallback.jsx
import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "../../common/supabaseClient"; // ← 경로 확인!

export default function AuthCallback() {
  const navigate = useNavigate();
  const { search } = useLocation();

  useEffect(() => {
    (async () => {
      // code 파라미터 없는 접속은 홈으로
      const code = new URLSearchParams(search).get("code");
      if (!code) {
        navigate("/", { replace: true });
        return;
      }

      // Supabase가 URL의 code(+verifier)를 세션으로 교환
      const { error } = await supabase.auth.exchangeCodeForSession(window.location.href);
      if (error) {
        console.error("exchange error:", error);
        alert("로그인 처리에 실패했어요.");
        navigate("/", { replace: true });
        return;
      }

      // URL 정리 후 원하는 곳으로 이동
      window.history.replaceState({}, "", "/mypage");
      navigate("/mypage", { replace: true });
    })();
  }, [search, navigate]);

  return <div style={{ padding: 16 }}>로그인 처리 중…</div>;
}
