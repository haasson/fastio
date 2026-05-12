import { defineNuxtPlugin, onNuxtReady } from 'nuxt/app'
import { useSelectedBranchStore } from '~/features/branch'

export default defineNuxtPlugin(() => {
  onNuxtReady(() => {
    const branchStore = useSelectedBranchStore()
    branchStore.restore()
  })
})
