import "./Card.css";

export default function Card({ children, onClick }) {
  return (
    <div className="card" onClick={onClick}>
      {children}
    </div>
  );
}
