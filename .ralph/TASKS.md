# World Wide Webb - Ralph Build Plan

**Project:** Guest WiFi Captive Portal for Home Network
**Network SSID:** `world-wide-webb`
**Tech Stack:** Next.js 14 + TypeScript + Better Auth + SQLite + Tailwind + shadcn/ui

---

## 🤖 Ralph's Autonomy Guidelines

**Ralph, you are trusted to make decisions!** You should:

✅ **FIX ISSUES IMMEDIATELY** - Don't ask permission for obvious fixes (typos, linting, formatting, test failures)
✅ **MAKE ARCHITECTURAL DECISIONS** - Follow the patterns in Cycle 00, choose the best approach
✅ **REFACTOR FREELY** - If you see better patterns, implement them (as long as tests pass)
✅ **ADD HELPFUL UTILITIES** - If you need a helper function, build it (with tests!)
✅ **OPTIMIZE AS YOU GO** - Make performance improvements when you spot them
✅ **HANDLE EDGE CASES** - Add error handling and validation proactively

❌ **ONLY ASK USER WHEN:**
- Fundamental product direction changes
- Major architectural shifts that affect future cycles
- External service choices (APIs, paid services)
- Deployment/infrastructure decisions

**Your goal:** Ship a production-ready, well-tested, beautiful captive portal. You have the authority to make technical decisions that support this goal.

---

## 📊 Current Status

- **Active Cycle:** Cycle 00
- **Progress:** 0/15 cycles completed (0%)
- **Last Updated:** 2026-01-18

---

## 🎯 Quick Start for Ralph

```bash
# Check current cycle status
.ralph/scripts/check-cycle.sh

# Verify clean git state
.ralph/scripts/verify-clean.sh

# Check test coverage
.ralph/scripts/check-coverage.sh 80

# Create new cycle doc (if needed)
.ralph/scripts/create-cycle.sh 01 "Cycle Name"
```

---

## 📋 Cycle Overview

### ✅ Completed Cycles
(none yet)

---

### 🔄 In Progress

**Cycle 00:** Architecture & Testing Patterns → [cycles/cycle-00.md]
- Define testing approach and patterns
- Document DI pattern (factory functions)
- Establish architectural principles
- Create ADR (Architecture Decision Records)

---

### ⏳ Pending Cycles

**Cycle 01:** Test Utilities & Shared Foundation → [cycles/cycle-01.md]
- Create test database utilities (in-memory SQLite)
- Build fake service implementations (Email, Unifi, Auth)
- Develop test data factories (Faker.js)
- Create shared validation schemas (Zod)
- Build reusable utility functions (MAC address, date/time, etc.)
- **TDD Coverage:** 100% (this is the foundation)

**Cycle 02:** Next.js Project Setup & Tooling → [cycles/cycle-02.md]
- Initialize Next.js 14 with App Router
- Configure TypeScript + ESLint + Prettier
- Setup Husky git hooks + lint-staged
- Configure Tailwind CSS
- Install and configure shadcn/ui components
- Setup Vitest + Testing Library + Playwright
- Configure coverage reporting (80% threshold)

**Cycle 03:** Database Layer → [cycles/cycle-03.md]
- Setup SQLite + Drizzle ORM
- Create database schema (all tables from PRD)
- Write migration scripts
- Write admin seed script
- **TDD:** Database connection, migrations, CRUD operations

**Cycle 04:** Authentication Foundation → [cycles/cycle-04.md]
- Configure Better Auth
- Setup email OTP (passwordless for guests)
- Setup password + TOTP (for admin)
- Build session management
- **TDD:** Auth functions, session handling, token validation

**Cycle 05:** Email Service → [cycles/cycle-05.md]
- Create email service abstraction (IEmailService)
- Build Mailpit adapter (development)
- Build Resend adapter (production)
- Create email templates (verification, admin notification)
- **TDD:** Email sending, template rendering, switching providers

**Cycle 06:** Unifi Integration → [cycles/cycle-06.md]
- Build Unifi API client (IUnifiClient interface)
- Implement authorize/unauthorize/status methods
- Implement active clients + DPI stats
- **TDD:** All Unifi client methods (with FakeUnifiClient)

