import { useEffect, useState } from "react";
import { supabase } from "../common/supabaseClient";
import "./AdminProducts.css";

export default function AdminProducts() {
  // ===== 상태 =====
  const [events, setEvents] = useState([]);
  const [eventId, setEventId] = useState("");

  const [products, setProducts] = useState([]);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [pForm, setPForm] = useState({
    name: "",
    price: "",
    image_url: "",
    status: "판매중",
  });
  const [pFile, setPFile] = useState(null);
  const [pPreview, setPPreview] = useState("");

  const [options, setOptions] = useState([]);
  const [oForm, setOForm] = useState({
    name: "",
    price_delta: "0",
    price_override: "",
    image_url: "",
    status: "판매중",
    sort_order: "0",
  });
  const [oFile, setOFile] = useState(null);
  const [editingOptionId, setEditingOptionId] = useState(null);

  const [busy, setBusy] = useState(false);

  const beginEditOption = (opt) => {
  setEditingOptionId(opt.id);
  setOForm({
    name: opt.name ?? "",
    price_delta: String(opt.price_delta ?? "0"),
    price_override: opt.price_override == null ? "" : String(opt.price_override),
    image_url: opt.image_url ?? "",
    status: opt.status ?? "판매중",
    sort_order: String(opt.sort_order ?? "0"),
  });
  setOFile(null);
};

  const saveOption = async () => {
  if (!editingOptionId) return;
  if (!oForm.name.trim()) return alert("옵션명을 입력하세요.");
  setBusy(true);
  try {
    let img = oForm.image_url;
    if (oFile) img = await uploadToStorage(oFile, "products");
    const payload = {
      name: oForm.name.trim(),
      price_delta: oForm.price_delta === "" ? 0 : Number(oForm.price_delta),
      price_override: oForm.price_override === "" ? null : Number(oForm.price_override),
      image_url: img || null,
      status: oForm.status || "판매중",
      sort_order: Number(oForm.sort_order || 0),
    };
    const { error } = await supabase
      .from("product_options")
      .update(payload)
      .eq("id", editingOptionId);
    if (error) throw error;
    await loadOptions(selectedProductId);
    setEditingOptionId(null);
    setOForm({
      name: "",
      price_delta: "0",
      price_override: "",
      image_url: "",
      status: "판매중",
      sort_order: "0",
    });
    setOFile(null);
    alert("옵션이 수정되었어요.");
  } catch (e) {
    console.error(e);
    alert("수정 실패: " + e.message);
  } finally {
    setBusy(false);
  }
};

 const moveOption = async (opt, dir = "up") => {
  // dir: "up" => -1, "down" => +1
  const delta = dir === "down" ? 1 : -1;
  const nextOrder = Number(opt.sort_order || 0) + delta;
  setBusy(true);
  try {
    const { error } = await supabase
      .from("product_options")
      .update({ sort_order: nextOrder })
      .eq("id", opt.id);
    if (error) throw error;
    await loadOptions(selectedProductId);
  } catch (e) {
    console.error(e);
    alert("정렬 변경 실패: " + e.message);
  } finally {
    setBusy(false);
  }
};










  // ===== 초기: 이벤트 목록 불러오기 =====
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("events")
        .select("id, title, group_name, open_date")
        .order("open_date", { ascending: true });
      if (error) {
        console.error(error);
        return;
      }
      setEvents(data || []);
      if ((data || []).length > 0) {
        setEventId(String(data[0].id)); // 문자열 유지
      }
    })();
  }, []);

  // ===== 이벤트 선택 시 상품 목록 불러오기 =====
  useEffect(() => {
    if (!eventId) return;
    loadProducts(eventId);
    setSelectedProductId("");
    setOptions([]);
  }, [eventId]);

  // ===== 상품 선택 시 옵션 목록 불러오기 =====
  useEffect(() => {
    if (!selectedProductId) {
      setOptions([]);
      return;
    }
    loadOptions(selectedProductId);
  }, [selectedProductId]);

  // ===== helpers =====
  const bind = (form, setForm, key) => ({
    value: form[key] ?? "",
    onChange: (e) => setForm({ ...form, [key]: e.target.value }),
  });

  const uploadToStorage = async (file, folder = "products") => {
    if (!file) return null;
    const ext = file.name.split(".").pop() || "jpg";
    const filename = `${folder}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("products").upload(filename, file, {
      cacheControl: "3600",
      upsert: false,
    });
    if (error) throw error;
    const { data } = supabase.storage.from("products").getPublicUrl(filename);
    return data.publicUrl;
  };

  const loadProducts = async (eid) => {
    const { data, error } = await supabase
      .from("products")
      .select("id, name, price, image_url, status, created_at")
      .eq("event_id", eid) // 문자열 그대로
      .order("created_at", { ascending: true });
    if (error) {
      console.error(error);
      setProducts([]);
    } else {
      setProducts(data || []);
    }
  };

  const loadOptions = async (pid) => {
    const { data, error } = await supabase
      .from("product_options")
      .select("id, name, price_delta, price_override, image_url, status, sort_order, created_at")
      .eq("product_id", pid)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) {
      console.error(error);
      setOptions([]);
    } else {
      setOptions(data || []);
    }
  };

  // ===== 상품 =====
  const addProduct = async () => {
    if (!eventId) return alert("이벤트를 선택하세요.");
    if (!pForm.name) return alert("상품명을 입력하세요.");
    setBusy(true);
    try {
      let img = pForm.image_url;
      if (pFile) img = await uploadToStorage(pFile, "products");

      const payload = {
        event_id: eventId, // 문자열 그대로
        name: pForm.name.trim(),
        price: Number(pForm.price || 0),
        image_url: img || null,
        status: pForm.status || "판매중",
      };

      const { error } = await supabase.from("products").insert([payload]);
      if (error) throw error;

      setPForm({ name: "", price: "", image_url: "", status: "판매중" });
      setPFile(null);
      await loadProducts(eventId);
      alert("상품이 추가되었어요.");
    } catch (e) {
      console.error(e);
      alert("추가 실패: " + e.message);
    } finally {
      setBusy(false);
    }
  };

  const removeProduct = async (id) => {
    if (!confirm("상품을 삭제할까요? (옵션도 함께 삭제됩니다)")) return;
    setBusy(true);
    try {
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;
      if (id === selectedProductId) setSelectedProductId("");
      await loadProducts(eventId);
    } catch (e) {
      alert("삭제 실패: " + e.message);
    } finally {
      setBusy(false);
    }
  };

  // ===== 옵션 =====
  const addOption = async () => {
    if (!selectedProductId) return alert("먼저 상품을 선택하세요.");
    if (!oForm.name) return alert("옵션명을 입력하세요.");
    setBusy(true);
    try {
      let img = oForm.image_url;
      if (oFile) img = await uploadToStorage(oFile, "products");

      const payload = {
        product_id: selectedProductId,
        name: oForm.name.trim(),
        price_delta: oForm.price_delta === "" ? 0 : Number(oForm.price_delta),
        price_override: oForm.price_override === "" ? null : Number(oForm.price_override),
        image_url: img || null,
        status: oForm.status || "판매중",
        sort_order: Number(oForm.sort_order || 0),
      };

      const { error } = await supabase.from("product_options").insert([payload]);
      if (error) throw error;

      setOForm({
        name: "",
        price_delta: "0",
        price_override: "",
        image_url: "",
        status: "판매중",
        sort_order: "0",
      });
      setOFile(null);
      await loadOptions(selectedProductId);
      alert("옵션이 추가되었어요.");
    } catch (e) {
      console.error(e);
      alert("추가 실패: " + e.message);
    } finally {
      setBusy(false);
    }
  };

  const removeOption = async (id) => {
    if (!confirm("옵션을 삭제할까요?")) return;
    setBusy(true);
    try {
      const { error } = await supabase.from("product_options").delete().eq("id", id);
      if (error) throw error;
      await loadOptions(selectedProductId);
    } catch (e) {
      alert("삭제 실패: " + e.message);
    } finally {
      setBusy(false);
    }
  };

  // ===== 렌더 =====
  return (
    <div className="admin-products">
      <h3>상품 관리</h3>

      {/* 이벤트 선택 */}
      <div className="panel">
        <label>이벤트 선택</label>
        <select value={eventId} onChange={(e) => setEventId(e.target.value)}>
          {events.map((ev) => (
            <option key={ev.id} value={String(ev.id)}>
              {ev.group_name ? `[${ev.group_name}] ` : ""}
              {ev.title}
            </option>
          ))}
        </select>
      </div>

      <div className="grid-2">
        {/* 상품 등록 */}
        <div className="panel">
          <h4>상품 추가</h4>
          <input placeholder="상품명 (예: GRIPTOK)" {...bind(pForm, setPForm, "name")} />
          <input placeholder="가격(원)" type="number" {...bind(pForm, setPForm, "price")} />
          <input placeholder="이미지 URL(업로드 시 자동 채움)" {...bind(pForm, setPForm, "image_url")} />
          <div className="row">
            <input 
            type="file" 
            accept="image/*" 
            onChange={(e) => {
              const file = e.target.files?.[0] || null;
                setPFile(file);
                if (file) setPPreview(URL.createObjectURL(file));
                else setPPreview("");
              }}
            />
            <span className="hint">storage products 버킷에 올라갑니다.</span>
          </div>
          <select {...bind(pForm, setPForm, "status")}>
            <option>판매중</option>
            <option>일시품절</option>
            <option>완전품절</option>
          </select>
          <button className="btn primary" disabled={busy} onClick={addProduct}>
            {busy ? "처리 중…" : "상품 추가"}
          </button>
           {pPreview && (
            <div style={{ marginTop: 10 }}>
              <img
                src={pPreview}
                alt="preview"
                style={{
                  width: 120,
                  height: 120,
                  objectFit: "cover",
                  borderRadius: 8,
                  border: "1px solid #ddd",
                }}
              />
            </div>
          )}
          </div>     
        

        {/* 상품 목록 */}
        <div className="panel">
          <h4>상품 목록</h4>
          <ul className="list">
            {products.map((p) => (
              <li key={p.id} className={`item ${selectedProductId === p.id ? "active" : ""}`}>
                <button
                  className="link"
                  onClick={() => setSelectedProductId(p.id)}
                  style={{ display: "flex", alignItems: "center", gap: 10 }}
                >
                  {p.image_url && (
                    <img
                      src={p.image_url}
                      alt={p.name}
                      style={{ width: 40, height: 40, borderRadius: 6, objectFit: "cover" }}
                    />
                  )}
                  <div style={{ textAlign: "left" }}>
                    <div>{p.name}</div>
                    <div className="muted">₩{Number(p.price).toLocaleString()}</div>
                  </div>
              </button>
                <div className="spacer" />
                <button className="btn danger" onClick={() => removeProduct(p.id)}>삭제</button>
              </li>
            ))}
            {products.length === 0 && <div className="muted">등록된 상품이 없습니다.</div>}
          </ul>
        </div>
      </div>

      {/* 옵션 관리 */}
      <div className="panel">
        <h4>옵션 관리 {selectedProductId ? "" : "(상품 선택 필요)"}</h4>
        <div className="grid-3">
          <input placeholder="옵션명 (예: 소희 ver)" {...bind(oForm, setOForm, "name")} />
          <input placeholder="가격 증감(원, 기본 0)" type="number" {...bind(oForm, setOForm, "price_delta")} />
          <input placeholder="옵션 고정가(비워두면 미사용)" type="number" {...bind(oForm, setOForm, "price_override")} />
          <input placeholder="옵션 이미지 URL" {...bind(oForm, setOForm, "image_url")} />
          <div className="row">
            <input type="file" accept="image/*" onChange={(e) => setOFile(e.target.files?.[0] || null)} />
          </div>
          <select {...bind(oForm, setOForm, "status")}>
            <option>판매중</option>
            <option>일시품절</option>
            <option>완전품절</option>
          </select>
          <input placeholder="정렬값(숫자 작을수록 위)" type="number" {...bind(oForm, setOForm, "sort_order")} />
        </div>
        <div style={{ display: "flex", gap: 8 }}>
  {!editingOptionId ? (
    <button className="btn" disabled={busy || !selectedProductId} onClick={addOption}>
      옵션 추가
    </button>
  ) : (
    <>
      <button className="btn primary" disabled={busy} onClick={saveOption}>
        수정 저장
      </button>
      <button
        className="btn"
        disabled={busy}
        onClick={() => {
          setEditingOptionId(null);
          setOForm({
            name: "",
            price_delta: "0",
            price_override: "",
            image_url: "",
            status: "판매중",
            sort_order: "0",
          });
          setOFile(null);
        }}
      >
        취소
      </button>
    </>
  )}
</div>


        <ul className="list" style={{ marginTop: 10 }}>
          {options.map((o) => (
            <li key={o.id} className="item">
              {/* 썸네일 */}
{o.image_url && (
  <img
    src={o.image_url}
    alt={o.name}
    style={{ width: 40, height: 40, borderRadius: 6, objectFit: "cover", marginRight: 8 }}
  />
)}

{/* 이름/가격 정보 */}
<div style={{ minWidth: 0 }}>
  <div style={{ fontWeight: 600 }}>{o.name}</div>
  <div className="muted" style={{ fontSize: 12 }}>
    delta {o.price_delta ?? 0}
    {o.price_override != null ? ` / override ₩${Number(o.price_override).toLocaleString()}` : ""}
    {` · sort ${o.sort_order ?? 0}`}
  </div>
</div>

<div className="spacer" />

{/* 정렬 버튼 */}
<div style={{ display: "flex", gap: 6 }}>
  <button className="btn" onClick={() => moveOption(o, "up")}>▲</button>
  <button className="btn" onClick={() => moveOption(o, "down")}>▼</button>
</div>

{/* 수정/삭제 */}
<div style={{ display: "flex", gap: 6, marginLeft: 6 }}>
  <button className="btn" onClick={() => beginEditOption(o)}>수정</button>
  <button className="btn danger" onClick={() => removeOption(o.id)}>삭제</button>
</div>

            </li>
          ))}
          {selectedProductId && options.length === 0 && <div className="muted">옵션이 없습니다.</div>}
        </ul>
      </div>
    </div>
  );
}
