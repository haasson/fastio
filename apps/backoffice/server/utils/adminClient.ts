import { createClient } from '@supabase/supabase-js'
import { createPrivateKey, createSign } from 'node:crypto'

function buildEs256Jwt(jwkJson: string, supabaseUrl: string): string {
  const ecKey = JSON.parse(Buffer.from(jwkJson, 'base64').toString('utf8'))
  const privKey = createPrivateKey({ key: ecKey, format: 'jwk' })

  const header = Buffer.from(JSON.stringify({ alg: 'ES256', kid: ecKey.kid, typ: 'JWT' })).toString('base64url')
  const payload = Buffer.from(JSON.stringify({
    iss: `${supabaseUrl}/auth/v1`,
    role: 'service_role',
    aud: 'authenticated',
    exp: Math.floor(Date.now() / 1000) + 3600,
  })).toString('base64url')

  const signer = createSign('SHA256')
  signer.update(`${header}.${payload}`)
  const sig = signer.sign({ key: privKey, dsaEncoding: 'ieee-p1363' }).toString('base64url')

  return `${header}.${payload}.${sig}`
}

export function getAdminClient() {
  const config = useRuntimeConfig()
  const supabaseUrl = config.public.supabaseUrl

  const token = config.supabaseJwtPrivateKey
    ? buildEs256Jwt(config.supabaseJwtPrivateKey, supabaseUrl)
    : config.supabaseServiceKey

  return createClient(supabaseUrl, token, { auth: { persistSession: false } })
}
