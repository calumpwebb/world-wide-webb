# Dependency Migration Plan - World Wide Webb

**Document Version:** 1.0
**Date:** 2026-01-20
**Status:** Planning Phase

## Executive Summary

This document outlines the comprehensive migration strategy for upgrading **World Wide Webb** from its current stable dependency versions to the latest major versions. All updates involve major version jumps requiring careful planning, testing, and potential code changes.

**Current State:**
- ✅ All 49 unit tests passing
- ✅ Zero security vulnerabilities (`pnpm audit` clean)
- ✅ Production-ready with comprehensive monitoring and documentation
- ✅ Stable dependencies with no critical issues

**Recommendation:** These migrations are **optional** and should only be undertaken when:
1. You have dedicated time for thorough testing (2-4 hours minimum)
2. You're not in a critical deployment window
3. You want to leverage new framework features or prepare for long-term maintenance

---

## Migration Overview

### Dependency Update Matrix

| Package | Current | Target | Risk Level | Effort | Priority |
|---------|---------|--------|------------|--------|----------|
| **Next.js** | 14.2.35 | 16.1.4 | 🟡 Medium | High | 1 |
| **React + React DOM** | 18.3.1 | 19.2.3 | 🟡 Medium | Medium | 2 |
| **ESLint** | 8.57.1 | 9.39.2 | 🟢 Low | Medium | 3 |
| **Tailwind CSS** | 3.4.19 | 4.1.18 | 🔴 High | High | 4 |
| **@types/node** | 20.19.30 | 25.0.9 | 🟢 Low | Low | - |
| **@types/react** | 18.3.27 | 19.2.8 | 🟢 Low | Low | - |
| **@types/react-dom** | 18.3.7 | 19.2.3 | 🟢 Low | Low | - |

**Total Estimated Effort:** 6-8 hours (including testing and validation)

---

## Phase 1: Next.js 14.2.35 → 16.1.4

### Breaking Changes Impact Analysis

#### 1. ✅ Async Request APIs (Already Partially Migrated)

**Change:** `params`, `searchParams`, `cookies()`, `headers()`, and `draftMode()` must be awaited.

**Current Status:**
- ✅ `cookies()` already async in `src/lib/session.ts:25`
- ✅ `params` already async in `src/app/api/portal/devices/[id]/route.ts:13`
- ⚠️ `searchParams` uses `useSearchParams()` hook in client components (no changes needed)
- ⚠️ Need to audit all server components for params/searchParams usage

**Files Requiring Updates:**
```bash
# Files with potential async API usage (11 files found)
src/app/admin/guests/page.tsx
src/app/api/admin/guests/route.ts
src/app/api/admin/activity/route.ts
src/app/admin/logs/page.tsx
src/app/admin/reset-password/page.tsx
src/app/page.tsx
src/app/api/admin/dpi/route.ts
src/app/api/portal/devices/[id]/route.ts
src/app/api/guest/status/route.ts
src/lib/session.ts
src/app/api/portal/devices/route.ts
```

**Action Items:**
- [ ] Audit all 11 files for synchronous access to `params`, `searchParams`, `cookies()`, `headers()`
- [ ] Add `await` to all async API calls
- [ ] Update TypeScript types from `{ params: { id: string } }` to `{ params: Promise<{ id: string }> }`

#### 2. ⚠️ Turbopack Default Bundler

**Change:** Turbopack is now the default bundler. Webpack config is ignored unless using `--webpack` flag.

**Current Status:**
- ✅ No custom Webpack configuration in `next.config.mjs`
- ✅ Project only uses standard Next.js configuration (standalone output, headers, instrumentation hook)

**Action Items:**
- [ ] No changes required - project has no custom Webpack config

#### 3. ⚠️ Middleware → Proxy Rename

**Change:** `middleware.ts` file should be renamed to `proxy.ts`, and it runs in Node.js runtime (not Edge).

