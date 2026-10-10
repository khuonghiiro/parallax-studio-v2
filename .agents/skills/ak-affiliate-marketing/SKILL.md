---
name: ak:affiliate-marketing
description: Design and evaluate affiliate partner programs, commissions, KOL/KOC recruitment, attribution, and fraud controls. Use for partner-led acquisition; customer refer-a-friend programs belong to referral-program-building.
user-invocable: true
when_to_use: "Invoke to design or grow a SaaS affiliate program."
category: marketing
keywords: [affiliate, commission, partners, program, saas]
argument-hint: "[program or strategy]"
metadata:
  author: agentkit
  version: "1.0.1"
---

# Affiliate Marketing

Design sustainable partner acquisition programs from observed unit economics. Record margin, retention/LTV assumptions, refund windows, attribution rules, and allowed payback before choosing commissions. Benchmarks are not expected outcomes; distinguish supplied data, sourced comparisons, and test hypotheses.

## Quick Start

1. **Define Program** → Choose commission model matching business stage
2. **Select Platform** → Pick tool based on scale and integration needs
3. **Recruit Partners** → Identify KOL/KOC aligned with ICP
4. **Prevent Fraud** → Implement multi-layer protection
5. **Scale & Optimize** → Track KPIs, iterate on performance

## Commission Models

Illustrative structures only: calculate the rate and attribution window for this product.

| Model | Best For | Example Rate | Example Cookie |
|-------|----------|------|--------|
| Recurring | SaaS subscriptions | 20-30% | 90 days |
| One-time | High-ticket products | $50-200 | 60 days |
| Tiered | Scaling programs | 20→40% | 90 days |
| Hybrid | Top affiliates | Base + % | 120 days |

## Platform and Measurement Decisions

Compare supported billing integration, attribution, fraud controls, reporting, operating cost, and partner needs in `references/platform-selection.md`. Verify provider claims and current pricing before recommending a purchase; no platform is the default for every stage.

Report conversion, EPC, fully loaded CAC, partner retention, contribution profit, and program ROI for a defined cohort/window. Compare equivalent channels and include commission, refunds, incentives, platform fees, and support costs.

## References

### Strategy & Design
- [Program Structure](references/program-structure.md) - Commission models, tiering, cookie windows
- [Platform Selection](references/platform-selection.md) - FirstPromoter vs PartnerStack vs Rewardful

### Partner Recruitment
- [KOL/KOC Partnerships](references/kol-koc-partnerships.md) - Influencer identification, vetting, compensation
- [Outreach Templates](references/outreach-templates.md) - Cold emails, proposals, onboarding

### Operations
- [Fraud Prevention](references/fraud-prevention.md) - Detection, clawbacks, risk management
- [Compliance & Legal](references/compliance-legal.md) - FTC disclosure, GDPR, contracts
- [Case Studies](references/case-studies.md) - Dropbox, PayPal, Shopify, ConvertKit

## Choose the Program

- New program: select a commission model whose contribution margin supports the payback target; pilot with relevant partners.
- Scale: diagnose the constraint in activation, qualified traffic, conversion, retention, or economics before changing rates.
- Fraud: apply verified attribution, eligible events, refund holds, and clawbacks proportional to actual abuse.
- Partner outreach and payouts: prepare drafts and terms first; perform external actions only for the authorized recipients, accounts, and amounts.

## Report Output

**Activate:** `assets-organizing` skill for report file paths

Affiliate reports go to `assets/reports/performance/{date}-affiliate-program.md`

## Anti-Patterns

| Issue | Fix |
|-------|-----|
| Low participation | Diagnose partner fit, support, and economics before testing a sustainable incentive |
| High fraud rate | Implement 90-day hold + vetting |
| Inactive affiliates | Monthly check-ins + content support |
| Brand bidding | Explicit TOS prohibition + monitoring |
| Poor conversion | Provide better landing pages + training |
