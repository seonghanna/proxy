import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "../../common/supabaseClient";
import "./ProductDetail.css";

export default function ProductDetail() {
  const { productId } = useParams();
  const [product, setProduct] = useState(null);
  const [options, setOptions] = useState([]);
  const [selectedOptId, setSelectedOptId] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: p } = await supabase
        .from("products")
        .select("id, event_id, name, price, image_url, status")
        .eq("id", productId)
        .maybeSingle();
      setProduct(p || null);

      const { data: opts } = await supabase
        .from("product_options")
        .select("id, name, price_delta, price_override, image_url, status, sort_order")
        .eq("product_id", productId)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });
      setOptions(opts || []);
      setLoading(false);
    })();
  }, [productId]);

  const selectedOpt = useMemo(
    () => options.find(o => o.id === selectedOptId) || null,
    [options, selectedOptId]
  );

  const finalPrice = useMemo(() => {
    if (!product) return 0;
    if (selectedOpt?.price_override != null) return Number(selectedOpt.price_override);
    const delta = Number(selectedOpt?.price_delta ?? 0);
    return Number(product.price || 0) + delta;
  }, [product, selectedOpt]);

  if (loading) return <div style={{ padding: 16 }}>불러오는 중…</div>;
  if (!product) return <div style={{ padding: 16 }}>상품을 찾을 수 없어요.</div>;

  return (
    <div className="pd-wrap">
      <Link to={`/e/${product.event_id}`} className="pd-primary">
        ← 이벤트로 돌아가기
      </Link>

      <div className="pd-grid">
        {/* 이미지 */}
        <div className="pd-image">
          {product.image_url ? (
            <img src={product.image_url} alt={product.name} />
          ) : (
            <div className="pd-noimg">No Image</div>
          )}
        </div>

        {/* 정보 */}
        <div>
          <h2 style={{ marginTop: 0 }}>{product.name}</h2>
          <div className="pd-muted" style={{ marginBottom: 12 }}>{product.status}</div>

          {/* 옵션 목록 */}
          {options.length > 0 ? (
            <div style={{ display: "grid", gap: 8, marginBottom: 12 }}>
              {options.map(o => (
                <label
                  key={o.id}
                  className={`pd-card ${selectedOptId === o.id ? "active" : ""}`}
                >
                  <input
                    type="radio"
                    name="opt"
                    checked={selectedOptId === o.id}
                    onChange={() => setSelectedOptId(o.id)}
                  />
                  {o.image_url && (
                    <img
                      src={o.image_url}
                      alt={o.name}
                      className="pd-opt-img"
                    />
                  )}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600 }}>{o.name}</div>
                    <div className="pd-muted" style={{ fontSize: 13 }}>
                      {o.price_override != null
                        ? `₩${Number(o.price_override).toLocaleString()} (고정가)`
                        : `기본가 + ₩${Number(o.price_delta || 0).toLocaleString()}`}
                    </div>
                  </div>
                  <div className="pd-muted">{o.status}</div>
                </label>
              ))}
            </div>
          ) : (
            <div className="pd-muted" style={{ marginBottom: 12 }}>옵션 없음</div>
          )}

          {/* 가격/버튼 */}
          <div className="pd-price-box">
            <div className="pd-price-total">
              합계: ₩{Number(finalPrice).toLocaleString()}
            </div>
            <button
              className="btn primary"
              onClick={() => alert("장바구니/구매 흐름은 다음 단계에서 붙일게요!")}
            >
              구매하기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
