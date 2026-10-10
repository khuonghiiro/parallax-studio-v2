# Onboarding Flow Design

## Immediate Post-Signup (First 30 Seconds)

**Options:**
1. **Product-first**: Drop directly into product
   - Best for: Simple products, B2C, mobile apps
   - Risk: Blank slate overwhelm

2. **Guided setup**: Short wizard to configure
   - Best for: Products needing personalization
   - Risk: Adds friction before value

3. **Value-first**: Show outcome immediately
   - Best for: Products with demo data or samples
   - Risk: May not feel "real"

**Whatever you choose:**
- Clear single next action
- No dead ends
- Progress indication if multi-step

## Onboarding Checklist Pattern

**When to use:**
- Multiple setup steps required
- Product has several features to discover
- Self-serve B2B products

**Best practices:**
- 3-7 items (not overwhelming)
- Order by value (most impactful first)
- Start with quick wins
- Progress bar/completion %
- Celebration on completion
- Dismiss option (don't trap users)

**Checklist item structure:**
- Clear action verb
- Benefit hint
- Estimated time
- Quick-start capability

Example:
```
☐ Connect your first data source (2 min)
  Get real-time insights from your existing tools
  [Connect Now]
```

## Empty States

Empty states are onboarding opportunities, not dead ends.

**Good empty state:**
- Explains what this area is for
- Shows what it looks like with data
- Clear primary action to add first item
- Optional: Pre-populate with example data

**Structure:**
1. Illustration or preview
2. Brief explanation of value
3. Primary CTA to add first item
4. Optional: Secondary action (import, template)

## Tooltips and Guided Tours

**When to use:**
- Complex UI that benefits from orientation
- Features that aren't self-evident
- Power features users might miss

**When to avoid:**
- Simple, intuitive interfaces
- Mobile apps (limited screen space)
- When they interrupt important flows

**Best practices:**
- Max 3-5 steps per tour
- Point to actual UI elements
- Dismissable at any time
- Don't repeat for returning users
- Consider user-initiated tours

## Progress Indicators

**Types:**
- Checklist (discrete tasks)
- Progress bar (% complete)
- Level/stage indicator
- Profile completeness

**Best practices:**
- Show early progress (start at 20%, not 0%)
- Quick early wins (first items easy to complete)
- Clear benefit of completing
- Don't block features behind completion