**Current Status:**
- ⚠️ Project uses `src/middleware.ts` for auth cookie checks and redirects
- Current middleware is Edge-compatible (no database queries)

**Action Items:**
- [ ] Rename `src/middleware.ts` → `src/proxy.ts` (if upgrading to Next.js 16+)
- [ ] Verify Edge runtime compatibility or accept Node.js runtime
- [ ] Test auth redirects still work after rename

#### 4. ℹ️ Caching Model Changes

**Change:** Caching behavior has changed. Need to add `cacheLife` profiles or use `updateTag()` in Server Actions.

**Current Status:**
- ℹ️ Project uses HTTP Cache-Control headers in admin API routes (30s cache)
- No explicit caching directives in data fetching

**Action Items:**
- [ ] Review admin API routes (`/api/admin/stats`, `/api/admin/guests`, etc.)
- [ ] Add `cacheLife: 'max'` for SWR behavior if needed
- [ ] Test cache behavior with 30s polling on admin dashboard

### Migration Steps

```bash
# 1. Create feature branch
git checkout -b upgrade/nextjs-16

# 2. Use automated codemod (recommended)
npx @next/codemod@canary upgrade latest

# 3. Manual verification
# - Review all changes made by codemod
# - Audit async API usage in 11 files identified above
# - Test middleware/proxy behavior

# 4. Install dependencies
pnpm install

# 5. Run tests
pnpm test              # Unit tests
pnpm test:e2e          # E2E tests
pnpm build             # Production build

# 6. Dev testing
pnpm dev               # Manual testing of all flows
```

### Validation Checklist

- [ ] All 49+ unit tests pass
- [ ] All E2E tests pass (guest signup, admin login, TOTP setup)
- [ ] Production build succeeds (`pnpm build`)
- [ ] Guest authentication flow works (email → code → success)
- [ ] Admin authentication works (login → TOTP → dashboard)
- [ ] Admin dashboard polling works (30s auto-refresh)
- [ ] Guest portal device management works
- [ ] Unifi integration works (authorize/revoke)
- [ ] Email sending works (verification codes, password reset)
- [ ] Rate limiting works (5/hour email, 3 attempts code)
- [ ] Background jobs work (connection sync, DPI cache, expiry cleanup)
- [ ] Health check endpoint works (`/api/health`)
- [ ] Metrics endpoint works (`/api/metrics`, `/api/metrics/prometheus`)

**Estimated Time:** 3-4 hours

---

## Phase 2: React 18.3.1 → 19.2.3

### Breaking Changes Impact Analysis

#### 1. ⚠️ Removed APIs

**Changes:**
- String refs removed (deprecated 2018)
- PropTypes removed (deprecated 2017)
- `defaultProps` removed from function components
- UMD builds removed (use ESM CDNs)

**Current Status:**
- ✅ Project uses modern React patterns (functional components, hooks)
- ✅ No string refs (uses `useRef()` hooks)
- ✅ No PropTypes (TypeScript used instead)
- ✅ No `defaultProps` (uses ES6 default parameters)

**Action Items:**
- [ ] No changes required - project already uses modern React patterns

#### 2. ⚠️ TypeScript Changes

**Changes:**
- Ref cleanup functions must return `void` or cleanup function
- Global JSX namespace removed (use `React.JSX`)
- Stricter ref forwarding rules

**Current Status:**
- ⚠️ Project uses TypeScript with strict mode
- Need to run automated codemod for type migrations

**Action Items:**
- [ ] Run automated types codemod: `npx types-react-codemod@latest preset-19 ./src`
- [ ] Review TypeScript errors after codemod
- [ ] Update ref callbacks to return proper cleanup functions

#### 3. ℹ️ Concurrent Rendering by Default

**Changes:**
- Concurrent rendering enabled by default
- `useEffect` timing may change slightly
- Stricter rules for state updates

**Current Status:**
- ℹ️ Project uses standard `useEffect` hooks for polling and side effects
- Admin dashboard has 30s auto-refresh with cleanup

