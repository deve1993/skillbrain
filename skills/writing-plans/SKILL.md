---
name: writing-plans
description: >
  Use when you have a spec or requirements for a multi-step task, before touching code.
  Triggers on: "create a plan", "write implementation steps", "break down the task", any planning request.
  Creates comprehensive implementation plans with bite-sized tasks and exact file paths.
version: 1.0.0
user-invocable: true
argument-hint: "descrivi il task da pianificare"
---

# Writing Plans

## Overview

Write comprehensive implementation plans assuming the engineer has zero context for our codebase and questionable taste. Document everything they need to know: which files to touch for each task, code, testing, docs they might need to check, how to test it. Give them the whole plan as bite-sized tasks. DRY. YAGNI. TDD. Frequent commits.

Assume they are a skilled developer, but know almost nothing about our toolset or problem domain. Assume they don't know good test design very well.

**Announce at start:** "I'm using the writing-plans skill to create the implementation plan."

**Context:** This should be run in a dedicated worktree (created by brainstorming skill).

**Save plans to:** `docs/plans/YYYY-MM-DD-<feature-name>.md`

## Bite-Sized Task Granularity

**Each step is one action (2-5 minutes):**
- "Write the failing test" - step
- "Run it to make sure it fails" - step
- "Implement the minimal code to make the test pass" - step
- "Run the tests and make sure they pass" - step
- "Commit" - step

## Plan Document Header

**Every plan MUST start with this header:**

```markdown
# [Feature Name] Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** [One sentence describing what this builds]

**Architecture:** [2-3 sentences about approach]

**Tech Stack:** [Key technologies/libraries]

---
```

## Task Structure

````markdown
### Task N: [Component Name]

**Files:**
- Create: `exact/path/to/file.py`
- Modify: `exact/path/to/existing.py:123-145`
- Test: `tests/exact/path/to/test.py`

**Step 1: Write the failing test**

```python
def test_specific_behavior():
    result = function(input)
    assert result == expected
```

**Step 2: Run test to verify it fails**

Run: `pytest tests/path/test.py::test_name -v`
Expected: FAIL with "function not defined"

**Step 3: Write minimal implementation**

```python
def function(input):
    return expected
```

**Step 4: Run test to verify it passes**

Run: `pytest tests/path/test.py::test_name -v`
Expected: PASS

**Step 5: Commit**

```bash
git add tests/path/test.py src/path/file.py
git commit -m "feat: add specific feature"
```
````

## Remember
- Exact file paths always
- Complete code in plan (not "add validation")
- Exact commands with expected output
- Reference relevant skills with @ syntax
- DRY, YAGNI, TDD, frequent commits

## Execution Handoff

After saving the plan, offer execution choice:

**"Plan complete and saved to `docs/plans/<filename>.md`. Two execution options:**

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

**Which approach?"**

**If Subagent-Driven chosen:**
- **REQUIRED SUB-SKILL:** Use superpowers:subagent-driven-development
- Stay in this session
- Fresh subagent per task + code review

**If Parallel Session chosen:**
- Guide them to open new session in worktree
- **REQUIRED SUB-SKILL:** New session uses superpowers:executing-plans

## Examples

### Example 1: Simple Feature Plan
Feature: "Add dark mode toggle"
Plan structure: 1. Create toggle component, 2. Add theme context, 3. Update CSS variables, 4. Test all pages
Output: 4-task plan with exact file paths and code snippets

### Example 2: Complex Feature Plan
Feature: "Implement user authentication"
Plan structure: 1. Database schema, 2. Auth API endpoints, 3. Login form, 4. Session management, 5. Protected routes, 6. Tests
Output: 6-task plan with dependencies and integration points

### Example 3: Refactoring Plan
Feature: "Reorganize component folder structure"
Plan structure: 1. Create new structure, 2. Move files, 3. Update imports, 4. Run tests, 5. Delete old folders
Output: 5-task plan with exact mv commands and import patterns

## Troubleshooting

### Issue: Plan seems too detailed
Solution: Bite-sized tasks are intentional. Each step should take 2-5 minutes. This prevents context loss and enables parallel execution.

### Issue: Plan is missing dependencies
Solution: Add explicit "depends on Task X" notes. Clarify which tasks can run in parallel vs sequentially.

### Issue: Code examples in plan are incomplete
Solution: Complete code is required. Don't write "add validation" — write the exact validation code. Implementer should copy-paste, not guess.
