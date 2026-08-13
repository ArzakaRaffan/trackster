import React from "react";

/** Lucide glyph wrapper. Requires the Lucide UMD script (or lucide-react in a Next app). */
export function Icon({ name, size = 20, strokeWidth = 2, color = "currentColor", style, ...rest }) {
  const ref = React.useRef(null);
  React.useEffect(() => {
    const host = ref.current;
    if (!host) return;
    host.innerHTML = '<i data-lucide="' + name + '"></i>';
    const lucide = typeof window !== "undefined" ? window.lucide : null;
    if (lucide && lucide.createIcons) {
      try { lucide.createIcons(); } catch (e) { /* icon set not ready */ }
      const svg = host.querySelector("svg");
      if (svg) {
        svg.setAttribute("width", size);
        svg.setAttribute("height", size);
        svg.setAttribute("stroke-width", strokeWidth);
      }
    }
  }, [name, size, strokeWidth]);
  return (
    <span
      ref={ref}
      className="tk-icon"
      aria-hidden="true"
      style={{ display: "inline-flex", flex: "0 0 auto", width: size, height: size, color, ...style }}
      {...rest}
    />
  );
}
