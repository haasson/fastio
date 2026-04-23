import { useStorefrontUrl } from '~/composables/useStorefrontUrl'

export const useTableUrl = () => {
  const { baseUrl } = useStorefrontUrl()

  const getTableUrl = (tableId: string) => `${baseUrl.value}/table/${tableId}`

  return { baseUrl, getTableUrl }
}
