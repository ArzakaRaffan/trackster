/* @ds-bundle: {"format":4,"namespace":"TracksterDesignSystem_4b3ed2","components":[{"name":"Badge","sourcePath":"components/core/Badge.jsx"},{"name":"Button","sourcePath":"components/core/Button.jsx"},{"name":"Card","sourcePath":"components/core/Card.jsx"},{"name":"Icon","sourcePath":"components/core/Icon.jsx"},{"name":"IconButton","sourcePath":"components/core/IconButton.jsx"},{"name":"Input","sourcePath":"components/core/Input.jsx"},{"name":"Select","sourcePath":"components/core/Select.jsx"},{"name":"Switch","sourcePath":"components/core/Switch.jsx"},{"name":"AmountDisplay","sourcePath":"components/data/AmountDisplay.jsx"},{"name":"BudgetProgress","sourcePath":"components/data/BudgetProgress.jsx"},{"name":"DayBarChart","sourcePath":"components/data/DayBarChart.jsx"},{"name":"SourceTag","sourcePath":"components/data/SourceTag.jsx"},{"name":"StatTile","sourcePath":"components/data/StatTile.jsx"},{"name":"TransactionRow","sourcePath":"components/data/TransactionRow.jsx"},{"name":"Alert","sourcePath":"components/feedback/Alert.jsx"},{"name":"EmptyState","sourcePath":"components/feedback/EmptyState.jsx"},{"name":"Skeleton","sourcePath":"components/feedback/Skeleton.jsx"},{"name":"NavBar","sourcePath":"components/navigation/NavBar.jsx"},{"name":"SectionHeader","sourcePath":"components/navigation/SectionHeader.jsx"},{"name":"TopBar","sourcePath":"components/navigation/TopBar.jsx"}],"sourceHashes":{"components/core/Badge.jsx":"70c5431e7f17","components/core/Button.jsx":"2733cea03b73","components/core/Card.jsx":"a1e471043224","components/core/Icon.jsx":"b458a93f6176","components/core/IconButton.jsx":"90d04d435f33","components/core/Input.jsx":"68827badb17b","components/core/Select.jsx":"86e11fcad420","components/core/Switch.jsx":"910df84ef1bc","components/data/AmountDisplay.jsx":"ee57cf5c57bf","components/data/BudgetProgress.jsx":"d7408c20b006","components/data/DayBarChart.jsx":"d6ca057b59e2","components/data/SourceTag.jsx":"29bde564fa79","components/data/StatTile.jsx":"cfbe16eb0759","components/data/TransactionRow.jsx":"766fc566e9f0","components/data/currency.js":"1df770ef8cdd","components/feedback/Alert.jsx":"c98c9ae8694f","components/feedback/EmptyState.jsx":"52d4c7294746","components/feedback/Skeleton.jsx":"7d49339dface","components/navigation/NavBar.jsx":"7d5447d3a82e","components/navigation/SectionHeader.jsx":"2de3d5643b3b","components/navigation/TopBar.jsx":"677760067a92","handoff/tailwind.config.js":"f3e07bbfb280","ui_kits/trackster-app/App.jsx":"e9bd99480a1c","ui_kits/trackster-app/BudgetScreen.jsx":"c6891f2ee7b4","ui_kits/trackster-app/LoginScreen.jsx":"1f6535685cb8","ui_kits/trackster-app/SettingsScreen.jsx":"382b7daa976a","ui_kits/trackster-app/Shell.jsx":"f0f8d775134c","ui_kits/trackster-app/TodayScreen.jsx":"87d92e396185","ui_kits/trackster-app/WeeklyScreen.jsx":"1955e898851c"},"inlinedExternals":[],"unexposedExports":[{"name":"formatIDR","sourcePath":"components/data/currency.js"},{"name":"formatTime","sourcePath":"components/data/currency.js"}]} */

(() => {

const __ds_ns = (window.TracksterDesignSystem_4b3ed2 = window.TracksterDesignSystem_4b3ed2 || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/core/Badge.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const TONES = {
  neutral: {
    color: "var(--text-muted)",
    background: "var(--surface-track)"
  },
  under: {
    color: "var(--status-under)",
    background: "var(--status-under-bg)"
  },
  near: {
    color: "var(--status-near)",
    background: "var(--status-near-bg)"
  },
  over: {
    color: "var(--status-over)",
    background: "var(--status-over-bg)"
  },
  info: {
    color: "var(--status-info)",
    background: "var(--status-info-bg)"
  },
  accent: {
    color: "var(--text-on-accent)",
    background: "var(--green)"
  }
};
function Badge({
  children,
  tone = "neutral",
  icon = null,
  caps = false,
  style,
  ...rest
}) {
  const t = TONES[tone] || TONES.neutral;
  return /*#__PURE__*/React.createElement("span", _extends({
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: "var(--space-4)",
      padding: "3px 8px",
      borderRadius: "var(--radius-full-pill)",
      fontFamily: "var(--font-ui)",
      fontSize: "var(--text-badge)",
      fontWeight: "var(--weight-semibold)",
      lineHeight: 1.33,
      letterSpacing: caps ? "var(--tracking-caps)" : "var(--tracking-normal)",
      textTransform: caps ? "uppercase" : "capitalize",
      whiteSpace: "nowrap",
      ...t,
      ...style
    }
  }, rest), icon, children);
}
Object.assign(__ds_scope, { Badge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Badge.jsx", error: String((e && e.message) || e) }); }

// components/core/Button.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const SIZES = {
  sm: {
    padding: "6px 14px",
    fontSize: "var(--text-small)",
    minHeight: 32
  },
  md: {
    padding: "8px 16px",
    fontSize: "var(--text-label)",
    minHeight: 40
  },
  lg: {
    padding: "14px 32px",
    fontSize: "var(--text-label)",
    minHeight: 48
  }
};
const VARIANTS = {
  primary: {
    background: "var(--green)",
    color: "var(--text-on-accent)",
    border: "1px solid transparent"
  },
  dark: {
    background: "var(--surface-interactive)",
    color: "var(--text-base)",
    border: "1px solid transparent"
  },
  light: {
    background: "var(--surface-light)",
    color: "var(--text-on-light)",
    border: "1px solid transparent"
  },
  outlined: {
    background: "transparent",
    color: "var(--text-base)",
    border: "1px solid var(--border-strong)"
  },
  ghost: {
    background: "transparent",
    color: "var(--text-muted)",
    border: "1px solid transparent"
  },
  danger: {
    background: "var(--status-over-bg)",
    color: "var(--text-negative)",
    border: "1px solid var(--text-negative)"
  }
};
function Button({
  children,
  variant = "primary",
  size = "md",
  caps = false,
  fullWidth = false,
  disabled = false,
  icon = null,
  iconAfter = null,
  type = "button",
  onClick,
  style,
  ...rest
}) {
  const [hover, setHover] = React.useState(false);
  const [press, setPress] = React.useState(false);
  const v = VARIANTS[variant] || VARIANTS.primary;
  const s = SIZES[size] || SIZES.md;
  return /*#__PURE__*/React.createElement("button", _extends({
    type: type,
    disabled: disabled,
    onClick: onClick,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => {
      setHover(false);
      setPress(false);
    },
    onMouseDown: () => setPress(true),
    onMouseUp: () => setPress(false),
    style: {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      gap: "var(--space-8)",
      whiteSpace: "nowrap",
      flexShrink: 0,
      width: fullWidth ? "100%" : "auto",
      fontFamily: "var(--font-ui)",
      fontWeight: "var(--weight-bold)",
      lineHeight: caps ? "var(--leading-tight)" : "var(--leading-normal)",
      letterSpacing: caps ? "var(--tracking-caps)" : "var(--tracking-button)",
      textTransform: caps ? "uppercase" : "none",
      borderRadius: size === "lg" ? "var(--radius-pill)" : "var(--radius-full-pill)",
      cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? 0.4 : 1,
      transform: press && !disabled ? "scale(.97)" : "scale(1)",
      filter: hover && !disabled && (variant === "primary" || variant === "light") ? "brightness(1.08)" : "none",
      backgroundColor: hover && !disabled && (variant === "dark" || variant === "ghost" || variant === "outlined") ? "var(--surface-hover)" : undefined,
      transition: "transform var(--motion-fast) var(--ease-standard), background-color var(--motion-base) var(--ease-standard), filter var(--motion-base) var(--ease-standard)",
      ...v,
      ...s,
      ...style
    }
  }, rest), icon, children, iconAfter);
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Button.jsx", error: String((e && e.message) || e) }); }

// components/core/Card.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Card({
  children,
  variant = "raised",
  padding = 16,
  radius = "comfortable",
  interactive = false,
  elevated = false,
  as = "div",
  style,
  ...rest
}) {
  const [hover, setHover] = React.useState(false);
  const Tag = as;
  const bg = {
    raised: "var(--surface-card)",
    alt: "var(--surface-card-alt)",
    flat: "transparent",
    outlined: "transparent"
  }[variant];
  return /*#__PURE__*/React.createElement(Tag, _extends({
    onMouseEnter: interactive ? () => setHover(true) : undefined,
    onMouseLeave: interactive ? () => setHover(false) : undefined,
    style: {
      background: hover ? "var(--surface-card-alt)" : bg,
      borderRadius: "var(--radius-" + radius + ")",
      padding: typeof padding === "number" ? padding + "px" : padding,
      boxShadow: [variant === "outlined" ? "inset 0 0 0 1px var(--border-subtle)" : "", elevated ? "var(--shadow-medium)" : ""].filter(Boolean).join(", ") || "none",
      cursor: interactive ? "pointer" : "default",
      transition: "background var(--motion-base) var(--ease-standard)",
      ...style
    }
  }, rest), children);
}
Object.assign(__ds_scope, { Card });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Card.jsx", error: String((e && e.message) || e) }); }

// components/core/Icon.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Lucide glyph wrapper. Requires the Lucide UMD script (or lucide-react in a Next app). */
function Icon({
  name,
  size = 20,
  strokeWidth = 2,
  color = "currentColor",
  style,
  ...rest
}) {
  const ref = React.useRef(null);
  React.useEffect(() => {
    const host = ref.current;
    if (!host) return;
    host.innerHTML = '<i data-lucide="' + name + '"></i>';
    const lucide = typeof window !== "undefined" ? window.lucide : null;
    if (lucide && lucide.createIcons) {
      try {
        lucide.createIcons();
      } catch (e) {/* icon set not ready */}
      const svg = host.querySelector("svg");
      if (svg) {
        svg.setAttribute("width", size);
        svg.setAttribute("height", size);
        svg.setAttribute("stroke-width", strokeWidth);
      }
    }
  }, [name, size, strokeWidth]);
  return /*#__PURE__*/React.createElement("span", _extends({
    ref: ref,
    className: "tk-icon",
    "aria-hidden": "true",
    style: {
      display: "inline-flex",
      flex: "0 0 auto",
      width: size,
      height: size,
      color,
      ...style
    }
  }, rest));
}
Object.assign(__ds_scope, { Icon });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Icon.jsx", error: String((e && e.message) || e) }); }

// components/core/IconButton.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function IconButton({
  children,
  variant = "dark",
  size = 40,
  label,
  disabled = false,
  onClick,
  style,
  ...rest
}) {
  const [hover, setHover] = React.useState(false);
  const [press, setPress] = React.useState(false);
  const palette = {
    dark: {
      background: "var(--surface-interactive)",
      color: "var(--text-base)"
    },
    accent: {
      background: "var(--green)",
      color: "var(--text-on-accent)"
    },
    ghost: {
      background: "transparent",
      color: "var(--text-muted)"
    },
    outlined: {
      background: "transparent",
      color: "var(--text-base)",
      boxShadow: "inset 0 0 0 1px var(--border-strong)"
    }
  }[variant];
  return /*#__PURE__*/React.createElement("button", _extends({
    type: "button",
    "aria-label": label,
    title: label,
    disabled: disabled,
    onClick: onClick,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => {
      setHover(false);
      setPress(false);
    },
    onMouseDown: () => setPress(true),
    onMouseUp: () => setPress(false),
    style: {
      width: size,
      height: size,
      flex: "0 0 auto",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      borderRadius: "var(--radius-circle)",
      border: "none",
      padding: 0,
      cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? 0.4 : 1,
      transform: press && !disabled ? "scale(.94)" : hover && !disabled ? "scale(1.05)" : "scale(1)",
      filter: hover && !disabled && variant === "accent" ? "brightness(1.08)" : "none",
      transition: "transform var(--motion-fast) var(--ease-standard), filter var(--motion-base) var(--ease-standard), color var(--motion-base) var(--ease-standard)",
      ...palette,
      color: hover && !disabled && variant === "ghost" ? "var(--text-base)" : palette.color,
      ...style
    }
  }, rest), children);
}
Object.assign(__ds_scope, { IconButton });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/IconButton.jsx", error: String((e && e.message) || e) }); }

