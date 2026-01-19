# Cycle 09: Admin Dashboard

**Status:** ⏳ Pending
**Started:** [date]
**Completed:** [date]

---

## 🎯 Objective

[What this cycle achieves and why it's important]

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

### 2️⃣ GREEN Phase: Make Tests Pass
- Write minimum code to pass tests
- Use shared utilities from Cycle 01
- Keep it simple, no over-engineering

### 3️⃣ REFACTOR Phase: Clean & Optimize
- Extract duplicated code
- Improve naming and structure
- Ensure coverage ≥80%

### 4️⃣ VISUAL Polish (Frontend Tasks Only)
- Run `/frontend-dev` loop for visual convergence
- Compare against `docs/FIGMA-BRIEF.md`
- Iterate until design specs met

---

## 📝 Tasks

### Task 1: [Task Name]

#### Context
[Brief explanation of what this task accomplishes]

#### TDD Steps

**🔴 RED: Write Failing Tests**
```typescript
// Example test structure
describe('[Feature]', () => {
  it('should [behavior]', () => {
    // Arrange

    // Act

    // Assert - should FAIL initially
  });
});
```

**Tests to write:**
- [ ] Unit test: [specific test]
- [ ] Integration test: [specific test]
- [ ] Edge case: [specific test]

**🟢 GREEN: Implement Code**
```typescript
// Minimal implementation to pass tests
```

**Files to create/modify:**
- [ ] `path/to/file.ts` - [purpose]

**♻️ REFACTOR: Clean Up**
- [ ] Extract reusable logic to utilities
- [ ] Improve naming
- [ ] Add JSDoc comments
- [ ] Verify coverage ≥80%

---

### Task 2: [Task Name]
[Repeat structure above]

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

### Visual (Frontend Tasks Only)
- [ ] `/frontend-dev` loop achieves visual convergence
- [ ] UI matches `docs/FIGMA-BRIEF.md` specifications

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

---

## 🚀 Next Steps

After completing this cycle:
1. Run `.ralph/scripts/verify-clean.sh` to confirm clean state
2. Update `.ralph/TASKS.md` status
3. Proceed to next cycle: [Link to next cycle]

---

## 📚 References

- PRD: `/docs/PRD.md`
- Design Spec: `/docs/FIGMA-BRIEF.md`
- Previous Cycle: [Link if applicable]
- Next Cycle: [Link if applicable]

---

## 🚨 Remember

**TDD IS MANDATORY. NO EXCEPTIONS.**
- Tests FIRST, code SECOND
- Never skip the RED phase
- Coverage must be ≥80%
- Commit only when all tests pass

---

## 📝 Notes

[Add any notes, learnings, or decisions made during this cycle]

