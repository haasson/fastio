# План: блокировка участников команды + иконки в действиях

## Контекст

Страница настроек → вкладка "Команда". Таблица участников (`SettingsTeam.vue`).
Текущие действия: Роль (dropdown) + Филиалы (кнопка) + Удалить.
Нужно: три иконки — **Изменить** (pencil), **Заблокировать** (ban), **Удалить** (trash).

---

## 1. Миграция `supabase/migrations/022_member_blocked.sql`

```sql
ALTER TABLE tenant_members ADD COLUMN blocked_until timestamptz;

-- Обновляем хелперы чтобы заблокированные не имели доступа
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

Запустить вручную в Supabase Dashboard → SQL Editor (не через `supabase db push`).

---

## 2. `packages/shared/src/types/member.ts`

Добавить поле:
```ts
blockedUntil?: string | null
```

---

## 3. `apps/admin/utils/api/db-types.ts`

В `TenantMemberRow` добавить:
```ts
blocked_until: string | null
```

---

## 4. `apps/admin/utils/api/members.ts`

Добавить методы:
```ts
async block(sb, memberId: string, blockedUntil: string) {
  await query(sb.from('tenant_members').update({ blocked_until: blockedUntil }).eq('id', memberId))
},

async unblock(sb, memberId: string) {
  await query(sb.from('tenant_members').update({ blocked_until: null }).eq('id', memberId))
},

async updateRoleAndBranches(sb, memberId: string, role: TenantRole, branchIds: string[]) {
  await query(sb.from('tenant_members').update({ role, branch_ids: branchIds }).eq('id', memberId))
},
```

---

## 5. `supabase/functions/list-team/index.ts`

В SELECT добавить `blocked_until`:
```js
.select('id, tenant_id, user_id, role, branch_ids, blocked_until, created_at')
```

В `enrichedMembers` добавить поле:
```js
blockedUntil: m.blocked_until ?? null,
```

---

## 6. `packages/ui/src/icons.ts`

Добавить иконку `Ban` из lucide:
```ts
import { ..., Ban } from 'lucide-vue-next'

export const iconRegistry = {
  ...
  ban: Ban,
}
```

---

## 7. `apps/admin/composables/useTeam.ts`

Добавить методы:
```ts
const blockMember = async (memberId: string, blockedUntil: string) => {
  await api.members.block(memberId, blockedUntil)
  await load()
}

const unblockMember = async (memberId: string) => {
  await api.members.unblock(memberId)
  await load()
}
```

Экспортировать из `return { ... }`.

---

## 8. `apps/admin/components/settings/team-columns.ts`

### Тип `MemberColumnsDeps`
Заменить `onRoleChange` + `onBranchEdit` на:
```ts
onEdit: (member: TenantMember) => void      // открывает combined edit modal
onBlock: (member: TenantMember) => void     // открывает block modal (или unblock если уже заблокирован)
onRemove: (member: TenantMember) => void
```

### Колонка "Действия"
Убрать `UiMenuDropdown`. Три иконки:
```ts
h(UiButton, { type: 'text', size: 'small', icon: 'pencil', onClick: () => onEdit(row) })
h(UiButton, { type: 'text', size: 'small', icon: isBlocked ? 'checkRound' : 'ban', onClick: () => onBlock(row) })
h(UiButton, { type: 'text', size: 'small', icon: 'trash', onClick: () => onRemove(row) })
```

Где `isBlocked`:
```ts
const isBlocked = (row: TenantMember) =>
  !!row.blockedUntil && new Date(row.blockedUntil) > new Date()
```

---

## 9. `apps/admin/components/settings/SettingsTeam.vue`

### Убрать старое
- Убрать `editingMemberBranches`, `editingBranchIds`, `savingBranches`, `openBranchEdit`, `toggleEditBranch`, `saveBranchAssignment`
- Убрать `handleRoleMenuClick`
- Убрать старый Branch assignment modal из шаблона

### Добавить combined edit modal

State:
```ts
const editingMember = ref<TenantMember | null>(null)
const editForm = reactive({ role: '' as TenantRole, branchIds: [] as string[] })
const savingEdit = ref(false)
```

Открытие:
```ts
const openEdit = (member: TenantMember) => {
  editingMember.value = member
  editForm.role = member.role
  editForm.branchIds = [...(member.branchIds ?? [])]
}
```

Сохранение:
```ts
const saveEdit = async () => {
  if (!editingMember.value) return
  savingEdit.value = true
  try {
    await api.members.updateRoleAndBranches(editingMember.value.id, editForm.role, editForm.branchIds)
    await load()
    editingMember.value = null
  } finally {
    savingEdit.value = false
  }
}
```

Шаблон модала (использовать `UiModal`, `UiSelect` для роли, `UiRadioGroup` + `UiCheckbox` для филиалов):
- Роль: `UiSelect v-model:value="editForm.role" :options="roleOptions"`
- Если `branches.length > 0 && editForm.role !== 'admin' && editForm.role !== 'owner'`:
  - `UiRadioGroup` Ко всем / К выбранным
  - Чекбоксы филиалов если "К выбранным"

### Добавить block modal

State:
```ts
const blockingMember = ref<TenantMember | null>(null)
const blockDuration = ref('1w')

const blockDurationOptions = [
  { label: '1 день', value: '1d' },
  { label: '3 дня', value: '3d' },
  { label: '1 неделя', value: '1w' },
  { label: '1 месяц', value: '1m' },
  { label: 'Навсегда', value: 'forever' },
]

const getBlockedUntil = (duration: string): string => {
  const d = new Date()
  if (duration === '1d') d.setDate(d.getDate() + 1)
  else if (duration === '3d') d.setDate(d.getDate() + 3)
  else if (duration === '1w') d.setDate(d.getDate() + 7)
  else if (duration === '1m') d.setMonth(d.getMonth() + 1)
  else d.setFullYear(9999) // навсегда
  return d.toISOString()
}
```

Обработчики:
```ts
const handleBlock = (member: TenantMember) => {
  if (isBlocked(member)) {
    // сразу разблокировать с конфирмом
    confirm({ title: 'Разблокировать участника', ... }).then(ok => ok && unblockMember(member.id))
  } else {
    blockingMember.value = member
    blockDuration.value = '1w'
  }
}

const confirmBlock = async () => {
  if (!blockingMember.value) return
  await blockMember(blockingMember.value.id, getBlockedUntil(blockDuration.value))
  blockingMember.value = null
  message.success('Участник заблокирован')
}
```

Шаблон block modal:
- `UiModal` с title "Заблокировать участника"
- `UiRadioGroup` с вариантами срока (`blockDurationOptions`)
- Кнопки: Отмена / Заблокировать (confirmType: error)

### Обновить `memberColumns`
```ts
const memberColumns = computed(() => buildMemberColumns({
  branches,
  canManageTeam,
  onEdit: openEdit,
  onBlock: handleBlock,
  onRemove: handleRemove,
}))
```

---

## Визуальные изменения в таблице

- Заблокированные участники — строка с приглушённым цветом (можно через `row-class-name` в UiDataTable или просто иконка ban подсвечивается красным)
- Иконка ban → checkRound (зелёная?) когда заблокирован и можно снять блок

---

## Порядок выполнения

1. Запустить SQL миграцию в Dashboard
2. Обновить типы и db-types
3. Обновить members.ts API
4. Обновить list-team edge function + задеплоить
5. Добавить Ban иконку в либу
6. Обновить useTeam
7. Переписать team-columns
8. Переписать SettingsTeam (убрать старое, добавить новые моды)