// components/core/Input.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Input({
  value,
  onChange,
  placeholder,
  label,
  type = "text",
  prefix = null,
  suffix = null,
  invalid = false,
  disabled = false,
  pill = false,
  hint,
  style,
  ...rest
}) {
  const [focus, setFocus] = React.useState(false);
  const ring = invalid ? "rgb(18,18,18) 0px 1px 0px, var(--text-negative) 0px 0px 0px 1px inset" : focus ? "var(--shadow-inset-accent)" : "var(--shadow-inset-border)";
  return /*#__PURE__*/React.createElement("label", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "var(--space-8)",
      ...style
    }
  }, label ? /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "var(--text-small)",
      fontWeight: "var(--weight-bold)",
      letterSpacing: "var(--tracking-caps)",
      textTransform: "uppercase",
      color: "var(--text-muted)"
    }
  }, label) : null, /*#__PURE__*/React.createElement("span", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: "var(--space-10)",
      background: "var(--surface-interactive)",
      borderRadius: pill ? "var(--radius-pill)" : "var(--radius-comfortable)",
      padding: pill ? "12px 20px" : "12px 14px",
      boxShadow: ring,
      opacity: disabled ? 0.5 : 1,
      transition: "box-shadow var(--motion-base) var(--ease-standard)"
    }
  }, prefix ? /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--text-muted)",
      display: "inline-flex"
    }
  }, prefix) : null, /*#__PURE__*/React.createElement("input", _extends({
    type: type,
    value: value,
    onChange: onChange,
    placeholder: placeholder,
    disabled: disabled,
    onFocus: () => setFocus(true),
    onBlur: () => setFocus(false),
    style: {
      flex: 1,
      minWidth: 0,
      background: "transparent",
      border: "none",
      outline: "none",
      color: "var(--text-base)",
      fontFamily: "var(--font-ui)",
      fontSize: "var(--text-body)",
      fontWeight: "var(--weight-regular)",
      fontVariantNumeric: "tabular-nums"
    }
  }, rest)), suffix ? /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--text-muted)",
      display: "inline-flex"
    }
  }, suffix) : null), hint ? /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "var(--text-small)",
      color: invalid ? "var(--text-negative)" : "var(--text-muted)"
    }
  }, hint) : null);
}
Object.assign(__ds_scope, { Input });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Input.jsx", error: String((e && e.message) || e) }); }

// components/core/Select.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Select({
  value,
  onChange,
  options = [],
  label,
  disabled = false,
  style,
  ...rest
}) {
  const [focus, setFocus] = React.useState(false);
  return /*#__PURE__*/React.createElement("label", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "var(--space-8)",
      ...style
    }
  }, label ? /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "var(--text-small)",
      fontWeight: "var(--weight-bold)",
      letterSpacing: "var(--tracking-caps)",
      textTransform: "uppercase",
      color: "var(--text-muted)"
    }
  }, label) : null, /*#__PURE__*/React.createElement("span", {
    style: {
      position: "relative",
      display: "flex",
      alignItems: "center"
    }
  }, /*#__PURE__*/React.createElement("select", _extends({
    value: value,
    onChange: onChange,
    disabled: disabled,
    onFocus: () => setFocus(true),
    onBlur: () => setFocus(false),
    style: {
      appearance: "none",
      WebkitAppearance: "none",
      width: "100%",
      background: "var(--surface-interactive)",
      color: "var(--text-base)",
      border: "none",
      outline: "none",
      boxShadow: focus ? "var(--shadow-inset-accent)" : "var(--shadow-inset-border)",
      borderRadius: "var(--radius-comfortable)",
      padding: "12px 40px 12px 14px",
      fontFamily: "var(--font-ui)",
      fontSize: "var(--text-body)",
      cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? 0.5 : 1,
      transition: "box-shadow var(--motion-base) var(--ease-standard)"
    }
  }, rest), options.map(o => {
    const opt = typeof o === "string" ? {
      value: o,
      label: o
    } : o;
    return /*#__PURE__*/React.createElement("option", {
      key: opt.value,
      value: opt.value,
      style: {
        background: "var(--surface-interactive)"
      }
    }, opt.label);
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      position: "absolute",
      right: 14,
      pointerEvents: "none",
      color: "var(--text-muted)",
      fontSize: "var(--text-small)"
    }
  }, "\u25BE")));
}
Object.assign(__ds_scope, { Select });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Select.jsx", error: String((e && e.message) || e) }); }

