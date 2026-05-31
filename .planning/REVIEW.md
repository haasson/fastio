---
phase: kitchen-substitution
reviewed: 2026-05-29T00:00:00Z
depth: deep
files_reviewed: 4
files_reviewed_list:
  - packages/shared/src/kitchen-helpers.ts
  - apps/admin/features/kitchen/components/KitchenSubstitutionCard.vue
  - apps/admin/pages/kitchen/queue.vue
  - apps/admin/features/kitchen/components/KitchenWorkCard.vue
findings:
  critical: 4
  warning: 6
  info: 3
  total: 13
status: issues_found
---

# Kitchen Substitution Feature — Code Review

**Reviewed:** 2026-05-29
**Depth:** deep
**Files Reviewed:** 4
**Status:** issues_found

## Summary

Фича реализует логику подмены блюда на кухне при отмене заказа. Алгоритм матчинга корректен в happy path, но содержит несколько критических дырок: race condition при одновременном claim двумя поварами, dangling reference в шаблоне при удалении отменённого item через realtime, утечка «зарезервированных» кандидатов при unmount, и некорректная логика фильтрации очереди (`cancelledQueue`) которая показывает чужие отменённые блюда всем поварам без исключения — в том числе те, что уже зарезервированы под чужую подмену.

---

## Critical Issues

### CR-01: Race condition — candidate claimed между findSubstitute и claim/acceptSubstitution

**File:** `apps/admin/pages/kitchen/queue.vue:332-352` (autoSubstitute), `355-383` (acceptSubstitution)

**Issue:** `findSubstitute()` выбирает кандидата из локального `items.value` по статусу `'queued'`. Между моментом выбора и реальным `api.kitchenQueue.claim(match.candidate.id, ...)` другой повар (или тот же повар на другой вкладке) может уже занять этот item. Claim выполнится поверх чужого state без проверки: `status` у кандидата в UI уже обновлён оптимистично на `in_progress`, а сервер вернёт обновление другому повару. Результат — два повара готовят одно блюдо, либо claim молча уходит в никуда и блюдо «зависает» со статусом `in_progress` у обоих.

Для `acceptSubstitution` окно расширяется ещё больше: кандидат резервируется на время пока повар читает карточку и думает (может быть минуты).

**Fix:** `claim` на сервере должен быть conditional update с проверкой текущего статуса (Postgres `UPDATE ... WHERE status = 'queued' AND assigned_to IS NULL RETURNING id`). Если `returning` пуст — показывать toast «блюдо уже взято» и повторно искать замену. Клиент должен обрабатывать пустой ответ от `claim`:

```typescript
const acceptSubstitution = async (cancelledId: string) => {
  // ...existing map delete...
  const claimed = await api.kitchenQueue.claim(match.candidate.id, currentUserId.value)
  if (!claimed) {
    // candidate already taken — re-run substitution search
    const newMatch = findSubstitute(cancelledItem, items.value.filter((i) => i.status === 'queued'))
    // handle newMatch or show "no longer available"
    return
  }
  // proceed with optimistic update
}
```

---

### CR-02: Dangling non-null assertion — crash при удалении cancelledItem через realtime

**File:** `apps/admin/pages/kitchen/queue.vue:72`

```html
:cancelled-item="items.find((i) => i.id === cancelledId)!"
```

**Issue:** `pendingSubstitutions` содержит `cancelledId`, а `items.value` — живой массив. Если пока карточка отображается приходит realtime DELETE event или `done`/`served` update (строка 428: `items.value = items.value.filter((i) => i.id !== item.id)`), item исчезает из массива. `items.find(...)` вернёт `undefined`, а `!` подавит TS-ошибку — Vue получит `undefined` в проп, помеченный как обязательный, и выбросит runtime exception / белый экран.

**Fix:** Хранить снапшот отменённого item прямо в записи `pendingSubstitutions` (тип `{ cancelled: KitchenQueueItem, match: SubstituteMatch }`), тогда он не зависит от живого массива:

```typescript
// В offUpdate, когда item.status === 'cancelled':
const next = new Map(pendingSubstitutions.value)
next.set(item.id, { cancelled: item, match })  // сохраняем item сразу
pendingSubstitutions.value = next
```

В шаблоне убрать поиск по `items`:
```html
:cancelled-item="match.cancelled"
```

---

### CR-03: Кандидат на подмену не защищён от захвата другим поваром на уровне сервера

**File:** `apps/admin/pages/kitchen/queue.vue:175, 244-245`

```typescript
const pendingCandidateIds = computed(() =>
  new Set([...pendingSubstitutions.value.values()].map((m) => m.candidate.id))
)
// ...
return base.filter((i) => !pendingCandidateIds.value.has(i.id))
```

**Issue:** `pendingCandidateIds` — локальный ref. Он скрывает кандидата из очереди только у того повара, у кого есть pending substitution. У повара B тот же `candidateId` остаётся видимым и кликабельным в `filteredQueueItems`. Повар B берёт кандидата раньше чем повар A нажимает «Взять» — и CR-01 материализуется гарантированно.

