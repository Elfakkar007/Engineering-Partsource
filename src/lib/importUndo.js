import { db } from './firebase'
import { collection, query, where, getDocs, writeBatch } from 'firebase/firestore'

export async function undoImportBatch(importBatchId, onProgress = () => {}) {
  const compQ = query(collection(db, 'components'), where('importBatchId', '==', importBatchId))
  const compSnap = await getDocs(compQ)
  
  let batch = writeBatch(db)
  let count = 0
  
  for (const docSnap of compSnap.docs) {
    batch.delete(docSnap.ref)
    count++
    if (count % 500 === 0) {
      onProgress(`Membatalkan import... ${count} baris`)
      await batch.commit()
      batch = writeBatch(db)
    }
  }
  if (count % 500 !== 0) await batch.commit()
  
  const locQ = query(collection(db, 'locations'), where('importBatchId', '==', importBatchId))
  const locSnap = await getDocs(locQ)
  
  batch = writeBatch(db)
  count = 0
  for (const docSnap of locSnap.docs) {
    batch.delete(docSnap.ref)
    count++
    if (count % 500 === 0) {
      onProgress(`Membatalkan import... ${count} lokasi`)
      await batch.commit()
      batch = writeBatch(db)
    }
  }
  if (count % 500 !== 0) await batch.commit()
  
  return { rowsDeleted: compSnap.size, locsDeleted: locSnap.size }
}
