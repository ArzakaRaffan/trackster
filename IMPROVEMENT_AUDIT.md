# Trackster Codebase Audit

## Scope

This audit was performed on the current repository state to identify:
- dead or duplicated code
- type-safety issues
- low/medium-risk bugs
- higher-risk items that need human decision

Auth flows, secrets, database migrations, production deployment configuration, and breaking public API contracts were treated as **out of scope** and were not modified.

## Findings

### High risk — not executed

- Auth/session logic and cookie handling should be reviewed separately.
- Gmail sync/parser logic touches external credentials and should only be changed with real email examples and owner approval.
- Telegram notification rate limits and retry behavior may need business review.
- Public Split Bill toggle-paid endpoint intentionally has no auth; do not change without product approval.

### Medium risk — recorded, not executed

- `apps/backend/src/modules/balance/balance.service.ts` could be simplified by using `upsert` directly without computing `oldBalance` manually.
- Several local `rp` formatting helpers duplicate `formatRupiah` from `apps/frontend/src/lib/format.ts`; consolidating them is safe but must preserve the intentional no-space “Rp” display in compact UI areas.
- `apps/frontend/src/app/app/today/page.tsx` uses a local `rp` function that matches `AmountDisplay`’s compact behavior; consolidation requires care.
- `apps/backend/src/modules/gmail/gmail-sync.service.ts` fallback `next.toISO() ?? next.toJSDate().toISOString()` should be verified against the installed `@nestjs/schedule` version.
- Some TypeScript `as` casts in DTO and parser files can be tightened later.

### Low risk — executed in this session

1. **Fixed `Input` focus-state handling**

   `apps/frontend/src/components/ui/Input.tsx`

   The `onFocus` and `onBlur` handlers were defined before spreading `{...rest}`, so consumer-provided `onFocus`/`onBlur` would overwrite the internal `setFocus` calls. Now the handlers are destructured and invoked after the internal state update.

2. **Replaced `any` type with Prisma type**

   `apps/backend/src/modules/income/income.service.ts`

   `const where: any = {}` was changed to `const where: Prisma.IncomeWhereInput = {}` to improve type safety without changing runtime behavior.

## Verification notes

- These changes were static review-level fixes and were not run through the full CI/build pipeline in this session.
- Before merging, run the relevant project checks:
  - Frontend: `npm run build`
  - Backend: `npm run build`
  - Backend/Prisma type generation is already assumed to be up to date.
- Higher-risk items above should be tracked separately and assigned for human review before implementation.
