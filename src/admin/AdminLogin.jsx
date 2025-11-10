import { useState } from "react";
import { supabase } from "../common/supabaseClient";
import "./AdminLogin.css";

export default function AdminLogin() {
  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  const signIn = async () => {
    setLoading(true);
    setMsg("");
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: pwd,
    });
    if (error) setMsg(error.message);
    else {
        setMsg("로그인 성공!");
    }
    setLoading(false);
  };

  return (
    <div className="admin-login">
      <h3>관리자 로그인</h3>
      <input
        placeholder="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <input
        placeholder="password"
        type="password"
        value={pwd}
        onChange={(e) => setPwd(e.target.value)}
      />
      <button onClick={signIn} disabled={loading}>
        {loading ? "로그인 중…" : "로그인"}
      </button>
      {msg && <div className="login-msg">{msg}</div>}
      <p className="hint">※ 이 계정의 UID가 admins 테이블에 있어야 관리자 권한이 됩니다.</p>
    </div>
  );
}
