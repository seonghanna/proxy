import "./HomeMain.css";
import { useEffect, useState } from "react";
import { supabase } from "../../common/supabaseClient";
import { useNavigate } from "react-router-dom";

function fmtDate(d) { return d ? String(d).slice(0, 10) : ""; }
function fmtTime(t) { return t ? String(t).slice(0, 5) : ""; }

export default function HomeMain() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("events")
        .select("id, title, group_name, address, open_date, close_date, open_time, close_time, banner_url")
        .order("open_date", { ascending: true });

      if (error) console.error("events load error:", error.message);
      setEvents(data || []);
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="home-wrap">불러오는 중…</div>;

  return (
    <div className="home-wrap">

      <div className="event-list">
        {events.map((ev) => (
          <div
            key={ev.id}
            className="event-card"
            onClick={() => navigate(`/e/${ev.id}`)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => (e.key === "Enter" ? navigate(`/e/${ev.id}`) : null)}
          >
            <img className="event-banner" src={ev.banner_url} alt={ev.title} />
            <div className="event-right">
              <div className="event-title">
                {ev.group_name ? `[${ev.group_name}] ` : ""}{ev.title}
              </div>
              <div className="event-period">
                {fmtDate(ev.open_date)} ~ {fmtDate(ev.close_date)}
              </div>
              <div className="event-hours">
                운영시간: {fmtTime(ev.open_time)} ~ {fmtTime(ev.close_time)}
              </div>
              <div className="event-address">{ev.address}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
