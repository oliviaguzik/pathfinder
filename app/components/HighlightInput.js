"use client";

import { useLayoutEffect, useRef } from "react";
import { splitHighlights } from "../../lib/highlight";

// A text box that softly highlights some of its words (the date words the Add
// bar understood). A text box can't style parts of its text, so an invisible
// copy of the text sits behind it with the words marked; it copies the box's
// font, padding and scroll so the marks line up. `className` is for the wrapper,
// `inputClassName` for the box; other props go to the <input>.
export default function HighlightInput({ value, highlights = [], tone = "accent", className = "", inputClassName = "", ...inputProps }) {
  const inputRef = useRef(null);
  const mirrorRef = useRef(null);

  useLayoutEffect(() => {
    const input = inputRef.current;
    const mirror = mirrorRef.current;
    if (!input || !mirror) return;
    function copyStyle() {
      const cs = getComputedStyle(input);
      for (const prop of ["fontFamily", "fontSize", "fontWeight", "letterSpacing", "paddingLeft", "paddingRight", "borderLeftWidth", "borderRightWidth", "textIndent"]) {
        mirror.style[prop] = cs[prop];
      }
      mirror.style.borderStyle = "solid";
      mirror.style.borderColor = "transparent";
      mirror.style.borderTopWidth = "0";
      mirror.style.borderBottomWidth = "0";
      // Centre the text the way a one-line box does.
      mirror.style.lineHeight = `${input.clientHeight}px`;
      mirror.style.top = cs.borderTopWidth;
      mirror.style.height = `${input.clientHeight}px`;
    }
    copyStyle();
    window.addEventListener("resize", copyStyle);
    return () => window.removeEventListener("resize", copyStyle);
  }, []);

  function syncScroll() {
    if (mirrorRef.current && inputRef.current) mirrorRef.current.scrollLeft = inputRef.current.scrollLeft;
  }

  return (
    <span className={`hl-input hl-${tone} ${className}`}>
      <span className="hl-mirror" ref={mirrorRef} aria-hidden="true">
        {splitHighlights(value, highlights).map((part, i) =>
          part.hit ? <mark key={i}>{part.text}</mark> : <span key={i}>{part.text}</span>
        )}
      </span>
      <input
        ref={inputRef}
        className={inputClassName}
        value={value}
        onScroll={syncScroll}
        onKeyUp={syncScroll}
        onSelect={syncScroll}
        {...inputProps}
      />
    </span>
  );
}
