# План: фикс замечаний code review (member block feature)

## Замечания

| # | Приоритет | Проблема |
|---|-----------|---------|
| 1 | Критично | `022_member_blocked.sql` не создана — RLS-хелперы не обновлены, заблокированные имеют доступ |
| 2 | Важно | `resendInvite` не отправляет email — только обновляет токен в БД |
| 3 | Незначительно | `inviteBranchIds` собирается в форме, но не передаётся в `invite-member` |
| 4 | Косметика | Съехавший отступ `:bordered="false"` в `SettingsTeam.vue:47` |
| 5 | Косметика | `.member-invited-by` не имеет стиля в `SettingsTeam.vue` |

---

## 1. Миграция `022_member_blocked.sql`

**Файл:** `supabase/migrations/022_member_blocked.sql`

```sql
ALTER TABLE tenant_members ADD COLUMN IF NOT EXISTS blocked_until timestamptz;

CREATE OR REPLACE FUNCTION is_tenant_member(_tenant_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM tenant_members
    WHERE tenant_id = _tenant_id
      AND user_id = auth.uid()
      AND (blocked_until IS NULL OR blocked_until < now())
  );
$$;

CREATE OR REPLACE FUNCTION has_tenant_role(_tenant_id uuid, _min_role tenant_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM tenant_members
    WHERE tenant_id = _tenant_id
      AND user_id = auth.uid()
      AND (blocked_until IS NULL OR blocked_until < now())
      AND ARRAY_POSITION(ARRAY['owner','admin','manager','staff']::tenant_role[], role)
       <= ARRAY_POSITION(ARRAY['owner','admin','manager','staff']::tenant_role[], _min_role)
  );
$$;
```

Запустить в Supabase Dashboard → SQL Editor.

---

## 2. Edge function `resend-invite`

Сейчас `invitations.ts#resend()` только обновляет токен в БД — письмо не отправляется.
Нужна новая edge function по аналогии с `invite-member`.

### 2.1 Создать `supabase/functions/resend-invite/index.ts`

Логика:
1. Принимает `{ invitationId }`
2. Авторизует вызывающего
3. Получает инвайт по `id` (`email`, `role`, `tenant_id`)
4. Проверяет что вызывающий — `admin+` в этом тенанте
5. Генерирует новый `token`, обновляет `expires_at = now() + 7 days`
6. Шлёт письмо через SendGrid (та же логика что в `invite-member`)
7. Возвращает `{ success: true }`

### 2.2 Обновить `apps/admin/utils/api/invitations.ts`

Заменить прямой `update` в `resend()` на вызов edge function:

```ts
async resend(sb: SupabaseClient, invitationId: string) {
  const { error } = await sb.functions.invoke('resend-invite', {
    body: { invitationId },
  })
  if (error) throw error
},
```

### 2.3 Обновить `apps/admin/composables/useTeam.ts`

Добавить `await load()` после `resendInvite` (сейчас пропущен — список не обновляется после переотправки):

```ts
const resendInvite = async (invitationId: string) => {
  await api.invitations.resend(invitationId)
  await load()
}
```

---

## 3. `branchIds` в приглашениях

Сейчас `inviteBranchIds` собирается в форме, но нигде не используется — `useTeam.invite()` не принимает этот параметр, `invite-member` его не сохраняет, колонка "Филиалы" в инвайтах всегда показывает "Все".

### 3.1 Миграция (добавить к `022_member_blocked.sql` или отдельным файлом)

```sql
ALTER TABLE tenant_invitations ADD COLUMN IF NOT EXISTS branch_ids uuid[] NOT NULL DEFAULT '{}';
```

### 3.2 `supabase/functions/invite-member/index.ts`

Принять `branchIds?: string[]` из тела запроса и сохранить при `insert`:

```ts
const { tenantId, email, role, branchIds = [] } = await req.json()
// ...
.insert({ ..., branch_ids: branchIds })
```

### 3.3 `packages/shared/src/types/member.ts`

Добавить поле в `TenantInvitation`:

```ts
branchIds: string[]
```

### 3.4 `apps/admin/utils/api/db-types.ts`

В `TenantInvitationRow` добавить:

```ts
branch_ids: string[]
```

### 3.5 `apps/admin/utils/api/invitations.ts`

В `mapInvitation` добавить маппинг:

```ts
branchIds: row.branch_ids ?? [],
```

### 3.6 `apps/admin/composables/useTeam.ts`

Добавить параметр `branchIds` в `invite()`:

```ts
const invite = async (email: string, role: TenantRole, branchIds: string[] = []) => {
  await api.functions.inviteMember({ tenantId, email, role, branchIds })
  // ...
}
```

### 3.7 `apps/admin/components/settings/SettingsTeam.vue`

В `handleInvite` передать `inviteBranchIds.value`:

```ts
await invite(inviteEmail.value, inviteRole.value, inviteBranchIds.value)
```

### 3.8 `apps/admin/components/settings/team-columns.ts`

Колонка "Филиалы" в инвайтах — показывать реальные данные (аналогично колонке у мемберов):

```ts
render: (row) => {
  if (!row.branchIds?.length)
    return h(UiText, { size: 'tiny', class: 'hint-cell' }, () => 'Все')

  const names = branches.value
    .filter((b) => row.branchIds.includes(b.id))
    .map((b) => b.name)
    .join(', ')

  return h(UiText, { size: 'tiny' }, () => names)
}
```

### 3.9 `supabase/functions/list-team/index.ts`

В запросе инвайтов добавить `branch_ids` в select и пробросить в ответ:

```ts
.select('id, tenant_id, email, role, invited_by, token, expires_at, accepted_at, created_at, branch_ids')
// ...
branchIds: inv.branch_ids ?? [],
```

---

## 4. Косметика

### 4.1 Отступ `:bordered="false"` в `SettingsTeam.vue:47`

```html
<!-- было -->
:bordered="false"
<!-- стало -->
        :bordered="false"
```

### 4.2 Стиль `.member-invited-by` в `SettingsTeam.vue`

Добавить в `<style scoped>` — приглушённый текст меньшего размера:

```css
:deep(.member-invited-by) {
  color: var(--color-text-tertiary);
}
```

---

## Порядок выполнения

1. SQL: создать и выполнить `022_member_blocked.sql` (с `ALTER TABLE tenant_invitations` тоже)
2. Типы: `TenantInvitation.branchIds`, `TenantMemberRow`, `TenantInvitationRow`
3. API: `invitations.ts` — маппинг `branchIds`, метод `resend` → edge function
4. Edge functions: создать `resend-invite`, обновить `invite-member` (branchIds), обновить `list-team` (branch_ids в инвайтах) → задеплоить
5. `useTeam.ts`: параметр `branchIds` в `invite`, `await load()` в `resendInvite`
6. `team-columns.ts`: колонка "Филиалы" в инвайтах
7. `SettingsTeam.vue`: передать `inviteBranchIds` в `invite`, отступ, стиль `.member-invited-by`
