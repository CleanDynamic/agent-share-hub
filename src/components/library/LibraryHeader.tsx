interface LibraryHeaderProps {
  itemCount: number;
  updateCount: number;
}

export function LibraryHeader({ itemCount, updateCount }: LibraryHeaderProps) {
  return (
    <div className="text-center mb-8 pt-4">
      <h1
        style={{
          fontSize: 22,
          fontWeight: 700,
          color: "rgba(255,255,255,0.90)",
          marginBottom: 6,
          letterSpacing: "-0.01em",
        }}
      >
        Your Library
      </h1>
      <p
        style={{
          fontSize: 13,
          fontWeight: 300,
          color: "rgba(255,255,255,0.45)",
          marginBottom: 4,
        }}
      >
        Organize and manage your saved content
      </p>
      <p
        style={{
          fontSize: 12,
          fontWeight: 500,
          color: "rgba(255,255,255,0.28)",
          letterSpacing: "0.04em",
        }}
      >
        {itemCount} item{itemCount !== 1 ? "s" : ""}
        {updateCount > 0 && (
          <span style={{ color: "#8B4513", marginLeft: 8 }}>
            · {updateCount} updated
          </span>
        )}
      </p>
    </div>
  );
}