**Cycle 07:** Guest Authentication Flow → [cycles/cycle-07.md]
- Landing page (name + email + terms) [TDD → Build → /frontend-dev]
- Verification code generation/validation [TDD]
- Verification page (6-digit input) [TDD → Build → /frontend-dev]
- Success page (welcome + auto-close) [TDD → Build → /frontend-dev]
- API endpoints: verify-email, verify-code, resend-code [TDD]
- **TDD + Visual:** Full guest auth flow (E2E + unit + visual convergence)

**Cycle 08:** Admin Authentication → [cycles/cycle-08.md]
- Admin login page [TDD → Build → /frontend-dev]
- TOTP setup page (QR + manual entry) [TDD → Build → /frontend-dev]
- Admin middleware protection [TDD]
- Backup codes generation/validation [TDD]
- **TDD + Visual:** Admin auth flow

**Cycle 09:** Admin Dashboard → [cycles/cycle-09.md]
- Dashboard layout + navigation [TDD → Build → /frontend-dev]
- Stats cards (active guests, bandwidth, etc.) [TDD → Build → /frontend-dev]
- Active devices table with real-time updates [TDD → Build → /frontend-dev]
- Recent activity feed [TDD → Build → /frontend-dev]
- **TDD + Visual:** Dashboard data fetching, polling

**Cycle 10:** Admin Guest Management → [cycles/cycle-10.md]
- Guest list page (search, filter, pagination) [TDD → Build → /frontend-dev]
- Guest detail modal [TDD → Build → /frontend-dev]
- Revoke/extend/delete actions [TDD]
- Export to CSV [TDD]
- **TDD + Visual:** Guest management CRUD

**Cycle 11:** Admin Network Monitoring → [cycles/cycle-11.md]
- Network status page [TDD → Build → /frontend-dev]
- Real-time device monitoring (30s polling) [TDD → Build → /frontend-dev]
- DPI stats integration [TDD → Build → /frontend-dev]
- Signal strength indicators [TDD → Build → /frontend-dev]
- **TDD + Visual:** Network monitoring APIs

**Cycle 12:** Activity Logging & Background Jobs → [cycles/cycle-12.md]
- Activity logging system [TDD]
- Connection event sync job [TDD]
- DPI stats sync job (optional) [TDD]
- Cleanup job (old logs/stats) [TDD]
- **TDD:** All logging functions, background job reliability

**Cycle 13:** Guest Self-Service Portal → [cycles/cycle-13.md]
- Guest dashboard [TDD → Build → /frontend-dev]
- Device management page [TDD → Build → /frontend-dev]
- Usage statistics [TDD → Build → /frontend-dev]
- Request extension flow [TDD → Build → /frontend-dev]
- **TDD + Visual:** Guest portal features

**Cycle 14:** Rate Limiting & Edge Cases → [cycles/cycle-14.md]
- Rate limiting implementation [TDD]
- Email resend flow with cooldown [TDD]
- Invalid code handling [TDD]
- Code expiry handling [TDD]
- MAC address randomization handling [TDD]
- Unifi API failure handling [TDD]
- **TDD:** All edge cases with comprehensive test coverage

**Cycle 15:** Production & Deployment → [cycles/cycle-15.md]
- Docker configuration (Dockerfile + docker-compose.yml) [TDD]
- Health check endpoint [TDD]
- Environment variable validation [TDD]
- Production optimizations
- Deployment documentation
- **TDD:** Health checks, production setup validation

---

## 🚨 Critical Rules

### TDD is MANDATORY
- **NO EXCEPTIONS** - Tests FIRST, code SECOND
- Every cycle follows: **RED → GREEN → REFACTOR**
- Coverage must be **≥80%** for all new/modified code
- Frontend tasks add: **VISUAL POLISH** via `/frontend-dev` loop

### Cycle Completion Requirements
Before moving to next cycle:
- [ ] All tests passing (`pnpm test`)
- [ ] Coverage ≥80% (`.ralph/scripts/check-coverage.sh`)
- [ ] No linting errors (`pnpm lint`)
- [ ] No type errors (`pnpm type-check`)
- [ ] Visual convergence (frontend tasks only)
- [ ] All changes committed
- [ ] Working tree clean (`.ralph/scripts/verify-clean.sh`)
- [ ] TASKS.md updated with completion status
- [ ] Cycle validation passes (`.ralph/scripts/check-cycle.sh`)

