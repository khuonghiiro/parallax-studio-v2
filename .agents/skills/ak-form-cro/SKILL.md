---
name: ak:form-cro
description: When the user wants to optimize any form that is NOT signup/registration — including lead capture forms, contact forms, demo request forms, application forms, survey forms, or checkout forms. Also use when the user mentions "form optimization," "lead form conversions," "form friction," "form fields," "form completion rate," or "contact form." Signup and popup implementation belong to a matching capability discovered in the live catalog.
user-invocable: true
when_to_use: "Invoke to optimize a non-signup form for conversion."
category: marketing
keywords: [form, cro, conversion, fields, friction]
argument-hint: "[form-url or description]"
metadata:
  author: agentkit
  version: "1.1.1"
---

# Form CRO

You are an expert in form optimization. Your goal is to improve qualified completions while retaining required business, security, and legal fields.

## Initial Assessment

Before providing recommendations, identify:

1. **Form Type**
   - Lead capture (gated content, newsletter)
   - Contact form
   - Demo/sales request
   - Application form
   - Survey/feedback
   - Checkout form
   - Quote request

2. **Current State**
   - How many fields?
   - What's the current completion rate?
   - Mobile vs. desktop split?
   - Where do users abandon?

3. **Business Context**
   - What happens with form submissions?
   - Which fields are actually used in follow-up?
   - Are there compliance/legal requirements?

---

## Core Principles

### 1. Every Field Has a Cost
Extra fields may add friction, but their effect depends on intent, qualification needs, and layout. Use observed abandonment and downstream lead quality rather than an assumed field-count penalty.

For each field, ask:
- Is this absolutely necessary before we can help them?
- Can we get this information another way?
- Can we ask this later?

### 2. Value Must Exceed Effort
- Clear value proposition above form
- Make what they get obvious
- Reduce perceived effort (field count, labels)

### 3. Reduce Cognitive Load
- One question per field
- Clear, conversational labels
- Logical grouping and order
- Smart defaults where possible

---

## Field-by-Field Optimization

Per-field rules for email, name, phone, company, job title, free text, dropdown selects, and multi-select checkboxes.
Load `references/field-by-field-optimization.md` before auditing or rewriting individual fields.

---

## Form Layout Optimization

Field order, labels versus placeholders, visual design, and the single- versus multi-column decision.
Load `references/form-layout-optimization.md` when arranging fields on the page.

---

## Multi-Step Forms

When to split a form into steps, multi-step best practices, and the progressive commitment pattern.
Load `references/multi-step-forms.md` when the form is long enough to consider splitting.

---

## Error Handling

### Inline Validation
- Validate as they move to next field
- Don't validate too aggressively while typing
- Clear visual indicators (green check, red border)

### Error Messages
- Specific to the problem
- Suggest how to fix
- Positioned near the field
- Don't clear their input

**Good:** "Please enter a valid email address (e.g., name@company.com)"
**Bad:** "Invalid input"

### On Submit
- Focus on first error field
- Summarize errors if multiple
- Preserve all entered data
- Don't clear form on error

---

## Submit Button Optimization

### Button Copy
Weak: "Submit" | "Send"
Strong: "[Action] + [What they get]"

Examples:
- "Get My Free Quote"
- "Download the Guide"
- "Request Demo"
- "Send Message"
- "Start Free Trial"

### Button Placement
- Immediately after last field
- Left-aligned with fields
- Sufficient size and contrast
- Mobile: Sticky or clearly visible

### Post-Submit States
- Loading state (disable button, show spinner)
- Success confirmation (clear next steps)
- Error handling (clear message, focus on issue)

---

## Trust and Friction Reduction

### Near the Form
- Privacy statement supported by the actual policy and data flow; do not promise never to share data without evidence.
- Security badges if collecting sensitive data
- Testimonial or social proof
- Expected response time

### Reducing Perceived Effort
- "Takes 30 seconds"
- Field count indicator
- Remove visual clutter
- Generous white space

### Addressing Objections
- State unsubscribe, phone-use, and payment requirements only when verified against the actual experience.

---

## Form Types: Specific Guidance

Field and copy guidance per form type: lead capture, contact, demo request, quote/estimate, and survey forms.
Load `references/form-type-guidance.md` once the form type is identified.

---

## Mobile Optimization

- Larger touch targets (44px minimum height)
- Appropriate keyboard types (email, tel, number)
- Autofill support
- Single column only
- Sticky submit button
- Minimal typing (dropdowns, buttons)

---

## Measurement

### Key Metrics
- **Form start rate**: Page views → Started form
- **Completion rate**: Started → Submitted
- **Qualified completion rate**: Valid, usable submissions / eligible form starts; define qualification and the observation window.
- **Field drop-off**: Which fields lose people
- **Error rate**: By field
- **Time to complete**: Total and by field
- **Mobile vs. desktop**: Completion by device

### What to Track
- Form views
- First field focus
- Each field completion
- Errors by field
- Submit attempts
- Successful submissions

---

## Output Format

Deliverable templates for the form audit, the recommended form design, and test hypotheses.
Load `references/output-format.md` when writing up the recommendation.

---

## Experiment Ideas

Test backlog grouped into form structure, copy and design, form type-specific, and mobile/UX experiments.
Load `references/experiment-ideas.md` when building a form test roadmap.

---

## Questions to Ask

If you need more context:
1. What's your current form completion rate?
2. Do you have field-level analytics?
3. What happens with the data after submission?
4. Which fields are actually used in follow-up?
5. Are there compliance/legal requirements?
6. What's the mobile vs. desktop split?

---

## Related Capabilities

For signup, popup, or surrounding-page work, check the live skill catalog for a matching owner. If absent, explain the boundary and provide a scoped form assessment directly. Use an installed experiment-design capability when testing changes.
