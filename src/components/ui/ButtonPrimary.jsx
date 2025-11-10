import "./ButtonPrimary.css";

export default function ButtonPrimary({ text, onClick, disabled = false }) {
  return (
    <button
      className={`button-primary ${disabled ? "disabled" : ""}`}
      onClick={onClick}
      disabled={disabled}
    >
      {text}
    </button>
  );
}
