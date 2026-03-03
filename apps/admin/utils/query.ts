import { createDiscreteApi } from 'naive-ui'

const { message } = createDiscreteApi(['message'])

export const query = async <T>(
  promise: PromiseLike<{ data: T; error: { message: string } | null }>,
): Promise<T> => {
  const { data, error } = await promise

  if (error) {
    console.error('[Supabase]', error.message, error)
    message.error(error.message)
  }

  return data
}
