# Autonomous TDD Development Loop

You are in an autonomous Test-Driven Development loop. Your goal is to complete all tasks in `.ralph/TASKS.md`.

## Workflow (Follow This Order STRICTLY):

### For Each Task:

1. **Read `.ralph/TASKS.md`**
   - Find the FIRST unchecked task: `- [ ] Task name`
   - If all tasks are `- [x]`, proceed to Exit Criteria

2. **Write Test First** (if it's a feature/fix task)
   - Create or update test file
   - Test should FAIL initially (RED phase)
   - Run: `npm test` to verify test fails
   - Commit test: `git add . && git commit -m "test: [brief description]"`

3. **Implement Feature**
   - Write minimal code to make test pass (GREEN phase)
   - Run: `npm test` repeatedly until all tests pass
   - If tests fail, fix and re-run

4. **Commit Implementation**
   - `git add . && git commit -m "feat: [brief description]"`
   - **VERIFY**: `git status` must show "working tree clean"
   - If not clean, commit remaining changes immediately

5. **Mark Task Complete**
   - Edit `.ralph/TASKS.md`: change `- [ ]` to `- [x]` for completed task
   - Commit: `git add .ralph/TASKS.md && git commit -m "chore: mark task complete"`

6. **Validate Before Next Task**
   ```bash
   npm test        # Must pass
   git status      # Must be clean
   ```

## CRITICAL RULES:

- ✅ **NEVER skip commits** - commit after test, after implementation, after marking task complete
- ✅ **ALWAYS verify `git status`** shows "working tree clean" after commits
- ✅ **ALWAYS run tests** before moving to next task
- ✅ **Write tests BEFORE implementation** (TDD Red-Green cycle)
- ✅ **Work on ONE task at a time** - no parallel work
- ❌ **NEVER mark a task complete** if tests fail
- ❌ **NEVER move to next task** with uncommitted changes

## Validation Commands:

```bash
# After each task, run these:
npm test                    # All tests must pass
git status                  # Must show "working tree clean"
cat .ralph/TASKS.md         # Check progress
```

## When You Get Stuck:

- Read test failure output carefully
- Check `git status` for uncommitted work
- Re-read the current task description
- Don't skip validation steps

## Exit Criteria:

Check ALL of these before outputting RALPH_DONE:

1. All tasks in `.ralph/TASKS.md` are marked `- [x]`
2. Run `npm test` - all tests pass
3. Run `git status` - shows "working tree clean"
4. Run `git log --oneline -5` - verify recent commits exist
5. No uncommitted files or changes

**When ALL criteria are met**, output exactly:

```
RALPH_DONE
```

## Notes:

- Read `.ralph/TASKS.md` fresh each iteration (it may have been updated)
- Commit messages should be clear and descriptive
- If a task doesn't need a test (e.g., "Initialize project"), skip step 2
- Keep commits atomic and focused on one change
