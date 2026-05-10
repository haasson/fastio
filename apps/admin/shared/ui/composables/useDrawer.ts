import { ref } from 'vue'

const useDrawer = <T = null>() => {
  const isOpen = ref(false)
  const data = ref<T | null>(null)

  const open = (item: T | null = null) => {
    data.value = item
    isOpen.value = true
  }

  const close = () => {
    isOpen.value = false
    data.value = null
  }

  return { isOpen, data, open, close }
}

export default useDrawer
