#!/bin/bash

# Enhanced cycle generation script with full details
# Usage: ./generate-cycle.sh --number 01 --name "Name" --objective "..." --tasks "task1|task2|task3"

set -e

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --number) CYCLE_NUM="$2"; shift 2 ;;
    --name) CYCLE_NAME="$2"; shift 2 ;;
    --objective) OBJECTIVE="$2"; shift 2 ;;
    --tasks) TASKS="$2"; shift 2 ;;
    --prev-cycle) PREV_CYCLE="$2"; shift 2 ;;
    --next-cycle) NEXT_CYCLE="$2"; shift 2 ;;
    --frontend) FRONTEND="true"; shift ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

# Validate required args
if [ -z "$CYCLE_NUM" ] || [ -z "$CYCLE_NAME" ] || [ -z "$OBJECTIVE" ]; then
  echo "Usage: ./generate-cycle.sh --number XX --name \"Name\" --objective \"Objective\" --tasks \"task1|task2\""
  exit 1
fi

# Pad cycle number
CYCLE_NUM=$(printf "%02d" $((10#$CYCLE_NUM)))
CYCLE_FILE=".ralph/cycles/cycle-${CYCLE_NUM}.md"
mkdir -p .ralph/cycles

# Parse tasks (pipe-separated)
IFS='|' read -ra TASK_ARRAY <<< "$TASKS"

# Build prerequisites section
if [ "$CYCLE_NUM" == "00" ]; then
  PREREQS="- [ ] Git repository initialized
- [ ] Run \`.ralph/scripts/verify-clean.sh\` - working tree must be clean"
else
  PREREQS="- [ ] Previous cycles completed and committed
- [ ] Run \`.ralph/scripts/verify-clean.sh\` - working tree must be clean
- [ ] All previous tests passing (\`pnpm test\`)"
fi

# Build next steps links
NEXT_CYCLE_LINK=""
PREV_CYCLE_LINK=""
if [ -n "$NEXT_CYCLE" ]; then
  NEXT_CYCLE_LINK="Proceed to next cycle: [Cycle $NEXT_CYCLE](cycle-$NEXT_CYCLE.md)"
fi
if [ -n "$PREV_CYCLE" ]; then
  PREV_CYCLE_LINK="- Previous Cycle: [Cycle $PREV_CYCLE](cycle-$PREV_CYCLE.md)"
fi

# Build visual testing section if frontend
VISUAL_SECTION=""
if [ "$FRONTEND" == "true" ]; then
  VISUAL_SECTION="
### 4️⃣ VISUAL Polish (This is a Frontend Cycle)
- Run \`/frontend-dev\` loop for visual convergence
- Compare against \`docs/FIGMA-BRIEF.md\`
- Iterate until design specs met
- All UI components match design specifications"
fi

# Generate the cycle document
cat > "$CYCLE_FILE" << EOF
# Cycle ${CYCLE_NUM}: ${CYCLE_NAME}

**Status:** ⏳ Pending
**Started:** [date]
**Completed:** [date]

---

## 🎯 Objective

${OBJECTIVE}

---

## 📋 Prerequisites

Before starting this cycle:

${PREREQS}

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
- Add JSDoc comments for public APIs${VISUAL_SECTION}

---

## 📝 Tasks

EOF

# Generate task sections
TASK_NUM=1
for task in "${TASK_ARRAY[@]}"; do
  cat >> "$CYCLE_FILE" << EOF
### Task ${TASK_NUM}: ${task}

#### 🔴 RED: Write Failing Tests

Write comprehensive tests that cover:
- Happy path functionality
- Edge cases and error handling
- Input validation
- Integration with other components

**Test files to create:**
- [ ] \`__tests__/[feature].test.ts\` - Unit tests
- [ ] \`__tests__/integration/[feature].test.ts\` - Integration tests (if applicable)

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
- [ ] Run \`pnpm lint --fix\` and fix any issues

---

EOF
  TASK_NUM=$((TASK_NUM + 1))
done

# Add completion criteria
cat >> "$CYCLE_FILE" << 'EOF'
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

EOF

# Add visual criteria if frontend
if [ "$FRONTEND" == "true" ]; then
  cat >> "$CYCLE_FILE" << 'EOF'
### Visual Validation
- [ ] Run `/frontend-dev` loop
- [ ] Achieve visual convergence with design specs
- [ ] UI matches `docs/FIGMA-BRIEF.md` specifications
- [ ] Responsive design works on mobile/tablet/desktop

EOF
fi

# Add remaining completion criteria
cat >> "$CYCLE_FILE" << EOF
### Documentation
- [ ] Update relevant docs if architecture changed
- [ ] Add JSDoc comments for public APIs
- [ ] Update this cycle doc with completion date

### Git
- [ ] All changes committed with descriptive message
- [ ] Commit message format: \`feat(cycle-${CYCLE_NUM}): [description]\`
- [ ] Working tree clean (\`.ralph/scripts/verify-clean.sh\` passes)

### Status Update
- [ ] Update \`.ralph/TASKS.md\` - move this cycle to "Completed"
- [ ] Update "Last Updated" date in \`TASKS.md\`
- [ ] Run \`.ralph/scripts/check-cycle.sh ${CYCLE_NUM}\` to verify

---

## 🚀 Next Steps

After completing this cycle:

1. Run \`.ralph/scripts/check-cycle.sh ${CYCLE_NUM}\` to validate completion
2. Update \`.ralph/TASKS.md\` status (move to ✅ Completed)
3. ${NEXT_CYCLE_LINK:-"This is the final cycle!"}

---

## 📚 References

- **PRD:** \`/docs/PRD.md\` - Complete product requirements
- **Design Spec:** \`/docs/FIGMA-BRIEF.md\` - UI/UX specifications
${PREV_CYCLE_LINK}
$([ -n "$NEXT_CYCLE" ] && echo "- Next Cycle: [Cycle $NEXT_CYCLE](cycle-$NEXT_CYCLE.md)")

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

EOF

echo "✅ Generated: $CYCLE_FILE"
EOF

chmod +x .ralph/scripts/generate-cycle.sh
echo "✅ Created enhanced generation script"