// components/core/Switch.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Switch({
  checked = false,
  onChange,
  label,
  description,
  disabled = false,
  style,
  ...rest
}) {
  const toggle = () => {
    if (!disabled && onChange) onChange(!checked);
  };
  return /*#__PURE__*/React.createElement("div", _extends({
    onClick: toggle,
    role: "switch",
    "aria-checked": checked,
    style: {
      display: "flex",
      alignItems: "center",
      gap: "var(--space-16)",
      cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? 0.5 : 1,
      ...style
    }
  }, rest), label || description ? /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0,
      display: "flex",
      flexDirection: "column",
      gap: "var(--space-3)"
    }
  }, label ? /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "var(--text-body)",
      fontWeight: "var(--weight-bold)",
      color: "var(--text-base)"
    }
  }, label) : null, description ? /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "var(--text-small)",
      lineHeight: "var(--leading-relaxed)",
      color: "var(--text-muted)"
    }
  }, description) : null) : null, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 48,
      height: 28,
      flex: "0 0 auto",
      borderRadius: "var(--radius-full-pill)",
      background: checked ? "var(--green)" : "var(--surface-track)",
      boxShadow: checked ? "none" : "inset 0 0 0 1px var(--border-default)",
      padding: 3,
      display: "flex",
      alignItems: "center",
      justifyContent: checked ? "flex-end" : "flex-start",
      transition: "background var(--motion-base) var(--ease-standard)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 22,
      height: 22,
      borderRadius: "var(--radius-circle)",
      background: checked ? "var(--pure-black)" : "var(--text-muted)",
      transition: "background var(--motion-base) var(--ease-standard)"
    }
  })));
}
Object.assign(__ds_scope, { Switch });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Switch.jsx", error: String((e && e.message) || e) }); }

// components/data/SourceTag.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const SOURCES = {
  BCA: {
    label: "BCA",
    color: "var(--source-bca)",
    background: "var(--source-bca-bg)"
  },
  JAGO: {
    label: "Jago",
    color: "var(--source-jago)",
    background: "var(--source-jago-bg)"
  }
};
function SourceTag({
  source = "BCA",
  size = "md",
  style,
  ...rest
}) {
  const key = String(source).toUpperCase();
  const s = SOURCES[key] || {
    label: String(source),
    color: "var(--text-muted)",
    background: "var(--surface-track)"
  };
  const dims = size === "sm" ? {
    fontSize: "var(--text-micro)",
    padding: "2px 6px"
  } : {
    fontSize: "var(--text-badge)",
    padding: "3px 8px"
  };
  return /*#__PURE__*/React.createElement("span", _extends({
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: "var(--space-4)",
      borderRadius: "var(--radius-subtle)",
      fontFamily: "var(--font-ui)",
      fontWeight: "var(--weight-bold)",
      letterSpacing: "var(--tracking-caps)",
      textTransform: "uppercase",
      whiteSpace: "nowrap",
      color: s.color,
      background: s.background,
      ...dims,
      ...style
    }
  }, rest), s.label);
}
Object.assign(__ds_scope, { SourceTag });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/SourceTag.jsx", error: String((e && e.message) || e) }); }

// components/data/currency.js
try { (() => {
/** Rupiah formatting shared by the data components. */
function formatIDR(value, {
  compact = false,
  sign = false
} = {}) {
  const n = Number(value) || 0;
  const abs = Math.abs(n);
  let body;
  if (compact && abs >= 1000000) body = trim(abs / 1000000) + "jt";else if (compact && abs >= 1000) body = trim(abs / 1000) + "rb";else body = abs.toLocaleString("id-ID");
  const prefix = sign ? n < 0 ? "−" : "+" : n < 0 ? "−" : "";
  return prefix + "Rp" + body;
}
function trim(x) {
  return (Math.round(x * 10) / 10).toString().replace(".", ",");
}
/** Clock time from an ISO timestamp, e.g. "19:42". */
function formatTime(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return "";
  return d.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit"
  });
}
Object.assign(__ds_scope, { formatIDR, formatTime });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/currency.js", error: String((e && e.message) || e) }); }

// components/data/AmountDisplay.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const SIZES = {
  hero: {
    fontSize: "var(--text-amount-hero)",
    letterSpacing: "var(--tracking-amount)",
    weight: "var(--weight-black)"
  },
  large: {
    fontSize: "var(--text-amount)",
    letterSpacing: "-1px",
    weight: "var(--weight-black)"
  },
  title: {
    fontSize: "var(--text-title)",
    letterSpacing: "normal",
    weight: "var(--weight-bold)"
  },
  body: {
    fontSize: "var(--text-body)",
    letterSpacing: "normal",
    weight: "var(--weight-bold)"
  },
  small: {
    fontSize: "var(--text-small)",
    letterSpacing: "normal",
    weight: "var(--weight-bold)"
  }
};
const TONES = {
  base: "var(--text-base)",
  muted: "var(--text-muted)",
  under: "var(--status-under)",
  near: "var(--status-near)",
  over: "var(--status-over)"
};
function AmountDisplay({
  value,
  size = "large",
  tone = "base",
  label,
  compact = false,
  sign = false,
  caption,
  style,
  ...rest
}) {
  const s = SIZES[size] || SIZES.large;
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "var(--space-4)",
      ...style
    }
  }, rest), label ? /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "var(--text-small)",
      fontWeight: "var(--weight-bold)",
      letterSpacing: "var(--tracking-caps)",
      textTransform: "uppercase",
      color: "var(--text-muted)"
    }
  }, label) : null, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-title)",
      fontSize: s.fontSize,
      fontWeight: s.weight,
      letterSpacing: s.letterSpacing,
      lineHeight: "var(--leading-tight)",
      color: TONES[tone] || TONES.base,
      fontVariantNumeric: "tabular-nums"
    }
  }, __ds_scope.formatIDR(value, {
    compact,
    sign
  })), caption ? /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "var(--text-label)",
      color: "var(--text-muted)",
      fontVariantNumeric: "tabular-nums"
    }
  }, caption) : null);
}
Object.assign(__ds_scope, { AmountDisplay });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/AmountDisplay.jsx", error: String((e && e.message) || e) }); }

// components/data/BudgetProgress.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function BudgetProgress({
  spent = 0,
  budget = 0,
  isOverBudget,
  height = 10,
  showLegend = true,
  nearThreshold = 0.8,
  style,
  ...rest
}) {
  const ratio = budget > 0 ? spent / budget : 0;
  const over = typeof isOverBudget === "boolean" ? isOverBudget : ratio > 1;
  const status = over ? "over" : ratio >= nearThreshold ? "near" : "under";
  const color = "var(--status-" + status + ")";
  const fill = Math.max(0, Math.min(1, ratio)) * 100;
  const overflow = over && budget > 0 ? Math.min(1, (spent - budget) / budget) * 100 : 0;
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "var(--space-8)",
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      height,
      borderRadius: "var(--radius-full-pill)",
      background: over ? "var(--status-over-bg)" : "var(--surface-track)",
      overflow: "hidden"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      inset: 0,
      width: (over ? 100 : fill) + "%",
      background: color,
      borderRadius: "var(--radius-full-pill)",
      transition: "width var(--motion-slow) var(--ease-out), background var(--motion-base) var(--ease-standard)"
    }
  }), overflow > 0 ? /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      top: 0,
      bottom: 0,
      right: 0,
      width: overflow + "%",
      background: "var(--status-over)",
      opacity: 0.55,
      borderLeft: "2px solid var(--surface-base)"
    }
  }) : null), showLegend ? /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "baseline",
      gap: "var(--space-12)",
      fontVariantNumeric: "tabular-nums"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "var(--text-small)",
      fontWeight: "var(--weight-bold)",
      color
    }
  }, Math.round(ratio * 100), "% terpakai"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "var(--text-small)",
      color: "var(--text-muted)"
    }
  }, over ? "lewat " + __ds_scope.formatIDR(spent - budget) : __ds_scope.formatIDR(budget - spent) + " sisa")) : null);
}
Object.assign(__ds_scope, { BudgetProgress });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/BudgetProgress.jsx", error: String((e && e.message) || e) }); }

