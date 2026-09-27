export default function Skeleton({ rows = 3 }) {
  return (
    <>
      {Array.from({ length: rows }, (_, i) => (
        <div className="skeleton-row" key={i}>
          <div className="skeleton-bar" style={{ width: 18, height: 18, borderRadius: 5, flexShrink: 0 }} />
          <div className="skeleton-bar" style={{ flex: 1, maxWidth: `${70 - i * 12}%` }} />
        </div>
      ))}
    </>
  );
}
