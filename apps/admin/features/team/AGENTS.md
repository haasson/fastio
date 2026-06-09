# team — заметка для агента

Команда тенанта: участники, роли, инвайты (shared). Полная мета — `feature.manifest.ts`.

## Что модуль делает

CRUD участников (`tenant_members`), управление ролями (`tenant_roles` — кастомные роли тенанта, гейтятся `customRoles` модулем), инвайты (`tenant_invitations`) с одноразовыми токенами. Приём инвайта — в фиче `auth` (`pages/invite.vue`), запись акцепта — здесь (`invitations.accept`).

## Карта модуля

| Файл | Что внутри |
|---|---|
| `api/members.ts` | CRUD участников + смена роли |
| `api/invitations.ts` | Создание/принятие/отзыв инвайта. `peek(token)` — публичный safe-метод для `pages/invite.vue` (без авторизации) |
| `api/roles.ts` | CRUD кастомных ролей. Системные роли (owner, admin, manager, etc.) — read-only |
| `composables/useTeam.ts` | Список + операции (invite, removeMember, changeRole) |
| `composables/useRoles.ts` | Список ролей + permissions matrix |

## Типовые задачи

- **Новый permission key:** добавь в `permissionGroups` в `apps/admin/config/team-roles.ts` (он один источник правды) + расширь `PermissionKey` тип в `@fastio/shared` + допиши в `ALL_PERMISSION_KEYS` теста `config/__tests__/team-roles.test.ts`. Дефолтные роли новых тенантов задаются триггером `create_default_roles()` (последняя версия — миграция 320) — обнови его новой миграцией, если право нужно из коробки.
- **Кастомная роль:** возможно только если в плане `customRoles=true` (проверь через `useGate`). UI — `pages/team/roles.vue`, мутации — `api/roles`.
- **Пресеты ролей:** статичные job-specific заготовки прав в `getRolePresets()` (`config/team-roles.ts`), под вертикаль (retail/services). Чипы «Начать с пресета» в `RoleEditModal.vue` — клик ЗАМЕНЯЕТ матрицу прав. Дополняют generic дефолт-роли, не дублируют их.
- **Multi-branch доступ:** `tenant_members.branch_ids` — массив `branch_id`. `null` = доступ ко всем филиалам. Логика выборки — в `useTeam`.

## Антипаттерны (не делай так)

- ❌ Создавать `tenant_members.role` как enum в коде — роли хранятся как FK на `tenant_roles.id`, потому что они кастомизируемые.
- ❌ Слать инвайт без RPC `send_invitation_email` — токен будет создан, но письмо не уйдёт.
- ❌ Менять `tenant_invitations.token` существующего инвайта — токены одноразовые, если нужно обновить — отзови (`revoke`) и создай новый.
- ❌ Чекать `permissions` хардкодом строки — используй `usePermissions().can('foo.bar')` (она знает текущую роль).

## Куда расти

SSO/SAML — отдельная фича `auth-sso` (когда понадобится enterprise). В `team` только локальные инвайты.