// components/data/DayBarChart.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function DayBarChart({
  days = [],
  height = 140,
  onSelect,
  selected,
  style,
  ...rest
}) {
  const max = Math.max(1, ...days.map(d => Math.max(d.spent || 0, d.budget || 0)));
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "var(--space-10)",
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "stretch",
      gap: "var(--space-8)",
      height
    }
  }, days.map((d, i) => {
    const over = typeof d.isOverBudget === "boolean" ? d.isOverBudget : (d.spent || 0) > (d.budget || 0);
    const ratio = (d.spent || 0) / max;
    const budgetLine = d.budget ? d.budget / max * 100 : null;
    const isSel = selected === d.label || selected === i;
    return /*#__PURE__*/React.createElement("div", {
      key: d.label || i,
      onClick: onSelect ? () => onSelect(d, i) : undefined,
      style: {
        flex: 1,
        minWidth: 0,
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
        alignItems: "center",
        gap: "var(--space-8)",
        cursor: onSelect ? "pointer" : "default"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        position: "relative",
        width: "100%",
        flex: "1 1 0",
        minHeight: 0,
        display: "flex",
        alignItems: "flex-end"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        width: "100%",
        height: Math.max(3, ratio * 100) + "%",
        background: over ? "var(--status-over)" : isSel ? "var(--green)" : "var(--surface-track)",
        borderRadius: "var(--radius-subtle)",
        transition: "height var(--motion-slow) var(--ease-out), background var(--motion-base) var(--ease-standard)"
      }
    }), budgetLine != null ? /*#__PURE__*/React.createElement("div", {
      style: {
        position: "absolute",
        left: 0,
        right: 0,
        bottom: budgetLine + "%",
        zIndex: 1,
        borderTop: "1px dashed rgba(255,255,255,.55)"
      }
    }) : null), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: "var(--text-micro)",
        fontWeight: "var(--weight-bold)",
        letterSpacing: "var(--tracking-caps)",
        textTransform: "uppercase",
        color: isSel ? "var(--text-base)" : "var(--text-muted)"
      }
    }, d.label));
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      fontSize: "var(--text-small)",
      color: "var(--text-muted)",
      fontVariantNumeric: "tabular-nums"
    }
  }, /*#__PURE__*/React.createElement("span", null, "Garis putus-putus = budget harian"), /*#__PURE__*/React.createElement("span", null, "Puncak ", __ds_scope.formatIDR(max, {
    compact: true
  }))));
}
Object.assign(__ds_scope, { DayBarChart });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/DayBarChart.jsx", error: String((e && e.message) || e) }); }

// components/data/StatTile.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const SIZES = {
  title: "var(--text-title)",
  heading: "var(--text-heading)",
  body: "var(--text-body)"
};
function StatTile({
  label,
  value,
  delta,
  tone = "base",
  size = "title",
  format = "currency",
  compact = true,
  style,
  ...rest
}) {
  const color = {
    base: "var(--text-base)",
    under: "var(--status-under)",
    near: "var(--status-near)",
    over: "var(--status-over)",
    muted: "var(--text-muted)"
  }[tone];
  const deltaTone = delta == null ? null : delta > 0 ? "var(--status-over)" : "var(--status-under)";
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "var(--space-6)",
      background: "var(--surface-card)",
      borderRadius: "var(--radius-comfortable)",
      padding: "var(--space-14)",
      minWidth: 0,
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "var(--text-small)",
      fontWeight: "var(--weight-bold)",
      letterSpacing: "var(--tracking-caps)",
      textTransform: "uppercase",
      color: "var(--text-muted)",
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis"
    }
  }, label), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-title)",
      fontSize: SIZES[size] || SIZES.title,
      fontWeight: "var(--weight-bold)",
      lineHeight: "var(--leading-tight)",
      whiteSpace: "nowrap",
      color,
      fontVariantNumeric: "tabular-nums"
    }
  }, format === "currency" ? __ds_scope.formatIDR(value, {
    compact
  }) : value), delta != null ? /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "var(--text-small)",
      fontWeight: "var(--weight-bold)",
      color: deltaTone,
      fontVariantNumeric: "tabular-nums"
    }
  }, delta > 0 ? "▲" : "▼", " ", Math.abs(delta), "% vs minggu lalu") : null);
}
Object.assign(__ds_scope, { StatTile });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/StatTile.jsx", error: String((e && e.message) || e) }); }

// components/data/TransactionRow.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function TransactionRow({
  description,
  amount,
  source,
  occurredAt,
  time,
  icon = null,
  onClick,
  style,
  ...rest
}) {
  const [hover, setHover] = React.useState(false);
  const clock = time || (occurredAt ? __ds_scope.formatTime(occurredAt) : "");
  return /*#__PURE__*/React.createElement("div", _extends({
    onClick: onClick,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
      display: "flex",
      alignItems: "center",
      gap: "var(--space-12)",
      padding: "10px 12px",
      minHeight: 56,
      borderRadius: "var(--radius-standard)",
      background: hover && onClick ? "var(--surface-hover)" : "transparent",
      cursor: onClick ? "pointer" : "default",
      transition: "background var(--motion-fast) var(--ease-standard)",
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("span", {
    style: {
      width: 40,
      height: 40,
      flex: "0 0 auto",
      borderRadius: "var(--radius-circle)",
      background: "var(--surface-interactive)",
      color: "var(--text-muted)",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: "var(--text-label)",
      fontWeight: "var(--weight-bold)"
    }
  }, icon || (description ? String(description).trim().charAt(0).toUpperCase() : "?")), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      minWidth: 0,
      display: "flex",
      flexDirection: "column",
      gap: 3
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "var(--text-body)",
      fontWeight: "var(--weight-bold)",
      color: "var(--text-base)",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap"
    }
  }, description), /*#__PURE__*/React.createElement("span", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: "var(--space-8)"
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.SourceTag, {
    source: source,
    size: "sm"
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "var(--text-small)",
      color: "var(--text-muted)",
      fontVariantNumeric: "tabular-nums"
    }
  }, clock))), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "var(--text-body)",
      fontWeight: "var(--weight-bold)",
      color: "var(--text-base)",
      fontVariantNumeric: "tabular-nums",
      whiteSpace: "nowrap"
    }
  }, "\u2212", __ds_scope.formatIDR(amount)));
}
Object.assign(__ds_scope, { TransactionRow });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/TransactionRow.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Alert.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const TONES = {
  over: {
    color: "var(--status-over)",
    background: "var(--status-over-bg)"
  },
  near: {
    color: "var(--status-near)",
    background: "var(--status-near-bg)"
  },
  under: {
    color: "var(--status-under)",
    background: "var(--status-under-bg)"
  },
  info: {
    color: "var(--status-info)",
    background: "var(--status-info-bg)"
  }
};
function Alert({
  tone = "info",
  title,
  children,
  icon = null,
  action = null,
  onDismiss,
  style,
  ...rest
}) {
  const t = TONES[tone] || TONES.info;
  return /*#__PURE__*/React.createElement("div", _extends({
    role: "status",
    style: {
      display: "flex",
      alignItems: "flex-start",
      gap: "var(--space-12)",
      background: t.background,
      borderRadius: "var(--radius-comfortable)",
      boxShadow: "inset 0 0 0 1px " + t.color,
      padding: "var(--space-14)",
      ...style
    }
  }, rest), icon ? /*#__PURE__*/React.createElement("span", {
    style: {
      color: t.color,
      display: "inline-flex",
      marginTop: 1
    }
  }, icon) : null, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0,
      display: "flex",
      flexDirection: "column",
      gap: "var(--space-4)"
    }
  }, title ? /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "var(--text-label)",
      fontWeight: "var(--weight-bold)",
      color: t.color
    }
  }, title) : null, children ? /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "var(--text-small)",
      lineHeight: "var(--leading-relaxed)",
      color: "var(--text-secondary)"
    }
  }, children) : null, action ? /*#__PURE__*/React.createElement("span", {
    style: {
      marginTop: "var(--space-6)"
    }
  }, action) : null), onDismiss ? /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onDismiss,
    "aria-label": "Tutup",
    style: {
      background: "transparent",
      border: "none",
      color: "var(--text-muted)",
      cursor: "pointer",
      fontSize: "var(--text-label)",
      padding: 0,
      lineHeight: 1
    }
  }, "\u2715") : null);
}
Object.assign(__ds_scope, { Alert });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Alert.jsx", error: String((e && e.message) || e) }); }

