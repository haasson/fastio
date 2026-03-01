import { initializeApp, cert, getApps, getApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

export function getAdminApp() {
  if (getApps().length) return getApp()

  const config = useRuntimeConfig()

  try {
    const credentials = JSON.parse(config.firebaseAdminCredentials || '{}')
    if (credentials.project_id) {
      return initializeApp({ credential: cert(credentials) })
    }
  } catch {
    // credentials not set — dev mode
  }

  return initializeApp()
}

export function getAdminDb() {
  return getFirestore(getAdminApp())
}