Кроме того, если у одного повара появляются два одновременных pending substitution с одинаковым кандидатом (см. WR-03), оба отобразятся и первый `acceptSubstitution` успешно заберёт кандидата, а второй — заклеймит уже занятое блюдо.

**Fix:** Резервирование должно быть серверным. При добавлении pending substitution (similar match) вызывать `api.kitchenQueue.softReserve(candidateId, currentUserId.value)`, при skip/accept — снимать. Пока это не реализовано — хотя бы немедленно переводить кандидата оптимистично в `reserved` статус в `items.value` (если схема позволяет), чтобы другие computed его не подхватили.

---

### CR-04: Ошибки в autoSubstitute поглощаются молча — нет error handling и нет rollback

**File:** `apps/admin/pages/kitchen/queue.vue:332-353`

```typescript
const autoSubstitute = async (cancelled: KitchenQueueItemType, match: SubstituteMatch) => {
  // ...optimistic updates applied...
  await Promise.all([
    api.kitchenQueue.claim(match.candidate.id, currentUserId.value),
    api.kitchenQueue.dismissCancelled(cancelled.id),
  ])
  logKitchenEvent(...)
}
```

**Issue:** `autoSubstitute` вызывается как fire-and-forget (строка 418, без `await` и без `.catch()`). Если `Promise.all` бросает (сетевой сбой, 5xx), ошибка становится unhandled promise rejection. Оптимистичный update (`queueItem.status = 'in_progress'`, `items.value.filter(cancelled)`) уже применён — UI показывает подмену как совершённую, но в базе ничего не изменилось. При следующем realtime update данные придут обратно в несогласованном состоянии.

**Fix:**

```typescript
// В offUpdate:
autoSubstitute(item, match).catch((e) =>
  reportError(e, { context: 'kitchen/offUpdate/autoSubstitute', candidateId: match.candidate.id })
)

// Внутри autoSubstitute — добавить try/catch с rollback:
try {
  await Promise.all([...])
} catch (e) {
  reportError(e, { context: 'kitchen/autoSubstitute' })
  // rollback optimistic updates
  if (queueItem) {
    queueItem.status = 'queued'
    queueItem.assignedTo = null
    queueItem.assignedAt = null
  }
  // restore cancelled item in items (или дождаться realtime)
  throw e
}
```

---

## Warnings

### WR-01: normModifierKey сортирует только по optionName — игнорирует groupName

**File:** `packages/shared/src/kitchen-helpers.ts:16-17`

```typescript
const normModifierKey = (item: KitchenQueueItem): string =>
  item.modifiers.map((m) => m.optionName).sort().join('\0')
```

**Issue:** `OrderItemModifier` имеет поля `groupName` и `optionName`. Если два разных модификатора в разных группах имеют одинаковое `optionName` (например, «Средний» в группе «Размер» и «Средний» в группе «Острота»), они дадут одинаковый ключ — и блюда с разными модификаторами будут считаться совпавшими.

**Fix:**
```typescript
const normModifierKey = (item: KitchenQueueItem): string =>
  item.modifiers.map((m) => `${m.groupName}\x1f${m.optionName}`).sort().join('\0')
```

---

### WR-02: autoSubstitute вызывается без await и без .catch()

**File:** `apps/admin/pages/kitchen/queue.vue:417-418`

```typescript
if (match.type === 'exact') {
  autoSubstitute(item, match)  // fire-and-forget
```

**Issue:** Unhandled promise rejection при любой ошибке. Связан с CR-04, выделен отдельно как pattern-level проблема: все async функции в обработчиках realtime событий должны иметь явный `.catch()`.

**Fix:**
```typescript
autoSubstitute(item, match).catch((e) =>
  reportError(e, { context: 'kitchen/offUpdate/autoSubstitute' })
)
```

---

### WR-03: Два одновременных cancelled от одного повара могут выбрать одного и того же кандидата

**File:** `apps/admin/pages/kitchen/queue.vue:413-425`

**Issue:** Realtime события могут прийти подряд для двух блюд одного повара. При обработке первого `findSubstitute` вызывается с `items.value.filter(queued)`, кандидат Y найден и добавлен в `pendingSubstitutions`. При обработке второго `findSubstitute` вызывается снова — `pendingSubstitutions` уже содержит Y, но в `items.value` он всё ещё `queued` (оптимистичного update ещё не было, т.к. pending, а не exact). Y будет выбран снова как кандидат для второго cancelled item. Оба `pendingSubstitutions` будут указывать на одного кандидата — первый `acceptSubstitution` пройдёт, второй зашлёт дублирующий claim на уже занятое блюдо.

**Fix:** При построении списка очереди для `findSubstitute` исключать уже зарезервированных кандидатов:
```typescript
const alreadyReserved = new Set([...pendingSubstitutions.value.values()].map((m) => m.candidate.id))
const match = findSubstitute(
  item,
  items.value.filter((i) => i.status === 'queued' && !alreadyReserved.has(i.id))
)
```

