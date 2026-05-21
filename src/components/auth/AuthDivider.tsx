interface AuthDividerProps {
  text: string;
}

export function AuthDivider({ text }: AuthDividerProps) {
  return (
    <div
      className="relative flex items-center justify-center"
      style={{ margin: "20px 0" }}
    >
      <div
        style={{
          position: "absolute",
          width: "100%",
          height: "0.5px",
          background: "rgba(255, 255, 255, 0.10)",
        }}
      />
      <span
        style={{
          position: "relative",
          background: "rgba(52, 52, 66, 1)",
          padding: "0 12px",
          fontFamily: "Inter, sans-serif",
          fontSize: "11px",
          fontWeight: 500,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          color: "rgba(255, 255, 255, 0.45)",
        }}
      >
        {text}
      </span>
    </div>
  );
}
