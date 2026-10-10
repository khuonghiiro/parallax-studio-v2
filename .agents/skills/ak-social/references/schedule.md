Create a social media schedule for optimal posting times.

> **For actually scheduling a post via a provider (Postiz, Buffer,
> Post Bridge, Typefully, Zernio, Publer), use
> [`publish.md`](publish.md) — it runs `scripts/publish-post.js`
> against the adapter interface and takes a `--schedule <iso>` flag.
> This document covers *calendar generation* (weekly/monthly plans),
> which is a separate, non-network step.**

<period>$ARGUMENTS</period>

## Periods
- `week` - Weekly schedule
- `month` - Monthly content calendar
- `campaign [name]` - Campaign-specific schedule

## Workflow

1. **Gather Content**
   - Scan `content/social/` for pending posts
   - If empty, ask user for content topics

2. **Timing Analysis**
   - Use `social-media-manager` agent for optimal times
   - Activate `social` skill for platform data
   - Consider:
     - Platform peak hours
     - Audience timezone
     - Content type best times

3. **Create Schedule**
   - Distribute content across period
   - Balance platform coverage
   - Avoid posting conflicts
   - Generate calendar view

4. **Output**
   - Schedule → `assets/posts/schedule-{period}.md`
   - Calendar export (if needed)

## Agents Used
- `social-media-manager` - Scheduling strategy

## Skills Used
- `social` - Platform timing data
- `assets-organizing` - Standardized output paths

## Output
- Schedule → `assets/posts/schedule-{period}.md`
- Calendar → `assets/posts/calendar-{period}.md`

## Examples
```
/social/schedule week
/social/schedule month
/social/schedule campaign "Product Launch"
```
