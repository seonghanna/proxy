// /front/src/auth/AuthCallback.jsx  (혹은 경로 유지)
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../common/supabaseClient";

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      const { error } = await supabase.auth.exchangeCodeForSession(window.location.href);
      if (error) {
        console.error("exchange error:", error.message);
        alert("로그인 처리에 실패했어요.");
        navigate("/", { replace: true });
        return;
      }
      navigate("/mypage", { replace: true });
    })();
  }, [navigate]);

  return <div style={{ padding: 16 }}>로그인 처리 중…</div>;
}
