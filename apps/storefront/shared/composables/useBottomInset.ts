import { watch, onScopeDispose, toValue, type MaybeRefOrGetter } from 'vue'

// Единый источник правды для высоты «прибитого снизу» (FAB-кнопки, нижние бары).
// Резерв-паддинги контента и плавающие уведомления/тосты читают CSS-переменную
// --app-bottom-inset, чтобы ничто не перекрывало низ экрана.
//
// Источники взаимоисключающие по роутам (PageShell-FAB vs table-mode bar живут в
// разных лейаутах), но на случай сосуществования объединяем активные значения
// через CSS max() — единицы могут быть разными (px + env()), CSS их сам разрулит.
const sources = new Map<string, string>()

const flush = () => {
  if (!import.meta.client) return

  const values = [...sources.values()]
  const value = values.length === 0
    ? '0px'
    : values.length === 1
      ? values[0]
      : `max(${values.join(', ')})`

  document.documentElement.style.setProperty('--app-bottom-inset', value)
}

export function useBottomInset() {
  // Регистрирует высоту нижнего фикс-элемента под ключом. Геттер отдаёт CSS-длину
  // когда элемент виден, либо null — тогда источник снимается. Снятие при анмаунте
  // компонента — через onScopeDispose.
  const register = (key: string, value: MaybeRefOrGetter<string | null>) => {
    watch(
      () => toValue(value),
      (v) => {
        if (v) sources.set(key, v)
        else sources.delete(key)
        flush()
      },
      { immediate: true },
    )

    onScopeDispose(() => {
      sources.delete(key)
      flush()
    })
  }

  return { register }
}
