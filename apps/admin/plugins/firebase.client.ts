import { initializeApp, getApps } from 'firebase/app'
import { getAuth, onAuthStateChanged } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'
import { useAuthStore } from '~/stores/auth'

export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig()

  const app = getApps().length
    ? getApps()[0]
    : initializeApp({
        apiKey: config.public.firebaseApiKey,
        authDomain: config.public.firebaseAuthDomain,
        projectId: config.public.firebaseProjectId,
        storageBucket: config.public.firebaseStorageBucket,
        messagingSenderId: config.public.firebaseMessagingSenderId,
        appId: config.public.firebaseAppId,
      })

  const auth = getAuth(app)
  const db = getFirestore(app)
  const storage = getStorage(app)

  // Синхронизируем состояние авторизации с Pinia store
  const authStore = useAuthStore()
  onAuthStateChanged(auth, (user) => {
    authStore.setUser(user)
  })

  return {
    provide: { auth, db, storage },
  }
})
