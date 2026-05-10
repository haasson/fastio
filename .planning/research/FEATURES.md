---
focus: features
date: 2026-05-10
---
# Features Research

## Self-Registration Flow

### Table Stakes (users expect these)

**Minimum viable registration flow:**
1. Email + password (or magic link) — no OAuth required for v1, but Google OAuth dramatically increases conversion
2. Email verification — mandatory before accessing the dashboard; unverified users see a persistent banner + limited access
3. Business type selection — critical fork: different onboarding paths for restaurants vs service businesses; affects which modules are enabled and what the wizard shows
4. Tenant/workspace name — collected at signup or step 1 of wizard; users expect this to be the first thing after auth
5. Immediate redirect to onboarding wizard — do not drop user into an empty dashboard

**What Stripe Atlas, Linear, Notion, Vercel do well:**
- Ask for minimal data upfront (email + password only), defer everything else to onboarding
- Business type selection on a visually distinct "What kind of business are you?" screen with icons/cards (not a dropdown)
- Progress is saved — if user closes the browser mid-wizard, they resume where they left off
- "Skip for now" on most steps except business type and workspace name

**Anti-patterns:**
- Long signup forms (name, phone, company size, industry all at once) — kills conversion
- Email verification wall before showing ANY value — show a limited dashboard, just add a banner
- No social proof on the registration page (testimonials, logos of existing tenants increase trust)
- Redirect to `/dashboard` with no guidance — users churn immediately

**Email verification specifics:**
- Send verification email immediately upon signup
- Verification link expires in 24-48 hours (Supabase default is 1 hour — increase it)
- Resend button available after 60 seconds (not immediately — prevents spam)
- Verified = full access; unverified = read-only access to wizard + persistent top banner
- Do NOT block the entire app for unverified users — let them explore onboarding

**Business type selection:**
- Present as visual cards with icons, not a `<select>`
- For FastIO: "Restaurant / Cafe / Food", "Beauty / Wellness / Services", "Other"
- Selection immediately determines: which modules are enabled by default, which KB content is shown, which wizard steps appear
- Store this as `tenant.category` — used throughout the app for contextual hints

---

## Onboarding Wizard

### Core Patterns

**Structure:**
- 4-7 steps maximum for v1; users abandon wizards longer than this
- Step types: required (must complete to unlock feature) vs optional (can skip, clearly labeled)
- Show step count: "Step 2 of 5" or a progress bar — users need to know how long this takes
- Each step has a clear value proposition headline: "Set up your menu" not just "Menu"

**Recommended step sequence for FastIO:**

For food tenants:
1. **Workspace** — tenant name, city/timezone (required)
2. **Branding** — logo upload, primary color (optional but high-value, preview shown live)
3. **Menu** — add first category + 1-2 dishes, or import from URL (optional but highly recommended — empty menu = no value)
4. **Storefront** — set slug/domain preview, enable storefront toggle (required for value delivery)
5. **Notifications** — Telegram bot or email for new orders (optional, but highlight ROI)
6. **Done** — celebration screen with next actions checklist

For services tenants:
1. **Workspace** — name, timezone
2. **Branding** — logo, color
3. **Services** — add first service category + 1 service
4. **Staff** — add first staff member with schedule
5. **Booking page** — preview live booking page
6. **Done**

**Progress persistence:**
- Save wizard state to DB (`tenant.onboarding_step` enum or JSON blob)
- On dashboard, show "Continue setup" card until wizard is 100% complete
- After 100%: hide wizard entry point but keep a subtle "Setup guide" link in sidebar

**Gamification patterns that work:**
- Checklist-style dashboard widget (like Intercom, Notion, Linear): shows X/Y steps completed with a progress bar
- Completion percentage shown in sidebar next to workspace name
- Confetti/celebration on wizard completion (one-time animation, not annoying)
- "You're 80% done!" copy with specific next action — not generic "Complete your profile"

**Anti-patterns:**
- Requiring credit card before showing value (not applicable v1, but noted)
- Making every step mandatory — users with specific use cases need escape hatches
- No "I'll do this later" option on non-critical steps
- Wizard that doesn't auto-save — if user refreshes, they lose progress
- Generic wizard — same flow for restaurant and beauty salon = wrong mental model
- Hiding the main app until wizard is complete — frustrates power users

**Post-wizard engagement:**
- Send "Day 1" email: "Here's what you set up, here's what to do next"
- Send "Day 3" email if key action (e.g., first order/booking) not taken: "Your storefront is live but hasn't had visitors"
- In-app tooltips on first visit to each section (Shepherd.js or custom, one tooltip per page, dismissible)

---

## Plan/Billing UI (no payment)

### How to show tiers without payment processing

**Tier display patterns:**

**Pricing page (landing + `/account/billing` in admin):**
- 3-tier layout is the SaaS standard: Free / Pro / Business (or similar)
- Highlight the recommended tier with visual prominence (border, badge "Most Popular")
- Show features as a vertical list with checkmarks; grayed-out features for unavailable tiers
- Show limits explicitly: "Up to 50 menu items", "3 staff members", "1 branch"
- CTA: "Current Plan" (disabled button) for active tier, "Upgrade" for higher tiers, "Downgrade" for lower
- Monthly/annual toggle (even if v1 has no payment — sets up the mental model)

**In-app plan badge:**
- Show current plan name in sidebar footer or account dropdown: `Free Plan` / `Pro`
- Subtle, not aggressive — the upgrade prompts do the heavy lifting

