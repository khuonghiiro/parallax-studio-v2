---
name: ak:referral-program-building
description: Build referral programs for SaaS/digital products. Covers reward structures (two-sided, tiered, multi-step), platform selection (Rewardful, ReferralCandy, Viral Loops, FirstPromoter), technical implementation (tracking, attribution, API patterns), fraud prevention, email templates, and KPI metrics. Use for designing viral growth loops, implementing refer-a-friend features, or optimizing existing referral systems.
user-invocable: true
when_to_use: "Invoke to build a referral program for a SaaS or digital product."
category: marketing
keywords: [referral, rewards, program, viral, saas]
argument-hint: "[product or program-type]"
metadata:
  author: agentkit
  version: "1.0.1"
---

# Referral Program Building

Design customer refer-a-friend programs; partner commissions belong to affiliate marketing. Size rewards against contribution margin, qualified referral value, refund exposure, and payback. Record event eligibility, attribution, deduplication, self-referral controls, and reward caps before launch.

## Quick Start

1. **Define Program Type** - Choose reward structure matching business model
2. **Select Platform** - Pick tool based on scale and integration needs
3. **Implement Tracking** - Set up attribution, fraud prevention, analytics
4. **Launch & Optimize** - Soft launch, measure KPIs, iterate

## Core Principles

- **Two-Sided Rewards:** Compare the incremental qualified referrals against the cost of rewarding both parties; improvement requires measurement.
- **Product Alignment:** Use product as reward when possible (Dropbox model)
- **Integration:** Embed in user workflow, not separate feature
- **Simplicity:** Explain in 2-3 bullet points or it's too complex

## References

### Strategy & Design
- [Reward Structures](references/reward-structures.md) - Incentive types, tiered rewards, real-world examples
- [Platform Selection](references/platform-selection.md) - Rewardful vs ReferralCandy vs Viral Loops comparison

### Implementation
- [Technical Guide](references/technical-implementation.md) - Database schema, API patterns, attribution
- [Fraud Prevention](references/fraud-prevention.md) - Detection mechanisms, validation rules

### Operations
- [Email Templates](references/email-templates.md) - Program intro, reminders, reward fulfillment
- [Metrics & KPIs](references/metrics-tracking.md) - Participation rate, ROI, CLV tracking

## Platform Quick Reference

Historical shortlist: verify current price, integration, and plan limits before recommending. No listed provider is assumed installed or authorized.

| Platform | Best For | Price | Setup |
|----------|----------|-------|-------|
| Rewardful | SaaS subscriptions | $49/mo | 1 hour |
| ReferralCandy | Ecommerce | $49/mo | 1-click |
| Viral Loops | Custom campaigns | Custom | Visual builder |
| FirstPromoter | Recurring commissions | Custom | Dashboard |
| Voucherify | Enterprise API-first | Custom | API integration |

## Measurement and Launch

Define eligible participation, qualified referral conversion, fully loaded CAC, retention/LTV cohorts, and contribution profit in a stated window. Compare equivalent cohorts; do not promise conversion or retention uplift before a test.

Use product-aligned rewards when valuable and economical, clear two-party messaging, and attribution with delayed fulfillment after a qualifying event. Test messaging and incentives against a baseline. Publishing invitations or fulfilling rewards requires the authorized audience, account, and reward budget; a plan is not a launched program.

## Report Output

**Activate:** `assets-organizing` skill for report file paths

Referral reports go to `assets/reports/performance/{date}-referral-program.md`
