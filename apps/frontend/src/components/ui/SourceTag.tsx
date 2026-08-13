const SOURCE_STYLE: Record<string, string> = {
  BCA: 'bg-source-bca-bg text-source-bca',
  JAGO: 'bg-source-jago-bg text-source-jago',
};
const sourceLabel = (source: string) => (source === 'JAGO' ? 'Jago' : source);

export function SourceTag({ source, size = 'sm' }: { source: string; size?: 'sm' | 'md' }) {
  const dims = size === 'sm' ? 'px-1.5 py-0.5 text-micro' : 'px-2 py-[3px] text-badge';
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-subtle font-bold uppercase tracking-caps ${dims} ${
        SOURCE_STYLE[source] || 'bg-track text-ink-muted'
      }`}
    >
      {sourceLabel(source)}
    </span>
  );
}
