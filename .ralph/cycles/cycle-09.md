# Cycle 09: Admin Dashboard

**Status:** ⏳ Pending
**Started:** [date]
**Completed:** [date]

---

## 🎯 Objective

Build main admin panel with real-time network monitoring, guest overview, activity feed, and quick actions. Implement dashboard layout, stats cards, active devices table, and recent activity with 30s polling.

---

## 📋 Prerequisites

Before starting this cycle:

- [ ] Previous cycles completed and committed
- [ ] Run `.ralph/scripts/verify-clean.sh` - working tree must be clean
- [ ] All previous tests passing (`pnpm test`)

---

## 🧪 TDD Approach

This cycle follows strict Test-Driven Development:

### 1️⃣ RED Phase: Write Failing Tests
- Write tests FIRST for all functionality
- Tests must FAIL initially (prove they work)
- Cover edge cases and error scenarios
- Use descriptive test names

### 2️⃣ GREEN Phase: Make Tests Pass
- Write minimum code to pass tests
- Use shared utilities from Cycle 01 (if available)
- Keep it simple, no over-engineering
- Make tests pass as quickly as possible

### 3️⃣ REFACTOR Phase: Clean & Optimize
- Extract duplicated code
- Improve naming and structure
- Ensure coverage ≥80%
- Add JSDoc comments for public APIs
### 4️⃣ VISUAL Polish (This is a Frontend Cycle)
- Run `/frontend-dev` loop for visual convergence
- Compare against `docs/FIGMA-BRIEF.md`
- Iterate until design specs met
- All UI components match design specifications

---

## 📝 Tasks

### Task 1: Frontend: Build dashboard layout and navigation

#### 🔴 RED: Write Failing Tests

Write comprehensive tests that cover:
- Happy path functionality
- Edge cases and error handling
- Input validation
- Integration with other components

**Test files to create:**
- [ ] `__tests__/[feature].test.ts` - Unit tests
- [ ] `__tests__/integration/[feature].test.ts` - Integration tests (if applicable)

**Tests must FAIL initially** - verify the RED phase works!

---

#### 🟢 GREEN: Implement Functionality

Write the minimum code needed to make tests pass.

