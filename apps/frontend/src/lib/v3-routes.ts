// Prototype `page` / `pre` state ↔ URL. `base` is '/app' for the real app and '/demo' for the sample-data mode.
export type V3Target = { pre: 'landing' | 'auth' | 'wizard' | null; page: string };

const PAGES: Record<string, string> = {
  dash: '', today: '/today', weekly: '/weekly', budget: '/budget', income: '/income', checkin: '/income/checkin',
  goals: '/goals', subs: '/subscriptions', reports: '/reports', analysis: '/insights', chat: '/chat', memory: '/chat/memory',
  tidy: '/categorize', me: '/more', settings: '/settings', sources: '/sources', privacy: '/privacy', calc: '/calc',
  split: '/split', splitNew: '/split/new', splitDetail: '/split/detail',
};
const BY_PATH = Object.fromEntries(Object.entries(PAGES).map(([k, v]) => [v, k]));

export function stateToPath(base: string, s: { pre?: string | null; page?: string }): string | null {
  if (s.pre === 'landing') return '/';
  if (s.pre === 'auth') return '/login';
  if (s.pre === 'wizard') return '/setup';
  const tail = PAGES[s.page ?? 'dash'];
  return tail === undefined ? null : base + tail;
}

export function pathToState(base: string, path: string): V3Target | null {
  if (path === '/') return { pre: 'landing', page: 'dash' };
  if (path === '/login') return { pre: 'auth', page: 'dash' };
  if (path === '/setup') return { pre: 'wizard', page: 'dash' };
  if (path === base || path.startsWith(base + '/')) {
    const page = BY_PATH[path.slice(base.length).replace(/\/$/, '')];
    return page ? { pre: null, page } : null;
  }
  return null;
}
