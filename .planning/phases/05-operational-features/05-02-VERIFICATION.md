---
phase: 05-operational-features
plan: 02
requirement: OPS-02
verification_date: 2026-05-23
mode: code-citation+manual-trace
---

# OPS-02 Verification Record — Order Status Page

## Summary

OPS-02 ("the order status link works without any login and shows the current order status, updating in real time when the venue changes the status") is verified as fully implemented. No production code was modified by this plan — the implementation in `apps/storefront/pages/order/[id].vue` and `apps/storefront/server/api/orders/[id].get.ts` was built prior to Phase 5 (decision D-02 in CONTEXT.md). This document records static code citations for all five success criteria plus a live-test trace; the trace steps are pre-populated with `[PENDING — Task 2 checkpoint]` placeholders until a human verifier completes the end-to-end run.

---

## Success Criteria Mapping

| Criterion | Description (from CONTEXT.md / RESEARCH.md) | Implementation file:line | Proof | Verdict |
|-----------|---------------------------------------------|--------------------------|-------|---------|
| **A** | The order status link works without any login | `apps/storefront/pages/order/[id].vue:84-125` | No `definePageMeta({ auth: true })` present anywhere in the file. The `<script setup>` at line 84 directly calls `useFetch` at line 109 with the guest_token forwarded in the query (`route.query.t`). The IDOR guard on the server accepts `?t=guest_token` as the sole credential — no Supabase session required (server path documented at lines 103–108). SSR renders the full page without a login wall. | PASS |
| **B** | Shows the current order status | `apps/storefront/pages/order/[id].vue:36, 135` | Template at line 36: `<SfOrderStatus :group="statusGroup" />` renders the status badge. Computed `statusGroup` at line 135: `const statusGroup = computed(() => order.value?.statusGroup ?? 'new')` — derives group from the fetched order payload returned by `/api/orders/[id].get.ts`. The server endpoint joins `order_statuses` table (lines 46–54 of `orders/[id].get.ts`) to populate `statusGroup` on the mapped order. | PASS |
| **C** | Updating status without manual page refresh (polling, stops on terminal state) | `apps/storefront/pages/order/[id].vue:149-165` | Polling block at lines 149–161: `setInterval` with `15_000` ms cadence is started inside `if (import.meta.client)` guard (client-only). At line 154 the interval callback checks `isFinished.value` before calling `refresh()` — if the order is in a terminal state, it clears the timer immediately and returns without fetching. `isFinished` computed at line 137: `statusGroup.value === 'completed' || statusGroup.value === 'cancelled'`. Cleanup at lines 163–165: `onUnmounted` calls `clearInterval(pollTimer)`. Chosen mechanism: polling at 15s per D-04 (Supabase Realtime with anon client deferred to v2 — requires special RLS policy). | PASS |
| **D** | Unauthorized access returns 404 (not 403, not page data) — IDOR guard | `apps/storefront/server/api/orders/[id].get.ts:16-43` | Line 16: if the order does not exist in DB, `createError({ statusCode: 404 })` is thrown immediately. Lines 20–42: `authorized` flag checked via three accepted credentials — (1) `customerId` from `getAuthenticatedContext` matches `orders.customer_id` (lines 27–36); (2) `?t=` query param equals `orders.guest_token` (lines 38–41). If neither path sets `authorized = true`, line 43 throws `createError({ statusCode: 404, message: 'Заказ не найден' })`. Critically, 404 is returned (not 403) so a guessing attacker cannot enumerate order existence — standard IDOR mitigation. | PASS |
| **E** | Customer reaches `/order/{id}` from checkout without login — flow integrity | `apps/storefront/pages/checkout.vue:484` | Line 484: `await navigateTo(result.token ? \`/order/\${result.id}?t=\${result.token}\` : \`/order/\${result.id}\`)` — after successful order creation, checkout navigates to `/order/{uuid}?t={guest_token}` for guest users (token is non-null) or `/order/{uuid}` for authenticated customers (auth path, no token needed). The `token` comes from `POST /api/orders` response. In `orders.post.ts` line 94: `const guestToken = customerId ? null : randomUUID()` — UUID generated server-side and returned in the response (`result.guest_token`). The token is stored in `orders.guest_token` column via `orderPayload.guest_token` at line 128, making the IDOR guard work on subsequent GET requests. | PASS |