**Action Items:**
- [ ] Test admin dashboard auto-refresh (30s polling)
- [ ] Test guest portal polling behavior
- [ ] Verify no race conditions in connection sync jobs

### Migration Steps

```bash
# 1. Recommended: Upgrade to React 18.3 first (includes warnings)
pnpm add react@18.3.1 react-dom@18.3.1

# 2. Run dev server and fix deprecation warnings
pnpm dev

# 3. Upgrade to React 19
pnpm add react@19 react-dom@19
pnpm add -D @types/react@19 @types/react-dom@19

# 4. Run automated type codemod
npx types-react-codemod@latest preset-19 ./src

# 5. Fix TypeScript errors
pnpm build

# 6. Run tests
pnpm test
pnpm test:e2e
```

### Validation Checklist

- [ ] All unit tests pass
- [ ] All E2E tests pass
- [ ] TypeScript compilation succeeds with no errors
- [ ] Admin dashboard polling works correctly
- [ ] No console warnings about deprecated APIs
- [ ] Forms work (react-hook-form compatibility verified)
- [ ] Radix UI components work (dialogs, toasts, selects, checkboxes)
- [ ] Client-side navigation works

**Estimated Time:** 1-2 hours

---

## Phase 3: ESLint 8.57.1 → 9.39.2

### Breaking Changes Impact Analysis

#### 1. ⚠️ Flat Config Required

**Change:** ESLint 9 uses flat config (`eslint.config.js`) by default. Legacy `.eslintrc.json` is deprecated.

**Current Status:**
- ⚠️ Project uses `.eslintrc.json` with `next/core-web-vitals` and `next/typescript`

**Current Config:**
```json
{
  "extends": ["next/core-web-vitals", "next/typescript"]
}
```

**Action Items:**
- [ ] Convert `.eslintrc.json` to `eslint.config.js` using automated migrator
- [ ] Verify `next/core-web-vitals` flat config compatibility
- [ ] Test linting with new flat config

#### 2. ℹ️ Node.js Version Requirement

**Change:** ESLint 9 requires Node.js 18.18+

**Current Status:**
- ✅ Project already requires Node.js 20+ (TypeScript configuration)

**Action Items:**
- [ ] No changes required

#### 3. ℹ️ Removed Rules

**Changes:**
- `require-jsdoc` and `valid-jsdoc` rules removed

**Current Status:**
- ✅ Project doesn't use these deprecated rules

**Action Items:**
- [ ] No changes required

### Migration Steps

```bash
# 1. Install ESLint 9
pnpm add -D eslint@9 eslint-config-next@latest

# 2. Use automated migration tool
npx @eslint/migrate-config .eslintrc.json

# 3. Review generated eslint.config.js
# The tool creates a flat config with extends support

# 4. Test linting
pnpm lint

# 5. Fix any new linting errors
pnpm lint --fix
```

### Validation Checklist

- [ ] `pnpm lint` runs without errors
- [ ] Linting still enforces Next.js best practices
- [ ] TypeScript files are linted correctly
- [ ] Pre-commit hooks still work (lint-staged + Husky)
- [ ] No new linting errors introduced

**Estimated Time:** 1 hour

---

## Phase 4: Tailwind CSS 3.4.19 → 4.1.18

### ⚠️ HIGHEST RISK MIGRATION

Tailwind CSS v4 is a complete rewrite with significant breaking changes. This migration carries the **highest risk** and should be done last.

### Breaking Changes Impact Analysis

#### 1. 🔴 Browser Support Requirements

**Change:** Tailwind v4 requires Safari 16.4+, Chrome 111+, Firefox 128+

**Impact:**
- ⚠️ Older browsers (2+ years old) will not be supported
- Captive portals often run in older iOS Safari versions

**Action Items:**
- [ ] **CRITICAL:** Test on target iOS devices (captive portal use case)
- [ ] Verify browser support matches expected guest devices
- [ ] Consider deferring this upgrade if older device support is needed

