import { addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { db } from './firebase'

export function logActivity(action, userId, extra = {}) {
  addDoc(collection(db, 'activityLog'), {
    action,
    userId: userId || '',
    timestamp: serverTimestamp(),
    ...extra,
  }).catch(err => console.error('Failed to log activity:', err))
}