---

## Live Test Trace

> Steps are marked `[PENDING — Task 2 checkpoint]` until a human verifier completes the end-to-end run per Task 2 instructions.

**Environment:** Local storefront (`pnpm dev:storefront`) or staging, with at least one active branch and one orderable item. Admin panel accessible.

### Step 1 — Place test order

Place a test order via the storefront checkout (cash on delivery, minimum items).

- **order_id (UUID):** [PENDING — Task 2 checkpoint]
- **Redirected URL:** [PENDING — Task 2 checkpoint]
- **URL shape `/order/{uuid}?t={uuid}` confirmed:** [PENDING — Task 2 checkpoint]

### Step 2 — Open order page in fresh browser window (no Supabase session)

Open the redirected URL in a fresh browser window or incognito tab with no Supabase session cookies/localStorage.

- **HTTP status:** [PENDING — Task 2 checkpoint]
- **Order card rendered (order number visible):** [PENDING — Task 2 checkpoint]
- **Status badge group displayed:** [PENDING — Task 2 checkpoint]
- **DevTools Network: `GET /api/orders/{uuid}?t={token}` returns 200:** [PENDING — Task 2 checkpoint]

### Step 3 — Admin changes status to non-terminal; status updates in UI within 15s

In admin panel (separate window, owner login), change the order status to a non-terminal value (e.g., "В работе").

- **Status badge updated on storefront tab within 15s (no manual reload):** [PENDING — Task 2 checkpoint]
- **DevTools Network: `GET /api/orders/{uuid}` fires ~every 15s:** [PENDING — Task 2 checkpoint]

### Step 4 — Admin moves order to terminal status; polling stops

In admin panel, change order to "Завершён" or "Отменён".

- **Status badge updated to terminal state within 15s:** [PENDING — Task 2 checkpoint]
- **After waiting an additional 20s — no further `GET /api/orders/{uuid}` requests in DevTools Network (polling stopped):** [PENDING — Task 2 checkpoint]

### Step 5 — IDOR probe: order UUID without `?t=` returns 404

Open an incognito window. Visit `/order/{uuid}` with no `?t=` query param (copy UUID, drop the token).

- **HTTP status observed:** [PENDING — Task 2 checkpoint]
- **Confirmed: 404 (NOT 403, NOT partial page, NOT 500):** [PENDING — Task 2 checkpoint]

---

## Pitfall 5 Note

> Verbatim from RESEARCH.md `## Common Pitfalls` § Pitfall 5:

**Pitfall 5: OPS-02 verification — accessing order page without guest_token**

**What goes wrong:** Tester opens `/order/{uuid}` directly without `?t=` param and gets 404, incorrectly concluding the feature is broken.
**Why it happens:** The IDOR guard intentionally returns 404 (not 403) for unauthorized access.
**How to avoid:** Always test via the redirect from checkout which includes `?t={guest_token}`. The token is a UUID generated at order creation and stored in `orders.guest_token`. Use the URL from `/order/${id}?t=${token}` format exactly as generated by `checkout.vue`.

---

## Outcome

OPS-02 is statically PASS — implementation in `apps/storefront/pages/order/[id].vue` and `apps/storefront/server/api/orders/[id].get.ts` satisfies all five criteria per code citation above. **Live-test trace (Steps 1–5) is PENDING human verification in Task 2.** Final PASS/PARTIAL/FAIL verdict for the live trace to be recorded by the verifier by replacing `[PENDING — Task 2 checkpoint]` placeholders with actual observations.
