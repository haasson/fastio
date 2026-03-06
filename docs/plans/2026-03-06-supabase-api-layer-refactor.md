# Supabase API Layer Refactor

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Eliminate all direct `$supabase` usage from components, pages, layout and stores — everything goes through `useSupabaseApi()`.

**Architecture:** `useSupabaseApi()` already binds all API modules with `$supabase` automatically. We need to: (1) add missing auth/functions methods to `useSupabaseApi`, (2) add missing `orderNotes` module, (3) replace direct `$supabase` calls in 11 files with `useSupabaseApi()`.

**Tech Stack:** Nuxt 3, Supabase JS, TypeScript

**Exceptions:** Realtime (`$supabase.channel()`) stays as-is in `stores/branch.ts`, `stores/tenant.ts`, `composables/useRealtimeList.ts` — different pattern, already abstracted.

---

### Task 1: Extend `useSupabaseApi` — add auth methods and edge functions

**Files:**
- Modify: `apps/admin/composables/useSupabaseApi.ts`

**Step 1: Add missing auth and functions methods**

Add to `auth` section:
```ts
auth: {
  signOut: () => sb.auth.signOut(),
  signIn: (email: string, password: string) => sb.auth.signInWithPassword({ email, password }),
  signUp: (email: string, password: string) => sb.auth.signUp({ email, password }),
  getSession: () => sb.auth.getSession(),
  updateUser: (attrs: { password: string }) => sb.auth.updateUser(attrs),
},
```

Add to `functions` section:
```ts
functions: {
  listTeam: (body: object) => sb.functions.invoke('list-team', { body }),
  inviteMember: (body: object) => sb.functions.invoke('invite-member', { body }),
  acceptInvite: (body: object) => sb.functions.invoke('accept-invite', { body }),
  getInvite: (body: object) => sb.functions.invoke('get-invite', { body }),
},
```

**Step 2: Add `orderNotes` module binding**

Add import at top:
```ts
import { orderNotesApi } from '~/utils/api/order-notes'
```

Add to return object:
```ts
orderNotes: bindAll(orderNotesApi, sb),
```

**Step 3: Verify** — check that the file has no TypeScript errors (IDE or `npx nuxi typecheck`).

---

### Task 2: Migrate CRUD components (7 files)

These files import API modules directly and pass `$supabase` manually. Replace with `useSupabaseApi()`.

**Files:**
- Modify: `apps/admin/pages/orders/index.vue`
- Modify: `apps/admin/components/orders/OrderNotesSection.vue`
- Modify: `apps/admin/components/orders/OrderEditModal.vue`
- Modify: `apps/admin/components/orders/OrderAddDishModal.vue`
- Modify: `apps/admin/components/menu/DishSettingsSection.vue`
- Modify: `apps/admin/components/menu/DishFormModal.vue`
- Modify: `apps/admin/components/settings/SettingsTeam.vue`

**Pattern for each file:**

1. Remove `import { xxxApi } from '~/utils/api/xxx'`
2. Remove `const { $supabase } = useNuxtApp()` (and `import { useNuxtApp } from '#imports'` if no longer used)
3. Add `const api = useSupabaseApi()`
4. Replace `xxxApi.method($supabase, ...)` with `api.xxx.method(...)`

**Detailed changes per file:**

#### `pages/orders/index.vue`
- Line 92: remove `import { ordersApi } from '~/utils/api/orders'`
- Line 100: replace `const { $supabase } = useNuxtApp()` with `const api = useSupabaseApi()`
- Line 126: `ordersApi.counts($supabase, ...)` -> `api.orders.counts(...)`

#### `components/orders/OrderNotesSection.vue`
- Line 47: remove `import { orderNotesApi } from '~/utils/api/order-notes'`
- Line 58: replace `const { $supabase } = useNuxtApp()` with `const api = useSupabaseApi()`
- Line 79: `orderNotesApi.list($supabase, ...)` -> `api.orderNotes.list(...)`
- Line 86: `orderNotesApi.add($supabase, ...)` -> `api.orderNotes.add(...)`

#### `components/orders/OrderEditModal.vue`
- Line 122: remove `import { ordersApi } from '~/utils/api/orders'`
- Line 140: replace `const { $supabase } = useNuxtApp()` with `const api = useSupabaseApi()`
- Line 213: `ordersApi.update($supabase, ...)` -> `api.orders.update(...)`

