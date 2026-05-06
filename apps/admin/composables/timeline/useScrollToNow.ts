import { nextTick, onScopeDispose, type Ref } from 'vue'

type Params = {
  scrollRef: Ref<HTMLElement | null>
  nowTop: Ref<number | null>
}

// Высоту хедера и верхний padding контента читаем рантайм, а не хардкодим:
// header — sticky-элемент над скроллом (его высоту нужно прибавить к nowTop,
// чтобы now-линия оказалась в видимой части), padding-top контента сдвигает
// абсолютные координаты карточек/линий относительно scrollTop=0.
const measureScrollOffsets = (el: HTMLElement): { headerPx: number; contentPaddingTopPx: number } => {
  const header = el.querySelector<HTMLElement>('.grid-header')
  const content = el.querySelector<HTMLElement>('.grid-content')
  const contentPaddingTopPx = content
    ? parseFloat(getComputedStyle(content).paddingTop) || 0
    : 0

  return { headerPx: header?.offsetHeight ?? 0, contentPaddingTopPx }
}

/**
 * Императивный scroll-to-now для таймлайна. На первом тике после v-else
 * контейнер часто имеет clientHeight=0 (height вычисляется из 100dvh-calc
 * родителя). Ждём через ResizeObserver первого не-нулевого размера,
 * затем применяем скролл — иначе центрирование посчитается от высоты 0.
 */
export function useScrollToNow({ scrollRef, nowTop }: Params) {
  // Активный observer держим на уровне scope, чтобы при unmount компонента
  // (или повторном вызове scrollToNow до того как клиентHeight стал >0)
  // отключить его и не держать ссылку на DOM-элемент.
  let activeRo: ResizeObserver | null = null

  const stopActiveRo = () => {
    if (activeRo) {
      activeRo.disconnect()
      activeRo = null
    }
  }

  const applyScroll = (el: HTMLElement) => {
    if (nowTop.value === null) {
      el.scrollTop = 0

      return
    }
    const { headerPx, contentPaddingTopPx } = measureScrollOffsets(el)
    const targetTop = nowTop.value + contentPaddingTopPx + headerPx - el.clientHeight / 2

    el.scrollTop = Math.max(0, targetTop)
  }

  const scrollToNowImpl = (): Promise<void> => new Promise((resolve) => {
    const el = scrollRef.value

    if (!el) {
      resolve()

      return
    }

    if (el.clientHeight > 0) {
      applyScroll(el)
      resolve()

      return
    }

    stopActiveRo()
    activeRo = new ResizeObserver(() => {
      if (el.clientHeight > 0) {
        stopActiveRo()
        applyScroll(el)
        resolve()
      }
    })
    activeRo.observe(el)
  })

  const scrollToNow = async (): Promise<void> => {
    await nextTick()
    await scrollToNowImpl()
  }

  onScopeDispose(stopActiveRo)

  return { scrollToNow }
}
