---
name: ak:pricing-strategy
description: "When the user wants help with pricing decisions, packaging, or monetization strategy. Also use when the user mentions 'pricing,' 'pricing tiers,' 'freemium,' 'free trial,' 'packaging,' 'price increase,' 'value metric,' 'Van Westendorp,' 'willingness to pay,' or 'monetization.' This skill covers pricing research, tier structure, and packaging strategy."
user-invocable: true
when_to_use: "Invoke for pricing, packaging, or monetization decisions."
category: marketing
keywords: [pricing, packaging, monetization, tiers, strategy]
argument-hint: "[product or tier]"
metadata:
  author: agentkit
  version: "1.1.1"
---

# Pricing Strategy

Design pricing and packaging from supplied or sourced evidence. Access to willingness-to-pay research, billing data, or analysis tools is not implied: discover available authorized capabilities and label observations, estimates, and hypotheses separately. Preserve user-selected prices and constraints. When evidence cannot identify a price, deliver a research or experiment plan instead of an invented optimum.

## Before Starting

Reuse existing context and ask only for material gaps. Establish segment, value metric, contribution margin, cost to serve, and payback constraints before recommending price changes:

### 1. Business Context
- What type of product? (SaaS, marketplace, e-commerce, service)
- What's your current pricing (if any)?
- What's your target market? (SMB, mid-market, enterprise)
- What's your go-to-market motion? (self-serve, sales-led, hybrid)

### 2. Value & Competition
- What's the primary value you deliver?
- What alternatives do customers consider?
- How do competitors price?
- What makes you different/better?

### 3. Current Performance
- What's your current conversion rate?
- What's your average revenue per user (ARPU)?
- What's your churn rate?
- Any feedback on pricing from customers/prospects?

### 4. Goals
- Are you optimizing for growth, revenue, or profitability?
- Are you trying to move upmarket or expand downmarket?
- Any pricing changes you're considering?

## Pricing Fundamentals

### The Three Pricing Axes

Every pricing decision involves three dimensions:

**1. Packaging** — What's included at each tier?
- Features, limits, support level
- How tiers differ from each other

**2. Pricing Metric** — What do you charge for?
- Per user, per usage, flat fee
- How price scales with value

**3. Price Point** — How much do you charge?
- The actual dollar amounts
- The perceived value vs. cost

### Value-Based Pricing Framework

Use value delivered to frame willingness to pay, while checking cost to serve and margin constraints. The following amounts are illustrative:

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  Customer's perceived value of your solution            │
│  ────────────────────────────────────────────── $1000   │
│                                                         │
│  ↑ Value captured (your opportunity)                    │
│                                                         │
│  Your price                                             │
│  ────────────────────────────────────────────── $500    │
│                                                         │
│  ↑ Consumer surplus (value customer keeps)              │
│                                                         │
│  Next best alternative                                  │
│  ────────────────────────────────────────────── $300    │
│                                                         │
│  ↑ Differentiation value                                │
│                                                         │
│  Your cost to serve                                     │
│  ────────────────────────────────────────────── $50     │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Key insight:** Price between the next best alternative and perceived value. Cost is a floor, not a basis.

## Pricing Research Methods

Load `references/pricing-research-methods.md` only for the method that answers the current pricing question. Choose a method and recruitment plan suitable for the segment; do not run every method by default.

## Value Metrics

Load `references/value-metrics.md` when choosing and validating the value metric to charge on.

## Tier Structure

Load `references/tier-structure.md` when deciding tier count, differentiation, and good-better-best layout.

## Packaging for Personas

Load `references/packaging-for-personas.md` when packaging tiers around distinct pricing personas.

## Freemium vs. Free Trial

Load `references/freemium-vs-free-trial.md` when choosing between freemium, free trial, or a hybrid.

## When to Raise Prices

Load `references/when-to-raise-prices.md` when planning, executing, or communicating a price increase.

## Pricing Page Best Practices

Load `references/pricing-page-best-practices.md` when designing or reviewing the pricing page itself.

## Price Testing

Load `references/price-testing.md` when testing price levels and measuring the result.

## Enterprise Pricing

Load `references/enterprise-pricing.md` when adding a custom or enterprise tier.

## Pricing Checklist

### Before Setting Prices

- [ ] Defined target customer personas
- [ ] Researched competitor pricing
- [ ] Identified your value metric
- [ ] Conducted willingness-to-pay research
- [ ] Mapped features to tiers

### Pricing Structure

- [ ] Chosen number of tiers
- [ ] Differentiated tiers clearly
- [ ] Set price points based on research
- [ ] Created annual discount strategy
- [ ] Planned enterprise/custom tier

### Validation

- [ ] Tested pricing with target customers
- [ ] Reviewed pricing with sales team
- [ ] Validated unit economics work
- [ ] Planned for price increases
- [ ] Set up tracking for pricing metrics

## Questions to Ask

If you need more context:
1. What pricing research have you done (surveys, competitor analysis)?
2. What's your current ARPU and conversion rate?
3. What's your primary value metric (what do customers pay for value)?
4. Who are your main pricing personas (by size, use case)?
5. Are you self-serve, sales-led, or hybrid?
6. What pricing changes are you considering?

## Related Skills

- Discover a currently installed page-optimization capability for pricing-page conversion.
- **copywriting**: For pricing page copy
- **marketing-psychology**: For pricing psychology principles
- **ab-test-setup**: For testing pricing changes
- Discover the installed analytics capability for pricing metrics. Publishing prices or changing billing requires the user-authorized product, price, and affected customer scope.