**Files to create/modify:**
- [ ] Implementation files (TDD will guide what's needed)
- [ ] Type definitions if needed

**Keep it simple** - just make the tests green!

---

#### ♻️ REFACTOR: Clean Up

Now that tests are passing:
- [ ] Extract reusable logic to utilities
- [ ] Improve naming and code structure
- [ ] Add JSDoc comments for public functions
- [ ] Ensure coverage ≥80%
- [ ] Run `pnpm lint --fix` and fix any issues

---

### Task 2: Frontend: Build stats overview cards

#### 🔴 RED: Write Failing Tests

Write comprehensive tests that cover:
- Happy path functionality
- Edge cases and error handling
- Input validation
- Integration with other components

**Test files to create:**
- [ ] `__tests__/[feature].test.ts` - Unit tests
- [ ] `__tests__/integration/[feature].test.ts` - Integration tests (if applicable)

**Tests must FAIL initially** - verify the RED phase works!

---

#### 🟢 GREEN: Implement Functionality

Write the minimum code needed to make tests pass.

**Files to create/modify:**
- [ ] Implementation files (TDD will guide what's needed)
- [ ] Type definitions if needed

**Keep it simple** - just make the tests green!

---

#### ♻️ REFACTOR: Clean Up

Now that tests are passing:
- [ ] Extract reusable logic to utilities
- [ ] Improve naming and code structure
- [ ] Add JSDoc comments for public functions
- [ ] Ensure coverage ≥80%
- [ ] Run `pnpm lint --fix` and fix any issues

---

### Task 3: Frontend: Build live active devices table with status

#### 🔴 RED: Write Failing Tests

Write comprehensive tests that cover:
- Happy path functionality
- Edge cases and error handling
- Input validation
- Integration with other components

**Test files to create:**
- [ ] `__tests__/[feature].test.ts` - Unit tests
- [ ] `__tests__/integration/[feature].test.ts` - Integration tests (if applicable)

**Tests must FAIL initially** - verify the RED phase works!

---

#### 🟢 GREEN: Implement Functionality

Write the minimum code needed to make tests pass.

**Files to create/modify:**
- [ ] Implementation files (TDD will guide what's needed)
- [ ] Type definitions if needed

**Keep it simple** - just make the tests green!

---

#### ♻️ REFACTOR: Clean Up

Now that tests are passing:
- [ ] Extract reusable logic to utilities
- [ ] Improve naming and code structure
- [ ] Add JSDoc comments for public functions
- [ ] Ensure coverage ≥80%
- [ ] Run `pnpm lint --fix` and fix any issues

---

### Task 4: Frontend: Build recent activity feed

#### 🔴 RED: Write Failing Tests

Write comprehensive tests that cover:
- Happy path functionality
- Edge cases and error handling
- Input validation
- Integration with other components

**Test files to create:**
- [ ] `__tests__/[feature].test.ts` - Unit tests
- [ ] `__tests__/integration/[feature].test.ts` - Integration tests (if applicable)

**Tests must FAIL initially** - verify the RED phase works!

---

#### 🟢 GREEN: Implement Functionality

Write the minimum code needed to make tests pass.

**Files to create/modify:**
- [ ] Implementation files (TDD will guide what's needed)
- [ ] Type definitions if needed

**Keep it simple** - just make the tests green!

---

#### ♻️ REFACTOR: Clean Up

Now that tests are passing:
- [ ] Extract reusable logic to utilities
- [ ] Improve naming and code structure
- [ ] Add JSDoc comments for public functions
- [ ] Ensure coverage ≥80%
- [ ] Run `pnpm lint --fix` and fix any issues

---

### Task 5: API: Implement GET /api/admin/dashboard with stats

#### 🔴 RED: Write Failing Tests

Write comprehensive tests that cover:
- Happy path functionality
- Edge cases and error handling
- Input validation
- Integration with other components

**Test files to create:**
- [ ] `__tests__/[feature].test.ts` - Unit tests
- [ ] `__tests__/integration/[feature].test.ts` - Integration tests (if applicable)

**Tests must FAIL initially** - verify the RED phase works!

---

#### 🟢 GREEN: Implement Functionality

Write the minimum code needed to make tests pass.

**Files to create/modify:**
- [ ] Implementation files (TDD will guide what's needed)
- [ ] Type definitions if needed

**Keep it simple** - just make the tests green!

---

#### ♻️ REFACTOR: Clean Up

Now that tests are passing:
- [ ] Extract reusable logic to utilities
- [ ] Improve naming and code structure
- [ ] Add JSDoc comments for public functions
- [ ] Ensure coverage ≥80%
- [ ] Run `pnpm lint --fix` and fix any issues

---

### Task 6: API: Implement real-time device polling from Unifi

#### 🔴 RED: Write Failing Tests

Write comprehensive tests that cover:
- Happy path functionality
- Edge cases and error handling
- Input validation
- Integration with other components

**Test files to create:**
- [ ] `__tests__/[feature].test.ts` - Unit tests
- [ ] `__tests__/integration/[feature].test.ts` - Integration tests (if applicable)

**Tests must FAIL initially** - verify the RED phase works!

---

#### 🟢 GREEN: Implement Functionality

Write the minimum code needed to make tests pass.

**Files to create/modify:**
- [ ] Implementation files (TDD will guide what's needed)
- [ ] Type definitions if needed

**Keep it simple** - just make the tests green!

---

#### ♻️ REFACTOR: Clean Up

Now that tests are passing:
- [ ] Extract reusable logic to utilities
- [ ] Improve naming and code structure
- [ ] Add JSDoc comments for public functions
- [ ] Ensure coverage ≥80%
- [ ] Run `pnpm lint --fix` and fix any issues

---

### Task 7: Setup 30-second polling interval for updates

#### 🔴 RED: Write Failing Tests

Write comprehensive tests that cover:
- Happy path functionality
- Edge cases and error handling
- Input validation
- Integration with other components

**Test files to create:**
- [ ] `__tests__/[feature].test.ts` - Unit tests
- [ ] `__tests__/integration/[feature].test.ts` - Integration tests (if applicable)

**Tests must FAIL initially** - verify the RED phase works!

---

#### 🟢 GREEN: Implement Functionality

Write the minimum code needed to make tests pass.

**Files to create/modify:**
- [ ] Implementation files (TDD will guide what's needed)
- [ ] Type definitions if needed

**Keep it simple** - just make the tests green!

---

#### ♻️ REFACTOR: Clean Up

Now that tests are passing:
- [ ] Extract reusable logic to utilities
- [ ] Improve naming and code structure
- [ ] Add JSDoc comments for public functions
- [ ] Ensure coverage ≥80%
- [ ] Run `pnpm lint --fix` and fix any issues

---

### Task 8: Add visual convergence with /frontend-dev

#### 🔴 RED: Write Failing Tests

Write comprehensive tests that cover:
- Happy path functionality
- Edge cases and error handling
- Input validation
- Integration with other components

**Test files to create:**
- [ ] `__tests__/[feature].test.ts` - Unit tests
- [ ] `__tests__/integration/[feature].test.ts` - Integration tests (if applicable)

**Tests must FAIL initially** - verify the RED phase works!

---

#### 🟢 GREEN: Implement Functionality

Write the minimum code needed to make tests pass.

**Files to create/modify:**
- [ ] Implementation files (TDD will guide what's needed)
- [ ] Type definitions if needed

**Keep it simple** - just make the tests green!

---

#### ♻️ REFACTOR: Clean Up

Now that tests are passing:
- [ ] Extract reusable logic to utilities
- [ ] Improve naming and code structure
- [ ] Add JSDoc comments for public functions
- [ ] Ensure coverage ≥80%
- [ ] Run `pnpm lint --fix` and fix any issues

---

## ✅ Completion Criteria

Before marking this cycle complete:

### Testing
- [ ] All tests pass (`pnpm test`)
- [ ] Coverage ≥80% for new/modified files (`pnpm test:coverage`)
- [ ] No test warnings or console errors

### Code Quality
- [ ] No ESLint errors (`pnpm lint`)
- [ ] Code formatted with Prettier (`pnpm format:check`)
- [ ] No TypeScript errors (`pnpm type-check`)

### Visual Validation
- [ ] Run `/frontend-dev` loop
- [ ] Achieve visual convergence with design specs
- [ ] UI matches `docs/FIGMA-BRIEF.md` specifications
- [ ] Responsive design works on mobile/tablet/desktop

### Documentation
- [ ] Update relevant docs if architecture changed
- [ ] Add JSDoc comments for public APIs
- [ ] Update this cycle doc with completion date

### Git
- [ ] All changes committed with descriptive message
- [ ] Commit message format: `feat(cycle-09): [description]`
- [ ] Working tree clean (`.ralph/scripts/verify-clean.sh` passes)

### Status Update
- [ ] Update `.ralph/TASKS.md` - move this cycle to "Completed"
- [ ] Update "Last Updated" date in `TASKS.md`
- [ ] Run `.ralph/scripts/check-cycle.sh 09` to verify

---

## 🚀 Next Steps

After completing this cycle:

1. Run `.ralph/scripts/check-cycle.sh 09` to validate completion
2. Update `.ralph/TASKS.md` status (move to ✅ Completed)
3. Proceed to next cycle: [Cycle 10](cycle-10.md)

---

## 📚 References

- **PRD:** `/docs/PRD.md` - Complete product requirements
- **Design Spec:** `/docs/FIGMA-BRIEF.md` - UI/UX specifications
- Previous Cycle: [Cycle 08](cycle-08.md)
- Next Cycle: [Cycle 10](cycle-10.md)

---

## 🚨 Remember

**TDD IS MANDATORY. NO EXCEPTIONS.**

- Tests FIRST, code SECOND
- Never skip the RED phase
- Coverage must be ≥80%
- Commit only when all tests pass
- Ralph: You have autonomy to make technical decisions!

---

## 📝 Notes

[Add any notes, learnings, or decisions made during this cycle]

