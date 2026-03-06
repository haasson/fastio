import { ref, watch } from 'vue'

const useDelayedLoading = (loading: Ref<boolean>, delay = 1000) => {
  const showSkeleton = ref(false)
  let timer: ReturnType<typeof setTimeout> | null = null

  watch(loading, (isLoading) => {
    if (isLoading) {
      timer = setTimeout(() => {
        showSkeleton.value = true
      }, delay)
    } else {
      if (timer) {
        clearTimeout(timer)
        timer = null
      }
      showSkeleton.value = false
    }
  }, { immediate: true })

  return { showSkeleton }
}

export default useDelayedLoading
