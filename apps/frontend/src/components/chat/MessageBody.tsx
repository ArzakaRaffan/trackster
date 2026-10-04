import { Fragment, type ReactNode } from 'react';

// Subset markdown yang realistis keluar dari model: paragraf, `-`/`1.` list, heading, **bold**, `code`.
// Sengaja bukan parser penuh (tanpa dependency baru) — tabel/link/blockquote tampil sebagai teks biasa.

function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return (
        <strong key={i} className="font-bold text-text">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return (
        <code key={i} className="rounded-subtle bg-neutral px-1.5 py-0.5 text-[0.9em] text-text">
          {part.slice(1, -1)}
        </code>
      );
    }
    return <Fragment key={i}>{part}</Fragment>;
  });
}

const BULLET = /^\s*[-*•]\s+(.*)$/;
const NUMBERED = /^\s*\d+[.)]\s+(.*)$/;
const HEADING = /^\s{0,3}#{1,4}\s+(.*)$/;

export function MessageBody({ content }: { content: string }) {
  const blocks: ReactNode[] = [];
  let para: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;

  const flushPara = () => {
    if (para.length) {
      blocks.push(
        <p key={blocks.length} className="whitespace-pre-line">
          {inline(para.join('\n'))}
        </p>,
      );
      para = [];
    }
  };
  const flushList = () => {
    if (!list) return;
    const Tag = list.ordered ? 'ol' : 'ul';
    blocks.push(
      <Tag
        key={blocks.length}
        className={`space-y-1.5 pl-5 marker:text-text-subtle ${list.ordered ? 'list-decimal' : 'list-disc'}`}
      >
        {list.items.map((it, i) => (
          <li key={i} className="pl-1">
            {inline(it)}
          </li>
        ))}
      </Tag>,
    );
    list = null;
  };

  for (const line of content.split('\n')) {
    const b = BULLET.exec(line);
    const n = b ? null : NUMBERED.exec(line);
    const h = b || n ? null : HEADING.exec(line);
    if (b || n) {
      flushPara();
      const ordered = !!n;
      if (list && list.ordered !== ordered) flushList();
      list ??= { ordered, items: [] };
      list.items.push((b ?? n)![1]);
    } else if (h) {
      flushPara();
      flushList();
      blocks.push(
        <p key={blocks.length} className="font-title font-bold text-text">
          {inline(h[1])}
        </p>,
      );
    } else if (line.trim() === '') {
      flushPara();
      flushList();
    } else {
      flushList();
      para.push(line);
    }
  }
  flushPara();
  flushList();

  return <div className="space-y-3 break-words">{blocks}</div>;
}
