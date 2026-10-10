---
name: ak:marketing-research
description: Research market trends, competitors, audience insights, customer personas, and marketing best practices. Use before marketing-planning for data-driven strategy.
user-invocable: true
when_to_use: "Invoke to research markets, competitors, audiences, and customer personas."
category: marketing
keywords: [research, market, audience, personas, competitors]
argument-hint: "[topic or market]"
license: MIT
metadata:
  author: agentkit
  version: "1.0.3"
---

# Marketing Research

Produce evidence that supports a marketing decision: market, audience, competitor, channel, or campaign analysis. Reuse relevant research and the accepted brief before searching again.

## Scope and Evidence

Define the decision, target segment, geography, period, comparison set, and requested deliverable. Record the user's time, source, or call budget when supplied. Ask only for a gap that materially changes the research.

Search market participants' primary sources, product/pricing pages, public statistics, customer evidence, and relevant studies. Prefer original evidence over repeated summaries. Use current runtime search or authorized account capabilities; do not assume private research databases or campaign access. Technical/API documentation is relevant only when the marketing question depends on it.

For each consequential claim, record source, publication/retrieval date, geography, population/sample, method, and limitation where available. Distinguish company claims, independent findings, estimates, and your inferences. Missing measurements stay unknown; never fabricate market size, benchmarks, or performance.

## Research Loop

1. Map the requested decisions to evidence already available and remaining gaps.
2. Retrieve targeted sources for the most consequential gaps; parallelize independent reads when supported.
3. Cross-check contested or high-impact claims and preserve disagreement. Do not count multiple articles repeating one source as independent confirmation.
4. Stop when the requested questions have adequate evidence, further retrieval is unlikely to change the recommendation, or the user's budget is reached. Report uncovered gaps honestly; no fixed number of searches guarantees coverage.
5. Synthesize practical options, costs, prerequisites, risks, and a testable next step. Separate recommendations from authorization to run campaigns.

## Report

Use the requested report path, active plan reporting convention, or the project's established location. Include only sections relevant to the question:

- Decision summary and recommended action.
- Scope: audience, market/geography, period, method, and sources inspected.
- Market and audience findings: needs, behavior, demand evidence, and uncertainty.
- Competitor comparison: sourced positioning, features, pricing, and verified differences.
- Channel implications: reach, intent, cost/measurement assumptions, and constraints.
- Evidence gaps and conflicting sources, including what would change the recommendation.
- Proposed experiments or next actions, with success criteria and source links.

Verify every numerical and factual claim against the cited evidence. Include the research date, preserve source links, and distinguish observed facts from hypotheses. Finish with the actual report path and unresolved questions.
