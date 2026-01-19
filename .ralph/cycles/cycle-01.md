# Cycle 01: Test Utilities & Shared Foundation

**Status:** ⏳ Pending
**Started:** [date]
**Completed:** [date]

---

## 🎯 Objective

Establish a robust testing foundation and shared utilities that all features depend on. This cycle creates the testing infrastructure, mock services, and helper functions that enable confident development in subsequent cycles without duplicating test setup work.

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

---

## 📝 Tasks

### Task 1: Setup test framework & testing utilities

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

### Task 2: Create shared utility functions

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

### Task 3: Implement database test helpers & fixtures

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

### Task 4: Setup mock Unifi & email service stubs

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

### Task 5: Create test data factories

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

### Task 6: Setup CI/CD pipeline

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

### Task 7: Implement rate limiting utilities

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

### Task 8: Create logger & monitoring setup

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

### Documentation
- [ ] Update relevant docs if architecture changed
- [ ] Add JSDoc comments for public APIs
- [ ] Update this cycle doc with completion date

### Git
- [ ] All changes committed with descriptive message
- [ ] Commit message format: `feat(cycle-01): [description]`
- [ ] Working tree clean (`.ralph/scripts/verify-clean.sh` passes)

### Status Update
- [ ] Update `.ralph/TASKS.md` - move this cycle to "Completed"
- [ ] Update "Last Updated" date in `TASKS.md`
- [ ] Run `.ralph/scripts/check-cycle.sh 01` to verify

---

## 🚀 Next Steps

After completing this cycle:

1. Run `.ralph/scripts/check-cycle.sh 01` to validate completion
2. Update `.ralph/TASKS.md` status (move to ✅ Completed)
3. Proceed to next cycle: [Cycle 02](cycle-02.md)

---

## 📚 References

- **PRD:** `/docs/PRD.md` - Complete product requirements
- **Design Spec:** `/docs/FIGMA-BRIEF.md` - UI/UX specifications
- Previous Cycle: [Cycle 00](cycle-00.md)
- Next Cycle: [Cycle 02](cycle-02.md)

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

