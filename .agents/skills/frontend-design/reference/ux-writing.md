# UX Writing

## The Button Label Problem

**Never use "OK", "Submit", "Yes/No", or "Click here".** Use specific verb + object patterns:

| Bad | Good | Why |
|-----|------|-----|
| OK | Save changes | Says what will happen |
| Submit | Create account | Outcome-focused |
| Yes | Delete message | Confirms the action |
| No | Cancel | Clear |
| Cancel | Keep editing | Clarifies what "cancel" means |
| Click here | Download report | Describes the destination |

**For destructive actions**, name the destruction:
- "Delete" not "Remove" (delete is permanent, remove implies recoverable)
- "Delete 5 items" not "Delete selected" (show the count)
- Button pair: "Delete project" / "Keep project" — not "Yes" / "No"

---

## Error Messages: The Formula

Every error message answers: **(1) What happened? (2) Why? (3) How to fix it?**

| Situation | Template |
|-----------|----------|
| **Format error** | "[Field] needs to be [format]. Example: [example]" |
| **Missing required** | "Please enter [what's missing]" |
| **Permission denied** | "You don't have access to [thing]. [What to do instead]" |
| **Network error** | "We couldn't reach [thing]. Check your connection and try again." |
| **Server error** | "Something went wrong on our end. We're looking into it. [Alternative action]" |

**Never blame the user:**
- ❌ "You entered an invalid date"
- ✅ "Please enter a date in DD/MM/YYYY format"

**Never use humor for errors.** Users are frustrated. Be helpful, not clever.

---

## Empty States Are Opportunities

Empty states are onboarding moments:
1. Acknowledge briefly
2. Explain the value of filling it
3. Provide a clear action

```
No projects yet.
Create your first project to start tracking work.
[Create project]
```

Not just: "No items found."

---

## Voice vs Tone

**Voice** = brand personality, consistent everywhere.
**Tone** = adapts to the moment.

| Moment | Tone Shift |
|--------|------------|
| Success | Celebratory, brief: "Done! Your changes are live." |
| Error | Empathetic, helpful: "That didn't work. Here's what to try..." |
| Loading | Reassuring: "Saving your work..." |
| Destructive confirm | Serious, clear: "Delete this project? This can't be undone." |
| First use | Welcoming, helpful: Guide them to value immediately |

---

## Writing for Accessibility

- **Link text**: Standalone meaning — "View pricing plans" not "Click here"
- **Alt text**: Describes information, not the image — "Revenue increased 40% in Q4" not "Chart"
- **Decorative images**: Use `alt=""`
- **Icon buttons**: Need `aria-label` — `<button aria-label="Close dialog">`
- **Form fields**: `aria-describedby` connects fields to error messages

---

## Writing for i18n

### Plan for Text Expansion

| Language | Expansion vs English |
|----------|---------------------|
| German | +30% |
| French | +20% |
| Finnish | +30–40% |
| Chinese | −30% (fewer chars, similar visual weight) |

### Translation-Friendly Patterns

```jsx
// Good — numbers separate from text
"New messages: {count}"

// Bad — word order varies by language
"You have {count} new messages"

// Good — full sentence as single string
t('welcomeBack', { name: 'Alex' })
// → "Welcome back, Alex!" / "Bentornato, Alex!"

// Bad — concatenation breaks translation
"Welcome back, " + name + "!"
```

**Give translators context**: Where does this string appear? What's the character limit?

---

## Terminology Consistency

Pick one term and stick with it:

| Inconsistent | Consistent |
|--------------|------------|
| Delete / Remove / Trash | Delete |
| Settings / Preferences / Options | Settings |
| Sign in / Log in / Enter | Sign in |
| Create / Add / New | Create |

Build a terminology glossary and enforce it across the entire product.

---

## Avoid Redundant Copy

If the heading explains it, the intro paragraph is redundant.
If the button is self-explanatory, don't explain it in the label.
Say it once. Say it well.

---

## Loading State Copy

Be specific, not generic:

| Generic (Bad) | Specific (Good) |
|---------------|-----------------|
| Loading... | Saving your draft... |
| Please wait | Analyzing results (this usually takes 30 seconds) |
| Processing | Sending your message... |

For long operations, set expectations with duration or progress.

---

**Avoid**: Jargon without explanation. Blaming users in errors. Vague errors ("Something went
wrong"). Varying terminology for variety. Humor for errors. Placeholder text as form labels.
