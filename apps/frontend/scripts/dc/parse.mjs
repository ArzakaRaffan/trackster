// Tokenizer + tree builder for the Claude Design ".dc.html" template dialect
// (plain HTML + <sc-if value="{{ x }}"> / <sc-for list="{{ xs }}" as="x"> + {{ path }} holes).
// Dev tool only — see scripts/dc-to-tsx.mjs.

const VOID = new Set(['input', 'br', 'img', 'hr', 'meta', 'link', 'source', 'wbr']);
const ENT = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&nbsp;': ' ' };
const decode = (s) => s.replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (m) => ENT[m]);

export function parse(src) {
  const root = { t: 'el', tag: '#root', attrs: [], children: [] };
  const stack = [root];
  let i = 0;
  const top = () => stack[stack.length - 1];
  while (i < src.length) {
    if (src.startsWith('<!--', i)) {
      const e = src.indexOf('-->', i);
      i = e < 0 ? src.length : e + 3;
      continue;
    }
    if (src[i] === '<' && src[i + 1] === '/') {
      const e = src.indexOf('>', i);
      const name = src.slice(i + 2, e).trim();
      // pop to matching open tag
      let k = stack.length - 1;
      while (k > 0 && stack[k].tag !== name) k--;
      if (k === 0) throw new Error(`unmatched </${name}> at ${lineOf(src, i)}`);
      stack.length = k;
      i = e + 1;
      continue;
    }
    if (src[i] === '<' && /[A-Za-z]/.test(src[i + 1] || '')) {
      let j = i + 1;
      while (j < src.length && /[A-Za-z0-9-]/.test(src[j])) j++;
      const tag = src.slice(i + 1, j);
      const attrs = [];
      let selfClose = false;
      for (;;) {
        while (j < src.length && /\s/.test(src[j])) j++;
        if (src[j] === '>') { j++; break; }
        if (src[j] === '/' && src[j + 1] === '>') { selfClose = true; j += 2; break; }
        let k = j;
        while (k < src.length && !/[\s=>/]/.test(src[k])) k++;
        const name = src.slice(j, k);
        if (!name) throw new Error(`bad attr at line ${lineOf(src, j)}`);
        j = k;
        while (/\s/.test(src[j])) j++;
        let val = true;
        if (src[j] === '=') {
          j++;
          while (/\s/.test(src[j])) j++;
          if (src[j] === '"' || src[j] === "'") {
            const q = src[j];
            const e = src.indexOf(q, j + 1);
            val = decode(src.slice(j + 1, e));
            j = e + 1;
          } else {
            let e = j;
            while (e < src.length && !/[\s>]/.test(src[e])) e++;
            val = decode(src.slice(j, e));
            j = e;
          }
        }
        attrs.push([name, val]);
      }
      const el = { t: 'el', tag, attrs, children: [], line: lineOf(src, i) };
      top().children.push(el);
      if (!VOID.has(tag) && !selfClose) stack.push(el);
      i = j;
      continue;
    }
    let j = src.indexOf('<', i + 1);
    // a lone "<" that is not a tag start belongs to the text
    while (j >= 0 && !(src[j + 1] === '/' || src[j + 1] === '!' || /[A-Za-z]/.test(src[j + 1] || ''))) j = src.indexOf('<', j + 1);
    if (j < 0) j = src.length;
    top().children.push({ t: 'text', value: decode(src.slice(i, j)) });
    i = j;
  }
  if (stack.length !== 1) throw new Error(`unclosed <${top().tag}> opened at line ${top().line}`);
  return root;
}

export function lineOf(src, idx) {
  let n = 1;
  for (let k = 0; k < idx; k++) if (src.charCodeAt(k) === 10) n++;
  return n;
}