#### 2. 🔴 CSS Import Changes

**Change:** Use `@import` instead of `@tailwind` directives

**Current Status:**
- ⚠️ Project likely uses `@tailwind base; @tailwind components; @tailwind utilities;` in globals.css

**Action Items:**
- [ ] Replace `@tailwind` directives with `@import "tailwindcss"`
- [ ] Update all CSS entry points

#### 3. 🔴 Configuration System Redesign

**Change:** Configuration uses CSS variables instead of JavaScript

**Current Status:**
- ⚠️ Project has extensive `tailwind.config.ts` with custom theme colors, HSL variables
- Uses shadcn/ui with custom CSS variables for theming

**Impact:**
- **HIGH RISK:** May break shadcn/ui component styling
- Dark mode implementation may require changes
- Custom color system (HSL variables) needs migration

**Action Items:**
- [ ] **CRITICAL:** Verify shadcn/ui v4 compatibility
- [ ] Migrate theme configuration from JS to CSS
- [ ] Test dark mode styling extensively
- [ ] Verify all custom colors work (background, foreground, card, popover, etc.)

#### 4. 🔴 Preflight Changes

**Changes:**
- Placeholder text uses 50% opacity of current color (not gray-400)
- Buttons use `cursor: default` (not `cursor: pointer`)
- Dialog margins reset

**Impact:**
- Forms may look different (placeholder text)
- Buttons may have wrong cursor
- Modal dialogs may have spacing issues

**Action Items:**
- [ ] Test all forms (guest landing, admin login, TOTP setup, password reset)
- [ ] Test all buttons (verify cursor behavior)
- [ ] Test all dialogs (Radix UI AlertDialog, Dialog components)

#### 5. 🔴 No CSS Preprocessor Support

**Change:** Cannot use Sass, Less, or Stylus

**Current Status:**
- ✅ Project uses vanilla CSS with PostCSS

**Action Items:**
- [ ] No changes required

### Migration Steps

```bash
# 1. IMPORTANT: Create backup branch
git checkout -b upgrade/tailwind-v4-backup
git push origin upgrade/tailwind-v4-backup

# 2. Create working branch
git checkout -b upgrade/tailwind-v4

# 3. Use automated upgrade tool (requires Node.js 20+)
npx @tailwindcss/upgrade@next

# 4. Review all changes
# - Check globals.css for @import changes
# - Check tailwind.config.ts migration to CSS
# - Check component files for class name changes

# 5. Install dependencies
pnpm install

# 6. Build and test EXTENSIVELY
pnpm build
pnpm dev

# 7. Visual regression testing
# - Test every page in dark mode
# - Test all forms and buttons
# - Test all dialogs and toasts
# - Test admin dashboard cards and tables
# - Test guest portal UI
```

### Validation Checklist

#### Visual Testing (CRITICAL)
- [ ] **Guest Landing Page:** Email form, name field, terms checkbox, dark theme
- [ ] **Guest Verify Page:** 6-digit code input, resend button, error messages
- [ ] **Guest Success Page:** Welcome message, countdown timer
- [ ] **Admin Login Page:** Email/password form, forgot password link
- [ ] **Admin TOTP Setup:** QR code display, manual entry key, backup codes
- [ ] **Admin Dashboard:** Stats cards, device list table, activity feed, dark theme
- [ ] **Admin Guests Page:** Table, search/filter, revoke/extend buttons
- [ ] **Admin Network Page:** Real-time client list, signal strength indicators
- [ ] **Admin Logs Page:** Filterable table, CSV export button
- [ ] **Guest Portal Dashboard:** Connection status, device list, data usage
- [ ] **Guest Device Management:** Edit nicknames, connection history

#### Functional Testing
- [ ] All Radix UI components work (AlertDialog, Dialog, Toast, Select, Checkbox)
- [ ] Dark mode toggle works (if applicable)
- [ ] All buttons have correct cursor behavior
- [ ] All forms have correct placeholder styling
- [ ] All modals have correct spacing
- [ ] Responsive design works on mobile (test captive portal on iPhone/Android)

