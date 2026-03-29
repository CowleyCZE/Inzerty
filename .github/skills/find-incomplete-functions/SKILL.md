---
name: find-incomplete-functions
description: "Use when: searching for incomplete, unfinished, or placeholder functions in the codebase. Scans workspace for TODO/FIXME comments, error stubs, empty implementations, unimplemented patterns, and returns organized results with file locations and context."
---

# SKILL: Find Incomplete Functions

Helps identify functions and implementations that are incomplete, placeholder, or need finishing in your codebase.

## When to Use

- **Finding work items**: Locate all unfinished functions to prioritize implementation tasks
- **Audit code completeness**: Identify technical debt and placeholder implementations
- **Code review**: Check for incomplete TODOs or stub methods before merging
- **Progress tracking**: See what's still pending across the workspace

## What This Skill Does

1. **Scans all workspace files** for patterns indicating incomplete functions
2. **Detects multiple indicators**:
   - TODO/FIXME comments (with context)
   - Throw statements used as placeholders
   - Empty function bodies (`{}`, `return;`, `return null`)
   - Unimplemented stubs
   - NotImplementedError patterns
3. **Organizes results** by file, function name, and pattern type
4. **Provides context** with line numbers and surrounding code

## How to Use This Skill

### Quick Scan — Find All Incomplete Functions

Ask the agent to scan your workspace:

```
Find all incomplete functions in the workspace using the "find-incomplete-functions" skill.
```

Expected output: List of all incomplete functions grouped by file.

### Targeted Scan — Specific Directory or Component

```
Use the find-incomplete-functions skill to find incomplete functions in the components/ directory.
```

### Filter by Pattern Type

```
Find all functions with TODO or FIXME comments using the incomplete-functions skill.
```

### Follow-up Actions

Once incomplete functions are identified, you can:

- **Review**: Ask agent to explain what each function should do
- **Implement**: Ask agent to implement the function based on context
- **Create task list**: Request a summary for your development roadmap
- **Generate templates**: Ask for code templates to help complete them

## Implementation Strategy

When the agent uses this skill, it should:

1. **Search comprehensively** for these patterns:
   ```
   - /TODO|FIXME|todo|fixme/i (case-insensitive comments)
   - throw new Error|throw Error (error stubs)
   - async function.*\{[\s]*\}|function.*\{[\s]*\} (empty bodies)
   - unimplemented!|not_implemented|NotImplementedError (explicit stubs)
   - /stub|placeholder|WIP|HACK/i (informal markers)
   ```

2. **Group results** by:
   - File path
   - Function/method name (if identifiable)
   - Pattern type
   - Line number

3. **Include context** for each match:
   - Surrounding code (2-3 lines before/after)
   - Full function signature if available
   - Comment content if present

4. **Prioritize output** by:
   - Severity (TODO < FIXME for comments)
   - File organization (frontend, then backend)
   - Line number sequence

## Example Output Format

```
📋 Incomplete Functions Found: 12 items

📄 components/NegotiationInterface.tsx
  ├─ Line 45: TODO - Complete auto-negotiation logic
  │  Pattern: TODO comment
  │  Context: const handleAutoNegotiate = async () => { // TODO: ...
  │
  └─ Line 89: (empty implementation)
     Pattern: Empty function body
     Context: function validateOffer() { }

📄 services/fraudDetection.ts
  ├─ Line 156: FIXME - Implement ML scoring
  │  Pattern: FIXME comment
  │  Context: const mlScore = () => { // FIXME: call ML model
  │
  └─ Line 203: throw new Error stub
     Pattern: Placeholder error
     Context: return scoreFraud() { throw new Error("not implemented"); }
```

## Related Workflows

- **Code Completion**: Once functions are identified, ask the agent to generate implementation suggestions
- **Task Management**: Export results to create a TODO list or task tracker
- **Code Review Checklist**: Use before PR to ensure no incomplete code is merged
- **Architecture Assessment**: Identify areas of development incompleteness

## Quick Tips

- **Refresh results**: Run the skill again to see what's been completed since the last run
- **Exclude patterns**: Ask agent to skip certain comment types if they're not true TODOs
- **Deep dive**: Request full function context for any suspicious matches
- **Export**: Ask for results as a JSON or markdown document for tracking
