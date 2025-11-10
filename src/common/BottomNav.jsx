import { Link, useLocation } from "react-router-dom";
import { Home, ShoppingBag, User, MessageCircle } from "lucide-react";
import "./BottomNav.css";

export default function BottomNav() {
  const { pathname } = useLocation();

  const items = [
    { to: "/", label: "홈", Icon: Home },
    { to: "/sell", label: "대리해요", Icon: ShoppingBag },
    { to: "/mypage", label: "마이", Icon: User },
    { to: "/message", label: "메시지", Icon: MessageCircle },
  ];

  return (
    <nav className="bottom-nav">
      <div className="bottom-nav-content">
        {items.map(({ to, label, Icon }) => (
          <Link
            key={to}
            to={to}
            className={`nav-item ${pathname === to ? "active" : ""}`}
          >
            <Icon className="nav-icon" />
            <span className="nav-text">{label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
