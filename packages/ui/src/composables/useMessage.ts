import { useMessage as useNaiveMessage } from 'naive-ui'

const useMessage = () => {
  const msg = useNaiveMessage()

  return {
    success: (content: string) => msg.success(content),
    error: (content: string) => msg.error(content),
    warning: (content: string) => msg.warning(content),
    info: (content: string) => msg.info(content),
  }
}

export default useMessage
