// AST -> TSX emitter for the ".dc.html" dialect. Output is a pure function of `vm` (view-model).
// Exactness rules (mirror support.js runtime):
//  - {{ a.b.c }} resolves like resolvePath (undefined-safe), loop aliases shadow vm keys
//  - style="…" static -> object literal; with {{ }} -> runtime css() (same cssToObj as the prototype)
//  - style-hover/active/focus/focus-within -> generated CSS class (.scpN:pseudo{…!important})
//  - value/checked undefined -> ''/false (controlled inputs), other attrs pass through
//  - hint-placeholder-* are dropped

const REACT_ATTR = {
  class: 'className', for: 'htmlFor', autocomplete: 'autoComplete', tabindex: 'tabIndex', readonly: 'readOnly',
  maxlength: 'maxLength', novalidate: 'noValidate', colspan: 'colSpan', rowspan: 'rowSpan', viewbox: 'viewBox',
  'accept-charset': 'acceptCharset', contenteditable: 'contentEditable', autofocus: 'autoFocus', inputmode: 'inputMode',
  enterkeyhint: 'enterKeyHint', spellcheck: 'spellCheck',
};
const EVENTS = new Set(['onClick', 'onChange', 'onInput', 'onSubmit', 'onKeyDown', 'onKeyUp', 'onScroll', 'onFocus', 'onBlur', 'onPointerDown', 'onPointerUp', 'onMouseEnter', 'onMouseLeave', 'onTouchStart', 'onTouchEnd', 'onTouchMove']);
const kebabToCamel = (s) => s.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
const IDENT = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

