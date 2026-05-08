import { watch, onMounted, onUnmounted } from 'vue'

/**
 * Глобальный singleton-менеджер:
 * - closeHandlers: стек закрывашек открытых модалок (LIFO — закрываем верхнюю).
 * - pendingProgrammaticBack: счётчик popstate, которые мы сами вызвали через history.back()
 *   и должны проигнорировать. Счётчик, а не boolean — на случай нескольких одновременных
 *   программных закрытий.
 */
const closeHandlers: (() => void)[] = []
let initialized = false
let pendingProgrammaticBack = 0

// HMR: при горячей перезагрузке модуль пересоздаётся, но слушатель от прошлой версии
// остаётся висеть на window — сбрасываем флаг, чтобы новый модуль переустановил listener.
if (typeof import.meta !== 'undefined' && (import.meta as { hot?: { dispose: (cb: () => void) => void } }).hot) {
  (import.meta as { hot: { dispose: (cb: () => void) => void } }).hot.dispose(() => {
    initialized = false
    closeHandlers.length = 0
    pendingProgrammaticBack = 0
  })
}

function ensureInitialized() {
  if (initialized || typeof window === 'undefined') return
  initialized = true
  window.addEventListener('popstate', (e: PopStateEvent) => {
    if (pendingProgrammaticBack > 0) {
      pendingProgrammaticBack--
      return
    }
    // Реагируем только если уходим С нашей fsModal-записи. Если state уже не наш
    // (Vue Router SPA-переход, чужой pushState) — не трогаем модалки.
    if (!(e.state && (e.state as { fsModal?: boolean }).fsModal)) {
      closeHandlers[closeHandlers.length - 1]?.()
    }
  })
}

/**
 * @param options.silent — не пушим запись в history и не делаем history.back при закрытии.
 *   Только регистрируемся в LIFO-стеке закрывашек: на back попадёт верхний модал.
 *   Нужно для блокирующих imperative-диалогов (ConfirmDialog), которые открываются
 *   поверх обычного модала и не должны добавлять собственную запись в навигацию.
 */
export function useModalHistory(
  isOpen: () => boolean,
  close: () => void,
  options: { silent?: boolean } = {},
) {
  if (typeof window === 'undefined') return

  ensureInitialized()

  const { silent = false } = options

  // pushed — мы добавили свою запись в history и должны её убрать при закрытии.
  // closingViaBack — закрытие инициировано popstate-хендлером, а не пропсом,
  //   значит history-запись уже ушла сама и history.back() дёргать НЕ надо.
  let pushed = false
  let closingViaBack = false

  const handler = () => {
    closingViaBack = true
    close()
  }

  const pushEntry = () => {
    if (pushed) return
    if (!silent) history.pushState({ fsModal: true }, '')
    closeHandlers.push(handler)
    pushed = true
  }

  const popEntry = () => {
    const idx = closeHandlers.lastIndexOf(handler)
    if (idx !== -1) closeHandlers.splice(idx, 1)
    if (!pushed) return
    pushed = false
    if (closingViaBack) {
      closingViaBack = false
      return
    }
    if (silent) return
    pendingProgrammaticBack++
    history.back()
  }

  // flush: 'sync' — pushState должен произойти синхронно при изменении modelValue,
  // иначе browser back-жест может обогнать наш push и порядок записей поедет.
  watch(isOpen, (val) => {
    if (val) pushEntry()
    else popEntry()
  }, { flush: 'sync' })

  // Deeplink: модалка может быть открыта уже на маунте — watch без immediate это пропустит.
  onMounted(() => {
    if (isOpen()) pushEntry()
  })

  onUnmounted(() => {
    const idx = closeHandlers.lastIndexOf(handler)
    if (idx !== -1) closeHandlers.splice(idx, 1)
    // Не дёргаем history.back(): обычно unmount — это route-переход, лишний back ломает навигацию.
    pushed = false
  })
}
