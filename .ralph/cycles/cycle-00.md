# Cycle 00: Architecture & Testing Patterns

**Status:** ⏳ Pending
**Started:** [date]
**Completed:** [date]

---

## 🎯 Objective

Establish testing philosophy, architectural patterns, and decision-making framework. This cycle creates the foundation for all future development by defining how we write testable code, structure dependencies, and make technical decisions. No code is written yet - this is pure documentation and decision-making.

---

## 📋 Prerequisites

Before starting this cycle:

- [ ] Git repository initialized
- [ ] Run `.ralph/scripts/verify-clean.sh` - working tree must be clean

---

## 📐 Documentation-Focused Cycle

**Note:** Cycle 00 is foundational architecture and documentation. While it doesn't produce user-facing code, it establishes patterns that ALL future cycles will follow. Think of this as creating the "playbook" for development.

### Deliverables Format
Each task will produce one or more documentation files that guide future implementation:
- **Pattern Guides:** How to structure code
- **Decision Records:** Why we made certain technical choices
- **Examples:** Reference implementations (no actual feature code yet)
- **Templates:** Reusable structures for future cycles

---

## 📝 Tasks

### Task 1: Document Testing Philosophy & Test Pyramid

Create comprehensive testing documentation based on PRD requirements (TDD mandatory, 80% coverage, integration tests > unit tests, Vitest + Testing Library + Playwright).

**Deliverables:**
- [ ] `docs/TESTING-PHILOSOPHY.md` - Complete testing strategy document including:
  - Overview of mandatory TDD approach
  - Test pyramid structure (Unit : Integration : E2E ratio)
  - When to use Vitest vs Testing Library vs Playwright
  - Coverage requirements (80% minimum)
  - Test naming conventions
  - Example test structure

- [ ] `docs/TEST-PYRAMID-BREAKDOWN.md` - Visual guide:
  - Test types breakdown with examples
  - Integration-first philosophy explanation
  - Why no mocking (explained)
  - Fake implementation approach

**Context from PRD:**
- TDD is mandatory (80% coverage)
- Integration tests > unit tests (per "Testing Strategy")
- Vitest + Testing Library + Playwright
- In-memory SQLite for test DB
- No mocking - use fake implementations

---

### Task 2: Define Dependency Injection Pattern (Factory Functions)

Document the factory function pattern for dependency injection (NOT Awilix container). This pattern enables testability without mocking.

**Deliverables:**
- [ ] `docs/DI-PATTERN.md` - Dependency Injection guide:
  - Factory function pattern explanation
  - Why NOT Awilix (per PRD decision)
  - How to structure service factories
  - Parameter passing strategy
  - Example: email service factory, unifi client factory

- [ ] `docs/DI-EXAMPLES.ts` - Reference code:
  - Example email service factory
  - Example unifi client factory
  - Example database service factory
  - How to use factories in API handlers
  - How to use factories in tests (with fake implementations)

**Context from PRD:**
- Use factory functions for DI (not Awilix)
- Enables passing fake implementations in tests
- Services accept their dependencies as constructor params

---

### Task 3: Document No-Mocking Strategy (Fake Implementations)

Explain the philosophy of using fake/stub implementations instead of mocking libraries (no Vitest mocks, no Jest mocks). This is a core architectural decision.

**Deliverables:**
- [ ] `docs/FAKE-IMPLEMENTATIONS.md` - Strategy guide:
  - Why NO mocking (philosophical justification)
  - Benefits: easier to maintain, closer to real behavior, clearer tests
  - What is a "fake" vs a "mock" vs a "stub"
  - How to structure fake implementations
  - When it's acceptable to use mocks (edge cases)

- [ ] `docs/FAKE-IMPL-PATTERNS.ts` - Reference implementations:
  - Fake email service (in-memory, returns success)
  - Fake unifi client (in-memory, tracks calls)
  - Fake database (in-memory SQLite for tests)
  - Pattern: how to make fakes testable
  - Pattern: how to verify fake was called with correct params

