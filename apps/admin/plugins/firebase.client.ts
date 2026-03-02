import { initializeApp, getApps } from 'firebase/app'
import { getAuth, onAuthStateChanged, connectAuthEmulator } from 'firebase/auth'
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore'
import { getStorage, connectStorageEmulator } from 'firebase/storage'
import { useAuthStore } from '~/stores/auth'

export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig()

  const isNew = !getApps().length
  const app = isNew
    ? initializeApp({
        apiKey: config.public.firebaseApiKey,
        authDomain: config.public.firebaseAuthDomain,
        projectId: config.public.firebaseProjectId,
        storageBucket: config.public.firebaseStorageBucket,
        messagingSenderId: config.public.firebaseMessagingSenderId,
        appId: config.public.firebaseAppId,
      })
    : getApps()[0]

  const auth = getAuth(app)
  const db = getFirestore(app)
  const storage = getStorage(app)

  if (import.meta.dev && isNew) {
    connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true })
    connectFirestoreEmulator(db, 'localhost', 8080)
    connectStorageEmulator(storage, 'localhost', 9199)
  }

  // Синхронизируем состояние авторизации с Pinia store
  const authStore = useAuthStore()
  onAuthStateChanged(auth, (user) => {
    authStore.setUser(user)
  })

  return {
    provide: { auth, db, storage },
  }
})