// components/feedback/EmptyState.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function EmptyState({
  icon = null,
  title,
  description,
  action = null,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      textAlign: "center",
      gap: "var(--space-12)",
      padding: "var(--space-32) var(--space-20)",
      borderRadius: "var(--radius-comfortable)",
      boxShadow: "inset 0 0 0 1px var(--border-subtle)",
      ...style
    }
  }, rest), icon ? /*#__PURE__*/React.createElement("span", {
    style: {
      width: 48,
      height: 48,
      borderRadius: "var(--radius-circle)",
      background: "var(--surface-interactive)",
      color: "var(--text-muted)",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center"
    }
  }, icon) : null, title ? /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "var(--text-body)",
      fontWeight: "var(--weight-bold)",
      color: "var(--text-base)"
    }
  }, title) : null, description ? /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "var(--text-small)",
      lineHeight: "var(--leading-relaxed)",
      color: "var(--text-muted)",
      maxWidth: 280
    }
  }, description) : null, action);
}
Object.assign(__ds_scope, { EmptyState });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/EmptyState.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Skeleton.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Skeleton({
  width = "100%",
  height = 16,
  radius = "subtle",
  circle = false,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("span", _extends({
    "aria-hidden": "true",
    style: {
      display: "block",
      width,
      height: circle ? width : height,
      borderRadius: circle ? "var(--radius-circle)" : "var(--radius-" + radius + ")",
      background: "linear-gradient(90deg,var(--surface-track) 25%,rgba(255,255,255,.18) 50%,var(--surface-track) 75%)",
      backgroundSize: "200% 100%",
      animation: "tk-shimmer 1.4s var(--ease-standard) infinite",
      ...style
    }
  }, rest));
}
Object.assign(__ds_scope, { Skeleton });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Skeleton.jsx", error: String((e && e.message) || e) }); }

// components/navigation/NavBar.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const DEFAULT_ITEMS = [{
  href: "/",
  label: "Hari Ini",
  icon: "sun"
}, {
  href: "/weekly",
  label: "Mingguan",
  icon: "bar-chart-3"
}, {
  href: "/budget",
  label: "Budget",
  icon: "wallet"
}, {
  href: "/settings",
  label: "Setting",
  icon: "settings"
}];
function NavBar({
  items = DEFAULT_ITEMS,
  active = "/",
  onNavigate,
  orientation = "bottom",
  style,
  ...rest
}) {
  const bottom = orientation === "bottom";
  return /*#__PURE__*/React.createElement("nav", _extends({
    style: {
      display: "flex",
      flexDirection: bottom ? "row" : "column",
      alignItems: bottom ? "stretch" : "stretch",
      gap: bottom ? 0 : "var(--space-4)",
      background: bottom ? "rgba(18,18,18,.92)" : "var(--surface-base)",
      backdropFilter: bottom ? "var(--blur-overlay)" : "none",
      WebkitBackdropFilter: bottom ? "var(--blur-overlay)" : "none",
      boxShadow: bottom ? "inset 0 1px 0 var(--border-subtle)" : "none",
      padding: bottom ? "8px 8px calc(8px + env(safe-area-inset-bottom,0px))" : "var(--space-12)",
      width: bottom ? "100%" : "var(--sidebar-width)",
      ...style
    }
  }, rest), items.map(it => {
    const on = it.href === active;
    return /*#__PURE__*/React.createElement("a", {
      key: it.href,
      href: it.href,
      onClick: onNavigate ? e => {
        e.preventDefault();
        onNavigate(it.href);
      } : undefined,
      style: {
        flex: bottom ? 1 : "0 0 auto",
        display: "flex",
        flexDirection: bottom ? "column" : "row",
        alignItems: "center",
        justifyContent: bottom ? "center" : "flex-start",
        gap: bottom ? "var(--space-4)" : "var(--space-12)",
        minHeight: 48,
        padding: bottom ? "6px 4px" : "10px 12px",
        borderRadius: bottom ? "var(--radius-comfortable)" : "var(--radius-subtle)",
        color: on ? "var(--text-base)" : "var(--text-muted)",
        background: !bottom && on ? "var(--surface-hover)" : "transparent",
        fontSize: "var(--text-label)",
        fontWeight: on ? "var(--weight-bold)" : "var(--weight-regular)",
        textDecoration: "none",
        transition: "color var(--motion-base) var(--ease-standard)"
      }
    }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
      name: it.icon,
      size: bottom ? 20 : 18
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: bottom ? "var(--text-micro)" : "var(--text-label)",
        letterSpacing: bottom ? ".2px" : "normal"
      }
    }, it.label), bottom && on ? /*#__PURE__*/React.createElement("span", {
      style: {
        width: 4,
        height: 4,
        borderRadius: "var(--radius-circle)",
        background: "var(--green)"
      }
    }) : null);
  }));
}
Object.assign(__ds_scope, { NavBar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/NavBar.jsx", error: String((e && e.message) || e) }); }

// components/navigation/SectionHeader.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function SectionHeader({
  title,
  meta,
  action = null,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      display: "flex",
      alignItems: "baseline",
      gap: "var(--space-12)",
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("h2", {
    style: {
      margin: 0,
      flex: 1,
      minWidth: 0,
      fontFamily: "var(--font-ui)",
      fontSize: "var(--text-heading)",
      fontWeight: "var(--weight-semibold)",
      lineHeight: "var(--leading-snug)",
      color: "var(--text-base)"
    }
  }, title), meta ? /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "var(--text-small)",
      color: "var(--text-muted)",
      fontVariantNumeric: "tabular-nums",
      whiteSpace: "nowrap"
    }
  }, meta) : null, action);
}
Object.assign(__ds_scope, { SectionHeader });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/SectionHeader.jsx", error: String((e && e.message) || e) }); }

// components/navigation/TopBar.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function TopBar({
  title,
  subtitle,
  leading = null,
  actions = null,
  sticky = true,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("header", _extends({
    style: {
      display: "flex",
      alignItems: "center",
      gap: "var(--space-12)",
      padding: "var(--space-16) var(--gutter-mobile)",
      position: sticky ? "sticky" : "static",
      top: 0,
      zIndex: 5,
      background: sticky ? "rgba(18,18,18,.86)" : "transparent",
      backdropFilter: sticky ? "var(--blur-overlay)" : "none",
      WebkitBackdropFilter: sticky ? "var(--blur-overlay)" : "none",
      ...style
    }
  }, rest), leading, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0,
      display: "flex",
      flexDirection: "column",
      gap: 2
    }
  }, subtitle ? /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "var(--text-small)",
      fontWeight: "var(--weight-bold)",
      letterSpacing: "var(--tracking-caps)",
      textTransform: "uppercase",
      color: "var(--text-muted)"
    }
  }, subtitle) : null, /*#__PURE__*/React.createElement("h1", {
    style: {
      margin: 0,
      fontFamily: "var(--font-title)",
      fontSize: "var(--text-title)",
      fontWeight: "var(--weight-bold)",
      lineHeight: "var(--leading-tight)",
      color: "var(--text-base)"
    }
  }, title)), actions ? /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: "var(--space-8)"
    }
  }, actions) : null);
}
Object.assign(__ds_scope, { TopBar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/TopBar.jsx", error: String((e && e.message) || e) }); }

// handoff/tailwind.config.js
try { (() => {
/** @type {import('tailwindcss').Config} */
// Trackster design tokens. Values are literal (not var()) so Tailwind's core utilities
// — text-*, bg-*, rounded-*, shadow-*, p-*, gap-* — resolve without any plugin.
// Keep this file in sync with tokens/*.css in the design system.
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        base: "#121212",
        surface: {
          DEFAULT: "#181818",
          interactive: "#1f1f1f",
          alt: "#252525",
          overlay: "#272727",
          light: "#eeeeee"
        },
        brand: {
          DEFAULT: "#1ed760",
          border: "#1db954",
          press: "#1aa34a"
        },
        ink: {
          DEFAULT: "#ffffff",
          bright: "#fdfdfd",
          secondary: "#cbcbcb",
          muted: "#b3b3b3",
          subtle: "#7c7c7c"
        },
        line: {
          subtle: "rgba(255,255,255,0.10)",
          DEFAULT: "#4d4d4d",
          strong: "#7c7c7c"
        },
        status: {
          under: "#1ed760",
          "under-bg": "rgba(30,215,96,0.12)",
          near: "#ffa42b",
          "near-bg": "rgba(255,164,43,0.12)",
          over: "#f3727f",
          "over-bg": "rgba(243,114,127,0.12)",
          info: "#539df5",
          "info-bg": "rgba(83,157,245,0.12)"
        },
        source: {
          bca: "#539df5",
          "bca-bg": "rgba(83,157,245,0.14)",
          jago: "#ffa42b",
          "jago-bg": "rgba(255,164,43,0.14)"
        },
        track: "rgba(255,255,255,0.10)"
      },
      fontFamily: {
        // Replace Figtree with SpotifyMixUI / CircularSp when licensed binaries are available.
        sans: ["Figtree", "SpotifyMixUI", "CircularSp-Arab", "CircularSp-Hebr", "Helvetica Neue", "helvetica", "arial", "Hiragino Sans", "Meiryo", "sans-serif"],
        title: ["Figtree", "SpotifyMixUITitle", "CircularSp-Arab", "Helvetica Neue", "helvetica", "arial", "sans-serif"]
      },
      fontSize: {
        micro: ["10px", {
          lineHeight: "normal"
        }],
        badge: ["10.5px", {
          lineHeight: "1.33"
        }],
        small: ["12px", {
          lineHeight: "1.5"
        }],
        label: ["14px", {
          lineHeight: "normal",
          letterSpacing: "0.14px"
        }],
        body: ["16px", {
          lineHeight: "normal"
        }],
        heading: ["18px", {
          lineHeight: "1.3"
        }],
        title: ["24px", {
          lineHeight: "1"
        }],
        amount: ["40px", {
          lineHeight: "1",
          letterSpacing: "-1px"
        }],
        "amount-hero": ["56px", {
          lineHeight: "1",
          letterSpacing: "-1.5px"
        }]
      },
      letterSpacing: {
        button: "0.14px",
        caps: "1.4px",
        "caps-wide": "2px",
        amount: "-1.5px"
      },
      spacing: {
        px: "1px",
        0.5: "2px",
        0.75: "3px",
        1: "4px",
        1.25: "5px",
        1.5: "6px",
        2: "8px",
        2.5: "10px",
        3: "12px",
        3.5: "14px",
        3.75: "15px",
        4: "16px",
        5: "20px",
        6: "24px",
        8: "32px",
        10: "40px",
        12: "48px",
        navbar: "64px"
      },
      borderRadius: {
        minimal: "2px",
        subtle: "4px",
        standard: "6px",
        comfortable: "8px",
        medium: "10px",
        panel: "20px",
        large: "100px",
        pill: "500px",
        "full-pill": "9999px"
      },
      boxShadow: {
        medium: "rgba(0,0,0,0.3) 0px 8px 8px",
        heavy: "rgba(0,0,0,0.5) 0px 8px 24px",
        field: "rgb(18,18,18) 0px 1px 0px, rgb(124,124,124) 0px 0px 0px 1px inset",
        "field-focus": "rgb(18,18,18) 0px 1px 0px, #1ed760 0px 0px 0px 1px inset",
        "field-error": "rgb(18,18,18) 0px 1px 0px, #f3727f 0px 0px 0px 1px inset",
        hairline: "inset 0 0 0 1px rgba(255,255,255,0.10)"
      },
      transitionDuration: {
        fast: "120ms",
        base: "200ms",
        slow: "320ms"
      },
      transitionTimingFunction: {
        standard: "cubic-bezier(.3,0,.4,1)",
        expressive: "cubic-bezier(.16,1,.3,1)"
      },
      maxWidth: {
        content: "720px"
      },
      screens: {
        xs: "425px",
        sm: "576px",
        md: "768px",
        "md-lg": "896px",
        lg: "1024px",
        xl: "1280px"
      }
    }
  },
  plugins: []
};
})(); } catch (e) { __ds_ns.__errors.push({ path: "handoff/tailwind.config.js", error: String((e && e.message) || e) }); }