#### Technical Validation
- [ ] Production build succeeds
- [ ] All unit tests pass
- [ ] All E2E tests pass
- [ ] No CSS class name warnings in console
- [ ] Browser support verified on target devices

**Estimated Time:** 2-3 hours (high complexity due to theme migration)

---

## Rollback Strategy

### If Migration Fails

Each phase should be done in a separate Git branch for easy rollback:

```bash
# Rollback Phase 1 (Next.js)
git checkout main
git branch -D upgrade/nextjs-16

# Rollback Phase 2 (React)
git checkout upgrade/nextjs-16  # Keep Next.js changes
git branch -D upgrade/react-19

# Rollback Phase 3 (ESLint)
git checkout upgrade/react-19  # Keep previous changes
git branch -D upgrade/eslint-9

# Rollback Phase 4 (Tailwind)
git checkout upgrade/tailwind-v4-backup  # Restore from backup
```

### Emergency Rollback (Production)

If issues are discovered in production after deployment:

```bash
# Revert to previous stable version
git revert HEAD~1  # Or specific commit
git push origin main

# Or full rollback to last known good commit
git reset --hard <last-good-commit-sha>
git push --force origin main  # DANGEROUS: Only if absolutely necessary
```

---

## Recommended Migration Order

### Option A: Conservative (Recommended)

**Timeline:** Spread over 2-4 weeks, one migration per week

```
Week 1: Next.js 14 → 16 (Phase 1)
Week 2: React 18 → 19 (Phase 2)
Week 3: ESLint 8 → 9 (Phase 3)
Week 4: Tailwind 3 → 4 (Phase 4) - ONLY if browser support verified
```

**Benefits:**
- Isolate issues to specific dependency
- Thorough testing between each phase
- Easy rollback if problems occur
- Lower risk to production

### Option B: Aggressive (Not Recommended)

**Timeline:** All migrations in one day (6-8 hours)

```
Day 1: All phases in sequence (1 → 2 → 3 → 4)
```

**Risks:**
- Hard to isolate which change caused issues
- Difficult rollback if multiple dependencies fail
- High risk of breaking changes interacting
- Not recommended for production systems

### Option C: Skip High-Risk Items

**Timeline:** 1-2 weeks

```
Week 1: Next.js 14 → 16 (Phase 1)
Week 2: React 18 → 19 (Phase 2)
Week 3: ESLint 8 → 9 (Phase 3)
SKIP: Tailwind 3 → 4 (defer until v5 or critical need)
```

**Benefits:**
- Avoid highest-risk migration (Tailwind v4)
- Still get Next.js and React improvements
- Lower overall risk
- Tailwind 3 is stable and supported

---

## Success Criteria

Before considering migration complete, verify:

### Technical Validation
- [ ] All unit tests pass (49+ tests)
- [ ] All E2E tests pass (guest signup, admin login)
- [ ] Production build succeeds with no errors
- [ ] No TypeScript compilation errors
- [ ] No ESLint errors
- [ ] Zero security vulnerabilities (`pnpm audit`)

### Functional Validation
- [ ] Guest authentication flow works end-to-end
- [ ] Admin authentication flow works end-to-end
- [ ] Unifi integration works (authorize/revoke)
- [ ] Email sending works (verification, password reset, admin notifications)
- [ ] Background jobs work (connection sync, DPI cache, cleanup)
- [ ] Rate limiting works correctly
- [ ] Admin dashboard auto-refresh works (30s polling)
- [ ] Health check endpoint responds correctly
- [ ] Metrics endpoints work (Prometheus format)

### Performance Validation
- [ ] Page load times same or better
- [ ] Build time same or better (Next.js 16 should be faster with Turbopack)
- [ ] No new console warnings or errors
- [ ] Memory usage stable

