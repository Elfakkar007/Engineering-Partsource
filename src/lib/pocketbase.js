import PocketBase from 'pocketbase'

// Menggunakan environment variable atau default ke localhost port 8090
const pbUrl = import.meta.env.VITE_POCKETBASE_URL || 'http://127.0.0.1:8090'
export const pb = new PocketBase(pbUrl)
