// src/message/MessageMain.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { supabase } from "../../common/supabaseClient";
import "./MessageMain.css";

export default function MessageMain() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const roomId = params.get("r") || null;

  const [me, setMe] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [loadingRooms, setLoadingRooms] = useState(true);

  const [room, setRoom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [loadingRoom, setLoadingRoom] = useState(true);

  const listRef = useRef(null);

  // ===== 주문 요약 모달 상태 =====
  const [showSummary, setShowSummary] = useState(false);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [summary, setSummary] = useState({
    customer_name: "",
    phone: "",
    delivery_method: "",
    address: "",
    total_amount: 0,
    items: [], // { name, optionName, qty, price }
  });

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      setMe(data?.user ?? null);
    })();
  }, []);

  // 📌 내 채팅방 목록 불러오기
  useEffect(() => {
    if (!me?.id) return;
    (async () => {
      setLoadingRooms(true);

      const { data: base } = await supabase
        .from("chat_rooms")
        .select("id, request_id, event_id, agent_id, buyer_user_id, agent_user_id, created_at")
        .or(`buyer_user_id.eq.${me.id},agent_user_id.eq.${me.id}`)
        .order("created_at", { ascending: false });

      const rows = base || [];

      const evIds = [...new Set(rows.map(r => r.event_id).filter(Boolean))];
      const agIds = [...new Set(rows.map(r => r.agent_id).filter(Boolean))];

      const [{ data: evs }, { data: agents }] = await Promise.all([
        evIds.length ? supabase.from("events").select("id,title,group_name,banner_url").in("id", evIds) : Promise.resolve({ data: [] }),
        agIds.length ? supabase.from("agents").select("id,display_name,avatar_url,agent_user_id").in("id", agIds) : Promise.resolve({ data: [] }),
      ]);

      const evMap = Object.fromEntries((evs || []).map(e => [e.id, e]));
      const agMap = Object.fromEntries((agents || []).map(a => [a.id, a]));

      const enriched = rows.map(r => {
        const event = evMap[r.event_id] || null;
        const agent = agMap[r.agent_id] || null;
        const otherName = r.buyer_user_id === me.id ? (agent?.display_name || "대리인") : "고객";
        return { ...r, event, agent, otherName };
      });

      setRooms(enriched);
      setLoadingRooms(false);
    })();
  }, [me?.id]);

  // 📌 특정 채팅방 열기
  useEffect(() => {
    if (!roomId) return;
    (async () => {
      setLoadingRoom(true);
      const { data: r } = await supabase
        .from("chat_rooms")
        .select("id, event_id")
        .eq("id", roomId)
        .maybeSingle();
      setRoom(r || null);

      const { data: msgs } = await supabase
        .from("chat_messages")
        .select("id,text,created_at,sender_uid")
        .eq("room_id", roomId)
        .order("created_at", { ascending: true });
      setMessages(msgs || []);
      setLoadingRoom(false);
      requestAnimationFrame(() => listRef.current?.scrollTo({ top: 999999 }));
    })();
  }, [roomId]);

  async function send() {
    if (!text.trim() || !roomId) return;
    const { data: uinfo } = await supabase.auth.getUser();
    const uid = uinfo?.user?.id || null;
    if (!uid) return alert("로그인이 필요합니다.");

    const payload = { room_id: roomId, text: text.trim(), sender_uid: uid };
    const { error } = await supabase.from("chat_messages").insert([payload]);
    if (!error) {
      setMessages(prev => [...prev, { id: crypto.randomUUID(), ...payload, created_at: new Date().toISOString() }]);
      setText("");
      requestAnimationFrame(() => listRef.current?.scrollTo({ top: 999999 }));
    }
  }

  // ===== 주문 요약 모달 열기 =====
  async function openSummary() {
    if (!roomId) return;
    setShowSummary(true);
    setLoadingSummary(true);
    try {
      // chat_rooms -> request_id
      const { data: roomRow } = await supabase
        .from("chat_rooms")
        .select("id, request_id")
        .eq("id", roomId)
        .single();

      if (!roomRow?.request_id) {
        setSummary(s => ({ ...s, items: [] }));
        return;
      }
      const reqId = roomRow.request_id;

      // 요청 본문
      const { data: req } = await supabase
        .from("proxy_requests")
        .select("id, customer_name, phone, delivery_method, address, total_amount")
        .eq("id", reqId)
        .single();

      // 아이템들
      const { data: items } = await supabase
        .from("proxy_request_items")
        .select("product_id, option_id, qty, price_snapshot")
        .eq("request_id", reqId);

      // 이름 매핑
      const pids = [...new Set((items || []).map(x => x.product_id))];
      const oids = [...new Set((items || []).map(x => x.option_id).filter(Boolean))];

      const { data: prows } = pids.length
        ? await supabase.from("products").select("id, name").in("id", pids)
        : { data: [] };
      const { data: orows } = oids.length
        ? await supabase.from("product_options").select("id, name").in("id", oids)
        : { data: [] };

      const pmap = Object.fromEntries((prows || []).map(r => [r.id, r.name]));
      const omap = Object.fromEntries((orows || []).map(r => [r.id, r.name]));

      const itemsPretty = (items || []).map(it => ({
        name: pmap[it.product_id] || "(상품)",
        optionName: it.option_id ? omap[it.option_id] : null,
        qty: it.qty,
        price: it.price_snapshot,
      }));

      setSummary({
        customer_name: req?.customer_name || "",
        phone: req?.phone || "",
        delivery_method: req?.delivery_method || "",
        address: req?.address || "",
        total_amount: Number(req?.total_amount || 0),
        items: itemsPretty,
      });
    } finally {
      setLoadingSummary(false);
    }
  }

  // ======================== UI ========================
  if (!roomId) {
    // ✅ 목록 화면
    return (
      <div className="chat-list-page">
        <header className="chat-header">메시지</header>
        {loadingRooms ? (
          <div className="chat-empty">목록 불러오는 중…</div>
        ) : rooms.length === 0 ? (
          <div className="chat-empty">아직 채팅방이 없습니다.</div>
        ) : (
          <ul className="chat-room-list">
            {rooms.map(r => (
              <li key={r.id} className="chat-room-item" onClick={() => navigate(`/message?r=${r.id}`)}>
                {r.event?.banner_url ? (
                  <img className="chat-room-thumb" src={r.event.banner_url} alt="event" />
                ) : (
                  <div className="chat-room-thumb noimg">EV</div>
                )}
                <div className="chat-room-meta">
                  <div className="chat-room-title">
                    {r.event?.group_name ? `[${r.event.group_name}] ` : ""}
                    {r.event?.title || "이벤트"}
                  </div>
                  <div className="chat-room-sub">{r.otherName}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  // ✅ 채팅방 화면
  return (
    <div className="chat-room-page">
      <header className="chat-header" style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button className="chat-back" onClick={() => navigate("/message")}>←</button>
        {room ? (rooms.find(r => r.id === room.id)?.otherName || "채팅") : "채팅"}
        {/* 주문 내역 모아보기 버튼 */}
        <button className="summary-btn" onClick={openSummary} style={{ marginLeft: "auto" }}>
          주문 내역 모아보기
        </button>
      </header>

      {loadingRoom ? (
        <div className="chat-wrap">불러오는 중…</div>
      ) : !room ? (
        <div className="chat-wrap">채팅방을 찾을 수 없어요.</div>
      ) : (
        <div className="chat-wrap">
          <div className="chat-list" ref={listRef}>
            {messages.map(m => (
              <div key={m.id} className={`chat-item ${m.sender_uid === me?.id ? "me" : ""}`}>
                <div className="chat-bubble">{m.text}</div>
                <div className="chat-time">{new Date(m.created_at).toLocaleTimeString()}</div>
              </div>
            ))}
            {messages.length === 0 && <div className="chat-empty">메시지가 없습니다.</div>}
          </div>
          <div className="chat-input">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="메시지를 입력하세요"
              onKeyDown={(e)=> (e.key === "Enter" ? send() : null)}
            />
            <button className="btn primary" onClick={send}>전송</button>
          </div>
        </div>
      )}

      {/* ===== 주문 요약 모달 ===== */}
      {showSummary && (
        <div className="modal-backdrop" onClick={() => setShowSummary(false)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">주문 내역</div>
              <button className="modal-close" onClick={() => setShowSummary(false)}>×</button>
            </div>

            {loadingSummary ? (
              <div className="modal-body">불러오는 중…</div>
            ) : (
              <div className="modal-body">
                <div className="kv"><span className="k">이름</span><span className="v">{summary.customer_name || "-"}</span></div>
                <div className="kv"><span className="k">전화번호</span><span className="v">{summary.phone || "-"}</span></div>
                <div className="kv"><span className="k">거래방법</span><span className="v">{summary.delivery_method || "-"}</span></div>
                {summary.delivery_method !== "현장거래" && (
                  <div className="kv"><span className="k">배송지</span><span className="v">{summary.address || "-"}</span></div>
                )}

                <div className="divider" />

                <div className="section-title">[신청내역]</div>
                <ul className="items">
                  {summary.items.map((it, idx) => (
                    <li key={idx} className="item">
                      <div className="name">
                        {it.name}{it.optionName ? ` - ${it.optionName}` : ""}
                      </div>
                      <div className="meta">
                        x{it.qty} · ₩{Number(it.price).toLocaleString()}
                      </div>
                    </li>
                  ))}
                  {summary.items.length === 0 && <li className="empty">아이템이 없습니다.</li>}
                </ul>

                <div className="total">
                  최종 결제금액 <b>₩{summary.total_amount.toLocaleString()}</b>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