**Upgrade prompt patterns:**
- **Contextual** (most effective): shown exactly when user hits a limit — "You've reached the 3-staff limit on Free. Upgrade to Pro for unlimited staff." with an Upgrade button
- **Passive**: small "Upgrade" badge next to locked features in navigation
- **Periodic** (least effective, most annoying): modal after X days — avoid in v1

**For v1 without payment:**
- Plan stored in `tenant.plan` (enum: free | pro | business)
- Upgrade button sends request to support / opens Telegram / shows "Contact us" modal
- Show "Billing" page with tiers and a "Request upgrade" CTA
- Do NOT fake a payment flow — users distrust it and it creates support burden

**Limit display in UI:**
- Resource pages show a usage indicator: "2/3 staff members used" with a small progress bar
- When approaching limit (>80%): yellow warning state
- When at limit: red state + CTA to upgrade

---

## Plan Limits Enforcement

### Soft vs Hard Limits

**Hard blocks (appropriate):**
- Creating a resource beyond the plan limit (e.g., 4th staff on Free): show modal/toast, block the action, offer upgrade path
- Accessing a module not in the plan (e.g., promotions on Free): show upgrade prompt instead of the module content
- Example: clicking "Promotions" in sidebar when on Free → full-page upgrade prompt, not a 403

**Soft limits / graceful degradation (appropriate):**
- Approaching a limit: show warning but don't block yet
- Features that are "advanced" variants of basic ones: show the basic version, show upgrade prompt for advanced (e.g., basic order notifications = free; advanced Telegram bot = pro)
- Reports/analytics: show last 7 days on Free, last 30/90 days on Pro — same page, just different data range

**Enforcement architecture:**

Frontend-level:
```
// composable pattern
const { canAddStaff, upgradeReason } = usePlanLimits()

// in component
if (!canAddStaff.value) {
  showUpgradeModal(upgradeReason.value)
  return
}
```

Backend-level (critical — frontend is UX, backend is truth):
- RLS policies or server-side checks on insert/update operations
- Return structured error: `{ code: 'PLAN_LIMIT_EXCEEDED', limit: 3, current: 3, resource: 'staff', requiredPlan: 'pro' }`
- Frontend maps this error code to the correct upgrade modal

**Patterns by resource type:**

| Resource | Free Limit | Enforcement |
|----------|-----------|-------------|
| Menu items | 50 | Hard block on create |
| Staff members | 3 | Hard block on create |
| Branches | 1 | Hard block on create |
| Order history | 30 days | Soft: filter query results |
| Promotions module | disabled | Full module gate |
| Custom domain | disabled | Feature gate in settings |
| Storefront themes | 1 (default) | Feature gate in appearance |

**Upgrade modal anatomy:**
1. Clear headline: "You've reached the staff limit"
2. Current plan context: "Your Free plan includes up to 3 staff members"
3. What they get by upgrading: "Pro includes unlimited staff + branch management"
4. Single CTA: "Upgrade to Pro" — not multiple options
5. Secondary: "Learn more" or "See all plans"
6. Tertiary dismiss: "Maybe later" (small, not prominent)

**Avoid:**
- Silent failures (user clicks Create, nothing happens, no explanation)
- Degrading existing data (never delete a user's menu items because they downgraded — just block adding new ones)
- Confusing limit errors mixed with real validation errors — use distinct error codes
- Blocking read access to over-limit resources — users should always be able to see what they have

---

## Differentiators vs Table Stakes

### Table Stakes (must-have for any SaaS v1 launch)

- Email + password auth with email verification
- Self-serve registration (no "request a demo" gate)
- Functional onboarding that gets user to first value in < 5 minutes
- Plan/tier concept visible in UI even without payment
- Feature gating that doesn't silently fail
- Password reset flow
- Basic profile (name, email, timezone)
- "Delete my account" option (GDPR requirement)
- Mobile-readable admin UI (not necessarily full mobile UX, just not broken)

### Nice-to-Have for v1 (do if time permits)

- Google/Apple OAuth (increases signup conversion ~30%)
- Onboarding email sequence (Day 1, Day 3, Day 7 emails)
- In-app product tours (Shepherd.js)
- Annual/monthly billing toggle on pricing page
- Usage analytics per tenant (admin view)
- Referral/invite system

### Differentiators (FastIO-specific, set apart from Restik/R-Keeper)

- **Business-type-aware onboarding**: wizard adapts to restaurant vs services — competitors use one-size-fits-all
- **Branded storefront preview during onboarding**: user sees their actual storefront URL during setup, not a generic demo — this is the core value prop and should be shown ASAP
- **Telegram-first notifications**: Russian market expects Telegram; make it a first-class step in wizard (not buried in settings)
- **Branch-awareness from day 1**: even Free plan shows single-branch setup correctly; upgrading to multi-branch feels natural
- **Module toggle UX**: ability to disable unused modules (e.g., a beauty salon doesn't need "Menu") makes the admin feel focused and tailored — competitors show everything always

### What NOT to build for v1

- Full Stripe/payment integration (manual upgrade is fine for early adopters)
- Self-serve plan downgrade (only upgrade; downgrade via support)
- Complex usage metering (counts are enough; no need for API call tracking etc.)
- White-label billing portal
- Multi-seat/team billing (one plan per tenant is fine)