// ui_kits/trackster-app/App.jsx
try { (() => {
const {
  NavBar,
  IconButton,
  Icon
} = window.TracksterDesignSystem_4b3ed2;
function App() {
  const [authed, setAuthed] = React.useState(true);
  const [route, setRoute] = React.useState("/");
  const [budget, setBudget] = React.useState(TODAY.budget);
  const today = {
    ...TODAY,
    budget,
    remaining: budget - TODAY.totalSpent,
    isOverBudget: TODAY.totalSpent > budget
  };
  return /*#__PURE__*/React.createElement(PhoneFrame, null, !authed ? /*#__PURE__*/React.createElement(LoginScreen, {
    onLogin: () => setAuthed(true)
  }) : /*#__PURE__*/React.createElement(React.Fragment, null, route === "/" ? /*#__PURE__*/React.createElement(TodayScreen, {
    data: today,
    onOpenBudget: () => setRoute("/budget")
  }) : null, route === "/weekly" ? /*#__PURE__*/React.createElement(WeeklyScreen, {
    week: WEEK
  }) : null, route === "/budget" ? /*#__PURE__*/React.createElement(BudgetScreen, {
    initial: budget,
    spent: TODAY.totalSpent,
    onSaved: setBudget
  }) : null, route === "/settings" ? /*#__PURE__*/React.createElement(SettingsScreen, {
    onLogout: () => {
      setAuthed(false);
      setRoute("/");
    }
  }) : null, route === "/" ? /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      right: 16,
      bottom: 88
    }
  }, /*#__PURE__*/React.createElement(IconButton, {
    variant: "accent",
    size: 56,
    label: "Tambah transaksi manual"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "plus",
    size: 26
  }))) : null, /*#__PURE__*/React.createElement(NavBar, {
    active: route,
    onNavigate: setRoute
  })));
}
ReactDOM.createRoot(document.getElementById("root")).render(/*#__PURE__*/React.createElement(App, null));
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/trackster-app/App.jsx", error: String((e && e.message) || e) }); }

