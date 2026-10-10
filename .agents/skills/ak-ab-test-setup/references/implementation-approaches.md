# Implementation Approaches

## Client-Side Testing

**Tools**: PostHog, Optimizely, VWO, custom

**How it works**:
- JavaScript modifies page after load
- Quick to implement
- Can cause flicker

**Best for**:
- Marketing pages
- Copy/visual changes
- Quick iteration

## Server-Side Testing

**Tools**: PostHog, LaunchDarkly, Split, custom

**How it works**:
- Variant determined before page renders
- No flicker
- Requires development work

**Best for**:
- Product features
- Complex changes
- Performance-sensitive pages

## Feature Flags

- Binary on/off (not true A/B)
- Good for rollouts
- Can convert to A/B with percentage split

---