### Deployment Validation
- [ ] Docker build succeeds
- [ ] Standalone build works for production deployment
- [ ] Environment variables work correctly
- [ ] HTTPS/TLS works with reverse proxy
- [ ] Health checks pass in production environment

---

## References & Resources

### Next.js 16
- [Official Next.js 16 Upgrade Guide](https://nextjs.org/docs/app/guides/upgrading/version-16)
- [Next.js 16 Blog Post](https://nextjs.org/blog/next-16)
- [Production Migration Guide](https://www.amillionmonkeys.co.uk/blog/migrating-to-nextjs-16-production-guide)
- [Complete Next.js 16 Guide](https://codelynx.dev/posts/nextjs-16-complete-guide)

### React 19
- [Official React 19 Upgrade Guide](https://react.dev/blog/2024/04/25/react-19-upgrade-guide)
- [React 19 Release Notes](https://react.dev/blog/2024/12/05/react-19)
- [Production Migration Guide](https://javascript.plainenglish.io/react-v18-to-v19-upgrade-guide-for-production-level-projects-c62986f0f6f6)
- [React 19 Common Mistakes](https://blog.openreplay.com/common-mistakes-upgrading-react-19-avoid/)

### ESLint 9
- [Official ESLint 9 Migration Guide](https://eslint.org/docs/latest/use/migrate-to-9.0.0)
- [Flat Config Migration Guide](https://eslint.org/docs/latest/use/configure/migration-guide)
- [ESLint Configuration Migrator](https://eslint.org/blog/2024/05/eslint-configuration-migrator/)
- [ESLint 9 Migration Tutorial](https://medium.com/ekino-france/migrate-to-eslint-9-x-29727f790249)

### Tailwind CSS 4
- [Official Tailwind CSS 4 Upgrade Guide](https://tailwindcss.com/docs/upgrade-guide)
- [Tailwind CSS 4.0 Blog Post](https://tailwindcss.com/blog/tailwindcss-v4)
- [Complete Migration Guide](https://medium.com/@mernstackdevbykevin/tailwind-css-v4-0-complete-migration-guide-breaking-changes-you-need-to-know-7f99944a9f95)
- [Upgrading Guide with Examples](https://typescript.tv/hands-on/upgrading-to-tailwind-css-v4-a-migration-guide/)

---

## Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-01-20 | Document created | Comprehensive migration planning for major dependency updates |
| TBD | Migration start date | Wait for dedicated maintenance window |
| TBD | Final migration approach | Choose Option A (conservative) vs Option C (skip Tailwind) |

---

## Questions for Project Owner

Before starting migration, clarify:

1. **Browser Support:** What is the oldest iOS/Safari version that must be supported for captive portal guests?
   - If iOS 15 or older: **Cannot upgrade Tailwind CSS to v4** (requires Safari 16.4+)
   - If iOS 16.4+ only: Tailwind v4 upgrade is feasible

2. **Maintenance Window:** When is the best time for this migration?
   - Avoid during critical deployment periods
   - Recommend off-peak hours with rollback plan ready

3. **Feature Priority:** Are any new Next.js 16 or React 19 features needed?
   - If no: Consider deferring migration (current versions are stable and secure)
   - If yes: Prioritize specific dependency upgrades

4. **Risk Tolerance:** What is acceptable downtime for testing?
   - Conservative approach: 1 week per phase with thorough testing
   - Aggressive approach: All-at-once (higher risk, faster completion)

---

## Conclusion

All major dependency updates are **optional** at this time. The current stack is:
- ✅ Secure (zero vulnerabilities)
- ✅ Stable (49 tests passing)
- ✅ Production-ready (comprehensive monitoring and documentation)

**Recommendation:** Choose **Option C** (skip Tailwind v4) or defer all migrations until there is a compelling business need (new features, security vulnerabilities, or end-of-life warnings).

If proceeding, use **Option A** (conservative, one phase per week) to minimize risk and ensure thorough validation at each step.
