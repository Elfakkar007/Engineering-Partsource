import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { ToastProvider } from './contexts/ToastContext'
import { ImportUndoProvider } from './contexts/ImportUndoContext'
import { NavigationProvider } from './contexts/NavigationContext'
import { initSyncWorker } from './lib/syncWorker'
import { seedAllDepartments } from './data/initialSeeds'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import LinePage from './pages/LinePage'
import AdminSettings from './pages/AdminSettings'
import RecycleBin from './pages/RecycleBin'
import ActivityLog from './pages/ActivityLog'
import ImportExcel from './pages/ImportExcel'
import ExportExcel from './pages/ExportExcel'

/* ------------------------------------------------------------------ */
/*  Route guards                                                        */
/* ------------------------------------------------------------------ */
function AdminRoute({ children }) {
  const { currentUser, userRole } = useAuth()
  if (!currentUser) return <Navigate to="/login" />
  if (userRole !== 'admin') return <Navigate to="/" />
  return children
}

function PrivateRoute({ children }) {
  const { currentUser } = useAuth()
  return currentUser ? children : <Navigate to="/login" />
}

function PublicRoute({ children }) {
  const { currentUser } = useAuth()
  return currentUser ? <Navigate to="/" /> : children
}

/* ------------------------------------------------------------------ */
/*  App shell — inisialisasi global                                     */
/* ------------------------------------------------------------------ */
function AppShell({ children }) {
  useEffect(() => {
    // 1. Inisialisasi Background Sync Worker (attach event listeners + interval)
    const cleanupSync = initSyncWorker()

    // 2. Seed data Department awal secara async — tidak memblokir render
    //    Idempotent: tidak melakukan apa-apa jika data sudah ada (SRS §14)
    //    Gunakan ID placeholder; Phase 3 belum ada PocketBase ID nyata —
    //    seed hanya dijalankan jika ada ID yang valid dari NavigationContext/cache.
    //    Untuk tahap ini, seed dummy dept IDs agar tabel columns_config
    //    terisi dan dapat diuji secara lokal.
    const runSeed = async () => {
      try {
        await seedAllDepartments({
          mekanik: 'dept_mekanik',
          elektrik: 'dept_elektrik',
        })
      } catch (err) {
        // Seed gagal tidak memblokir aplikasi
        console.warn('[App] seedAllDepartments warning:', err)
      }
    }
    runSeed()

    return cleanupSync
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return children
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
                <Route path="/" element={<Dashboard />} />

                {/* LinePage — Tier 2+3, URL: /line/:lineId/:departmentId?/:locationId? */}
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

                {/* Admin routes */}
                <Route
                  path="/admin/settings"
                  element={
                    <AdminRoute>
                      <AdminSettings />
                    </AdminRoute>
                  }
                />
                <Route
                  path="/admin/recycle-bin"
                  element={
                    <AdminRoute>
                      <RecycleBin />
                    </AdminRoute>
                  }
                />
                <Route
                  path="/admin/activity-log"
                  element={
                    <AdminRoute>
                      <ActivityLog />
                    </AdminRoute>
                  }
                />
                <Route
                  path="/admin/import"
                  element={
                    <AdminRoute>
                      <ImportExcel />
                    </AdminRoute>
                  }
                />
                <Route
                  path="/admin/export"
                  element={
                    <AdminRoute>
                      <ExportExcel />
                    </AdminRoute>
                  }
                />

                <Route path="*" element={<Navigate to="/" />} />
              </Routes>
            </AppShell>
          </ImportUndoProvider>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  )
}

export default App