export function createEmitter() {
  const pseudo = new Map(); // "pseudo|css" -> class
  let pseudoN = 0;
  let dynN = 0;
  const stats = { holes: new Set() };

  // ---- expressions -------------------------------------------------------------------------
  function expr(src, scope) {
    let e = src.trim();
    if (e.startsWith('(') && e.endsWith(')')) return `(${expr(e.slice(1, -1), scope)})`;
    const eq = e.match(/^(.+?)\s*(===|!==|==|!=)\s*(.+)$/);
    if (eq) return `(${expr(eq[1], scope)} ${eq[2]} ${expr(eq[3], scope)})`;
    if (e[0] === '!') return `!${expr(e.slice(1), scope)}`;
    if (e === 'true' || e === 'false' || e === 'null' || e === 'undefined') return e;
    if (/^-?\d+(\.\d+)?$/.test(e)) return e;
    if (/^(["']).*\1$/.test(e)) return JSON.stringify(e.slice(1, -1));
    if (e === '$index') return scope.index ?? '$index';
    const parts = e.split('.');
    if (!IDENT.test(parts[0])) throw new Error(`unsupported expression: ${src}`);
    const head = parts[0];
    let out = scope.vars.has(head) ? head : `vm.${head}`;
    if (!scope.vars.has(head)) stats.holes.add(head);
    for (const p of parts.slice(1)) out += /^\d+$/.test(p) ? `?.[${p}]` : `?.${p}`;
    return out;
  }

  // "a {{ x }} b" -> [ 'a ', {expr:'x'}, ' b' ]
  function split(raw) {
    const out = [];
    const re = /\{\{([\s\S]+?)\}\}/g;
    let last = 0, m;
    while ((m = re.exec(raw))) {
      if (m.index > last) out.push(raw.slice(last, m.index));
      out.push({ expr: m[1] });
      last = m.index + m[0].length;
    }
    if (last < raw.length) out.push(raw.slice(last));
    return out;
  }
  const hasHole = (s) => typeof s === 'string' && s.includes('{{');

  function tpl(raw, scope) {
    const parts = split(raw);
    return '`' + parts.map((p) => (typeof p === 'string' ? p.replace(/[`\\$]/g, '\\$&') : `\${${expr(p.expr, scope)} ?? ''}`)).join('') + '`';
  }

  // ---- css -----------------------------------------------------------------------------------
  function splitDecls(css) {
    const out = [];
    let depth = 0, quote = '', start = 0;
    for (let i = 0; i < css.length; i++) {
      const c = css[i];
      if (quote) { if (c === '\\') i++; else if (c === quote) quote = ''; }
      else if (c === '"' || c === "'") quote = c;
      else if (c === '(') depth++;
      else if (c === ')') depth--;
      else if (c === ';' && depth === 0) { out.push(css.slice(start, i)); start = i + 1; }
    }
    out.push(css.slice(start));
    return out.map((d) => d.trim()).filter(Boolean);
  }
  function cssObjLiteral(css) {
    const entries = new Map();
    for (const d of splitDecls(css)) {
      const i = d.indexOf(':');
      if (i < 0) continue;
      const prop = d.slice(0, i).trim();
      const val = d.slice(i + 1).trim();
      const key = prop.startsWith('--') ? prop : kebabToCamel(prop);
      entries.set(key, val);
    }
    return `{${[...entries].map(([k, v]) => `${JSON.stringify(k)}:${JSON.stringify(v)}`).join(',')}}`;
  }

  function pseudoClass(name, css, scope, styleExtras) {
    // dynamic values -> custom property so one class serves every row
    if (hasHole(css)) {
      const parts = split(css);
      css = parts.map((p) => {
        if (typeof p === 'string') return p;
        const v = `--scv${dynN++}`;
        styleExtras.push(`${JSON.stringify(v)}:${expr(p.expr, scope)}`);
        return `var(${v})`;
      }).join('');
    }
    const key = `${name}|${css}`;
    if (!pseudo.has(key)) pseudo.set(key, `scp${(pseudoN++).toString(36)}`);
    return pseudo.get(key);
  }

  // ---- nodes ---------------------------------------------------------------------------------
  const BLOCKY = /display:\s*(flex|grid|inline-flex|inline-grid)/;

  function jsxText(s) {
    // JSX-safe text; keep exact characters via string expression when anything is risky
    if (/[{}<>&]/.test(s) || /^\s|\s$/.test(s) || /\n/.test(s)) return `{${JSON.stringify(s.replace(/\s+/g, ' '))}}`;
    return s;
  }

  function children(nodes, scope, parent) {
    const out = [];
    const parentStyle = parent && (parent.attrs.find((a) => a[0] === 'style') || [])[1];
    const flexParent = typeof parentStyle === 'string' && BLOCKY.test(parentStyle);
    const structural = parent && ['ul', 'ol', 'dl', 'select', 'svg', 'tbody', 'table', 'tr', 'datalist'].includes(parent.tag);
    for (let idx = 0; idx < nodes.length; idx++) {
      const n = nodes[idx];
      if (n.t === 'text') {
        const raw = n.value;
        if (!raw.includes('{{')) {
          if (!raw.trim()) {
            // whitespace-only: ignored in flex/grid/structural parents, collapsible otherwise
            if (raw.includes('\n') && (flexParent || structural)) continue;
            if (!raw.includes(' ') && !raw.includes('\n')) continue;
            out.push('{" "}');
            continue;
          }
          out.push(jsxText(raw));
          continue;
        }
        for (const p of split(raw)) {
          if (typeof p === 'string') {
            if (p.trim() || p.includes(' ')) out.push(jsxText(p.trim() ? p : ' '));
          } else out.push(`{${expr(p.expr, scope)}}`);
        }
        continue;
      }
      out.push(node(n, scope, parent));
    }
    return out;
  }

  function attrs(n, scope) {
    const props = [];
    const styleExtras = [];
    let style = null;
    const pseudos = [];
    for (const [name0, val] of n.attrs) {
      if (name0.startsWith('hint-') || name0 === 'sc-name' || name0.startsWith('data-dc')) continue;
      if (name0.startsWith('style-')) { pseudos.push([name0.slice(6), val]); continue; }
      if (name0 === 'style') { style = val; continue; }
      let key = name0;
      const lower = key.toLowerCase();
      if (REACT_ATTR[lower]) key = REACT_ATTR[lower];
      else if (lower.startsWith('on') && /^on[a-z]+$/.test(key)) key = 'on' + key[2].toUpperCase() + key.slice(3);
      else if (key.includes('-') && !key.startsWith('aria-') && !key.startsWith('data-')) key = kebabToCamel(key);
      let v;
      if (val === true) v = 'true';
      else if (typeof val === 'string' && /^\s*\{\{[\s\S]+?\}\}\s*$/.test(val)) {
        v = expr(val.trim().slice(2, -2), scope);
        if (key === 'value') v = `${v} ?? ''`;
        if (key === 'checked') v = `${v} ?? false`;
      } else if (hasHole(val)) v = tpl(val, scope);
      else v = JSON.stringify(val);
      // static strings render as plain attributes, everything else as expression
      if (/^"[^"\\]*"$/.test(v) && !key.startsWith('on')) props.push(`${key}=${v}`);
      else props.push(`${key}={${v}}`);
    }
    if (props.some((p) => p.startsWith('value={')) && !props.some((p) => p.startsWith('onChange=')) && n.tag !== 'option') props.push('onChange={noop}');
    if (props.filter((p) => p.startsWith('className')).length > 0 && pseudos.length) throw new Error(`className + pseudo on <${n.tag}> line ${n.line}`);
    const cls = pseudos.map(([p, css]) => pseudoClass(p, css, scope, styleExtras));
    if (cls.length) props.push(`className="${cls.join(' ')}"`);
    if (style != null || styleExtras.length) {
      let s;
      if (style == null) s = '{}';
      else if (hasHole(style)) s = `css(${tpl(style, scope)})`;
      else s = cssObjLiteral(style);
      if (styleExtras.length) s = style != null && hasHole(style) ? `{...${s},${styleExtras.join(',')}}` : s === '{}' ? `{${styleExtras.join(',')}}` : `{...${s},${styleExtras.join(',')}}`;
      props.push(`style={${s}}`);
    }
    return props;
  }

  let replace = new Map();
  function node(n, scope, parent) {
    const rep = replace.get(n);
    if (rep) {
      if (n.tag === 'sc-if') {
        const v = (n.attrs.find((a) => a[0] === 'value') || [])[1];
        return `{${expr(v.trim().slice(2, -2), scope)} ? (<${rep}View vm={vm} />) : null}`;
      }
      return `<${rep}View vm={vm} />`;
    }
    if (n.tag === 'sc-if') {
      const v = (n.attrs.find((a) => a[0] === 'value') || [])[1];
      const cond = expr(v.trim().slice(2, -2), scope);
      const kids = children(n.children, scope, parent);
      return `{${cond} ? (<>${kids.join('')}</>) : null}`;
    }
    if (n.tag === 'sc-for') {
      const list = (n.attrs.find((a) => a[0] === 'list') || [])[1];
      const as = (n.attrs.find((a) => a[0] === 'as') || [])[1] || 'item';
      const idx = `$i${scope.depth}`;
      const inner = { vars: new Set([...scope.vars, as]), index: idx, depth: scope.depth + 1 };
      const kids = children(n.children, inner, parent);
      return `{(${expr(list.trim().slice(2, -2), scope)} ?? []).map((${as}: any, ${idx}: number) => (<Fragment key={${idx}}>${kids.join('')}</Fragment>))}`;
    }
    if (n.tag === 'track-mascot') {
      return `<TrackMascot ${attrs(n, scope).join(' ')} />`;
    }
    const tag = n.tag;
    const props = attrs(n, scope);
    const kids = children(n.children, scope, n);
    const open = `<${tag}${props.length ? ' ' + props.join(' ') : ''}`;
    if (!kids.length) return `${open} />`;
    return `${open}>${kids.join('')}</${tag}>`;
  }

  return {
    node: (n, parent) => node(n, { vars: new Set(), index: null, depth: 0 }, parent),
    // children of a transparent wrapper (sc-if) emitted standalone
    inner: (n, parent) => children(n.children, { vars: new Set(), index: null, depth: 0 }, parent).join(''),
    pseudoCss() {
      const rules = [];
      for (const [key, cls] of pseudo) {
        const i = key.indexOf('|');
        const name = key.slice(0, i), css = key.slice(i + 1);
        const decls = splitDecls(css).map((d) => (d.includes('!important') ? d : `${d} !important`)).join(';');
        rules.push(`.${cls}:${name}{${decls}}`);
      }
      return rules.join('\n') + '\n';
    },
    setReplace(m) { replace = m; },
    takeHoles() { const a = [...stats.holes].sort(); stats.holes.clear(); return a; },
  };
}
