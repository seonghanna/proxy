import { useEffect, useState } from "react";
import { supabase } from "../common/supabaseClient";
import "./AdminAgents.css";

export default function AdminAgents() {
  const [events, setEvents] = useState([]);
  const [eventId, setEventId] = useState("");
  const [agents, setAgents] = useState([]);

  const [form, setForm] = useState({
    id: null,
    display_name: "",
    avatar_url: "",
    handled_cnt: "0",
    is_active: true,
  });
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);

  // 공통 바인딩
  const bind = (key) => ({
    value: form[key],
    onChange: (e) => setForm({ ...form, [key]: e.target.value }),
  });

  // 스토리지 업로드 (agents 버킷)
  const uploadToStorage = async (fileObj) => {
    if (!fileObj) return null;
    const ext = fileObj.name.split(".").pop() || "jpg";
    const filename = `avatars/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("agents").upload(filename, fileObj, {
      cacheControl: "3600",
      upsert: false,
    });
    if (error) throw error;
    const { data } = supabase.storage.from("agents").getPublicUrl(filename);
    return data.publicUrl;
  };

  // 초기: 이벤트 목록
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("events")
        .select("id, title, group_name, open_date")
        .order("open_date", { ascending: true });
      if (!error) {
        setEvents(data || []);
        if ((data || []).length) setEventId(String(data[0].id));
      }
    })();
  }, []);

  // 이벤트 선택 시 에이전트 로드
  useEffect(() => {
    if (!eventId) return;
    loadAgents(eventId);
    setForm({ id: null, display_name: "", avatar_url: "", handled_cnt: "0", is_active: true });
    setFile(null);
  }, [eventId]);

  const loadAgents = async (eid) => {
    const { data, error } = await supabase
      .from("agents")
      .select("id, display_name, avatar_url, handled_cnt, is_active, created_at")
      .eq("event_id", eid)
      .order("handled_cnt", { ascending: false })
      .order("created_at", { ascending: true });
    if (!error) setAgents(data || []);
  };

  const onPick = (e) => setFile(e.target.files?.[0] || null);

  const submit = async () => {
    if (!eventId) return alert("이벤트를 선택하세요.");
    if (!form.display_name.trim()) return alert("이름을 입력하세요.");
    setBusy(true);
    try {
      let avatar = form.avatar_url;
      if (file) avatar = await uploadToStorage(file);

      const payload = {
        event_id: eventId,
        display_name: form.display_name.trim(),
        avatar_url: avatar || null,
        handled_cnt: Number(form.handled_cnt || 0),
        is_active: Boolean(form.is_active),
      };

      if (!form.id) {
        const { error } = await supabase.from("agents").insert([payload]);
        if (error) throw error;
        alert("대리인이 추가되었습니다.");
      } else {
        const { error } = await supabase.from("agents").update(payload).eq("id", form.id);
        if (error) throw error;
        alert("대리인이 수정되었습니다.");
      }

      await loadAgents(eventId);
      setForm({ id: null, display_name: "", avatar_url: "", handled_cnt: "0", is_active: true });
      setFile(null);
    } catch (e) {
      console.error(e);
      alert("처리 실패: " + e.message);
    } finally {
      setBusy(false);
    }
  };

  const edit = (a) => {
    setForm({
      id: a.id,
      display_name: a.display_name || "",
      avatar_url: a.avatar_url || "",
      handled_cnt: String(a.handled_cnt ?? "0"),
      is_active: Boolean(a.is_active),
    });
    setFile(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const remove = async (id) => {
    if (!confirm("삭제할까요?")) return;
    setBusy(true);
    try {
      const { error } = await supabase.from("agents").delete().eq("id", id);
      if (error) throw error;
      await loadAgents(eventId);
    } catch (e) {
      alert("삭제 실패: " + e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="aa-wrap">
      <h3>대리인 관리</h3>

      {/* 이벤트 선택 */}
      <div className="aa-panel">
        <label>이벤트 선택</label>
        <select value={eventId} onChange={(e) => setEventId(e.target.value)}>
          {events.map((ev) => (
            <option key={ev.id} value={String(ev.id)}>
              {ev.group_name ? `[${ev.group_name}] ` : ""}{ev.title}
            </option>
          ))}
        </select>
      </div>

      {/* 폼 */}
      <div className="aa-grid">
        <div className="aa-panel">
          <h4>{form.id ? "대리인 수정" : "대리인 추가"}</h4>
          <input placeholder="이름" {...bind("display_name")} />
          <input placeholder="아바타 URL(업로드 시 자동 채움)" {...bind("avatar_url")} />
          <div className="row">
            <input type="file" accept="image/*" onChange={onPick} />
            <span className="hint">storage <b>agents</b> 버킷에 올라갑니다.</span>
          </div>
          <input type="number" placeholder="맡김 수(예: 251)" {...bind("handled_cnt")} />
          <select
            value={String(form.is_active)}
            onChange={(e) => setForm({ ...form, is_active: e.target.value === "true" })}
          >
            <option value="true">활성</option>
            <option value="false">비활성</option>
          </select>

          <div className="aa-actions">
            <button className="btn primary" disabled={busy} onClick={submit}>
              {busy ? "처리 중…" : form.id ? "수정 저장" : "추가"}
            </button>
            {form.id && (
              <button
                className="btn"
                disabled={busy}
                onClick={() =>
                  setForm({ id: null, display_name: "", avatar_url: "", handled_cnt: "0", is_active: true })
                }
              >
                새로 추가로 전환
              </button>
            )}
          </div>
        </div>

        {/* 목록 */}
        <div className="aa-panel">
          <h4>대리인 목록</h4>
          <ul className="aa-list">
            {agents.map((a) => (
              <li key={a.id} className="aa-item">
                <div className="aa-left" onClick={() => edit(a)}>
                  {a.avatar_url ? (
                    <img src={a.avatar_url} alt={a.display_name} className="aa-avatar" />
                  ) : (
                    <div className="aa-noavatar">No Image</div>
                  )}
                  <div className="aa-meta">
                    <div className="aa-name">{a.display_name}</div>
                    <div className="aa-sub">맡김 {a.handled_cnt} · {a.is_active ? "활성" : "비활성"}</div>
                  </div>
                </div>
                <div className="aa-right">
                  <button className="btn danger" disabled={busy} onClick={() => remove(a.id)}>삭제</button>
                </div>
              </li>
            ))}
          </ul>
          {agents.length === 0 && <div className="muted">등록된 대리인이 없습니다.</div>}
        </div>
      </div>
    </div>
  );
}
