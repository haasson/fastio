import { initializeApp, cert, getApps, getApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

export function getAdminApp() {
  if (getApps().length) return getApp()

  const config = useRuntimeConfig()

  const raw = config.firebaseAdminCredentials || ''
  if (!raw) throw new Error('NUXT_FIREBASE_ADMIN_CREDENTIALS is not set')

  const credentials = JSON.parse(raw)
  if (credentials.private_key) {
    credentials.private_key = credentials.private_key.replace(/\\n/g, '\n')
  }

  return initializeApp({ credential: cert(credentials) })
}

export function getAdminDb() {
  return getFirestore(getAdminApp())
}
