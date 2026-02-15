---
name: creating-skills
description: Guide for creating new Agent Skills when patterns emerge or improvements are needed. Use when encountering repeated patterns, making the same mistakes, discovering better approaches, or receiving user corrections.
---

# Creating Skills

Recognize when new skills would be valuable and create them. Follow the [Agent Skills specification](https://agentskills.io).

## When to Create a New Skill

- **Repeated patterns**: Same pattern explained multiple times
- **Mistakes**: Same error repeatedly
- **User corrections**: "Do it this way, not that way"
- **Better approaches**: More effective pattern discovered
- **Domain knowledge**: Specialized context not already captured

## Skill Structure

```
.cursor/skills/
└── skill-name/
    ├── SKILL.md          # Required
    ├── scripts/          # Optional
    ├── references/       # Optional
    └── assets/           # Optional
```

## SKILL.md Format

YAML frontmatter + Markdown body.

### Required Frontmatter

```yaml
---
name: skill-name
description: What the skill does and when to use it. Use when [triggers].
---
```

### Name (Required)

- 1–64 chars, lowercase alphanumeric and hyphens only
- Must match the parent directory name
- No leading/trailing hyphens, no consecutive hyphens

### Description (Required)

- 1–1024 chars
- Third person; describe WHAT and WHEN
- Include trigger keywords for discovery

### Body Template

```markdown
# Skill Title
## When to Use
[Trigger scenarios]
## Instructions
[Concise, actionable steps]
## Examples
[Concrete examples]
```

## Best Practices

- Keep SKILL.md under ~500 lines; move details to `references/`
- Be concise; only add context the agent doesn’t already have
- One concept per skill
- Update or remove when patterns evolve