**Context from PRD:**
- No mocking - use fake implementations
- Integration tests > unit tests
- Fakes are real implementations that work locally

---

### Task 4: Create Architecture Decision Records (ADR) Template

Create a reusable ADR template for documenting significant architectural decisions. Future cycles will use this when making decisions.

**Deliverables:**
- [ ] `docs/ADR-TEMPLATE.md` - ADR template with sections:
  - Decision Title (one sentence)
  - Status (Proposed | Accepted | Deprecated | Superseded)
  - Context (what problem are we solving?)
  - Decision (what did we decide?)
  - Rationale (why this decision?)
  - Consequences (what are the implications?)
  - Alternatives Considered (why not them?)
  - Related ADRs (links to related decisions)

- [ ] `docs/ADR-000-factory-functions.md` - First ADR (example):
  - Title: "Use Factory Functions for Dependency Injection (not Awilix)"
  - Explains the DI pattern choice
  - References the PRD decision

- [ ] `docs/ADR-001-no-mocking.md` - Second ADR (example):
  - Title: "No Mocking - Use Fake Implementations"
  - Explains the testing philosophy
  - References the PRD decision

---

### Task 5: Define Service Layer Pattern

Document the service layer architecture that all business logic will follow. Services are where the core logic lives, separate from API handlers.

**Deliverables:**
- [ ] `docs/SERVICE-LAYER.md` - Architecture guide:
  - What is a service? (organized business logic)
  - Where services live (lib/services/)
  - Service structure (constructor with deps, public methods)
  - How services are tested (with fake deps)
  - Example services to build: GuestAuthService, UnifiService, EmailService

- [ ] `docs/SERVICE-STRUCTURE.ts` - Reference structure:
  - Example GuestAuthService with all dependencies
  - Example UnifiService for network operations
  - Pattern: how to structure a service
  - Pattern: how to handle errors in services
  - Pattern: how to test services (no mocks!)

**Context from PRD:**
- API handlers should delegate to services
- Services contain business logic
- Services are easier to test when dependencies are injected
- Makes code reusable across different handlers

---

### Task 6: Document Error Handling Strategy

Document how to handle errors consistently across the app. This aligns with PRD's "fail fast" philosophy for Unifi errors and clear error messages.

**Deliverables:**
- [ ] `docs/ERROR-HANDLING.md` - Strategy guide:
  - Error hierarchy (custom error classes)
  - Per PRD: "Fail fast on Unifi errors" - explain philosophy
  - HTTP error responses (400, 429, 503, etc.)
  - User-facing vs internal errors
  - Logging strategy for errors
  - Error recovery patterns

- [ ] `docs/ERROR-CLASSES.ts` - Error implementations:
  - Base AppError class
  - UnifiError (fail fast philosophy)
  - ValidationError (input validation)
  - RateLimitError (429 responses)
  - AuthError (authentication failures)
  - Pattern: how to use errors in services
  - Pattern: how to convert errors to HTTP responses

- [ ] `docs/ERROR-EXAMPLES.md` - Practical examples:
  - Example: Unifi API fails (fail fast immediately)
  - Example: Invalid email (validate early, return 400)
  - Example: Rate limit hit (return 429 with resetAt)
  - Example: Database error (log and return 500)

**Context from PRD:**
- "Fail fast on Unifi errors" (Section: Unifi Controller Integration)
- Clear error messages to users
- 503 for Unifi unavailable
- 429 for rate limiting
- 400 for validation failures

---

### Task 7: Create Code Organization Guidelines

Create comprehensive directory structure and file organization standards so all future code follows consistent patterns.

**Deliverables:**
- [ ] `docs/CODE-ORGANIZATION.md` - Full guide:
  - Directory structure (from PRD app/ layout, extended)
  - Where each type of code lives (services, tests, utilities)
  - Naming conventions (files, classes, functions)
  - When to extract to utils/lib
  - Import organization (standard imports first, relative second)
  - Comments and documentation standards