---

### WR-04: v-for по Map — менее идиоматично, риск при будущих изменениях Vue реактивности

**File:** `apps/admin/pages/kitchen/queue.vue:70`

```html
v-for="[cancelledId, match] in pendingSubstitutions"
```

**Issue:** Vue 3 поддерживает итерацию по Map в `v-for`, но это работает только с `ref<Map>` при переприсваивании (не при мутации). Код корректно переприсваивает Map везде. Тем не менее, итерация по Map менее идиоматична чем computed-массив, и при любом рефакторинге (например, случайном `.set()` вместо замены) реактивность тихо сломается.

**Fix:**
```typescript
const pendingSubstitutionsList = computed(() =>
  [...pendingSubstitutions.value.entries()]
)
```
```html
v-for="[cancelledId, match] in pendingSubstitutionsList"
```

---

### WR-05: skipSubstitution не логирует событие — потеря аудит-трейла

**File:** `apps/admin/pages/kitchen/queue.vue:386-393`

**Issue:** `claimDish`, `completeDish`, `unclaimDish` — все вызывают `logKitchenEvent`. `skipSubstitution` — нет. Если повар «выбрасывает» отменённое блюдо без подмены, это действие нигде не отражается в истории заказа.

**Fix:**
```typescript
const skipSubstitution = async (cancelledId: string) => {
  const match = pendingSubstitutions.value.get(cancelledId)
  const next = new Map(pendingSubstitutions.value)
  next.delete(cancelledId)
  pendingSubstitutions.value = next
  items.value = items.value.filter((i) => i.id !== cancelledId)
  await api.kitchenQueue.dismissCancelled(cancelledId)
  if (match) {
    logKitchenEvent(cancelledId, 'kitchen_substitution_skipped', {
      candidateId: match.candidate.id,
      candidateOrderId: match.candidate.orderId,
    })
  }
}
```

---

### WR-06: KitchenSubstitutionCard рендерит пустой diff-блок если вызван для exact match

**File:** `apps/admin/features/kitchen/components/KitchenSubstitutionCard.vue:10-51`

**Issue:** Компонент не получает `matchType` и не проверяет пустоту `diff`. Сейчас карточка рендерится только для similar (exact автоматически применяется) — это верно. Но `.notice` содержит текст «отличия:» без проверки что отличия непусты. Если в будущем карточка будет вызвана для exact (например, при отключённом auto-accept), пользователь увидит «отличия:» с пустым блоком под ним.

**Fix:** Добавить guard на пустой diff:
```html
<div v-if="hasDiff" class="notice">
  В очереди похожее блюдо из заказа #{{ candidate.orderNumber }} — отличия:
</div>
<div v-else class="notice">
  В очереди идентичное блюдо из заказа #{{ candidate.orderNumber }}
</div>
```
```typescript
const hasDiff = computed(() =>
  props.diff.addedAddons.length > 0 ||
  props.diff.removedAddons.length > 0 ||
  props.diff.restoredIngredients.length > 0 ||
  props.diff.newlyRemovedIngredients.length > 0
)
```

---

## Info

### IN-01: Два отдельных import из @fastio/shared можно объединить

**File:** `apps/admin/features/kitchen/components/KitchenSubstitutionCard.vue:61-62`

```typescript
import type { KitchenQueueItem } from '@fastio/shared'
import type { DishDiff } from '@fastio/shared'
```

**Fix:**
```typescript
import type { KitchenQueueItem, DishDiff } from '@fastio/shared'
```

---

### IN-02: findSubstitute возвращает первый similar матч без ранжирования по близости

**File:** `packages/shared/src/kitchen-helpers.ts:52`

**Issue:** Среди similar кандидатов возвращается первый попавшийся, а не тот с наименьшим количеством отличий. Если в очереди 3 похожих блюда с 5, 1 и 3 отличиями — повар увидит карточку с 5 отличиями вместо наиболее близкой.

**Fix (опционально):**
```typescript
const similarMatches = scoredMatches
  .filter((m) => m.type === 'similar')
  .sort((a, b) => {
    const score = (m: SubstituteMatch) =>
      m.diff.addedAddons.length + m.diff.removedAddons.length +
      m.diff.restoredIngredients.length + m.diff.newlyRemovedIngredients.length
    return score(a) - score(b)
  })
return scoredMatches.find((m) => m.type === 'exact') ?? similarMatches[0] ?? null
```

---

### IN-03: KitchenWorkCard.vue — правка color-error-bg -> color-error-light корректна

**File:** `apps/admin/features/kitchen/components/KitchenWorkCard.vue:138`

Токен `color-error-light` соответствует паттерну других компонентов проекта. Замечаний нет.

---

_Reviewed: 2026-05-29_
_Reviewer: Claude (adversarial code review)_
_Depth: deep_
