import { initializeApp, cert, getApps, getApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

export function getAdminApp() {
  if (getApps().length) return getApp()

  const config = useRuntimeConfig()

  const b64 = config.firebaseAdminCredentialsB64 as string
  if (!b64) throw new Error('NUXT_FIREBASE_ADMIN_CREDENTIALS_B64 is not set')

  const credentials = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'))

  return initializeApp({ credential: cert(credentials) })
}

export function getAdminDb() {
  return getFirestore(getAdminApp())
}
