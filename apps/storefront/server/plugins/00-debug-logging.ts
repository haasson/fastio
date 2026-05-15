// TEMPORARY: форсируем blocking stdout/stderr + ловим uncaught errors.
// Без этого Node в Docker буферизует stdout (не-TTY → block-buffered), SSR crash
// уходит в /dev/null до flush'а. После того как поймаем причину 500 — удалить.
export default defineNitroPlugin((nitroApp) => {
  type Handle = { setBlocking?: (b: boolean) => void } | undefined
  ;(process.stdout as unknown as { _handle?: Handle })._handle?.setBlocking?.(true)
  ;(process.stderr as unknown as { _handle?: Handle })._handle?.setBlocking?.(true)

  console.error('[debug-plugin] loaded — uncaught + nitro:error handlers armed')

  process.on('uncaughtException', (err) => {
    console.error('[uncaughtException]', err)
  })
  process.on('unhandledRejection', (err) => {
    console.error('[unhandledRejection]', err)
  })

  nitroApp.hooks.hook('error', (err, ctx) => {
    console.error('[nitro:error]', {
      url: ctx?.event?.path ?? '?',
      method: ctx?.event?.method ?? '?',
      stack: (err as Error)?.stack ?? String(err),
    })
  })

  nitroApp.hooks.hook('render:response', (response, ctx) => {
    if (response?.statusCode && response.statusCode >= 500) {
      console.error('[render:response]', {
        url: ctx?.event?.path,
        status: response.statusCode,
        body: typeof response.body === 'string' ? response.body.slice(0, 500) : '?',
      })
    }
  })
})