#### `components/orders/OrderAddDishModal.vue`
- Line 114-115: remove `import { categoriesApi }` and `import { dishesApi }`
- Line 129: replace `const { $supabase } = useNuxtApp()` with `const api = useSupabaseApi()`
- Line 175: `categoriesApi.list($supabase, ...)` -> `api.categories.list(...)`
- Line 176: `dishesApi.listAllActive($supabase, ...)` -> `api.dishes.listAllActive(...)`

#### `components/menu/DishSettingsSection.vue`
- Line 42: remove `import { dishesApi } from '~/utils/api/dishes'`
- Line 56: replace `const { $supabase } = useNuxtApp()` with `const api = useSupabaseApi()`
- Line 71: `dishesApi.getBranchPrices($supabase, ...)` -> `api.dishes.getBranchPrices(...)`

#### `components/menu/DishFormModal.vue`
- Line 166: remove `import { dishesApi } from '~/utils/api/dishes'`
- Line 182: replace `const { $supabase } = useNuxtApp()` with `const api = useSupabaseApi()`
- Line 320: `dishesApi.deletePhoto($supabase, ...)` -> `api.dishes.deletePhoto(...)`
- Line 322: `dishesApi.uploadPhoto($supabase, ...)` -> `api.dishes.uploadPhoto(...)`
- Line 326: `dishesApi.deletePhoto($supabase, ...)` -> `api.dishes.deletePhoto(...)`
- Line 343: `dishesApi.setBranchPrices($supabase, ...)` -> `api.dishes.setBranchPrices(...)`

#### `components/settings/SettingsTeam.vue`
- Line 111: remove `import { membersApi } from '~/utils/api/members'`
- Line 115: replace `const { $supabase } = useNuxtApp()` with `const api = useSupabaseApi()`
- Line 161: `membersApi.updateBranchIds($supabase, ...)` -> `api.members.updateBranchIds(...)`

---

### Task 3: Migrate auth pages (3 files)

**Files:**
- Modify: `apps/admin/pages/login.vue`
- Modify: `apps/admin/pages/invite.vue`
- Modify: `apps/admin/pages/set-password.vue`

#### `pages/login.vue`
- Line 61: replace `const { $supabase } = useNuxtApp()` with `const api = useSupabaseApi()`
- Line 94-95: `$supabase.auth.signInWithPassword({ email, password })` -> `api.auth.signIn(email, password)`
- Line 105: `$supabase.functions.invoke('accept-invite', { body })` -> `api.functions.acceptInvite(body)`

#### `pages/invite.vue`
- Line 23: replace `const { $supabase } = useNuxtApp()` with `const api = useSupabaseApi()`
- Line 39: `$supabase.auth.getSession()` -> `api.auth.getSession()`
- Line 42: `$supabase.functions.invoke('accept-invite', { body })` -> `api.functions.acceptInvite(body)`
- Line 55: `$supabase.functions.invoke('get-invite', { body })` -> `api.functions.getInvite(body)`

#### `pages/set-password.vue`
- Line 65: replace `const { $supabase } = useNuxtApp()` with `const api = useSupabaseApi()`
- Line 83: `$supabase.auth.signUp({ email, password })` -> `api.auth.signUp(email, password)`
- Line 99: `$supabase.auth.getSession()` -> `api.auth.getSession()`
- Line 102: `$supabase.functions.invoke('accept-invite', { body })` -> `api.functions.acceptInvite(body)`
- Line 116: `$supabase.auth.updateUser({ password })` -> `api.auth.updateUser({ password })`

---

### Task 4: Migrate layout (1 file)

**Files:**
- Modify: `apps/admin/layouts/default.vue`

- Line 88: replace `const { $supabase } = useNuxtApp()` with `const api = useSupabaseApi()`
- Line 156: `$supabase.auth.signOut()` -> `api.auth.signOut()`

---

### Task 5: Verify — grep for remaining violations

**Step 1: Run grep**

```bash
grep -rn '\$supabase.*useNuxtApp\|useNuxtApp.*\$supabase' apps/admin/ --include='*.vue' --include='*.ts'
```

Expected: only 3 files remain (realtime exceptions + `useSupabaseApi.ts` itself + `plugins/supabase.client.ts`):
- `composables/useSupabaseApi.ts`
- `composables/useRealtimeList.ts`
- `stores/branch.ts`
- `stores/tenant.ts`
- `plugins/supabase.client.ts`

**Step 2: Smoke test** — run `npx nuxi build` or dev server and verify no runtime errors.

**Step 3: Commit**

```bash
git add -A
git commit -m "refactor(no-refs): centralize all Supabase access through useSupabaseApi"
```