// ui_kits/trackster-app/BudgetScreen.jsx
try { (() => {
const {
  TopBar,
  SectionHeader,
  Card,
  Button,
  Input,
  Icon,
  Badge,
  Alert,
  BudgetProgress,
  AmountDisplay
} = window.TracksterDesignSystem_4b3ed2;
const PRESETS = [100000, 150000, 200000, 250000];
function BudgetScreen({
  initial = 150000,
  spent = 169700,
  onSaved
}) {
  const [budget, setBudget] = React.useState(initial);
  const [saved, setSaved] = React.useState(false);
  const setVal = v => {
    setBudget(v);
    setSaved(false);
  };
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(TopBar, {
    subtitle: "Budget harian",
    title: "Budget"
  }), /*#__PURE__*/React.createElement(Screen, null, /*#__PURE__*/React.createElement(Card, {
    padding: 20,
    radius: "medium",
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "var(--space-16)"
    }
  }, /*#__PURE__*/React.createElement(AmountDisplay, {
    label: "Budget harian",
    value: budget,
    size: "large"
  }), /*#__PURE__*/React.createElement(BudgetProgress, {
    spent: spent,
    budget: budget,
    height: 12
  }), /*#__PURE__*/React.createElement(Input, {
    label: "Ubah nominal",
    prefix: "Rp",
    value: Number(budget).toLocaleString("id-ID"),
    onChange: e => setVal(Number(String(e.target.value).replace(/\D/g, "")) || 0),
    hint: "Berlaku mulai hari ini. Riwayat hari sebelumnya nggak berubah."
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: "var(--space-8)",
      flexWrap: "wrap"
    }
  }, PRESETS.map(p => /*#__PURE__*/React.createElement(Button, {
    key: p,
    size: "sm",
    variant: p === budget ? "primary" : "dark",
    onClick: () => setVal(p)
  }, "Rp" + p / 1000 + "rb")))), saved ? /*#__PURE__*/React.createElement(Alert, {
    tone: "under",
    title: "Budget tersimpan",
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "check",
      size: 18
    })
  }, "Budget harian sekarang Rp", Number(budget).toLocaleString("id-ID"), ".") : null, /*#__PURE__*/React.createElement(Card, {
    padding: 16,
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "var(--space-12)"
    }
  }, /*#__PURE__*/React.createElement(SectionHeader, {
    title: "Riwayat budget"
  }), [{
    d: "12 Agu — sekarang",
    v: 150000,
    on: true
  }, {
    d: "1 – 11 Agu",
    v: 120000
  }, {
    d: "Juli",
    v: 100000
  }].map(r => /*#__PURE__*/React.createElement("div", {
    key: r.d,
    style: {
      display: "flex",
      alignItems: "center",
      gap: "var(--space-12)",
      minHeight: 44
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      fontSize: "var(--text-label)",
      color: "var(--text-muted)"
    }
  }, r.d), r.on ? /*#__PURE__*/React.createElement(Badge, {
    tone: "under"
  }, "Aktif") : null, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "var(--text-label)",
      fontWeight: 700,
      fontVariantNumeric: "tabular-nums"
    }
  }, "Rp", r.v.toLocaleString("id-ID"))))), /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    size: "lg",
    fullWidth: true,
    caps: true,
    onClick: () => {
      setSaved(true);
      if (onSaved) onSaved(budget);
    }
  }, "Simpan budget")));
}
Object.assign(window, {
  BudgetScreen
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/trackster-app/BudgetScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/trackster-app/LoginScreen.jsx
try { (() => {
const {
  Button,
  Input,
  Icon,
  Card
} = window.TracksterDesignSystem_4b3ed2;
function LoginScreen({
  onLogin
}) {
  const [email, setEmail] = React.useState("rizky@gmail.com");
  const [pw, setPw] = React.useState("");
  return /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-between",
      padding: "48px var(--gutter-mobile) 32px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "var(--space-8)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-title)",
      fontSize: 40,
      fontWeight: 900,
      letterSpacing: "-1.8px",
      lineHeight: 1
    }
  }, "Trackster", /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--green)"
    }
  }, ".")), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "var(--text-body)",
      color: "var(--text-muted)",
      lineHeight: 1.4
    }
  }, "Pengeluaran kamu dicatat otomatis dari email BCA dan Jago.")), /*#__PURE__*/React.createElement("form", {
    onSubmit: e => {
      e.preventDefault();
      if (onLogin) onLogin();
    },
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "var(--space-14)"
    }
  }, /*#__PURE__*/React.createElement(Input, {
    label: "Email",
    type: "email",
    value: email,
    onChange: e => setEmail(e.target.value),
    prefix: /*#__PURE__*/React.createElement(Icon, {
      name: "mail",
      size: 16
    })
  }), /*#__PURE__*/React.createElement(Input, {
    label: "Password",
    type: "password",
    value: pw,
    onChange: e => setPw(e.target.value),
    placeholder: "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022",
    prefix: /*#__PURE__*/React.createElement(Icon, {
      name: "lock",
      size: 16
    })
  }), /*#__PURE__*/React.createElement(Button, {
    type: "submit",
    variant: "primary",
    size: "lg",
    fullWidth: true,
    caps: true
  }, "Masuk"), /*#__PURE__*/React.createElement(Button, {
    variant: "ghost",
    size: "sm",
    fullWidth: true
  }, "Lupa password")), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "var(--text-small)",
      color: "var(--text-subtle)",
      textAlign: "center",
      lineHeight: 1.5
    }
  }, "Session disimpan di cookie. Kamu tetap login di HP ini."));
}
Object.assign(window, {
  LoginScreen
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/trackster-app/LoginScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/trackster-app/SettingsScreen.jsx
try { (() => {
const {
  TopBar,
  SectionHeader,
  Card,
  Button,
  Switch,
  Select,
  Input,
  Icon,
  Badge,
  SourceTag
} = window.TracksterDesignSystem_4b3ed2;
function SettingsScreen({
  onLogout
}) {
  const [telegram, setTelegram] = React.useState(true);
  const [daily, setDaily] = React.useState(true);
  const [weekly, setWeekly] = React.useState(false);
  const [threshold, setThreshold] = React.useState("100");
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(TopBar, {
    subtitle: "Akun & alert",
    title: "Setting"
  }), /*#__PURE__*/React.createElement(Screen, null, /*#__PURE__*/React.createElement(Card, {
    padding: 16,
    style: {
      display: "flex",
      alignItems: "center",
      gap: "var(--space-14)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 48,
      height: 48,
      borderRadius: "var(--radius-circle)",
      background: "var(--green)",
      color: "var(--pure-black)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "var(--font-title)",
      fontWeight: 900,
      fontSize: 20
    }
  }, "R"), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0,
      display: "flex",
      flexDirection: "column",
      gap: 2
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "var(--text-body)",
      fontWeight: 700
    }
  }, "rizky@gmail.com"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "var(--text-small)",
      color: "var(--text-muted)"
    }
  }, "Masuk lewat cookie session"))), /*#__PURE__*/React.createElement(Card, {
    padding: 16,
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "var(--space-16)"
    }
  }, /*#__PURE__*/React.createElement(SectionHeader, {
    title: "Email yang dibaca",
    meta: "2 sumber"
  }), [{
    s: "BCA",
    e: "notifikasi@bca.co.id",
    ok: true
  }, {
    s: "JAGO",
    e: "no-reply@jago.com",
    ok: true
  }].map(r => /*#__PURE__*/React.createElement("div", {
    key: r.s,
    style: {
      display: "flex",
      alignItems: "center",
      gap: "var(--space-12)",
      minHeight: 44
    }
  }, /*#__PURE__*/React.createElement(SourceTag, {
    source: r.s
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      minWidth: 0,
      fontSize: "var(--text-small)",
      color: "var(--text-muted)",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap"
    }
  }, r.e), /*#__PURE__*/React.createElement(Badge, {
    tone: "under"
  }, "Aktif")))), /*#__PURE__*/React.createElement(Card, {
    padding: 16,
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "var(--space-20)"
    }
  }, /*#__PURE__*/React.createElement(SectionHeader, {
    title: "Alert Telegram"
  }), /*#__PURE__*/React.createElement(Switch, {
    label: "Aktifkan alert",
    description: "Kirim pesan Telegram kalau pengeluaran lewat budget harian.",
    checked: telegram,
    onChange: setTelegram
  }), /*#__PURE__*/React.createElement(Switch, {
    label: "Ringkasan harian 21:00",
    description: "Total pengeluaran dan sisa budget hari itu.",
    checked: daily,
    onChange: setDaily
  }), /*#__PURE__*/React.createElement(Switch, {
    label: "Ringkasan mingguan",
    description: "Setiap Senin pagi.",
    checked: weekly,
    onChange: setWeekly
  }), /*#__PURE__*/React.createElement(Select, {
    label: "Kirim alert saat",
    value: threshold,
    onChange: e => setThreshold(e.target.value),
    options: [{
      value: "80",
      label: "80% budget terpakai"
    }, {
      value: "100",
      label: "Lewat budget"
    }, {
      value: "both",
      label: "Dua-duanya"
    }]
  }), /*#__PURE__*/React.createElement(Input, {
    label: "Chat ID",
    prefix: /*#__PURE__*/React.createElement(Icon, {
      name: "send",
      size: 16
    }),
    value: "482913756",
    hint: "Ambil dari @userinfobot di Telegram."
  })), /*#__PURE__*/React.createElement(Button, {
    variant: "danger",
    size: "md",
    fullWidth: true,
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "log-out",
      size: 16
    }),
    onClick: onLogout
  }, "Keluar"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "var(--text-micro)",
      color: "var(--text-subtle)",
      textAlign: "center"
    }
  }, "Trackster \xB7 v1.4.2")));
}
Object.assign(window, {
  SettingsScreen
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/trackster-app/SettingsScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/trackster-app/Shell.jsx
try { (() => {
const TK = window.TracksterDesignSystem_4b3ed2;
const TODAY = {
  date: "2026-08-12",
  budget: 150000,
  totalSpent: 169700,
  remaining: -19700,
  isOverBudget: true,
  transactions: [{
    id: "t1",
    amount: 87200,
    description: "Indomaret Tebet",
    source: "BCA",
    occurredAt: "2026-08-12T19:05:00"
  }, {
    id: "t2",
    amount: 58500,
    description: "GoFood — Nasi Padang",
    source: "JAGO",
    occurredAt: "2026-08-12T12:40:00"
  }, {
    id: "t3",
    amount: 24000,
    description: "Kopi Kenangan",
    source: "BCA",
    occurredAt: "2026-08-12T08:12:00"
  }]
};
const WEEK = {
  total: 987700,
  average: 141100,
  overDays: 3,
  days: [{
    label: "Sen",
    spent: 120000,
    budget: 150000
  }, {
    label: "Sel",
    spent: 168000,
    budget: 150000,
    isOverBudget: true
  }, {
    label: "Rab",
    spent: 96000,
    budget: 150000
  }, {
    label: "Kam",
    spent: 141000,
    budget: 150000
  }, {
    label: "Jum",
    spent: 205000,
    budget: 150000,
    isOverBudget: true
  }, {
    label: "Sab",
    spent: 88000,
    budget: 150000
  }, {
    label: "Min",
    spent: 169700,
    budget: 150000,
    isOverBudget: true
  }]
};
const DATE_LABEL = "Rabu, 12 Agustus";
function PhoneFrame({
  children
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      width: 390,
      height: 780,
      borderRadius: 34,
      overflow: "hidden",
      position: "relative",
      background: "var(--surface-base)",
      boxShadow: "var(--shadow-heavy), inset 0 0 0 1px var(--border-subtle)",
      display: "flex",
      flexDirection: "column"
    }
  }, children);
}
function Screen({
  children,
  scroll = true
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minHeight: 0,
      overflowY: scroll ? "auto" : "hidden",
      display: "flex",
      flexDirection: "column",
      gap: "var(--space-16)",
      padding: "0 var(--gutter-mobile) 24px"
    }
  }, children);
}
Object.assign(window, {
  TK,
  TODAY,
  WEEK,
  DATE_LABEL,
  PhoneFrame,
  Screen
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/trackster-app/Shell.jsx", error: String((e && e.message) || e) }); }

// ui_kits/trackster-app/TodayScreen.jsx
try { (() => {
const {
  TopBar,
  SectionHeader,
  Card,
  Button,
  IconButton,
  Icon,
  Badge,
  Alert,
  AmountDisplay,
  BudgetProgress,
  TransactionRow,
  EmptyState
} = window.TracksterDesignSystem_4b3ed2;
function TodayScreen({
  data,
  onOpenBudget
}) {
  const [dismissed, setDismissed] = React.useState(false);
  const empty = !data.transactions.length;
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(TopBar, {
    subtitle: window.DATE_LABEL,
    title: "Hari Ini",
    actions: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(IconButton, {
      variant: "ghost",
      label: "Sinkron email"
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "refresh-cw",
      size: 18
    })), /*#__PURE__*/React.createElement(IconButton, {
      variant: "dark",
      label: "Notifikasi"
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "bell",
      size: 18
    })))
  }), /*#__PURE__*/React.createElement(Screen, null, /*#__PURE__*/React.createElement(Card, {
    padding: 20,
    radius: "medium",
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "var(--space-16)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexWrap: "wrap",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: 12
    }
  }, /*#__PURE__*/React.createElement(AmountDisplay, {
    label: "Terpakai hari ini",
    value: data.totalSpent,
    size: "hero",
    tone: data.isOverBudget ? "over" : "base"
  }), /*#__PURE__*/React.createElement(Badge, {
    tone: data.isOverBudget ? "over" : data.totalSpent / data.budget >= 0.8 ? "near" : "under"
  }, data.isOverBudget ? "Over budget" : "Aman")), /*#__PURE__*/React.createElement(BudgetProgress, {
    spent: data.totalSpent,
    budget: data.budget,
    isOverBudget: data.isOverBudget,
    height: 16
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: "var(--space-20)"
    }
  }, /*#__PURE__*/React.createElement(AmountDisplay, {
    label: "Budget",
    value: data.budget,
    size: "body",
    tone: "muted"
  }), /*#__PURE__*/React.createElement(AmountDisplay, {
    label: data.isOverBudget ? "Lewat" : "Sisa",
    value: Math.abs(data.remaining),
    size: "body",
    tone: data.isOverBudget ? "over" : "under"
  }))), data.isOverBudget && !dismissed ? /*#__PURE__*/React.createElement(Alert, {
    tone: "over",
    title: "Lewat budget harian",
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "triangle-alert",
      size: 18
    }),
    onDismiss: () => setDismissed(true),
    action: /*#__PURE__*/React.createElement(Button, {
      variant: "outlined",
      size: "sm",
      onClick: onOpenBudget
    }, "Atur budget")
  }, "Kamu Rp19.700 di atas budget. Alert Telegram terkirim 19:05.") : null, /*#__PURE__*/React.createElement(SectionHeader, {
    title: "Transaksi",
    meta: data.transactions.length + " transaksi",
    action: /*#__PURE__*/React.createElement(Button, {
      variant: "ghost",
      size: "sm"
    }, "Semua")
  }), empty ? /*#__PURE__*/React.createElement(EmptyState, {
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "inbox",
      size: 22
    }),
    title: "Belum ada transaksi",
    description: "Begitu ada email notifikasi dari BCA atau Jago, transaksinya muncul di sini otomatis."
  }) : /*#__PURE__*/React.createElement(Card, {
    padding: 8
  }, data.transactions.map(t => /*#__PURE__*/React.createElement(TransactionRow, {
    key: t.id,
    description: t.description,
    amount: t.amount,
    source: t.source,
    occurredAt: t.occurredAt,
    onClick: () => {}
  }))), /*#__PURE__*/React.createElement(Card, {
    variant: "flat",
    padding: 0,
    style: {
      display: "flex",
      alignItems: "center",
      gap: "var(--space-10)",
      color: "var(--text-subtle)",
      fontSize: "var(--text-small)"
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "mail",
    size: 14
  }), /*#__PURE__*/React.createElement("span", null, "Sinkron terakhir 2 menit lalu \xB7 BCA, Jago"))));
}
Object.assign(window, {
  TodayScreen
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/trackster-app/TodayScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/trackster-app/WeeklyScreen.jsx
try { (() => {
const {
  TopBar,
  SectionHeader,
  Card,
  Button,
  IconButton,
  Icon,
  StatTile,
  DayBarChart,
  BudgetProgress,
  AmountDisplay
} = window.TracksterDesignSystem_4b3ed2;
function WeeklyScreen({
  week
}) {
  const [selected, setSelected] = React.useState("Min");
  const day = week.days.find(d => d.label === selected) || week.days[0];
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(TopBar, {
    subtitle: "1 \u2013 7 Agustus",
    title: "Mingguan",
    actions: /*#__PURE__*/React.createElement(IconButton, {
      variant: "dark",
      label: "Pilih minggu"
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "calendar",
      size: 18
    }))
  }), /*#__PURE__*/React.createElement(Screen, null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr 1fr",
      gap: "var(--space-10)"
    }
  }, /*#__PURE__*/React.createElement(StatTile, {
    label: "Total",
    value: week.total,
    size: "heading",
    delta: 12
  }), /*#__PURE__*/React.createElement(StatTile, {
    label: "Rata-rata",
    value: week.average,
    size: "heading",
    tone: "muted"
  }), /*#__PURE__*/React.createElement(StatTile, {
    label: "Over",
    value: week.overDays + " / 7",
    size: "heading",
    format: "raw",
    tone: "over"
  })), /*#__PURE__*/React.createElement(Card, {
    padding: 16,
    radius: "medium",
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "var(--space-14)"
    }
  }, /*#__PURE__*/React.createElement(SectionHeader, {
    title: "Per hari",
    meta: "budget Rp150.000"
  }), /*#__PURE__*/React.createElement(DayBarChart, {
    days: week.days,
    selected: selected,
    onSelect: d => setSelected(d.label),
    height: 130
  })), /*#__PURE__*/React.createElement(Card, {
    padding: 16,
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "var(--space-12)"
    }
  }, /*#__PURE__*/React.createElement(SectionHeader, {
    title: "Detail " + day.label
  }), /*#__PURE__*/React.createElement(AmountDisplay, {
    value: day.spent,
    size: "large",
    tone: day.isOverBudget ? "over" : "base",
    caption: day.isOverBudget ? "lewat budget harian" : "di bawah budget"
  }), /*#__PURE__*/React.createElement(BudgetProgress, {
    spent: day.spent,
    budget: day.budget,
    isOverBudget: day.isOverBudget
  })), /*#__PURE__*/React.createElement(Card, {
    padding: 16,
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "var(--space-12)"
    }
  }, /*#__PURE__*/React.createElement(SectionHeader, {
    title: "Sumber",
    meta: "minggu ini"
  }), [{
    n: "BCA",
    v: 612400,
    p: 62
  }, {
    n: "Jago",
    v: 375300,
    p: 38
  }].map(s => /*#__PURE__*/React.createElement("div", {
    key: s.n,
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      fontSize: "var(--text-label)",
      fontWeight: 700,
      fontVariantNumeric: "tabular-nums"
    }
  }, /*#__PURE__*/React.createElement("span", null, s.n), /*#__PURE__*/React.createElement("span", null, s.p, "%")), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 6,
      borderRadius: 500,
      background: "var(--surface-track)",
      overflow: "hidden"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: s.p + "%",
      height: "100%",
      borderRadius: 500,
      background: s.n === "BCA" ? "var(--source-bca)" : "var(--source-jago)"
    }
  })))))));
}
Object.assign(window, {
  WeeklyScreen
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/trackster-app/WeeklyScreen.jsx", error: String((e && e.message) || e) }); }

__ds_ns.Badge = __ds_scope.Badge;

__ds_ns.Button = __ds_scope.Button;

__ds_ns.Card = __ds_scope.Card;

__ds_ns.Icon = __ds_scope.Icon;

__ds_ns.IconButton = __ds_scope.IconButton;

__ds_ns.Input = __ds_scope.Input;

__ds_ns.Select = __ds_scope.Select;

__ds_ns.Switch = __ds_scope.Switch;

__ds_ns.AmountDisplay = __ds_scope.AmountDisplay;

__ds_ns.BudgetProgress = __ds_scope.BudgetProgress;

__ds_ns.DayBarChart = __ds_scope.DayBarChart;

__ds_ns.SourceTag = __ds_scope.SourceTag;

__ds_ns.StatTile = __ds_scope.StatTile;

__ds_ns.TransactionRow = __ds_scope.TransactionRow;

__ds_ns.Alert = __ds_scope.Alert;

__ds_ns.EmptyState = __ds_scope.EmptyState;

__ds_ns.Skeleton = __ds_scope.Skeleton;

__ds_ns.NavBar = __ds_scope.NavBar;

__ds_ns.SectionHeader = __ds_scope.SectionHeader;

__ds_ns.TopBar = __ds_scope.TopBar;

})();
