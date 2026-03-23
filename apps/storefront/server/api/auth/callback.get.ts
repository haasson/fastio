export default defineEventHandler(async (event) => {
  const url = getRequestURL(event)
  const code = url.searchParams.get('code')

  if (!code) {
    return sendRedirect(event, '/?auth_error=no_code')
  }

  // Pass the code to the client for PKCE exchange
  return sendRedirect(event, `/?auth_code=${code}`)
})