### Git Commit Format
```
feat(cycle-XX): [Brief description]

- Implemented [feature/component]
- Tests: [test coverage info]
- Coverage: [percentage]%

[Optional: Additional details]
```

---

## 📚 Key References

- **PRD:** [`/docs/PRD.md`](../docs/PRD.md) - Complete product requirements
- **Design Spec:** [`/docs/FIGMA-BRIEF.md`](../docs/FIGMA-BRIEF.md) - UI/UX specifications
- **Frontend Dev Setup:** [`/docs/FRONTEND-DEV-SETUP.md`](../docs/FRONTEND-DEV-SETUP.md) - Visual testing workflow

---

## 🛠️ Development Workflow

### Starting a New Cycle
```bash
# 1. Verify prerequisites
.ralph/scripts/verify-clean.sh

# 2. Read cycle documentation
cat .ralph/cycles/cycle-XX.md

# 3. Follow TDD approach (RED → GREEN → REFACTOR)
# 4. For frontend: Add visual polish with /frontend-dev
# 5. Validate cycle completion
.ralph/scripts/check-cycle.sh XX

# 6. Commit and update TASKS.md
git add .
git commit -m "feat(cycle-XX): [description]"
```

### Debugging Failed Cycles
```bash
# Show what's blocking completion
.ralph/scripts/check-cycle.sh XX --fix

# Check specific aspects
pnpm test                    # Run tests
pnpm test:coverage           # Check coverage
pnpm lint                    # Check linting
pnpm type-check              # Check types
git status                   # Check uncommitted changes
```

---

## 📈 Progress Tracking

| Cycle | Name | Status | Tests | Coverage | Committed |
|-------|------|--------|-------|----------|-----------|
| 00 | Architecture & Patterns | ⏳ Pending | - | - | - |
| 01 | Test Utilities | ⏳ Pending | - | - | - |
| 02 | Next.js Setup | ⏳ Pending | - | - | - |
| 03 | Database Layer | ⏳ Pending | - | - | - |
| 04 | Auth Foundation | ⏳ Pending | - | - | - |
| 05 | Email Service | ⏳ Pending | - | - | - |
| 06 | Unifi Integration | ⏳ Pending | - | - | - |
| 07 | Guest Auth Flow | ⏳ Pending | - | - | - |
| 08 | Admin Auth | ⏳ Pending | - | - | - |
| 09 | Admin Dashboard | ⏳ Pending | - | - | - |
| 10 | Guest Management | ⏳ Pending | - | - | - |
| 11 | Network Monitoring | ⏳ Pending | - | - | - |
| 12 | Activity Logging | ⏳ Pending | - | - | - |
| 13 | Guest Portal | ⏳ Pending | - | - | - |
| 14 | Edge Cases | ⏳ Pending | - | - | - |
| 15 | Production | ⏳ Pending | - | - | - |

---

## 🎓 Testing Philosophy

### Test Pyramid
```
        /\
       /E2E\         Few (3-5 critical user journeys)
      /------\
     /  Inte- \      Many (test real behavior with fakes)
    /  gration \
   /------------\
  /    Unit      \   Some (pure functions, utilities)
 /----------------\
```

### Why This Works
- **Unit tests:** Fast, test pure logic
- **Integration tests:** Test real behavior (no mocks, use fakes)
- **E2E tests:** Validate critical user flows
- **Visual tests:** `/frontend-dev` ensures UI matches design

### Key Principles
1. **No Mocking** - Use fake implementations instead
2. **Real Database** - In-memory SQLite for tests
3. **Dependency Injection** - Factory functions for flexibility
4. **Test First** - RED → GREEN → REFACTOR always

---

## 🔄 Iteration & Improvement

This is a living document. As we learn during implementation:
- Update cycle docs with new insights
- Refine testing approaches
- Document architectural decisions
- Share learnings across cycles

**Ralph: You're empowered to update these docs as you learn. If you discover better patterns, document them and apply them!**

---

**Last Updated:** 2026-01-18
**Next Review:** After Cycle 05 completion
