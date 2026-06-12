import { computed } from 'vue'
import { useRuntimeConfig } from '#imports'
import useLegalCompliance from './useLegalCompliance'

// Логин на витрине возможен только когда заведение заполнило юр.данные И настроен Telegram-бот.
// Иначе модалка входа — тупик (показывает алерт), поэтому точку входа (иконку «Войти») прячем.
export default function useCanLogin() {
  const config = useRuntimeConfig()
  const { legalInfoComplete } = useLegalCompliance()
  const telegramEnabled = computed(() => !!config.public.telegramClientBotUsername)
  const canLogin = computed(() => legalInfoComplete.value && telegramEnabled.value)

  return { canLogin }
}
