import { Routes, Route, Link, Navigate, useNavigate, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "../common/supabaseClient";
import AdminLogin from "./AdminLogin";
import AdminEvents from "./AdminEvents";
import AdminProducts from "./AdminProducts";
import "./AdminLayout.css";
import AdminAgents from "./AdminAgents";

export default function AdminLayout() {
  const [session, setSession] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [checking, setChecking] = useState(true); 
  const [authReady, setAuthReady] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      setSession(data.session ?? null);
      setAuthReady(true);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setAuthReady(true);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const check = async () => {
      if (!authReady) return;
      setChecking(true);
      if (!session?.user) {
        setIsAdmin(false);
        setChecking(false);
        return;
      }
      const { data, error } = await supabase
        .from("admins")
        .select("user_id")
        .eq("user_id", session.user.id)
        .maybeSingle();
      if (error) {
       console.error("admins check error:", error.message);
       setIsAdmin(false);
     } else {
       setIsAdmin(Boolean(data));
     }
      setChecking(false);
    };
    check();
  }, [authReady, session?.user?.id]);

  const signOut = async () => {
    await supabase.auth.signOut();
    setIsAdmin(false);
    navigate("/admin/login", { replace: true });
  };

  if (!authReady || checking) {
    return <div style={{ padding: 16 }}>권한 확인 중…</div>;
  }

  return (
    <div className="admin-wrap">
        <header className="admin-header">
            <div className="admin-title">관리자</div>
            <nav className="admin-nav">
                <Link to="/admin/events">이벤트 관리</Link>
                <Link to="/admin/products">상품 관리</Link>
                <Link to="/admin/agents">대리인 관리</Link>
                {!session?.user && <Link to="/admin/login">로그인</Link>}
                {session?.user && <button onClick={signOut}>로그아웃</button>}
            </nav>
        </header>


      <main className="admin-main">
        <Routes>
          <Route
    path="/login"
    element={
      session?.user
        ? (checking ? <div style={{padding:16}}>권한 확인 중…</div>
                    : (isAdmin ? <Navigate to="/admin/events" replace /> : <div style={{padding:16}}>관리자 권한이 없습니다.</div>))
        : <AdminLogin />
    }
  />

  <Route
    path="/events"
    element={
      !session?.user
        ? <Navigate to="/admin/login" replace />
        : (checking ? <div style={{padding:16}}>권한 확인 중…</div>
                    : (isAdmin ? <AdminEvents /> : <Navigate to="/admin/login" replace />))
    }
  />

  <Route
    path="/products"
    element={
      !session?.user
        ? <Navigate to="/admin/login" replace />
        : (checking ? <div style={{padding:16}}>권한 확인 중…</div>
                    : (isAdmin ? <AdminProducts /> : <Navigate to="/admin/login" replace />))
    }
  />

  <Route
    path="/agents"
    element={
      !session?.user
      ? <Navigate to="/admin/login" replace />
      : (checking ? <div style={{padding:16}}>권한 확인 중…</div>
      : (isAdmin ? <AdminAgents /> : <Navigate to="/admin/login" replace />))
      }
      />
  <Route index element={<Navigate to="/admin/events" replace />} />
        </Routes>
      </main>
    </div>
  );
}
