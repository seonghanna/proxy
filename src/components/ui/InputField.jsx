import "./InputField.css";

export default function InputField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}) {
  return (
    <div className="input-field">
      {label && <label className="input-label">{label}</label>}
      <input
        className="input-box"
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}
