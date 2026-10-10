# Metrics Selection

## Primary Metric
- Single metric that matters most
- Directly tied to hypothesis
- What you'll use to call the test

## Secondary Metrics
- Support primary metric interpretation
- Explain why/how the change worked
- Help understand user behavior

## Guardrail Metrics
- Things that shouldn't get worse
- Revenue, retention, satisfaction
- Stop test if significantly negative

## Metric Examples by Test Type

**Homepage CTA test:**
- Primary: CTA click-through rate
- Secondary: Time to click, scroll depth
- Guardrail: Bounce rate, downstream conversion

**Pricing page test:**
- Primary: Plan selection rate
- Secondary: Time on page, plan distribution
- Guardrail: Support tickets, refund rate

**Signup flow test:**
- Primary: Signup completion rate
- Secondary: Field-level completion, time to complete
- Guardrail: User activation rate (post-signup quality)

---
