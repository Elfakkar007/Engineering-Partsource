import { initializeApp } from 'firebase/app'
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore'
import { getAuth } from 'firebase/auth'

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCsz7pF8FAfnLhwceasjn-s9qwih-RnGj4",
  authDomain: "plantsourcing-app.firebaseapp.com",
  projectId: "plantsourcing-app",
  storageBucket: "plantsourcing-app.firebasestorage.app",
  messagingSenderId: "417344730126",
  appId: "1:417344730126:web:f722c9c14d0cc0419af85f"
}

// Initialize Firebase
const app = initializeApp(firebaseConfig)

// Initialize Firestore dengan offline persistence (API baru, menggantikan
// enableIndexedDbPersistence yang deprecated). persistentMultipleTabManager
// dipertahankan supaya perilaku multi-tab (mis. admin & intern buka di 2
// window Chrome sekaligus) tetap didukung sinkron, bukan gagal seperti
// peringatan 'failed-precondition' di versi lama.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
  }),
})

console.log('✅ Firestore offline persistence enabled (multi-tab)')

// Initialize Auth
export const auth = getAuth(app)

export default app