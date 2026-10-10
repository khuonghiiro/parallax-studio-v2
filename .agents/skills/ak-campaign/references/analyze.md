Analyze marketing campaign performance with insights and recommendations.

<campaign_name>$ARGUMENTS</campaign_name>

## Workflow

1. **Gather Data**
   - Resolve the named campaign's actual configuration and recorded receipts.
   - Use supplied metrics or a discovered authorized account connector; a generic MCP capability is not proof of analytics access.
   - Record source, period, timezone, attribution, and missingness. Work directly or resolve an available specialist when useful.

2. **Performance Analysis**
   - Use `campaign-debugger` agent for issue identification
   - Analyze conversion funnel
   - Compare against benchmarks
   - Identify top/bottom performers

3. **Generate Insights**
   - Use `funnel-architect` agent for optimization suggestions
   - Calculate ROI and attribution
   - Identify improvement opportunities

4. **Create Report**
   - Executive summary
   - Detailed metrics breakdown
   - Actionable recommendations
   - Output to `reports/campaign-analysis-{date}-{name}.md`

## Agents Used
- `analytics-analyst` - Performance data
- `campaign-debugger` - Issue diagnosis
- `funnel-architect` - Optimization

## Skills Used
- `analytics` - Metrics frameworks
- `campaign` - Analysis templates
- `assets-organizing` - Standardized output paths

## MCP Integrations
- GA4 - Traffic and conversion data
- Google Ads - Ad performance

## Output
- Analysis report → `assets/diagnostics/campaign-audits/{date}-{name}.md`

## Examples
```
/campaign/analyze "Q1 Product Launch"
/campaign/analyze "Black Friday Sale"
```
