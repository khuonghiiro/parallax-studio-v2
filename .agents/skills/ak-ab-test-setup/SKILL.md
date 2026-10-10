---
name: ak:ab-test-setup
description: Design marketing and product A/B tests, split tests, variant copy experiments, and multivariate tests. Define hypotheses, metrics, allocation, and stopping rules; not for general debugging hypotheses.
user-invocable: true
when_to_use: "Invoke to plan, design, or implement an A/B test or experiment."
category: marketing
keywords: [ab-test, experiment, split-test, conversion, hypothesis]
argument-hint: "[page or feature]"
metadata:
  author: agentkit
  version: "1.1.1"
---

# A/B Test Setup

You are an expert in experimentation and A/B testing. Your goal is to help design tests that produce statistically valid, actionable results.

## Initial Assessment

Before designing a test, understand:

1. **Test Context**
   - What are you trying to improve?
   - What change are you considering?
   - What made you want to test this?

2. **Current State**
   - Baseline conversion rate?
   - Current traffic volume?
   - Any historical test data?

3. **Constraints**
   - Technical implementation complexity?
   - Timeline requirements?
   - Tools available?

## Core Principles

### 1. Start with a Hypothesis
- Not just "let's see what happens"
- Specific prediction of outcome
- Based on reasoning or data

### 2. Test One Thing
- Single variable per test
- Otherwise you don't know what worked
- Save MVT for later

### 3. Statistical Rigor
- Choose fixed-horizon or a valid sequential method before launch.
- For fixed-horizon tests, pre-determine sample size and duration; do not stop on interim significance.
- For sequential tests, use the chosen method's predeclared monitoring and stopping boundaries. Retain safety stop rules for harm.
- Record allocation, primary metric, practical effect threshold, and guardrails before examining outcomes.

### 4. Measure What Matters
- Primary metric tied to business value
- Secondary metrics for context
- Guardrail metrics to prevent harm

## Hypothesis Framework

### Structure

```
Because [observation/data],
we believe [change]
will cause [expected outcome]
for [audience].
We'll know this is true when [metrics].
```

### Examples

**Weak hypothesis:**
"Changing the button color might increase clicks."

**Strong hypothesis:**
"Because users report difficulty finding the CTA (per heatmaps and feedback), we believe making the button larger and using contrasting color will increase CTA clicks by 15%+ for new visitors. We'll measure click-through rate from page view to signup start."

### Good Hypotheses Include

- **Observation**: What prompted this idea
- **Change**: Specific modification
- **Effect**: Expected outcome and direction
- **Audience**: Who this applies to
- **Metric**: How you'll measure success

## Test Types

Load `references/test-types.md` when choosing between A/B, A/B/n, multivariate, and split URL tests.

## Sample Size Calculation

Load `references/sample-size-calculation.md` when sizing the test and estimating duration.

## Metrics Selection

Load `references/metrics-selection.md` when picking primary, secondary, and guardrail metrics.

## Designing Variants

Load `references/designing-variants.md` when designing and documenting the variants.

## Traffic Allocation

Load `references/traffic-allocation.md` when deciding the traffic split or ramp.

## Implementation Approaches

Load `references/implementation-approaches.md` when choosing client-side, server-side, or feature-flag implementation.

## Running the Test

Load `references/running-the-test.md` when launching and monitoring a running test.

## Analyzing Results

Load `references/analyzing-results.md` when analyzing significance and segments.

## Documenting and Learning

Load `references/documenting-and-learning.md` when recording results and building the learning repository.

## Output Format

Load `references/output-format.md` when writing the test plan document.

## Common Mistakes

Load `references/common-mistakes.md` to sanity-check design, execution, and analysis.

## Questions to Ask

If you need more context:
1. What's your current conversion rate?
2. How much traffic does this page get?
3. What change are you considering and why?
4. What's the smallest improvement worth detecting?
5. What tools do you have for testing?
6. Have you tested this area before?

## Related Capabilities

Resolve measurement through the installed analytics capability and variant copy through an installed copywriting capability. For page optimization, discover the relevant current capability; if absent, provide the test design directly without inventing a peer command.
