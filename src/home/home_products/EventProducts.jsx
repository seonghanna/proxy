import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../../common/supabaseClient";
import "./EventsProducts.css";
import DelegateModal from "./DelegateModal";

const STATUS_CLASS = {
  "판매중": "status-open",
  "일시품절": "status-temp",
  "완전품절": "status-sold",
};

export default function EventProducts() {
  const { eventId } = useParams();
  const navigate = useNavigate();

  const [event, setEvent] = useState(null);
  const [products, setProducts] = useState([]);
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);

  // 대리인 모달
  const [dlgOpen, setDlgOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState(null);

  // 상품 상세 모달
  const [selectedProduct, setSelectedProduct] = useState(null);

  useEffect(() => {
    (async () => {
      setLoading(true);

      // 이벤트 정보
      const { data: ev } = await supabase
        .from("events")
        .select("id, title, group_name, banner_url, open_date, close_date, open_time, close_time, address")
        .eq("id", eventId)
        .maybeSingle();
      setEvent(ev || null);

      // 상품 목록
      const { data: ps } = await supabase
        .from("products")
        .select("id, name, price, image_url, status") // ✅ description 제거
        .eq("event_id", eventId)
        .order("created_at", { ascending: true });
      setProducts(ps || []);

      // 대리인 목록
      const { data: ags } = await supabase
        .from("agents")
        .select("id, display_name, avatar_url, handled_cnt, is_active")
        .eq("event_id", eventId)
        .eq("is_active", true)
        .order("handled_cnt", { ascending: false });
      setAgents(ags || []);

      setLoading(false);
    })();
  }, [eventId]);

  if (loading) return <div className="ep-loading">불러오는 중…</div>;
  if (!event) return <div className="ep-loading">이벤트를 찾을 수 없어요.</div>;

  return (
    <div className="ep-container">
      {/* 이벤트 헤더 */}
      <div className="ep-header">
        {event.banner_url && (
          <img className="ep-header-img" src={event.banner_url} alt={event.title} />
        )}
        <div className="ep-header-body">
          <div className="ep-header-title">
            {event.group_name ? `[${event.group_name}] ` : ""}
            {event.title}
          </div>
          <div className="ep-header-address">{event.address}</div>
          <div className="ep-header-time">
            {event.open_date} ~ {event.close_date}
            <br />
            {String(event.open_time || "").slice(0, 5)} ~ {String(event.close_time || "").slice(0, 5)}
          </div>
        </div>
      </div>

      <button
        className="btn"
        style={{ width: "100%", marginTop: 12, borderRadius: 12 }}
        onClick={() => navigate(`/sell?eventId=${eventId}`)}
      >
        이 이벤트의 대리인으로 참가하기
      </button>

      {/* 상품 목록 */}
      <div className="ep-grid">
        {products.map((p) => (
          <div
            key={p.id}
            className="ep-card"
            onClick={() => setSelectedProduct(p)}
          >
            <div className="ep-card-media">
              {p.image_url ? (
                <img className="ep-card-img" src={p.image_url} alt={p.name} />
              ) : (
                <div className="ep-card-noimg">No Image</div>
              )}
              {p.status && (
                <span className={`ep-badge ${STATUS_CLASS[p.status] || ""}`}>
                  {p.status}
                </span>
              )}
            </div>
            <div className="ep-card-body">
              <div className="ep-card-name">{p.name}</div>
              <div className="ep-card-price">₩{Number(p.price).toLocaleString()}</div>
            </div>
          </div>
        ))}
        {products.length === 0 && (
          <div className="ep-empty">등록된 상품이 없습니다.</div>
        )}
      </div>

      {/* 대리인 목록 */}
      <div className="ep-agent-title">대리인 정보</div>
      <div className="ep-agent-grid">
        {agents.map((a) => (
          <div key={a.id} className="ep-agent-card">
            <img
              className="ep-agent-avatar"
              src={a.avatar_url || "https://i.pravatar.cc/100"}
              alt={a.display_name}
            />
            <div className="ep-agent-name">{a.display_name}</div>
            <div className="ep-agent-count">맡김 {a.handled_cnt}</div>
            <button
              className="btn ep-agent-btn"
              onClick={() => {
                setSelectedAgent(a);
                setDlgOpen(true);
              }}
            >
              맡기기
            </button>
          </div>
        ))}
        {agents.length === 0 && (
          <div className="ep-agent-empty">아직 등록된 대리인이 없습니다.</div>
        )}
      </div>

      {/* 맡기기 모달 */}
      <DelegateModal
        open={dlgOpen}
        eventId={eventId}
        agent={selectedAgent}
        onClose={() => setDlgOpen(false)}
        onSubmitted={(roomId) => {
          setDlgOpen(false);
          navigate(`/message?r=${roomId}`);
        }}
      />

      {/* 상품 상세 모달 */}
      {selectedProduct && (
        <div className="dlg-backdrop" onClick={() => setSelectedProduct(null)}>
          <div
            className="dlg-panel slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={selectedProduct.image_url}
              alt={selectedProduct.name}
              className="dlg-image"
            />
            <h3 className="dlg-title">{selectedProduct.name}</h3>
            <p className="dlg-price">
              ₩{Number(selectedProduct.price).toLocaleString()}
            </p>
            {selectedProduct.status && (
              <p className="dlg-status">상태: {selectedProduct.status}</p>
            )}
            <button
              className="btn primary"
              style={{ width: "100%", marginTop: 12 }}
              onClick={() => setSelectedProduct(null)}
            >
              닫기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
