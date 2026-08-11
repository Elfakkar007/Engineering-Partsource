/**
 * AuthContext.jsx — Real PocketBase Authentication (Phase 7)
 *
 * Menggantikan Mock Auth Provider dari Phase 1 dengan integrasi PocketBase riil.
 *
 * Fitur:
 *   - Login email/password via pb.collection('users').authWithPassword()
 *   - Auto-login dari localStorage token (pb.authStore.isValid)
 *   - Fallback Offline Auth: jika offline tapi token masih valid → izinkan masuk
 *   - Role-based: baca field `role` dari pb.authStore.model (admin | staff | viewer)
 *   - Logout: pb.authStore.clear() + redirect ke /login
 *   - onAuthChange: listen perubahan token (expired, refresh dll)
 *
 * SRS v2.0 §3 — Authentication & RBAC
 */

import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { pb } from '../lib/pocketbase'

const AuthContext = createContext()

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

/* ---- helpers ---- */
function buildUser(model) {
  if (!model) return null
  return {
    id: model.id,
    uid: model.id,
    email: model.email || model.username || '',
    name: model.name || model.username || model.email || '',
    avatar: model.avatar || null,
    role: model.role || 'staff',
  }
}

/**
 * Simpan profil user ringkas ke localStorage sebagai cache offline.
 * Digunakan saat aplikasi dibuka offline: PocketBase tidak bisa
 * melakukan network request, tapi kita tahu siapa yang terakhir login.
 */
const OFFLINE_PROFILE_KEY = 'partsource_offline_profile'

function saveOfflineProfile(user) {
  try { localStorage.setItem(OFFLINE_PROFILE_KEY, JSON.stringify(user)) } catch (_) {}
}
function loadOfflineProfile() {
  try { return JSON.parse(localStorage.getItem(OFFLINE_PROFILE_KEY) || 'null') } catch { return null }
}
function clearOfflineProfile() {
  try { localStorage.removeItem(OFFLINE_PROFILE_KEY) } catch (_) {}
}

/* ---- Provider ---- */
export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null)
  const [userRole, setUserRole]     = useState(null)
  const [loading, setLoading]       = useState(true)
  const [authError, setAuthError]   = useState(null)

  /* ---- Sync state dari PocketBase auth store ---- */
  const syncFromStore = useCallback(() => {
    if (pb.authStore.isValid && pb.authStore.model) {
      const user = buildUser(pb.authStore.model)
      setCurrentUser(user)
      setUserRole(user.role)
      saveOfflineProfile(user)
    } else {
      setCurrentUser(null)
      setUserRole(null)
    }
  }, [])

  /* ---- Init: cek token tersimpan di localStorage ---- */
  useEffect(() => {
    const tryAutoLogin = async () => {
      setLoading(true)
      try {
        if (pb.authStore.isValid) {
          // Token ada & belum kadaluwarsa — coba refresh ke server
          if (navigator.onLine) {
            try {
              await pb.collection('users').authRefresh()
            } catch {
              // Refresh gagal (misal: server belum nyala) — tetap pakai cached token
              // jika offline, cukup gunakan token lokal
            }
          }
          syncFromStore()
        } else if (!navigator.onLine) {
          // Offline + tidak ada token valid → coba cached profile
          const cached = loadOfflineProfile()
          if (cached) {
            setCurrentUser(cached)
            setUserRole(cached.role || 'staff')
          }
        }
      } finally {
        setLoading(false)
      }
    }

    tryAutoLogin()

    // Listen perubahan auth store (token expired, token diperbarui)
    const unsubscribe = pb.authStore.onChange(() => {
      syncFromStore()
    })

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe()
    }
  }, [syncFromStore])

  /* ---- Login ---- */
  async function login(email, password) {
    setAuthError(null)
    try {
      const authData = await pb.collection('users').authWithPassword(email, password)
      const user = buildUser(authData.record)
      setCurrentUser(user)
      setUserRole(user.role)
      saveOfflineProfile(user)
      return { user }
    } catch (err) {
      // Map PocketBase errors ke pesan yang ramah
      let message = 'Login gagal. Periksa koneksi internet dan coba lagi.'
      if (!navigator.onLine) {
        message = 'Anda sedang offline. Tidak bisa login tanpa koneksi ke server.'
      } else if (err.status === 400 || err.status === 401) {
        message = 'Email atau password salah.'
      } else if (err.status === 0 || err.message?.includes('fetch')) {
        message = 'Tidak bisa menjangkau server. Periksa apakah PocketBase sudah berjalan.'
      }
      setAuthError(message)
      throw Object.assign(new Error(message), { originalError: err })
    }
  }

  /* ---- Logout ---- */
  async function logout() {
    pb.authStore.clear()
    clearOfflineProfile()
    setCurrentUser(null)
    setUserRole(null)
    setAuthError(null)
  }

  /* ---- Permission helpers ---- */
  const isAdmin   = userRole === 'admin'
  const isStaff   = userRole === 'staff' || userRole === 'admin'
  const canEdit   = isStaff
  const canAdmin  = isAdmin

  const value = {
    currentUser,
    userRole,
    loading,
    authError,
    login,
    logout,
    isAdmin,
    isStaff,
    canEdit,
    canAdmin,
  }

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  )
}
