Get the current status of a marketing campaign.

<campaign_name>$ARGUMENTS</campaign_name>

## Workflow

1. **Locate Campaign**
   - Resolve the campaign location from the current project and brief; use existing files and receipts.
   - If no name provided, list all active campaigns

2. **Gather Status**
   - Read campaign brief and timeline
   - Check milestone completion
   - Read recorded metrics with their timestamp; retrieve fresh metrics only when requested and authorized. Missing metrics remain unknown.

3. **Generate Report**
   - Campaign overview and goals
   - Progress against milestones
   - Key metrics and KPIs
   - Blockers and next steps

## Scope

Answer status directly from evidence. Do not launch analysis, change budgets, or publish as part of a status request.

## Output
- Status displayed in terminal
- Optional detailed report to `reports/`

## Examples
```
/campaign/status "Q1 Product Launch"
/campaign/status
```
