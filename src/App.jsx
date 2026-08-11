/**
 * App.jsx — Phase 7 Final Polish
 *
 * Perubahan dari Phase 1-6:
 *   - AuthProvider sekarang riil (PocketBase, bukan mock)
 *   - AdminRoute + PrivateRoute pakai loading state agar tidak flash redirect
 *   - UpdatePrompt disertakan di App shell agar tampil di semua halaman
 *   - NavigationProvider dipindah ke dalam AppShell agar semua halaman bisa akses
 */

import { useEffect, lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { ToastProvider } from './contexts/ToastContext'
import { ImportUndoProvider } from './contexts/ImportUndoContext'
import { NavigationProvider } from './contexts/NavigationContext'
import { initSyncWorker } from './lib/syncWorker'
import { seedAllDepartments } from './data/initialSeeds'
import UpdatePrompt from './components/common/UpdatePrompt'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import LinePage from './pages/LinePage'

// Lazy-load halaman berat (Admin, Excel I/O, RecycleBin) — code splitting
const AdminSettings  = lazy(() => import('./pages/AdminSettings'))
const RecycleBin     = lazy(() => import('./pages/RecycleBin'))
const ActivityLog    = lazy(() => import('./pages/ActivityLog'))
const ImportExcel    = lazy(() => import('./pages/ImportExcel'))
const ExportExcel    = lazy(() => import('./pages/ExportExcel'))

// Fallback saat lazy chunk sedang dimuat
function PageLoader() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100dvh' }}>
      <div style={{ width: '28px', height: '28px', border: '3px solid #e6f4ea', borderTop: '3px solid #188038', borderRadius: '50%', animation: 'spin 0.9s linear infinite' }} />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Route Guards — respek loading state agar tidak flash redirect       */
/* ------------------------------------------------------------------ */
function AdminRoute({ children }) {
  const { currentUser, userRole, loading } = useAuth()
  if (loading) return null                          // tunggu auth resolve
  if (!currentUser) return <Navigate to="/login" replace />
  if (userRole !== 'admin') return <Navigate to="/" replace />
  return children
}

function PrivateRoute({ children }) {
  const { currentUser, loading } = useAuth()
  if (loading) return null
  return currentUser ? children : <Navigate to="/login" replace />
}

function PublicRoute({ children }) {
  const { currentUser, loading } = useAuth()
  if (loading) return null
  return currentUser ? <Navigate to="/" replace /> : children
}

/* ------------------------------------------------------------------ */
/*  Loading Spinner — tampil selama AuthProvider memverifikasi token    */
/* ------------------------------------------------------------------ */
function AuthLoadingScreen() {
  const { loading } = useAuth()
  if (!loading) return null
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#fff',
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{
          width: '36px', height: '36px', borderRadius: '50%',
          border: '3px solid #e6f4ea', borderTop: '3px solid #188038',
          animation: 'spin 0.9s linear infinite',
          margin: '0 auto 16px',
        }} />
        <p style={{ fontSize: '13px', color: '#5f6368', margin: 0 }}>Memverifikasi sesi...</p>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  App shell — inisialisasi global                                     */
/* ------------------------------------------------------------------ */
function AppShell({ children }) {
  useEffect(() => {
    // 1. Inisialisasi Background Sync Worker
    const cleanupSync = initSyncWorker()

    // 2. Seed data Department awal — idempotent, tidak memblokir render
    const runSeed = async () => {
      try {
        await seedAllDepartments({
          mekanik: 'dept_mekanik',
          elektrik: 'dept_elektrik',
        })
      } catch (err) {
        console.warn('[App] seedAllDepartments warning:', err)
      }
    }
    runSeed()

    return cleanupSync
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      {children}
      {/* PWA Update Prompt — tampil di atas semua halaman saat ada versi baru */}
      <UpdatePrompt />
    </>
  )
}

/* ------------------------------------------------------------------ */
/*  App                                                                 */
/* ------------------------------------------------------------------ */
function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <ImportUndoProvider>
            <AppShell>
              <AuthLoadingScreen />
              <Routes>
                {/* Public */}
                <Route
                  path="/login"
                  element={
                    <PublicRoute>
                      <Login />
                    </PublicRoute>
                  }
                />

                {/* Dashboard — Tier 1 (pilih Line) */}
                <Route
                  path="/"
                  element={
                    <PrivateRoute>
                      <Dashboard />
                    </PrivateRoute>
                  }
                />

                {/* LinePage — Tier 2+3 — NavigationProvider di sini karena pakai useParams */}
                <Route
                  path="/line/:lineId"
                  element={
                    <PrivateRoute>
                      <NavigationProvider>
                        <LinePage />
                      </NavigationProvider>
                    </PrivateRoute>
                  }
                />
                <Route
                  path="/line/:lineId/:departmentId"
                  element={
                    <PrivateRoute>
                      <NavigationProvider>
                        <LinePage />
                      </NavigationProvider>
                    </PrivateRoute>
                  }
                />
                <Route
                  path="/line/:lineId/:departmentId/:locationId"
                  element={
                    <PrivateRoute>
                      <NavigationProvider>
                        <LinePage />
                      </NavigationProvider>
                    </PrivateRoute>
                  }
                />

                {/* Admin routes — lazy loaded, wrapped in Suspense */}
                <Route
                  path="/admin/settings"
                  element={
                    <AdminRoute>
                      <Suspense fallback={<PageLoader />}>
                        <AdminSettings />
                      </Suspense>
                    </AdminRoute>
                  }
                />
                <Route
                  path="/admin/recycle-bin"
                  element={
                    <AdminRoute>
                      <Suspense fallback={<PageLoader />}>
                        <RecycleBin />
                      </Suspense>
                    </AdminRoute>
                  }
                />
                <Route
                  path="/admin/activity-log"
                  element={
                    <AdminRoute>
                      <Suspense fallback={<PageLoader />}>
                        <ActivityLog />
                      </Suspense>
                    </AdminRoute>
                  }
                />
                <Route
                  path="/admin/import"
                  element={
                    <AdminRoute>
                      <Suspense fallback={<PageLoader />}>
                        <ImportExcel />
                      </Suspense>
                    </AdminRoute>
                  }
                />
                <Route
                  path="/admin/export"
                  element={
                    <AdminRoute>
                      <Suspense fallback={<PageLoader />}>
                        <ExportExcel />
                      </Suspense>
                    </AdminRoute>
                  }
                />

                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </AppShell>
          </ImportUndoProvider>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  )
}

export default App
