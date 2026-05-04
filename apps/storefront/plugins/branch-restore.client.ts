import { defineNuxtPlugin, onNuxtReady } from 'nuxt/app'
import { useSelectedBranchStore } from '~/stores/selectedBranch'

export default defineNuxtPlugin(() => {
  onNuxtReady(() => {
    const branchStore = useSelectedBranchStore()
    branchStore.restore()
  })
})
