import { Check } from "lucide-react";
import type { ReactNode } from "react";

interface AuthCheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: ReactNode;
  id: string;
}

export function AuthCheckbox({ checked, onChange, label, id }: AuthCheckboxProps) {
  return (
    <label
      htmlFor={id}
      className="flex items-center cursor-pointer"
      style={{ gap: "10px" }}
    >
      <div style={{ position: "relative" }}>
        <input
          type="checkbox"
          id={id}
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only"
        />
        <div
          style={{
            width: "16px",
            height: "16px",
            border: checked ? "none" : "1px solid rgba(255, 255, 255, 0.30)",
            borderRadius: "4px",
            background: checked ? "#E8571A" : "transparent",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "background 150ms, border 150ms",
          }}
        >
          {checked && <Check size={12} color="white" strokeWidth={3} />}
        </div>
      </div>
      <span
        style={{
          fontFamily: "Figtree, sans-serif",
          fontSize: "12px",
          fontWeight: 400,
          color: "rgba(255, 255, 255, 0.70)",
        }}
      >
        {label}
      </span>
    </label>
  );
}
