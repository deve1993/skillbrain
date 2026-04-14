---
name: executing-plans
description: >
  Use when you have a written implementation plan to execute in a separate session with review checkpoints.
  Triggers on: "execute the plan", "implement the tasks", "start building", any plan execution request.
  Loads plan, reviews critically, executes tasks in batches with checkpoints.
version: 1.0.0
---

# Executing Plans

## Overview

Load plan, review critically, execute tasks in batches, report for review between batches.

**Core principle:** Batch execution with checkpoints for architect review.

**Announce at start:** "I'm using the executing-plans skill to implement this plan."

## The Process

### Step 1: Load and Review Plan
1. Read plan file
2. Review critically - identify any questions or concerns about the plan
3. If concerns: Raise them with your human partner before starting
4. If no concerns: Create TodoWrite and proceed

### Step 2: Execute Batch
**Default: First 3 tasks**

For each task:
1. Mark as in_progress
2. Follow each step exactly (plan has bite-sized steps)
3. Run verifications as specified
4. Mark as completed

### Step 3: Report
When batch complete:
- Show what was implemented
- Show verification output
- Say: "Ready for feedback."

### Step 4: Continue
Based on feedback:
- Apply changes if needed
- Execute next batch
- Repeat until complete

### Step 5: Complete Development

After all tasks complete and verified:
- Announce: "I'm using the finishing-a-development-branch skill to complete this work."
- **REQUIRED SUB-SKILL:** Use superpowers:finishing-a-development-branch
- Follow that skill to verify tests, present options, execute choice

## When to Stop and Ask for Help

**STOP executing immediately when:**
- Hit a blocker mid-batch (missing dependency, test fails, instruction unclear)
- Plan has critical gaps preventing starting
- You don't understand an instruction
- Verification fails repeatedly

**Ask for clarification rather than guessing.**

## When to Revisit Earlier Steps

**Return to Review (Step 1) when:**
- Partner updates the plan based on your feedback
- Fundamental approach needs rethinking

**Don't force through blockers** - stop and ask.

## Remember
- Review plan critically first
- Follow plan steps exactly
- Don't skip verifications
- Reference skills when plan says to
- Between batches: just report and wait
- Stop when blocked, don't guess
- Never start implementation on main/master branch without explicit user consent

## Integration

**Required workflow skills:**
- **superpowers:using-git-worktrees** - REQUIRED: Set up isolated workspace before starting
- **superpowers:writing-plans** - Creates the plan this skill executes
- **superpowers:finishing-a-development-branch** - Complete development after all tasks

## Examples

### Example 1: Batch Execution
Plan: 6 tasks for dark mode feature
Batch 1: Tasks 1-3 (toggle component, context, CSS)
Checkpoint: Review, feedback
Batch 2: Tasks 4-6 (test, documentation, cleanup)
Checkpoint: Final review, merge

### Example 2: Blocker Handling
Task 3: "Add theme context" fails because dependency missing
Action: STOP, ask for clarification
Don't: Guess and continue
Result: Get help, resume from Task 3

### Example 3: Plan Revision
Batch 1 complete, feedback: "Need to support system preference"
Action: Return to Step 1 (Review), update plan
Continue: Execute revised plan from Task 4

## Troubleshooting

### Issue: Hit a blocker mid-batch
Solution: STOP immediately. Ask for clarification. Don't guess or skip the task.

### Issue: Plan has gaps or unclear instructions
Solution: Raise concerns in Step 1 (Review). Don't proceed until clarified.

### Issue: Verification fails repeatedly
Solution: STOP. Ask for help. Don't attempt workarounds or skip verification.
