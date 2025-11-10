// /front/src/pages/sell/sell_main/SellMain.jsx
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "../../common/supabaseClient";
import "./SellMain.css";

/** 거래/배송 방법 목록 (다중 선택용) */
const DELIVERY_METHODS = ["현장거래", "CU알뜰택배", "GS반값택배", "일반택배", "준등기"];

/** 배송 예정일 옵션 */
const ETA_OPTIONS = [
  { key: "D0", label: "구매 당일" },
  { key: "D1", label: "구매 후 1일 이내" },
  { key: "D2", label: "구매 후 2일 이내" },
  { key: "OTHER", label: "기타 (직접 입력)" },
];

/** 인증 이미지 업로드 */
async function uploadVerification(file) {
  if (!file) return null;
  const ext = file.name.split(".").pop() || "jpg";
  const filename = `certs/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("verifications").upload(filename, file, {
    cacheControl: "3600",
    upsert: false,
  });
  if (error) throw error;
  const { data } = supabase.storage.from("verifications").getPublicUrl(filename);
  return data.publicUrl;
}

function TermsEditor({ open, product, options, initialRows, onClose, onSave }) {
  const [rows, setRows] = useState(initialRows || []);

  useEffect(() => {
    if (open) {
      setRows(initialRows || [{ option_id: null, headcount: "", fee: "" }]);
    }
  }, [open, initialRows]);

  if (!open) return null;

  const update = (idx, patch) =>
    setRows((r) => r.map((row, i) => (i === idx ? { ...row, ...patch } : row)));

  const valid =
    rows.length > 0 &&
    rows.every((row) => {
      const hc = Number(row.headcount);
      const fee = Number(row.fee);
      return (
        row.headcount !== "" &&
        row.fee !== "" &&
        !Number.isNaN(hc) &&
        !Number.isNaN(fee) &&
        hc >= 1 &&
        fee >= 0
      );
    });

  return (
    <div className="dlg-backdrop" onClick={onClose}>
      <div className="dlg-panel" onClick={(e) => e.stopPropagation()}>
        <div className="dlg-header">
          <div className="dlg-title">{product?.name} · 인원/수고비 설정</div>
          <button className="dlg-close" onClick={onClose}>×</button>
        </div>

        <div style={{ padding: 12, display: "grid", gap: 8 }}>
          {!options?.length && <div className="muted">옵션 없음 (상품 단위로 설정합니다)</div>}

          {rows.map((row, i) => (
            <div
              key={i}
              className="row"
              style={{
                display: "grid",
                gridTemplateColumns: options?.length ? "1fr 120px 120px" : "120px 120px",
                gap: 8,
                alignItems: "center",
              }}
            >
              {options?.length && (
                <select
                  value={row.option_id || ""}
                  onChange={(e) => update(i, { option_id: e.target.value || null })}
                >
                  {options.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              )}
              <input
                type="number"
                min={1}
                value={row.headcount}
                onChange={(e) => update(i, { headcount: e.target.value })}
                placeholder="인원"
              />
              <input
                type="number"
                min={0}
                value={row.fee}
                onChange={(e) => update(i, { fee: e.target.value })}
                placeholder="수고비(원)"
              />
            </div>
          ))}
        </div>

        <div className="dlg-footer">
          <button className="btn" onClick={onClose}>취소</button>
          <button className="btn primary" onClick={() => onSave(rows)} disabled={!valid}>
            저장
          </button>
        </div>
      </div>
    </div>
  );
}

function BulkTermsEditor({ open, onClose, onSave }) {
  const [rows, setRows] = useState([{ option_id: null, headcount: 1, fee: 0 }]);
  const [applyPerOption, setApplyPerOption] = useState(false);

  useEffect(() => {
    if (open) {
      setRows([{ option_id: null, headcount: 1, fee: 0 }]);
      setApplyPerOption(false);
    }
  }, [open]);

  if (!open) return null;

  const addRow = () => setRows((r) => [...r, { option_id: null, headcount: 1, fee: 0 }]);
  const update = (idx, patch) => setRows((r) => r.map((row, i) => (i === idx ? { ...row, ...patch } : row)));
  const remove = (idx) => setRows((r) => r.filter((_, i) => i !== idx));

  return (
    <div className="dlg-backdrop" onClick={onClose}>
      <div className="dlg-panel" onClick={(e) => e.stopPropagation()}>
        <div className="dlg-header">
          <div className="dlg-title">선택 상품 정보 일괄 입력</div>
          <button className="dlg-close" onClick={onClose}>×</button>
        </div>

        <div style={{ padding: 12, display: "grid", gap: 10 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="checkbox"
              checked={applyPerOption}
              onChange={(e) => setApplyPerOption(e.target.checked)}
            />
            옵션이 있는 상품은 <b>옵션별</b>로 동일하게 적용
          </label>

          {rows.map((row, i) => (
            <div
              key={i}
              className="row"
              style={{
                display: "grid",
                gridTemplateColumns: "120px 120px 60px",
                gap: 8,
                alignItems: "center",
              }}
            >
              <input
                type="number"
                min={1}
                value={row.headcount}
                onChange={(e) =>
                  update(i, { headcount: Math.max(1, Number(e.target.value || 1)) })
                }
                placeholder="인원"
              />
              <input
                type="number"
                min={0}
                value={row.fee}
                onChange={(e) => update(i, { fee: Math.max(0, Number(e.target.value || 0)) })}
                placeholder="수고비(원)"
              />
              <button className="btn danger" onClick={() => remove(i)}>
                삭제
              </button>
            </div>
          ))}

          <button className="btn" onClick={addRow}>
            행 추가
          </button>
          <div className="muted" style={{ fontSize: 13 }}>
            • 옵션별 적용 해제 시: 상품 단위로만 저장됩니다. <br />
            • 옵션별 적용 활성 시: 해당 상품의 모든 옵션에 동일한 인원/수고비 복제.
          </div>
        </div>

        <div className="dlg-footer">
          <button className="btn" onClick={onClose}>취소</button>
          <button
            className="btn primary"
            onClick={() => onSave({ rows, applyPerOption })}
            disabled={!rows.length}
          >
            저장
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SellMain() {
  const [params] = useSearchParams();
  const initialEventId = params.get("eventId") || "";

  const [user, setUser] = useState(null);

  // 이벤트 & 선택
  const [events, setEvents] = useState([]);
  const [eventId, setEventId] = useState(initialEventId);

  // 상품 & 선택상태
  const [products, setProducts] = useState([]);
  const [pick, setPick] = useState({}); // { productId: {checked, qty} }

  // 인증/배송 폼
  const [certUrl, setCertUrl] = useState("");
  const [certWaived, setCertWaived] = useState(false);

  // ✅ 거래/배송 방법: 다중선택
  const [deliveryMethods, setDeliveryMethods] = useState([]); // string[]
  // ✅ 배송 예정일: 선택식 + 기타 텍스트
  const [etaOption, setEtaOption] = useState("D0"); // 'D0' | 'D1' | 'D2' | 'OTHER'
  const [etaOtherText, setEtaOtherText] = useState("");

  const [hasPerk, setHasPerk] = useState(false);
  const [memo, setMemo] = useState("");

  // terms[productId] = [{ option_id, headcount, fee }]
  const [terms, setTerms] = useState({});
  const [touched, setTouched] = useState({}); // { [productId]: true }

  // 모달 상태
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorProduct, setEditorProduct] = useState(null);
  const [editorOptions, setEditorOptions] = useState([]);
  const [editorInitialRows, setEditorInitialRows] = useState([]);

  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkWorking, setBulkWorking] = useState(false);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      setUser(data?.user ?? null);
    })();
  }, []);

  // 이벤트 목록
  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("events")
        .select("id,title,group_name,banner_url,open_date")
        .order("open_date", { ascending: true });
      setEvents(data || []);
      if (!eventId && data?.length) setEventId(String(data[0].id));
      setLoading(false);
    })();
  }, []);

  // 이벤트 변경 시 상품 로드
  useEffect(() => {
    if (!eventId) return;
    (async () => {
      const { data: ps } = await supabase
        .from("products")
        .select("id,name,price,image_url,status")
        .eq("event_id", eventId)
        .order("created_at", { ascending: true });
      const list = ps || [];
      setProducts(list);

      const initPick = {};
      list.forEach((p) => (initPick[p.id] = { checked: false, qty: 1 }));
      setPick(initPick);
      setTerms({});
      setTouched({});
      setSaved(false);
    })();
  }, [eventId]);

  // 기존 입력값 불러오기
  useEffect(() => {
    if (!eventId || !user || products.length === 0) return;
    (async () => {
      // form
      const { data: form } = await supabase
        .from("agent_event_forms")
        .select("cert_url, cert_waived, delivery_method, delivery_eta, has_perk, memo")
        .eq("event_id", eventId)
        .eq("agent_user_id", user.id)
        .maybeSingle();

      if (form) {
        setCertUrl(form.cert_url || "");
        setCertWaived(!!form.cert_waived);

        // ✅ delivery_method(JSON 문자열 or 단일 문자열) 파싱
        let methods = [];
        if (typeof form.delivery_method === "string" && form.delivery_method.length) {
          try {
            const parsed = JSON.parse(form.delivery_method);
            if (Array.isArray(parsed)) methods = parsed;
            else methods = [form.delivery_method];
          } catch {
            methods = [form.delivery_method];
          }
        }
        setDeliveryMethods(methods);

        // ✅ delivery_eta를 옵션으로 유추
        const eta = form.delivery_eta || "";
        if (eta.includes("구매 당일")) setEtaOption("D0");
        else if (eta.includes("1일")) setEtaOption("D1");
        else if (eta.includes("2일")) setEtaOption("D2");
        else {
          setEtaOption("OTHER");
          setEtaOtherText(eta);
        }

        setHasPerk(!!form.has_perk);
        setMemo(form.memo || "");
      }

      // terms
      const { data: rows } = await supabase
        .from("agent_product_terms")
        .select("product_id, option_id, headcount, fee")
        .eq("event_id", eventId)
        .eq("agent_user_id", user.id);

      if (rows && rows.length) {
        const t = {};
        rows.forEach((r) => {
          (t[r.product_id] ||= []).push({
            option_id: r.option_id || null,
            headcount: Number(r.headcount || 1),
            fee: Number(r.fee || 0),
          });
        });
        setTerms(t);

        setTouched((prev) => {
          const next = { ...prev };
          Object.keys(t).forEach((pid) => {
            next[pid] = true;
          });
          return next;
        });

        setPick((prev) => {
          const next = { ...prev };
          Object.keys(t).forEach((pid) => {
            if (next[pid]) next[pid] = { ...next[pid], checked: true };
          });
          return next;
        });
      }
    })();
  }, [eventId, user?.id, products.length]);

  // 합계 수량
  const totalQty = useMemo(
    () => Object.values(pick).reduce((acc, v) => acc + (v.checked ? v.qty : 0), 0),
    [pick]
  );

  const toggle = (pid) =>
    setPick((old) => ({ ...old, [pid]: { ...(old[pid] || { qty: 1 }), checked: !(old[pid]?.checked) } }));

  const step = (pid, d) =>
    setPick((old) => {
      const cur = old[pid] || { checked: false, qty: 1 };
      const next = Math.max(1, (cur.qty || 1) + d);
      return { ...old, [pid]: { ...cur, qty: next } };
    });

  // 개별 편집 열기
  const openEditor = async (product) => {
    const { data: opts } = await supabase
      .from("product_options")
      .select("id,name,price_delta,price_override,sort_order")
      .eq("product_id", product.id)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    const options = opts || [];
    const existing = terms[product.id] || [];
    const isTouched = !!touched[product.id];

    let rows = [];
    if (options.length > 0) {
      rows = options.map((o) => {
        const byOption = existing.find((r) => String(r.option_id) === String(o.id));
        const generic = existing.find((r) => r.option_id == null);
        const base = isTouched
          ? byOption || generic || { headcount: 1, fee: 0 }
          : { headcount: "", fee: "" };
        return {
          option_id: o.id,
          headcount: base.headcount,
          fee: base.fee,
        };
      });
    } else {
      if (isTouched && existing.length) {
        rows = existing.map((r) => ({
          option_id: null,
          headcount: Number(r.headcount || 1),
          fee: Number(r.fee || 0),
        }));
      } else {
        rows = [{ option_id: null, headcount: "", fee: "" }];
      }
    }

    setEditorOptions(options);
    setEditorProduct(product);
    setEditorInitialRows(rows);
    setEditorOpen(true);
  };

  const saveEditor = (rows) => {
    if (!editorProduct) return;
    const normalized = rows.map((r) => ({
      option_id: r.option_id || null,
      headcount: Number(r.headcount),
      fee: Number(r.fee),
    }));
    setTerms((t) => ({ ...t, [editorProduct.id]: normalized }));
    setTouched((prev) => ({ ...prev, [editorProduct.id]: true }));
    setEditorOpen(false);
  };

  const saveBulkEditor = async ({ rows, applyPerOption }) => {
    const selectedIds = Object.entries(pick)
      .filter(([, v]) => v.checked)
      .map(([pid]) => pid);
    if (!selectedIds.length) return alert("선택된 상품이 없습니다.");

    try {
      setBulkWorking(true);

      let optionsByProduct = {};
      if (applyPerOption) {
        const { data: opts } = await supabase
          .from("product_options")
          .select("id, product_id")
          .in("product_id", selectedIds);
        optionsByProduct = (opts || []).reduce((acc, o) => {
          (acc[o.product_id] ||= []).push(o);
          return acc;
        }, {});
      }

      setTerms((prev) => {
        const next = { ...prev };
        selectedIds.forEach((pid) => {
          if (applyPerOption) {
            const opts = optionsByProduct[pid] || [];
            if (opts.length) {
              next[pid] = opts.flatMap((o) =>
                rows.map((r) => ({
                  option_id: o.id,
                  headcount: Number(r.headcount || 1),
                  fee: Number(r.fee || 0),
                }))
              );
            } else {
              next[pid] = rows.map((r) => ({
                option_id: null,
                headcount: Number(r.headcount || 1),
                fee: Number(r.fee || 0),
              }));
            }
          } else {
            next[pid] = rows.map((r) => ({
              option_id: null,
              headcount: Number(r.headcount || 1),
              fee: Number(r.fee || 0),
            }));
          }
        });
        return next;
      });

      setTouched((prev) => {
        const next = { ...prev };
        selectedIds.forEach((pid) => (next[pid] = true));
        return next;
      });

      setPick((prev) => {
        const next = { ...prev };
        selectedIds.forEach((pid) => {
          if (next[pid]) next[pid] = { ...next[pid], checked: true };
        });
        return next;
      });

      setBulkOpen(false);
    } catch (e) {
      console.error(e);
      alert(e.message || "일괄 적용 실패");
    } finally {
      setBulkWorking(false);
    }
  };

  const onPickCert = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const url = await uploadVerification(file);
      setCertUrl(url || "");
    } catch (err) {
      alert("인증 이미지 업로드 실패: " + (err.message || err));
    }
  };

  const allSelectedHaveTerms = useMemo(() => {
    const selectedIds = Object.entries(pick).filter(([, v]) => v.checked).map(([pid]) => pid);
    if (!selectedIds.length) return false;
    return selectedIds.every(
      (pid) => touched[pid] && Array.isArray(terms[pid]) && terms[pid].length > 0
    );
  }, [pick, terms, touched]);

  const saveAsAgent = async () => {
    const { data } = await supabase.auth.getUser();
    const u = data?.user;
    if (!u) {
      alert("로그인이 필요합니다.");
      return;
    }
    if (!eventId) return alert("이벤트를 선택하세요.");
    if (!allSelectedHaveTerms) return alert("체크된 모든 상품의 인원/수고비를 입력하세요.");
    if (!deliveryMethods.length) return alert("거래/배송 방법을 하나 이상 선택하세요.");

    try {
      setBusy(true);

      // agents upsert
      const { data: me } = await supabase
        .from("agents")
        .select("id")
        .eq("event_id", eventId)
        .eq("agent_user_id", u.id)
        .maybeSingle();

      const payload = {
        event_id: eventId,
        agent_user_id: u.id,
        display_name: u.user_metadata?.name || u.email?.split("@")[0] || "Agent",
        avatar_url: u.user_metadata?.avatar_url || null,
        is_active: true,
      };
      if (me?.id) {
        const { error } = await supabase.from("agents").update(payload).eq("id", me.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("agents").insert([payload]);
        if (error) throw error;
      }

      // form upsert (delete-then-insert)
      await supabase.from("agent_event_forms")
        .delete()
        .eq("event_id", eventId)
        .eq("agent_user_id", u.id);

      // ✅ eta 텍스트 만들기
      const etaText =
        etaOption === "D0" ? "구매 당일"
          : etaOption === "D1" ? "구매 후 1일 이내"
          : etaOption === "D2" ? "구매 후 2일 이내"
          : (etaOtherText || "");

      const { error: formErr } = await supabase.from("agent_event_forms").insert([{
        event_id: eventId,
        agent_user_id: u.id,
        cert_url: certWaived ? null : (certUrl || null),
        cert_waived: !!certWaived,
        // ✅ 다중선택을 JSON 문자열로 저장
        delivery_method: JSON.stringify(deliveryMethods),
        delivery_eta: etaText || null,
        has_perk: hasPerk,
        memo: memo || null,
      }]);
      if (formErr) throw formErr;

      // terms upsert (delete-then-insert)
      await supabase.from("agent_product_terms")
        .delete()
        .eq("event_id", eventId)
        .eq("agent_user_id", u.id);

      const rows = [];
      for (const [pid, rowset] of Object.entries(terms)) {
        (rowset || []).forEach((r) => {
          rows.push({
            event_id: eventId,
            agent_user_id: u.id,
            product_id: pid,
            option_id: r.option_id || null,
            headcount: Number(r.headcount || 1),
            fee: Number(r.fee || 0),
          });
        });
      }
      if (rows.length) {
        const { error: rowsErr } = await supabase.from("agent_product_terms").insert(rows);
        if (rowsErr) throw rowsErr;
      }

      setSaved(true);
      alert("대리인 등록 및 상세 정보가 저장되었습니다.");
    } catch (e) {
      console.error(e);
      alert(e.message || "등록 실패");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="sell-wrap">불러오는 중…</div>;

  return (
    <div className="sell-wrap">
      {/* 헤더 */}
      <header className="sell-header">
        <div className="sell-title">SELL</div>
        <div className="sell-user">
          {user ? (
            <span>{user.user_metadata?.name || user.email}</span>
          ) : (
            <button className="btn" onClick={async () => {
              const { data } = await supabase.auth.getUser();
              if (!data?.user) {
                await supabase.auth.signInWithOAuth({
                  provider: "google",
                  options: { redirectTo: window.location.href },
                });
              }
            }}>Google 로그인</button>
          )}
        </div>
      </header>

      {/* 이벤트 선택 */}
      <section className="sell-section">
        <h3>이벤트 선택</h3>
        <div className="event-list">
          {events.map((ev) => (
            <button
              key={ev.id}
              className={`event-item ${String(ev.id) === String(eventId) ? "active" : ""}`}
              onClick={() => setEventId(String(ev.id))}
            >
              <div className="event-name">
                {ev.group_name ? `[${ev.group_name}] ` : ""}
                {ev.title}
              </div>
              <div className="event-date">{ev.open_date?.slice(0, 10)}</div>
            </button>
          ))}
          {!events.length && <div className="muted">표시할 이벤트가 없어요.</div>}
        </div>
      </section>

      {/* 인증 & 배송 */}
      <section className="sell-section">
        <h3>인증 및 배송 정보</h3>

        <div className="panel">
          {/* 업로드 */}
          <div className="form-row">
            <input
              id="cert-file"
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={onPickCert}
              disabled={certWaived}
            />
            <button
              className="btn"
              onClick={() => document.getElementById("cert-file").click()}
              disabled={certWaived}
            >
              인증(사진) 업로드
            </button>
            {certUrl && !certWaived && <span className="muted">업로드됨 ✔</span>}
          </div>

          {/* 체크박스: 인증 생략 */}
          <div className="form-row-inline">
            <input
              id="cert-waived"
              type="checkbox"
              checked={certWaived}
              onChange={(e) => setCertWaived(e.target.checked)}
            />
            <label htmlFor="cert-waived">아직 인증 내역이 없어요</label>
          </div>

          {/* 거래/배송 방법: 다중 선택 체크박스 */}
          <div className="form-item">
            <label>거래/배송 방법 (복수 선택 가능)</label>
            <div className="form-stack" style={{ gridTemplateColumns: "1fr" }}>
              {DELIVERY_METHODS.map((m) => {
                const checked = deliveryMethods.includes(m);
                return (
                  <label key={m} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        const on = e.target.checked;
                        setDeliveryMethods((prev) =>
                          on ? Array.from(new Set([...prev, m])) : prev.filter((x) => x !== m)
                        );
                      }}
                    />
                    {m}
                  </label>
                );
              })}
            </div>
          </div>

          {/* 배송 예정일: 라디오 + 기타 입력 */}
          <div className="form-item">
            <label>배송 예정일</label>
            <div className="form-stack">
              {ETA_OPTIONS.map((opt) => (
                <label key={opt.key} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input
                    type="radio"
                    name="eta"
                    checked={etaOption === opt.key}
                    onChange={() => setEtaOption(opt.key)}
                  />
                  {opt.label}
                </label>
              ))}
              {etaOption === "OTHER" && (
                <input
                  type="text"
                  value={etaOtherText}
                  onChange={(e) => setEtaOtherText(e.target.value)}
                  placeholder="예: 주말 수령 가능, 3일 이내, 일정 협의 등"
                />
              )}
            </div>
          </div>

          {/* 특전/메모 */}
          <div className="form-item">
            <label style={{ display: "flex", alignItems: "center", gap: 8, margin: 0 }}>
              <input
                id="has-perk"
                type="checkbox"
                checked={hasPerk}
                onChange={(e) => setHasPerk(e.target.checked)}
              />
              특전 유무
            </label>
          </div>
          <div className="form-item">
            <label>기타 메모</label>
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="현장 전달 시 대략적인 시간 등"
              rows={3}
            />
          </div>
        </div>
      </section>

      {/* 상품 목록 */}
      <section className="sell-section">
        <h3>대리할 상품 선택</h3>
        <div className="prod-grid">
          {products.map((p) => {
            const sel = pick[p.id] || { checked: false, qty: 1 };
            const completed = touched[p.id] && Array.isArray(terms[p.id]) && terms[p.id].length > 0;
            return (
              <div key={p.id} className={`prod-card ${sel.checked ? "checked" : ""}`}>
                <label className="prod-left">
                  <input type="checkbox" checked={sel.checked} onChange={() => toggle(p.id)} />
                  {p.image_url ? (
                    <img className="prod-thumb" src={p.image_url} alt={p.name} />
                  ) : (
                    <div className="prod-noimg">No Image</div>
                  )}
                  <div className="prod-meta">
                    <div className="prod-name">{p.name}</div>
                    <div className="prod-price">₩{Number(p.price).toLocaleString()}</div>
                  </div>
                </label>

                <div className="prod-stepper">
                  <button onClick={() => step(p.id, -1)}>-</button>
                  <span>{sel.qty}</span>
                  <button onClick={() => step(p.id, +1)}>+</button>
                </div>

                <button
                  className="btn prod-edit-btn"
                  title="옵션별 인원/수고비 편집"
                  onClick={() => openEditor(p)}
                >
                  ✏️
                </button>

                {sel.checked && (
                  <div style={{ marginTop: 6 }}>
                    <span className="muted">{completed ? "입력 완료 ✔" : "정보 입력 필요"}</span>
                  </div>
                )}
              </div>
            );
          })}
          {!products.length && <div className="muted">등록된 상품이 없습니다.</div>}
        </div>

        <div className="sell-footer">
          <div className="sell-summary">
            선택 수량: <b>{totalQty}</b>개
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn" disabled={busy || totalQty === 0} onClick={() => setBulkOpen(true)}>
              선택 상품 정보 일괄 입력
            </button>
            <button
              className="btn primary"
              disabled={busy || !eventId || !allSelectedHaveTerms || !deliveryMethods.length}
              onClick={saveAsAgent}
            >
              {saved ? "등록 완료" : "완료(등록)"}
            </button>
          </div>
        </div>
      </section>

      {/* 모달들 */}
      <TermsEditor
        open={editorOpen}
        product={editorProduct}
        options={editorOptions}
        initialRows={editorInitialRows}
        onClose={() => setEditorOpen(false)}
        onSave={saveEditor}
      />
      <BulkTermsEditor open={bulkOpen} onClose={() => setBulkOpen(false)} onSave={saveBulkEditor} />
    </div>
  );
}
