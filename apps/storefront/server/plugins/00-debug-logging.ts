// TEMPORARY: форсируем blocking stdout/stderr + ловим uncaught errors.
// Без этого Node в Docker буферизует stdout (не-TTY → block-buffered), SSR crash
// уходит в /dev/null до flush'а. После того как поймаем причину 500 — удалить.
export default defineNitroPlugin(() => {
  type Handle = { setBlocking?: (b: boolean) => void } | undefined
  ;(process.stdout as unknown as { _handle?: Handle })._handle?.setBlocking?.(true)
  ;(process.stderr as unknown as { _handle?: Handle })._handle?.setBlocking?.(true)

  process.on('uncaughtException', (err) => {
    console.error('[uncaughtException]', err)
  })
  process.on('unhandledRejection', (err) => {
    console.error('[unhandledRejection]', err)
  })
})
