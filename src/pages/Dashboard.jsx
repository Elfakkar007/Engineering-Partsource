import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import { db } from '../lib/firebase'
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

/* ------------------------------------------------------------------ */
/*  Constants & Pure Functions                                        */
/* ------------------------------------------------------------------ */

const LINE_IDS = ['line1', 'line2', 'line3', 'line4']
const LINE_LABELS = { line1: 'Line 1', line2: 'Line 2', line3: 'Line 3', line4: 'Line 4' }

function categoryColor(name) {
  const normalized = (name || '').trim().toLowerCase()
  let hash = 0
  for (let i = 0; i < normalized.length; i++) hash = normalized.charCodeAt(i) + ((hash << 5) - hash)
  const hue = Math.abs(hash) % 360
  return `hsl(${hue}, 65%, 50%)`
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function SyncStatusBar() {
  const [isOnline, setIsOnline] = useState(navigator.onLine)

  useEffect(() => {
    const onOnline = () => setIsOnline(true)
    const onOffline = () => setIsOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  return (
    <div className={isOnline ? 'sync-bar sync-bar--online' : 'sync-bar sync-bar--offline'}>
      {isOnline ? (
        <>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6L9 17l-5-5" />
          </svg>
          <span>Tersimpan • Online</span>
        </>
      ) : (
        <>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span>Mode Offline • Tersimpan di perangkat, akan sinkron otomatis</span>
        </>
      )}
    </div>
  )
}

function StatCard({ label, value, subtext, accent }) {
  const accentMap = {
    primary: { bg: '#e6f4ea', color: '#188038' },
    secondary: { bg: '#e8f0fe', color: '#1a73e8' },
    warning: { bg: '#fef7e0', color: '#f9ab00' },
    danger: { bg: '#fce8e6', color: '#d93025' },
  }
  const a = accentMap[accent] || accentMap.primary

  return (
    <div className="ds-card" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '36px',
        height: '36px',
        borderRadius: '8px',
        background: a.bg,
        flexShrink: 0,
      }}>
        <span style={{ fontSize: '16px', fontWeight: 700, color: a.color }}>{typeof value === 'number' ? '' : value}</span>
        {typeof value === 'number' && (
          <span style={{ fontSize: '14px', fontWeight: 700, color: a.color }}>#</span>
        )}
      </div>
      <div>
        <p style={{ fontSize: '24px', fontWeight: 700, color: '#1f2328', lineHeight: 1.1, margin: 0 }}>
          {typeof value === 'number' ? value.toLocaleString('id-ID') : value}
        </p>
        <p style={{ fontSize: '13px', color: '#5f6368', margin: '2px 0 0' }}>{label}</p>
        {subtext && (
          <p style={{ fontSize: '12px', color: '#80868b', margin: '2px 0 0' }}>{subtext}</p>
        )}
      </div>
    </div>
  )
}

function ProgressCard({ line, isOwnLine, onClick, canNavigate }) {
  const pct = line.totalRows > 0 ? Math.round((line.completedRows / line.totalRows) * 100) : 0

  return (
    <div
      className="ds-card"
      onClick={canNavigate ? onClick : undefined}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        cursor: canNavigate ? 'pointer' : 'default',
        transition: 'box-shadow 0.15s',
        ...(isOwnLine ? {
          borderLeft: '3px solid #1a73e8',
          background: '#f8fbff',
        } : {}),
      }}
      onMouseEnter={(e) => { if (canNavigate) e.currentTarget.style.boxShadow = 'rgba(0,0,0,0.08) 0 2px 8px' }}
      onMouseLeave={(e) => { if (canNavigate) e.currentTarget.style.boxShadow = 'rgba(0,0,0,0.06) 0 1px 2px' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: '#1f2328' }}>{line.name}</h3>
          {isOwnLine && (
            <span style={{
              fontSize: '11px',
              fontWeight: 600,
              color: '#1a73e8',
              background: '#e8f0fe',
              borderRadius: '999px',
              padding: '1px 8px',
              lineHeight: 1.4,
            }}>
              Line Kamu
            </span>
          )}
        </div>
        <span style={{ fontSize: '14px', fontWeight: 600, color: pct === 100 ? '#188038' : '#1f2328' }}>
          {pct}%
        </span>
      </div>

      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${pct}%` }} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '12px', color: '#5f6368' }}>
          {line.completedRows} / {line.totalRows} baris lengkap
        </span>
        {pct === 100 && (
          <span className="chip-existing" style={{ fontSize: '11px' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6L9 17l-5-5" />
            </svg>
            Selesai
          </span>
        )}
      </div>

      <div style={{
        borderTop: '1px solid #e8eaed',
        paddingTop: '10px',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
      }}>
        <p style={{ fontSize: '11px', fontWeight: 600, color: '#80868b', textTransform: 'uppercase', letterSpacing: '0.3px', margin: 0 }}>
          Lokasi
        </p>
        {line.locations.map((loc) => (
          <div key={loc.name} style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '13px',
            color: '#1f2328',
          }}>
            <div style={{
              width: '16px',
              height: '16px',
              borderRadius: '4px',
              border: loc.complete ? 'none' : '1.5px solid #dadce0',
              background: loc.complete ? '#188038' : '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}>
              {loc.complete && (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              )}
            </div>
            <span>{loc.name}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function CategoryBar({ categories }) {
  if (categories.length === 0) return null

  return (
    <div className="ds-card" style={{ gridColumn: '1 / -1' }}>
      <h3 style={{ margin: '0 0 16px', fontSize: '14px', fontWeight: 600, color: '#1f2328' }}>
        Breakdown per Category
      </h3>

      <div style={{ width: '100%', height: Math.max(categories.length * 36, 180) }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={categories} layout="vertical" margin={{ left: 0, right: 20, top: 0, bottom: 0 }}>
            <XAxis type="number" hide />
            <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 13, fill: '#5f6368' }} axisLine={false} tickLine={false} />
            <Tooltip
              formatter={(value) => [value, 'Jumlah']}
              contentStyle={{ fontSize: '13px', borderRadius: '8px', border: '1px solid #e8eaed' }}
            />
            <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={20}>
              {categories.map((cat) => (
                <Cell key={cat.name} fill={categoryColor(cat.name)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const { currentUser, userRole, logout } = useAuth()
  const navigate = useNavigate()

  const [components, setComponents] = useState([])
  const [locations, setLocations] = useState({})
  const [isLoading, setIsLoading] = useState(true)
  const [requiredColumns, setRequiredColumns] = useState(
    ['subMachine', 'category', 'part', 'spesification', 'status', 'qty', 'foto']
  )

  // -- State untuk Speed Dial (FAB) --
  const [isFabVisible, setIsFabVisible] = useState(true)
  const [isFabOpen, setIsFabOpen] = useState(false)

  // -- Logika Scroll --
  useEffect(() => {
    let lastScrollY = window.scrollY
    const handleScroll = () => {
      const currentScrollY = window.scrollY

      // UX Standar: Hilang saat scroll ke bawah, Muncul saat scroll ke atas.
      // Jika ingin sebaliknya (Muncul hanya saat scroll ke bawah), 
      // cukup ubah tanda `>` di bawah menjadi `<` (currentScrollY < lastScrollY)
      if (currentScrollY > lastScrollY) {
        setIsFabVisible(false)
        setIsFabOpen(false) // Otomatis tutup menu jika sedang scroll
      } else {
        setIsFabVisible(true)
      }

      lastScrollY = currentScrollY
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  function isRowComplete(row) {
    const exemptWhenInactive = ['qty', 'foto', 'spesification']
    return requiredColumns.every(col => {
      if (exemptWhenInactive.includes(col) && row.status === 'Tidak Aktif') return true
      const val = row[col]
      return val !== null && val !== undefined && val !== ''
    })
  }

  // --- Realtime listeners ---
  useEffect(() => {
    let loadedCount = 0
    const checkDone = () => { if (++loadedCount >= 3) setIsLoading(false) }

    const compQ = query(collection(db, 'components'), where('isDeleted', '==', false))
    const unsubComp = onSnapshot(compQ, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      setComponents(data)
      checkDone()
    }, (err) => {
      console.error('Dashboard components listener error:', err)
      checkDone()
    })

    const unsubLoc = onSnapshot(collection(db, 'locations'), (snap) => {
      const locMap = {}
      snap.docs.forEach(d => { locMap[d.id] = d.data() })
      setLocations(locMap)
      checkDone()
    }, (err) => {
      console.error('Dashboard locations listener error:', err)
      checkDone()
    })

    const unsubGrid = onSnapshot(doc(db, 'settings', 'gridConfig'), (snap) => {
      if (snap.exists()) {
        const data = snap.data()
        if (data.requiredColumns && data.requiredColumns.length > 0) {
          setRequiredColumns(data.requiredColumns)
        }
      }
      checkDone()
    }, (err) => {
      console.error('Dashboard gridConfig listener error:', err)
      checkDone()
    })

    return () => { unsubComp(); unsubLoc(); unsubGrid() }
  }, [])

  // --- Derived data ---
  const stats = useMemo(() => {
    const totalParts = components.length
    const existing = components.filter(c => c.status === 'Existing').length
    const inactive = components.filter(c => c.status === 'Tidak Aktif').length
    const existingPct = totalParts > 0 ? Math.round((existing / totalParts) * 100) : 0
    const inactivePct = totalParts > 0 ? Math.round((inactive / totalParts) * 100) : 0

    const lineData = LINE_IDS.map(lineId => {
      const lineComps = components.filter(c => c.line === lineId)
      const completed = lineComps.filter(isRowComplete).length
      const locGroups = {}
      lineComps.forEach(c => {
        const lid = c.locationId || '__none__'
        if (!locGroups[lid]) locGroups[lid] = []
        locGroups[lid].push(c)
      })

      const locChecklist = Object.entries(locGroups)
        .sort(([aId], [bId]) => {
          const aTime = locations[aId]?.createdAt?.toMillis?.() || 0
          const bTime = locations[bId]?.createdAt?.toMillis?.() || 0
          return aTime - bTime
        })
        .map(([locId, rows]) => ({
          name: locations[locId]?.name || locId,
          complete: rows.length > 0 && rows.every(isRowComplete),
        }))

      return {
        id: lineId,
        name: LINE_LABELS[lineId],
        totalRows: lineComps.length,
        completedRows: completed,
        locations: locChecklist,
      }
    })

    const totalRows = lineData.reduce((s, l) => s + l.totalRows, 0)
    const totalCompleted = lineData.reduce((s, l) => s + l.completedRows, 0)
    const overallPct = totalRows > 0 ? Math.round((totalCompleted / totalRows) * 100) : 0

    const catMap = {}
    components.forEach(c => {
      const raw = c.category?.trim()
      if (!raw) return
      const key = raw.toLowerCase()
      if (!catMap[key]) catMap[key] = { count: 0, labelCounts: {} }
      catMap[key].count += 1
      catMap[key].labelCounts[raw] = (catMap[key].labelCounts[raw] || 0) + 1
    })
    const categories = Object.values(catMap)
      .map(entry => {
        const label = Object.entries(entry.labelCounts).sort((a, b) => b[1] - a[1])[0][0]
        return { name: label, count: entry.count }
      })
      .sort((a, b) => b.count - a.count)

    return { totalParts, existing, inactive, existingPct, inactivePct, lineData, totalRows, totalCompleted, overallPct, categories }
  }, [components, locations, requiredColumns])

  async function handleLogout() {
    try {
      await logout()
      navigate('/login')
    } catch (err) {
      console.error('Logout error:', err)
    }
  }

  const roleLabelMap = {
    admin: 'Admin',
    intern: 'Internship',
  }

  return (
    <div style={{ minHeight: '100svh', background: '#f8f9fa' }}>
      {/* ---- Header ---- */}
      <header style={{
        background: '#ffffff',
        borderBottom: '1px solid #dadce0',
        position: 'sticky',
        top: 0,
        zIndex: 20,
      }}>
        <div style={{
          maxWidth: '1200px',
          margin: '0 auto',
          padding: '0 16px',
          height: '48px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          {/* Left: logo + title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: '#e6f4ea',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#188038" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
              </svg>
            </div>
            <h1 style={{
              margin: 0,
              fontSize: '16px',
              fontWeight: 600,
              color: '#1f2328',
              lineHeight: 1.3,
            }}>
              Plant Sourcing
            </h1>
          </div>

          {/* Right: user info + logout (Diberi class desktop-nav-actions jika berupa tombol navigasi) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {userRole === 'admin' && (
              <div className="desktop-nav-actions" style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => navigate('/admin/import')} className="btn-secondary" style={{ padding: '6px 12px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                  Import
                </button>
                <button onClick={() => navigate('/admin/export')} className="btn-secondary" style={{ padding: '6px 12px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                  Export
                </button>
                <button onClick={() => navigate('/admin/activity-log')} className="btn-secondary" style={{ padding: '6px 12px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                  Activity Log
                </button>
                <button onClick={() => navigate('/admin/recycle-bin')} className="btn-secondary" style={{ padding: '6px 12px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                  Recycle Bin
                </button>
                <button onClick={() => navigate('/admin/settings')} className="btn-secondary" style={{ padding: '6px 12px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" /><circle cx="12" cy="12" r="3" /></svg>
                  Pengaturan Kolom
                </button>
              </div>
            )}

            {currentUser && (
              <>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: '#1f2328', lineHeight: 1.2 }}>
                    {currentUser?.displayName || currentUser?.email?.split('@')[0] || 'User'}
                  </p>
                  <p style={{ margin: 0, fontSize: '12px', color: '#5f6368', lineHeight: 1.3 }}>
                    {roleLabelMap[userRole] || userRole || 'User'}
                  </p>
                </div>
                <button
                  onClick={handleLogout}
                  className="btn-secondary desktop-nav-actions"
                  style={{ padding: '6px 12px', fontSize: '13px', color: '#5f6368' }}
                >
                  Keluar
                </button>
              </>
            )}
            {!currentUser && (
              <button
                onClick={() => navigate('/login')}
                className="btn-primary"
                style={{ padding: '6px 16px', fontSize: '13px' }}
              >
                Login
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ---- Sync Status Bar ---- */}
      <SyncStatusBar />

      {/* ---- Main Content ---- */}
      <main style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '24px 16px 48px',
      }}>
        {/* Page title */}
        <div style={{ marginBottom: '24px' }}>
          <h2 style={{
            margin: 0,
            fontSize: '20px',
            fontWeight: 600,
            color: '#1f2328',
            lineHeight: 1.3,
            letterSpacing: '-0.1px',
          }}>
            Dashboard
          </h2>
          <p style={{
            margin: '4px 0 0',
            fontSize: '14px',
            color: '#5f6368',
          }}>
            Ringkasan progress sourcing komponen — data langsung dari Firestore
          </p>
        </div>

        {isLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '64px' }}>
            <div style={{ width: '40px', height: '40px', border: '3px solid #dadce0', borderTop: '3px solid #188038', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
            <p style={{ marginTop: '16px', color: '#5f6368' }}>Memuat data...</p>
            <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
          </div>
        ) : (
          <>
            {/* ---- Row 1: Stat cards ---- */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '12px',
              marginBottom: '24px',
            }}>
              <StatCard label="Total Part" value={stats.totalParts} accent="primary" />
              <StatCard label="Existing" value={stats.existing} subtext={`${stats.existingPct}% dari total`} accent="primary" />
              <StatCard label="Tidak Aktif" value={stats.inactive} subtext={`${stats.inactivePct}% dari total`} accent="warning" />
              <StatCard label="Kelengkapan Data" value={`${stats.overallPct}%`} subtext={`${stats.totalCompleted} / ${stats.totalRows} baris`} accent="secondary" />
            </div>

            {/* ---- Overall progress bar ---- */}
            <div className="ds-card" style={{ marginBottom: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '8px' }}>
                <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: '#1f2328' }}>
                  Progress Keseluruhan
                </h3>
                <span style={{ fontSize: '14px', fontWeight: 600, color: '#1f2328' }}>
                  {stats.overallPct}%
                </span>
              </div>
              <div className="progress-track" style={{ height: '10px' }}>
                <div className="progress-fill" style={{ width: `${stats.overallPct}%` }} />
              </div>
              <p style={{ fontSize: '12px', color: '#5f6368', marginTop: '6px' }}>
                {stats.totalCompleted} dari {stats.totalRows} baris sudah lengkap (gabungan 4 Line)
              </p>
            </div>

            {/* ---- Row 2: Per-line progress + location checklists ---- */}
            <div style={{ marginBottom: '24px' }}>
              <h3 style={{
                margin: '0 0 12px',
                fontSize: '16px',
                fontWeight: 600,
                color: '#1f2328',
                lineHeight: 1.3,
              }}>
                Progress per Line
              </h3>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                gap: '12px',
              }}>
                {stats.lineData.map((line) => (
                  <ProgressCard
                    key={line.id}
                    line={line}
                    isOwnLine={userRole === 'intern' && currentUser?.assignedLine === line.id}
                    canNavigate={!!currentUser}
                    onClick={() => navigate(`/line/${line.id}`)}
                  />
                ))}
              </div>
            </div>

            {/* ---- Row 3: Category breakdown ---- */}
            <CategoryBar categories={stats.categories} />
          </>
        )}
      </main>

      {/* ---- Speed Dial (Mobile) ---- */}
      {currentUser && (
        <div className={`mobile-speed-dial-container ${isFabVisible ? 'fab-visible' : 'fab-hidden'}`}>
          <div className={`speed-dial-menu ${isFabOpen ? 'open' : ''}`}>

            {userRole === 'admin' && (
              <>
                <div className="speed-dial-item">
                  <span className="speed-dial-tooltip">Pengaturan Kolom</span>
                  <button onClick={() => { setIsFabOpen(false); navigate('/admin/settings') }} className="speed-dial-btn">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" /><circle cx="12" cy="12" r="3" /></svg>
                  </button>
                </div>
                <div className="speed-dial-item">
                  <span className="speed-dial-tooltip">Recycle Bin</span>
                  <button onClick={() => { setIsFabOpen(false); navigate('/admin/recycle-bin') }} className="speed-dial-btn">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                  </button>
                </div>
                <div className="speed-dial-item">
                  <span className="speed-dial-tooltip">Activity Log</span>
                  <button onClick={() => { setIsFabOpen(false); navigate('/admin/activity-log') }} className="speed-dial-btn">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                  </button>
                </div>
                <div className="speed-dial-item">
                  <span className="speed-dial-tooltip">Export</span>
                  <button onClick={() => { setIsFabOpen(false); navigate('/admin/export') }} className="speed-dial-btn">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                  </button>
                </div>
                <div className="speed-dial-item">
                  <span className="speed-dial-tooltip">Import</span>
                  <button onClick={() => { setIsFabOpen(false); navigate('/admin/import') }} className="speed-dial-btn">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                  </button>
                </div>
              </>
            )}

            {/* Tombol Logout (muncul untuk Admin & Intern) */}
            <div className="speed-dial-item">
              <span className="speed-dial-tooltip" style={{ background: 'var(--color-danger)' }}>Keluar</span>
              <button
                onClick={() => { setIsFabOpen(false); handleLogout(); }}
                className="speed-dial-btn danger"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                  <polyline points="16 17 21 12 16 7"></polyline>
                  <line x1="21" y1="12" x2="9" y2="12"></line>
                </svg>
              </button>
            </div>

          </div>

          <button
            className={`speed-dial-main ${isFabOpen ? 'open' : ''}`}
            onClick={() => setIsFabOpen(!isFabOpen)}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
          </button>
        </div>
      )}

    </div>
  )
}