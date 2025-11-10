// /front/src/pages/MyPageMain.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../common/supabaseClient";
import "./MyPageMain.css";

const PENDING_STATES = new Set(["대기", "pending"]);
const ACCEPTED_STATES = new Set(["수락", "accepted", "수락완료"]);

async function requireGoogleLogin() {
  const { data } = await supabase.auth.getUser();
  if (data?.user) return data.user;

  await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      // 콜백용 별도 경로 없이, 로그인 시작한 페이지(혹은 사이트 루트)로 복귀
      redirectTo: window.location.origin, // 또는 window.location.href
      flowType: "implicit",               // 🔸핵심: implicit 흐름으로 강제
      queryParams: { access_type: "offline", prompt: "consent" }, // 필요 시
    },
  });
  return null;
}

async function handleLogout() {
  await supabase.auth.signOut();
  window.location.href = "/"; // 또는 navigate("/", { replace: true });
}


export default function MyPageMain() {
  const navigate = useNavigate();

  const [user, setUser] = useState(null);

  // 탭
  const [tab, setTab] = useState("buy"); // 'buy' | 'sell'
  const [sellTab, setSellTab] = useState("pending"); // 'pending' | 'accepted'

  // 데이터
  const [buyOrders, setBuyOrders] = useState([]);         // 내가 신청
  const [sellPending, setSellPending] = useState([]);     // 내가 받은 - 수락 전
  const [sellAccepted, setSellAccepted] = useState([]);   // 내가 받은 - 수락 완료

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      setUser(data?.user ?? null);
    })();
  }, []);

  useEffect(() => {
    if (!user) { setLoading(false); return; }

    (async () => {
      setLoading(true);

      // ===== 구매: buyer_user_id = 내 uid =====
      const { data: baseBuy } = await supabase
        .from("proxy_requests")
        .select("id,status,created_at,event_id,agent_id,total_amount")
        .eq("buyer_user_id", user.id)
        .order("created_at", { ascending: false });

      const evIdsB = [...new Set((baseBuy || []).map(r => r.event_id).filter(Boolean))];
      const agIdsB = [...new Set((baseBuy || []).map(r => r.agent_id).filter(Boolean))];

      const [{ data: evsB }, { data: agentsB }] = await Promise.all([
        evIdsB.length
          ? supabase.from("events").select("id,title,group_name,banner_url").in("id", evIdsB)
          : Promise.resolve({ data: [] }),
        agIdsB.length
          ? supabase.from("agents").select("id,display_name,avatar_url,agent_user_id").in("id", agIdsB)
          : Promise.resolve({ data: [] }),
      ]);

      const evMapB = Object.fromEntries((evsB || []).map(e => [e.id, e]));
      const agMapB = Object.fromEntries((agentsB || []).map(a => [a.id, a]));

      setBuyOrders((baseBuy || []).map(r => ({
        ...r,
        event: evMapB[r.event_id] || null,
        agent: agMapB[r.agent_id] || null,
      })));

      // ===== 판매: 내가 만든 agent들의 id 목록 구함 =====
      const { data: myAgents } = await supabase
        .from("agents")
        .select("id")
        .eq("agent_user_id", user.id);

      const myAgentIds = (myAgents || []).map(a => a.id);
      if (myAgentIds.length === 0) {
        setSellPending([]);
        setSellAccepted([]);
        setLoading(false);
        return;
      }

      // 전체(내가 받은 요청들)
      const { data: baseSell } = await supabase
        .from("proxy_requests")
        .select("id,status,created_at,event_id,agent_id,buyer_user_id,total_amount")
        .in("agent_id", myAgentIds)
        .order("created_at", { ascending: false });

      // 판매 쪽도 조인 데이터
      const evIdsS = [...new Set((baseSell || []).map(r => r.event_id).filter(Boolean))];
      const buyerIdsS = [...new Set((baseSell || []).map(r => r.buyer_user_id).filter(Boolean))];
      const agIdsS = [...new Set((baseSell || []).map(r => r.agent_id).filter(Boolean))];

      const [{ data: evsS }, { data: buyersS }, { data: agentsS }] = await Promise.all([
        evIdsS.length
          ? supabase.from("events").select("id,title,group_name,banner_url").in("id", evIdsS)
          : Promise.resolve({ data: [] }),
        buyerIdsS.length
          ? supabase.from("profiles").select("id,display_name,avatar_url").in("id", buyerIdsS)
          : Promise.resolve({ data: [] }),
        agIdsS.length
          ? supabase.from("agents").select("id,display_name,avatar_url,agent_user_id").in("id", agIdsS)
          : Promise.resolve({ data: [] }),
      ]);

      const evMapS = Object.fromEntries((evsS || []).map(e => [e.id, e]));
      const buyerMapS = Object.fromEntries((buyersS || []).map(b => [b.id, b]));
      const agMapS = Object.fromEntries((agentsS || []).map(a => [a.id, a]));

      const mapped = (baseSell || []).map(r => ({
        ...r,
        event: evMapS[r.event_id] || null,
        buyer: buyerMapS[r.buyer_user_id] || null,
        agent: agMapS[r.agent_id] || null,
      }));

      // 상태 분리
      setSellPending(mapped.filter(r => PENDING_STATES.has(String(r.status))));
      setSellAccepted(mapped.filter(r => ACCEPTED_STATES.has(String(r.status))));

      setLoading(false);
    })();
  }, [user?.id]);

  // ===== 공통: 요청 기준 채팅방 보장 후 이동 =====
  async function openChatByRequest(reqRow) {
    try {
      let { data: room } = await supabase
        .from("chat_rooms")
        .select("id")
        .eq("request_id", reqRow.id)
        .maybeSingle();

      if (!room) {
        const { data: uinfo } = await supabase.auth.getUser();
        const me = uinfo?.user;

        const buyerUid = reqRow.buyer_user_id || me?.id || null;
        let agentOwnerUid = null;

        if (reqRow.agent?.agent_user_id) agentOwnerUid = reqRow.agent.agent_user_id;
        else if (reqRow.agent_id) {
          const { data: arow } = await supabase
            .from("agents")
            .select("agent_user_id")
            .eq("id", reqRow.agent_id)
            .maybeSingle();
          agentOwnerUid = arow?.agent_user_id || null;
        }

        const { data: created, error: roomErr } = await supabase
          .from("chat_rooms")
          .upsert(
            [{
              request_id: reqRow.id,
              event_id: reqRow.event_id,
              agent_id: reqRow.agent_id,
              buyer_user_id: buyerUid,
              agent_user_id: agentOwnerUid,
            }],
            { onConflict: "request_id" }
          )
          .select("id")
          .single();
        if (roomErr) throw roomErr;
        room = created;
      }

      if (room?.id) navigate(`/message?r=${room.id}`);
      else alert("채팅방 생성에 실패했습니다.");
    } catch (e) {
      console.error(e);
      alert(e.message || "채팅방 이동 실패");
    }
  }

  // ===== 렌더 =====
  if (!user) {
    // 로그인 전에는 그대로 "로그인이 필요합니다" 노출
    return (
      <div className="mypage-wrap">
        <div className="mypage-login-cta">
          로그인이 필요합니다.
          <button className="btn primary" onClick={requireGoogleLogin} style={{ marginLeft: 8 }}>
            Google 로그인
          </button>
        </div>
      </div>
    );
  }

  // 로그인 후: 사용자 ID/이름/아바타 전부 숨김 (탭만 표시)
  return (
    <div className="mypage-wrap">
      <header className="mypage-header">
        <div className="mypage-tabs">
          <button
            className={`tab ${tab === "buy" ? "active" : ""}`}
            onClick={() => setTab("buy")}
          >구매</button>
          <button
            className={`tab ${tab === "sell" ? "active" : ""}`}
            onClick={() => setTab("sell")}
          >판매</button>
        </div>
        <button
    className="logout-btn"
    onClick={handleLogout}
  >
    로그아웃
  </button>
      </header>

      {loading ? (
        <div className="mypage-loading">불러오는 중…</div>
      ) : tab === "buy" ? (
        <section className="mypage-section">
          <div className="card-list">
            {buyOrders.map(o => (
  <div key={o.id} className="order-card">
    {/* 상단: 이미지 + 이벤트명 */}
    <div className="order-head">
      <img
        className="order-thumb"
        src={o.event?.banner_url || "https://placehold.co/80x80?text=EV"}
        alt={o.event?.title || "event"}
      />
      <div className="order-title">
        {o.event?.group_name && <div className="group">[{o.event.group_name}]</div>}
        <div className="name">{o.event?.title || "이벤트"}</div>
      </div>
    </div>

    {/* 하단: 풀폭 CTA 버튼 */}
    <button className="order-cta" onClick={() => openChatByRequest(o)}>
      대리내역 확인하기
    </button>
  </div>
))}




            {buyOrders.length === 0 && <div className="empty">신청한 내역이 없습니다.</div>}
          </div>
        </section>
      ) : (
        <section className="mypage-section">
          <div className="subtabs">
            <button
              className={`subtab ${sellTab === "pending" ? "active" : ""}`}
              onClick={() => setSellTab("pending")}
            >수락 전</button>
            <button
              className={`subtab ${sellTab === "accepted" ? "active" : ""}`}
              onClick={() => setSellTab("accepted")}
            >수락 완료</button>
          </div>

          <div className="card-list">
            {(sellTab === "pending" ? sellPending : sellAccepted).map(o => (
  <div key={o.id} className="order-card">
    <div className="order-head">
      <img
        className="order-thumb"
        src={o.event?.banner_url || "https://placehold.co/80x80?text=EV"}
        alt={o.event?.title || "event"}
      />
      <div className="order-title">
        {o.event?.group_name && <div className="group">[{o.event.group_name}]</div>}
        <div className="name">{o.event?.title || "이벤트"}</div>
      </div>
    </div>

    <button className="order-cta" onClick={() => openChatByRequest(o)}>
      대리내역 확인하기
    </button>
  </div>
))}



            {(sellTab === "pending" ? sellPending : sellAccepted).length === 0 && (
              <div className="empty">표시할 요청이 없습니다.</div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
