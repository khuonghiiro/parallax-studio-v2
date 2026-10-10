# Sample Size Calculation

## Inputs Needed

1. **Baseline conversion rate**: Your current rate
2. **Minimum detectable effect (MDE)**: Smallest change worth detecting
3. **Statistical significance level**: Usually 95%
4. **Statistical power**: Usually 80%

## Quick Reference

| Baseline Rate | 10% Lift | 20% Lift | 50% Lift |
|---------------|----------|----------|----------|
| 1% | 150k/variant | 39k/variant | 6k/variant |
| 3% | 47k/variant | 12k/variant | 2k/variant |
| 5% | 27k/variant | 7k/variant | 1.2k/variant |
| 10% | 12k/variant | 3k/variant | 550/variant |

## Formula Resources
- Evan Miller's calculator: https://www.evanmiller.org/ab-testing/sample-size.html
- Optimizely's calculator: https://www.optimizely.com/sample-size-calculator/

## Test Duration

```
Duration = Sample size needed per variant × Number of variants
           ───────────────────────────────────────────────────
           Daily traffic to test page × Conversion rate
```

Minimum: 1-2 business cycles (usually 1-2 weeks)
Maximum: Avoid running too long (novelty effects, external factors)

---
