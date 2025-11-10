import { useEffect, useState } from "react";
import { supabase } from "../common/supabaseClient";
import "./AdminEvents.css";

export default function AdminEvents() {
  const [form, setForm] = useState({
    title: "",
    group_name: "",
    address: "",
    open_date: "",
    close_date: "",
    open_time: "",
    close_time: "",
    banner_url: "",
  });
  const [file, setFile] = useState(null);
  const [list, setList] = useState([]);
  const [saving, setSaving] = useState(false);

  const onPick = (e) => setFile(e.target.files?.[0] || null);

  const uploadBanner = async () => {
    if (!file) return alert("이미지 파일을 선택해 주세요.");
    const ext = file.name.split(".").pop();
    const filename = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    const path = `banners/${filename}`;

    const { error } = await supabase.storage.from("events").upload(path, file, {
      cacheControl: "3600",
      upsert: false,
    });
    if (error) return alert("업로드 실패: " + error.message);

    const { data } = supabase.storage.from("events").getPublicUrl(path);
    setForm((f) => ({ ...f, banner_url: data.publicUrl }));
    alert("업로드 성공! URL이 입력칸에 채워졌어요.");
  };

  const saveEvent = async () => {
    const {
      title, group_name, address, open_date, close_date, open_time, close_time, banner_url,
    } = form;
    if (!title) return alert("제목은 필수입니다.");
    setSaving(true);
    const { error } = await supabase.from("events").insert([
      { title, group_name, address, open_date, close_date, open_time, close_time, banner_url },
    ]);
    if (error) alert("저장 실패: " + error.message);
    else {
      alert("저장 완료!");
      setForm({
        title: "", group_name: "", address: "",
        open_date: "", close_date: "", open_time: "", close_time: "",
        banner_url: "",
      });
      setFile(null);
      await loadList();
    }
    setSaving(false);
  };

  const loadList = async () => {
    const { data, error } = await supabase
      .from("events")
      .select("id, title, group_name, open_date, close_date, banner_url")
      .order("open_date", { ascending: true });
    if (!error) setList(data || []);
  };

  const remove = async (id) => {
    if (!confirm("삭제할까요?")) return;
    const { error } = await supabase.from("events").delete().eq("id", id);
    if (error) alert(error.message);
    else loadList();
  };

  useEffect(() => { loadList(); }, []);

  const bind = (k) => ({
    value: form[k] || "",
    onChange: (e) => setForm({ ...form, [k]: e.target.value }),
  });

  return (
    <div className="admin-events">
      <h3>이벤트 등록</h3>

      <div className="grid">
        <label>제목</label>
        <input placeholder="WE LITTLE POP-UP" {...bind("title")} />

        <label>그룹명</label>
        <input placeholder="RIIZE" {...bind("group_name")} />

        <label>주소</label>
        <input placeholder="서울 성동구 ..." {...bind("address")} />

        <label>운영 시작일</label>
        <input type="date" {...bind("open_date")} />
        <label>운영 종료일</label>
        <input type="date" {...bind("close_date")} />

        <label>오픈 시간</label>
        <input type="time" {...bind("open_time")} />
        <label>마감 시간</label>
        <input type="time" {...bind("close_time")} />

        <label>배너 URL</label>
        <input placeholder="업로드 후 자동 채움" {...bind("banner_url")} />
      </div>

      <div className="row">
        <input type="file" accept="image/*" onChange={onPick} />
        <button className="btn" onClick={uploadBanner}>이미지 업로드</button>
      </div>

      <button className="btn primary" onClick={saveEvent} disabled={saving}>
        {saving ? "저장 중…" : "이벤트 저장"}
      </button>

      <h3 style={{ marginTop: 16 }}>이벤트 목록</h3>
      <ul className="event-list">
        {list.map((ev) => (
          <li key={ev.id} className="event-row">
            <img src={ev.banner_url} alt="" />
            <div className="info">
              <div className="title">[{ev.group_name}] {ev.title}</div>
              <div className="date">{ev.open_date} ~ {ev.close_date}</div>
            </div>
            <button className="btn danger" onClick={() => remove(ev.id)}>삭제</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
