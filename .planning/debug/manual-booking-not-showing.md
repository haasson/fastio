---
slug: manual-booking-not-showing
status: resolved
trigger: "Ручное бронирование не работает — создаётся бронь, но ничего не появляется в списке"
created: 2026-06-03
updated: 2026-06-03
---

## Symptoms

- **Expected:** После создания брони запись появляется в списке броней
- **Actual:** Форма закрывается, список пустой, брони не видно
- **Errors:** Нет ошибок в консоли браузера, нет упавших network-запросов
- **Reproduction:** Открыть раздел бронирований → нажать "Создать бронь" → заполнить форму → сохранить → форма закрылась, список пустой

## Current Focus

hypothesis: "ReservationDrawer не передаёт branchId при создании брони → INSERT пишет branch_id = null → list() с eq('branch_id', currentBranchId) не возвращает новую запись"
test: "При currentBranchId != null создать бронь → проверить в БД branch_id → должен совпадать с currentBranchId"
expecting: "После фикса бронь появляется в списке"
next_action: "fix applied"
reasoning_checkpoint: "Симптом: форма закрывается (нет исключения при CREATE) + список пустеет после refresh(). Это означает: INSERT успешен, но SELECT не возвращает запись. Причина: branch_id = null в БД, а list() фильтрует eq('branch_id', X). Realtime тоже блокирует: onInsert проверяет branchId !== currentBranchId."

## Evidence

- timestamp: 2026-06-03T00:00:00Z
  file: apps/admin/features/reservations/components/ReservationDrawer.vue
  note: "onSave() при создании новой брони (r === null) вызывает reservationsStore.create() без branchId"

- timestamp: 2026-06-03T00:00:00Z
  file: apps/admin/features/reservations/api/reservations.ts
  note: "reservationsApi.list() применяет фильтр .eq('branch_id', branchId) когда branchId задан"

- timestamp: 2026-06-03T00:00:00Z
  file: apps/admin/features/reservations/composables/useReservations.ts
  note: "fetch() передаёт branchId.value в list(); onInsert проверяет r.branchId !== branchId.value и отбрасывает бронь если не совпадает"

- timestamp: 2026-06-03T00:00:00Z
  file: apps/admin/pages/reservations/list.vue
  note: "@saved='reservationsStore.refresh()' — вызывает refresh после создания, который перезапрашивает список с branchId-фильтром"

## Eliminated

- RLS policies — INSERT успешен (форма закрывается, нет ошибок)
- network ошибки — не наблюдаются
- статус брони — новая бронь имеет статус 'pending', который входит в RESERVATION_ACTIVE_STATUSES

## Resolution

root_cause: "ReservationDrawer.onSave() не передавал branchId при вызове reservationsStore.create(), из-за чего бронь создавалась с branch_id = null в БД. После создания @saved триггерил refresh(), который делал list() с фильтром eq('branch_id', currentBranchId) — запись с branch_id = null не попадала в выборку. Realtime-подписка тоже отфильтровывала запись по той же причине (onInsert guard: r.branchId !== branchId.value)."
fix: "В ReservationDrawer.vue добавлен импорт useBranchStore и передача branchStore.currentBranchId как branchId при вызове reservationsStore.create(). Воспроизводится только когда пользователь выбрал конкретный филиал (currentBranchId != null); в режиме 'все филиалы' (currentBranchId = null) баг не проявлялся."
verification: "Создать бронь при выбранном конкретном филиале → бронь должна появиться в списке немедленно после закрытия формы"
files_changed:
  - apps/admin/features/reservations/components/ReservationDrawer.vue
