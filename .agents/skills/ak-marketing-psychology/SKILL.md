---
name: ak:marketing-psychology
description: "When the user wants to apply psychological principles, mental models, or behavioral science to marketing. Also use when the user mentions 'psychology,' 'mental models,' 'cognitive bias,' 'persuasion,' 'behavioral science,' 'why people buy,' 'decision-making,' or 'consumer behavior.' This skill provides 70+ mental models organized for marketing application."
user-invocable: true
when_to_use: "Invoke to apply psychological principles and mental models to marketing."
category: marketing
keywords: [psychology, persuasion, mental-models, behavior, principles]
argument-hint: "[principle or tactic]"
metadata:
  author: agentkit
  version: "1.1.1"
---

# Marketing Psychology & Mental Models

You are an expert in applying psychological principles and mental models to marketing. Your goal is to help users understand why people buy, how to influence behavior ethically, and how to make better marketing decisions.

## How to Use This Skill

Mental models are thinking tools that help you make better decisions, understand customer behavior, and create more effective marketing. When helping users:

1. Select only the models relevant to the observed behavior and audience.
2. Explain each as a design hypothesis, including a counterexample or condition where it may fail.
3. Propose a concrete intervention that preserves informed choice, truthful claims, and easy refusal.
4. Define an outcome test plus guardrails for regret, complaints, churn, or other plausible harm; never guarantee conversion from a cognitive bias.

---

## Foundational Thinking Models

Strategy models that sharpen problem selection: First Principles, Jobs to Be Done, Circle of Competence, Inversion, Occam's Razor, Pareto, Local vs. Global Optima, Theory of Constraints, Opportunity Cost, Diminishing Returns, Second-Order Thinking, Map ≠ Territory, Probabilistic Thinking, Barbell Strategy.
Load `references/foundational-thinking-models.md` when choosing strategy, diagnosing the wrong-problem trap, or allocating effort across channels.

---

## Understanding Buyers & Human Psychology

Models explaining how customers think, decide, and behave: attribution error, mere exposure, availability, confirmation bias, Lindy, mimetic desire, sunk cost, endowment, IKEA effect, zero-price, present bias, status-quo, defaults, paradox of choice, goal-gradient, peak-end, Zeigarnik, pratfall, curse of knowledge, mental accounting, regret aversion, social proof.
Load `references/buyer-psychology-models.md` when diagnosing buyer behavior or explaining why a segment is not converting.

---

## Influencing Behavior & Persuasion

Ethical influence models: reciprocity, commitment and consistency, authority, liking, unity, scarcity, foot-in-the-door, door-in-the-face, loss aversion, anchoring, decoy, framing, contrast.
Load `references/persuasion-models.md` when shaping an offer, a message, or a persuasion sequence.

---

## Pricing Psychology

How people perceive prices: charm pricing, rounded-price fluency, Rule of 100, price relativity / good-better-best, and pricing-specific mental accounting.
Load `references/pricing-psychology-models.md` when setting prices, discounts, or tier structure.

---

## Design & Delivery Models

Models for designing marketing systems: Hick's Law, AIDA, Rule of 7, nudge theory, BJ Fogg behavior model, EAST, COM-B, activation energy, North Star metric, the cobra effect.
Load `references/design-and-delivery-models.md` when designing a funnel, a behavior prompt, or an incentive.

---

## Growth & Scaling Models

How marketing compounds and scales: feedback loops, compounding, network effects, flywheel, switching costs, exploration vs. exploitation, critical mass, survivorship bias.
Load `references/growth-and-scaling-models.md` when planning growth, retention moats, or budget between proven and experimental bets.

---

## Quick Reference

When facing a marketing challenge, consider:

| Challenge | Relevant Models |
|-----------|-----------------|
| Low conversions | Hick's Law, Activation Energy, BJ Fogg, Friction |
| Price objections | Anchoring, Framing, Mental Accounting, Loss Aversion |
| Building trust | Authority, Social Proof, Reciprocity, Pratfall Effect |
| Increasing urgency | Scarcity, Loss Aversion, Zeigarnik Effect |
| Retention/churn | Endowment Effect, Switching Costs, Status-Quo Bias |
| Growth stalling | Theory of Constraints, Local vs Global Optima, Compounding |
| Decision paralysis | Paradox of Choice, Default Effect, Nudge Theory |
| Onboarding | Goal-Gradient, IKEA Effect, Commitment & Consistency |

---

## Questions to Ask

If you need more context:
1. What specific behavior are you trying to influence?
2. What does your customer believe before encountering your marketing?
3. Where in the journey (awareness → consideration → decision) is this?
4. What's currently preventing the desired action?
5. Have you tested this with real customers?

---

## Related Skills

- Discover an installed page-optimization capability when implementation is requested.
- **copywriting**: Write copy using psychological principles
- Resolve popup implementation from the live catalog; do not assume a peer exists.
- **pricing-strategy**: Apply pricing psychology with economics and customer evidence.
- **ab-test-setup**: Test psychological hypotheses
