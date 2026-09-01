# Skills

This page is for operators deciding which skills to enable and for anyone wondering what a Kasie "skill" actually is. Straight answer up front: skills are prompt presets, not plugins. They change what the agent is told about itself; they do not install code, tools, or permissions.

## What enabling a skill does

Each skill is a short label and description defined in `src/lib/skills/catalog.ts`. When you enable one in the dashboard, its ID is stored in the `enabled_skill_ids` column of `kasie_project_config`, and on every run `buildSkillPromptSection` in `src/lib/agents/system-prompt.ts` appends a section like this to the agent's system prompt (the standing instructions the model receives before your message):

```
Enabled skill presets:
- Incident triage: Summarize alerts and suggest next steps
- Weekly digest: Summarize team activity across channels and tools
Use these capabilities when relevant.
```

That is the whole mechanism. It nudges the model toward those behaviors and makes them discoverable. It does not grant access to anything: the agent's actual capabilities come from connected [Integrations](12-integrations.md) and from [Memory](15-memory.md). Enabling "Code review" without a connected GitHub account gives you an agent that talks about code review but cannot fetch a pull request.

Skill settings are per project (per workspace), so each tenant on a shared install tunes its own set. Unknown IDs are filtered out on save (`sanitizeEnabledSkillIds`), so the stored list always matches the catalog.

## The nine toggleable skills

| ID | Label | What it steers the agent toward |
|---|---|---|
| `release-notes` | Release notes | Draft weekly release summaries |
| `incident-triage` | Incident triage | Summarize alerts and suggest next steps |
| `standup-summary` | Standup summary | Compile recent activity into a daily standup update |
| `status-updates` | Status updates | Draft stakeholder and client progress reports |
| `meeting-prep` | Meeting prep | Brief on context before meetings from recent threads |
| `documentation` | Documentation | Turn decisions and threads into docs or runbooks |
| `code-review` | Code review | Summarize PRs, flag risks, and suggest review focus |
| `research-brief` | Research brief | Synthesize information on a topic from connected tools |
| `weekly-digest` | Weekly digest | Summarize team activity across channels and tools |

## The two "core" skill IDs

Two always-on capabilities are baked into Kasie's core and are not skills you can toggle: knowledge retrieval is real because memory retrieval runs on every run regardless of skills, and platform ops is a label for behavior that lives in the orchestrator. Neither adds prompt text or a separate code path, so do not expect a switch for either.

## Skills pair with scheduled task templates

Six of the nine skills double as one-click templates for recurring tasks (`src/app/dashboard/(workspace)/tasks/templates.ts`). Picking a template on the Tasks page creates a row in `kasie_schedules` with a ready-made prompt and a default cron expression (a five-field schedule string: minute, hour, day of month, month, day of week):

| Template | Default cron | Meaning |
|---|---|---|
| Standup summary | `0 9 * * 1-5` | Weekdays at 09:00 |
| Weekly digest | `0 16 * * 5` | Fridays at 16:00 |
| Release notes | `0 9 * * 0` | Sundays at 09:00 |
| Meeting prep | `0 8 * * 1-5` | Weekdays at 08:00 |
| Status updates | `0 9 * * 1` | Mondays at 09:00 |
| Incident triage | `0 */6 * * *` | Every 6 hours |

Each schedule has its own timezone (default UTC), delivery channel (a Slack channel ID, or a DM to the org owner when unset), and enabled flag. Schedules fire via the worker tick or the cron heartbeat; if templates you created never run, see the scheduled-tasks section of [Troubleshooting](16-troubleshooting.md).

Enabling a skill does not create its schedule, and a schedule works even if the matching skill is off; the template prompt carries the instructions either way. Enabling the skill as well keeps the agent primed for the same behavior in ad-hoc conversation.

## Practical guidance

- Enable the two or three skills that match your team's rhythm rather than all nine; a shorter system prompt keeps the agent focused.
- Skills and workspace instructions (free-form text in the same config) compose: use instructions for tone and team-specific facts, skills for recurring output shapes.
- Custom skills are not supported yet: the catalog is fixed in code. Adding one today means editing `SKILL_PRESETS` in `src/lib/skills/catalog.ts` and redeploying.
