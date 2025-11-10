import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../common/supabaseClient";
import "./DelegateModal.css";

/** 거래방법별 배송비(원) — 필요시 수정 */
const FEE_BY_METHOD = {
  "현장거래": 0,
  "CU알뜰택배": 1800,
  "GS반값택배": 2000,
  "일반택배": 3500,
  "준등기": 2500,
};

export default function DelegateModal({ open, eventId, agent, onClose, onSubmitted }) {
  const [loading, setLoading] = useState(false);

  // 상품/옵션 선택 상태
  const [list, setList] = useState([]);
  const [optionsByPid, setOptionsByPid] = useState({});
  const [chosen, setChosen] = useState({}); // {productId: {checked, qty, optionId|null}}

  // 주문자/배송 폼
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [deliveryMethod, setDeliveryMethod] = useState("현장거래");
  const [address, setAddress] = useState("");

  // 에이전트의 소유자 uid (채팅방 참여자 지정에 필요)
  const [agentOwnerUid, setAgentOwnerUid] = useState(null);

  useEffect(() => {
    if (!open) return;
    (async () => {
      setLoading(true);

      // 에이전트 소유자 uid 확보 (agent.agent_user_id 가 없을 수도 있음)
      if (agent?.agent_user_id) {
        setAgentOwnerUid(agent.agent_user_id);
      } else if (agent?.id) {
        const { data: arow } = await supabase
          .from("agents")
          .select("agent_user_id")
          .eq("id", agent.id)
          .maybeSingle();
        setAgentOwnerUid(arow?.agent_user_id || null);
      } else {
        setAgentOwnerUid(null);
      }

      // 1) 이벤트 내 상품
      const { data: ps } = await supabase
        .from("products")
        .select("id,name,price,image_url,status")
        .eq("event_id", eventId)
        .order("created_at", { ascending: true });
      const products = ps || [];
      setList(products);

      // 2) 옵션 로드
      if (products.length) {
        const ids = products.map((p) => p.id);
        const { data: opts } = await supabase
          .from("product_options")
          .select("id,product_id,name,price_delta,price_override,status,sort_order,created_at")
          .in("product_id", ids)
          .order("sort_order", { ascending: true })
          .order("created_at", { ascending: true });
        const map = {};
        (opts || []).forEach((o) => (map[o.product_id] ||= []).push(o));
        setOptionsByPid(map);
      } else {
        setOptionsByPid({});
      }

      // 초기 선택값
      const init = {};
      products.forEach((p) => (init[p.id] = { checked: false, qty: 1, optionId: null }));
      setChosen(init);

      // 폼 초기화
      setCustomerName("");
      setPhone("");
      setDeliveryMethod("현장거래");
      setAddress("");

      setLoading(false);
    })();
  }, [open, eventId, agent?.id, agent?.agent_user_id]);

  const toggleCheck = (pid) =>
    setChosen((prev) => ({ ...prev, [pid]: { ...prev[pid], checked: !prev[pid].checked } }));
  const changeQty = (pid, d) =>
    setChosen((prev) => {
      const cur = prev[pid] || { qty: 1 };
      const next = Math.max(1, (cur.qty || 1) + d);
      return { ...prev, [pid]: { ...cur, qty: next } };
    });
  const changeOption = (pid, oid) =>
    setChosen((prev) => ({ ...prev, [pid]: { ...prev[pid], optionId: oid || null } }));

  // 가격 계산
  const prodMap = useMemo(() => Object.fromEntries(list.map((p) => [p.id, p])), [list]);
  const optMap = useMemo(
    () => Object.fromEntries(Object.values(optionsByPid).flat().map((o) => [o.id, o])),
    [optionsByPid]
  );

  const itemsSelected = useMemo(() => {
    return Object.entries(chosen)
      .filter(([, v]) => v.checked)
      .map(([pid, v]) => ({ product_id: pid, qty: v.qty, option_id: v.optionId || null }));
  }, [chosen]);

  const subTotal = useMemo(() => {
    return itemsSelected.reduce((sum, it) => {
      const p = prodMap[it.product_id];
      const o = it.option_id ? optMap[it.option_id] : null;
      if (!p) return sum;
      const unit =
        o?.price_override != null
          ? Number(o.price_override)
          : Number(p.price) + Number(o?.price_delta || 0);
      return sum + unit * it.qty;
    }, 0);
  }, [itemsSelected, prodMap, optMap]);

  const shippingFee = FEE_BY_METHOD[deliveryMethod] ?? 0;
  const totalAmount = subTotal + shippingFee;

  const submit = async () => {
    if (!itemsSelected.length) return alert("선택된 상품이 없습니다.");
    if (!customerName.trim()) return alert("이름을 입력하세요.");
    if (!phone.trim()) return alert("전화번호를 입력하세요.");
    if (deliveryMethod !== "현장거래" && !address.trim()) {
      return alert("배송 방법 선택 시 주소를 입력하세요.");
    }

    setLoading(true);
    const { data: uinfo } = await supabase.auth.getUser();
    const buyer = uinfo?.user;
    try {
      // 1) 요청 생성(주문자/배송/금액 포함)
      const { data: reqIns, error: reqErr } = await supabase
        .from("proxy_requests")
        .insert([
          {
            event_id: eventId,
            agent_id: agent.id,
            status: "대기",
            buyer_user_id: buyer?.id || null, // ✅ 내가 신청자
            customer_name: customerName.trim(),
            phone: phone.trim(),
            delivery_method: deliveryMethod,
            address: deliveryMethod === "현장거래" ? null : address.trim(),
            total_amount: totalAmount,
          },
        ])
        .select("id")
        .maybeSingle();
      if (reqErr || !reqIns) throw new Error("요청 생성 실패");

      // 2) 채팅방 생성/재사용 (request_id 기준 upsert)
      //    참여자: buyer_user_id, agent_user_id
      const { data: upserted, error: roomErr } = await supabase
        .from("chat_rooms")
        .upsert(
          [
            {
              request_id: reqIns.id,
              event_id: eventId,
              agent_id: agent.id,
              buyer_user_id: buyer?.id || null,
              agent_user_id: agentOwnerUid || null,
            },
          ],
          { onConflict: "request_id" }
        )
        .select("id")
        .single();
      if (roomErr || !upserted) throw new Error("채팅방 생성 실패");
      const roomId = upserted.id;

      // 3) 아이템 행 저장 (스냅샷 금액 포함)
      const rows = itemsSelected.map((it) => {
        const p = prodMap[it.product_id];
        const o = it.option_id ? optMap[it.option_id] : null;
        const unit =
          o?.price_override != null
            ? Number(o.price_override)
            : Number(p.price) + Number(o?.price_delta || 0);
        return {
          request_id: reqIns.id,
          product_id: it.product_id,
          option_id: it.option_id,
          qty: it.qty,
          price_snapshot: unit,
        };
      });
      const { error: itemsErr } = await supabase.from("proxy_request_items").insert(rows);
      if (itemsErr) throw itemsErr;

      // 4) 채팅에 요약 남기기 (보낸 사람은 현재 로그인 유저)
        const summaryText = `
신청 고객 : ${customerName}
전화번호 : ${phone}
${deliveryMethod === "현장거래" ? "" : `주소 : ${address}\n`}
상품합계 : ${subTotal.toLocaleString()}
거래방법 : ${deliveryMethod}${shippingFee ? ` (+${shippingFee.toLocaleString()})` : ""}
최종 결제금액 : ${totalAmount.toLocaleString()}

[신청내역]
${rows
  .map((r) => {
    const p = prodMap[r.product_id];
    const o = r.option_id ? optMap[r.option_id] : null;
    const name = o ? `${p.name} - ${o.name}` : p.name;
    return `${name} x${r.qty} (${Number(r.price_snapshot).toLocaleString()})`;
  })
  .join("\n")}
`;

await supabase.from("chat_messages").insert([
  {
    room_id: roomId,
    sender_uid: buyer?.id || null,
    text: summaryText.trim(),
  },
]);




      // 5) 콜백: 상위에서 navigate(`/message?r=${roomId}`) 등 처리
      onSubmitted?.(roomId);
    } catch (e) {
      console.error(e);
      alert(e.message || "처리 실패");
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="dlg-backdrop" onClick={onClose}>
      <div className="dlg-panel" onClick={(e) => e.stopPropagation()}>
        <div className="dlg-header">
          <div className="dlg-title">맡길 상품 선택</div>
          <button className="dlg-close" onClick={onClose}>
            ×
          </button>
        </div>

        {loading ? (
          <div className="dlg-loading">불러오는 중…</div>
        ) : (
          <>
            {/* 상품 선택 리스트 */}
            <div className="dlg-list">
              {list.map((p) => {
                const sel = chosen[p.id] || { checked: false, qty: 1, optionId: null };
                const opts = optionsByPid[p.id] || [];
                return (
                  <div className={`dlg-item ${sel.checked ? "checked" : ""}`} key={p.id}>
                    <label className="dlg-left">
                      <input
                        type="checkbox"
                        checked={sel.checked}
                        onChange={() => toggleCheck(p.id)}
                      />
                      {p.image_url ? (
                        <img className="dlg-thumb" src={p.image_url} alt={p.name} />
                      ) : (
                        <div className="dlg-noimg">No Image</div>
                      )}
                      <div className="dlg-meta">
                        <div className="dlg-name">{p.name}</div>
                        <div className="dlg-price">₩{Number(p.price).toLocaleString()}</div>
                      </div>
                    </label>

                    <div className="dlg-right">
                      {opts.length > 0 && (
                        <select
                          className="dlg-select"
                          value={sel.optionId || ""}
                          onChange={(e) => changeOption(p.id, e.target.value || null)}
                        >
                          <option value="">옵션 선택(없음)</option>
                          {opts.map((o) => (
                            <option key={o.id} value={o.id}>
                              {o.name} ·{" "}
                              {o.price_override != null
                                ? `₩${Number(o.price_override).toLocaleString()}`
                                : `+₩${Number(o.price_delta || 0).toLocaleString()}`}
                            </option>
                          ))}
                        </select>
                      )}
                      <div className="dlg-stepper">
                        <button onClick={() => changeQty(p.id, -1)}>-</button>
                        <span>{sel.qty}</span>
                        <button onClick={() => changeQty(p.id, +1)}>+</button>
                      </div>
                    </div>
                  </div>
                );
              })}
              {list.length === 0 && <div className="dlg-empty">등록된 상품이 없습니다.</div>}
            </div>

            {/* 주문자/배송 폼 */}
            <div className="dlg-form">
              <div className="dlg-form-row">
                <label>이름</label>
                <input
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="홍길동"
                />
              </div>
              <div className="dlg-form-row">
                <label>전화번호</label>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="010-1234-5678"
                />
              </div>
              <div className="dlg-form-row">
                <label>거래 방법</label>
                <select
                  value={deliveryMethod}
                  onChange={(e) => setDeliveryMethod(e.target.value)}
                >
                  {Object.keys(FEE_BY_METHOD).map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </select>
              </div>
              {deliveryMethod !== "현장거래" && (
                <div className="dlg-form-row">
                  <label>배송지</label>
                  <input
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="도로명 주소"
                  />
                </div>
              )}
            </div>

            {/* 합계/제출 */}
            <div className="dlg-footer">
              <div className="dlg-sum">
                <div>
                  상품합계 <b>₩{subTotal.toLocaleString()}</b>
                </div>
                <div>
                  배송비 <b>₩{shippingFee.toLocaleString()}</b>
                </div>
                <div>
                  최종 결제금액{" "}
                  <b className="dlg-total">₩{totalAmount.toLocaleString()}</b>
                </div>
              </div>
              <button
                className="btn primary"
                onClick={submit}
                disabled={
                  loading ||
                  !itemsSelected.length ||
                  !customerName ||
                  !phone ||
                  (deliveryMethod !== "현장거래" && !address)
                }
              >
                선택완료 · {agent?.display_name || "대리인"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