- [ ] `docs/FILE-STRUCTURE-TEMPLATE.txt` - Visual directory tree:
  - Complete structure showing all directories
  - Which directories are committed (not .gitignore)
  - Where test files live relative to source
  - New directories: lib/services/, lib/errors/, lib/factories/

- [ ] `docs/NAMING-CONVENTIONS.md` - Specific standards:
  - File naming (camelCase for utils, PascalCase for classes/services)
  - Function naming (verbs for commands: createUser, authorizeGuest)
  - Test file naming (*.test.ts, *.integration.test.ts, *.e2e.test.ts)
  - Constant naming (UPPER_SNAKE_CASE)
  - Type naming (PascalCase for interfaces/types)

**Context from PRD:**
- PRD already shows app/ structure (Section: System Architecture)
- We're adding lib/services/ for business logic
- Adding lib/errors/ for error classes
- Adding lib/factories/ for service creation

---

## ✅ Completion Criteria

Before marking this cycle complete:

### Documentation Deliverables
**All 7 tasks must produce their documented deliverables:**

- [ ] Task 1: `docs/TESTING-PHILOSOPHY.md` and `docs/TEST-PYRAMID-BREAKDOWN.md`
- [ ] Task 2: `docs/DI-PATTERN.md` and `docs/DI-EXAMPLES.ts`
- [ ] Task 3: `docs/FAKE-IMPLEMENTATIONS.md` and `docs/FAKE-IMPL-PATTERNS.ts`
- [ ] Task 4: `docs/ADR-TEMPLATE.md`, `docs/ADR-000-factory-functions.md`, `docs/ADR-001-no-mocking.md`
- [ ] Task 5: `docs/SERVICE-LAYER.md` and `docs/SERVICE-STRUCTURE.ts`
- [ ] Task 6: `docs/ERROR-HANDLING.md`, `docs/ERROR-CLASSES.ts`, `docs/ERROR-EXAMPLES.md`
- [ ] Task 7: `docs/CODE-ORGANIZATION.md`, `docs/FILE-STRUCTURE-TEMPLATE.txt`, `docs/NAMING-CONVENTIONS.md`

### Documentation Quality
- [ ] All docs are clear, comprehensive, and well-organized
- [ ] Examples are included where appropriate
- [ ] Docs reference the PRD where relevant
- [ ] Internal cross-references work correctly
- [ ] Markdown is properly formatted

### Code Quality (for example files)
- [ ] TypeScript files are syntactically correct (can be compiled)
- [ ] Examples follow the documented patterns
- [ ] Comments explain the "why" not just the "what"

### Git
- [ ] All documentation files committed with descriptive message
- [ ] Commit message format: `docs(cycle-00): [description]`
- [ ] Working tree clean (`.ralph/scripts/verify-clean.sh` passes)

### Status Update
- [ ] Update `.ralph/TASKS.md` - move this cycle to "Completed"
- [ ] Update "Last Updated" date in `TASKS.md`
- [ ] Run `.ralph/scripts/check-cycle.sh 00` to verify

---

## 🚀 Next Steps

After completing this cycle:

1. Run `.ralph/scripts/check-cycle.sh 00` to validate completion
2. Update `.ralph/TASKS.md` status (move to ✅ Completed)
3. Proceed to next cycle: [Cycle 01](cycle-01.md)

---

## 📚 References

- **PRD:** `/docs/PRD.md` - Complete product requirements
- **Design Spec:** `/docs/FIGMA-BRIEF.md` - UI/UX specifications

- Next Cycle: [Cycle 01](cycle-01.md)

---

## 🚨 Remember

**THIS CYCLE SETS THE FOUNDATION FOR ALL FUTURE WORK.**

- These documents will be referenced constantly in future cycles
- Be thorough and clear - ambiguity will cause rework later
- Include practical examples in documentation
- This is NOT feature work - focus on clarity and completeness
- Document the "why" not just the "what"
- Ralph: These decisions will shape the entire project's architecture!

---

## 📝 Notes

[Add any notes, learnings, or decisions made during this cycle]

