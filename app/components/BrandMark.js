// PathFinder's icon: a path up a mountain to a flag at the top (the goal is
// the peak, the tasks are the climb). The same drawing as the app icon in
// public/icons; `size` is the tile's width in pixels.
export default function BrandMark({ size = 26 }) {
  return (
    <span className="brand-mark" style={{ width: size, height: size, borderRadius: size * 0.27 }} aria-hidden="true">
      <svg width={size * 0.72} height={size * 0.72} viewBox="0 0 24 24">
        <path d="M1.5 21.5L9.6 9.2l3.6 5.2 2.6-3.2 6.7 10.3z" fill="#fff" />
        <path
          d="M5.3 20.6c3.2-.6 6.3-1.6 4.6-3.4-1.4-1.5-.6-3.4 0-4.9"
          stroke="#5b5bd6"
          strokeWidth="1.5"
          strokeLinecap="round"
          fill="none"
          strokeDasharray="0.01 2.4"
        />
        <path d="M9.6 9.6V2.6" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" fill="none" />
        <path d="M9.6 3h4.4l-1.35 1.9 1.35 1.9h-4.4" fill="#fff" stroke="#fff" strokeWidth="1.3" strokeLinejoin="round" />
      </svg>
    </span>
  );
}
