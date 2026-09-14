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
          color: "var(--text)",
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
          color: "var(--text2)",
          marginBottom: 4,
        }}
      >
        Organize and manage your saved content
      </p>
      <p
        style={{
          fontSize: 12,
          fontWeight: 500,
          color: "var(--text2)",
          letterSpacing: "0.04em",
        }}
      >
        {itemCount} item{itemCount !== 1 ? "s" : ""}
        {updateCount > 0 && (
          <span style={{ color: "var(--action)", marginLeft: 8 }}>
            · {updateCount} updated
          </span>
        )}
      </p>
    </div>
  );
}
