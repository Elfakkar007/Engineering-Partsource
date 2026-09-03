import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { db } from '../lib/db'
import { evaluateRowCompleteness } from '../hooks/useRowCompleteness'

/* ------------------------------------------------------------------ */
/*  Constants & Pure Functions                                          */
/* ------------------------------------------------------------------ */

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
        {line.locations.length === 0 ? (
          <p style={{ fontSize: '12px', color: '#80868b', margin: 0 }}>Belum ada lokasi</p>
        ) : line.locations.map((loc) => (
          <div key={loc.id || loc.name} style={{
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

function CategoryBar({ categories, groupingColumnLabel }) {
  if (categories.length === 0) return null

  return (
    <div className="ds-card" style={{ gridColumn: '1 / -1' }}>
      <h3 style={{ margin: '0 0 16px', fontSize: '14px', fontWeight: 600, color: '#1f2328' }}>
        Breakdown per {groupingColumnLabel || 'Kategori'}
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

  // ---- Live queries dari Dexie (pengganti mock data) ----
  // useLiveQuery returns `undefined` while loading, then the actual value.
  // We use default [] so components never receive undefined.
  const linesRaw = useLiveQuery(() => db.lines_cache.toArray().then(r => r.sort((a, b) => (a.order ?? 0) - (b.order ?? 0))), [])
  const departments = useLiveQuery(() => db.departments_cache.toArray().then(r => r.sort((a, b) => (a.order ?? 0) - (b.order ?? 0))), [], []) ?? []
  const allLocations = useLiveQuery(() => db.locations_cache.toArray(), [], []) ?? []
  const allRecords = useLiveQuery(
    () => db.records.filter(rec => rec.isDeleted !== true).toArray(),
    [],
    []
  ) ?? []
  const allColumns = useLiveQuery(() => db.columns_config.toArray(), [], []) ?? []
  const allExceptionRules = useLiveQuery(() => db.completion_exception_rules.toArray(), [], []) ?? []

  const lines = linesRaw ?? []
  // isLoading: true while the first query hasn't resolved yet
  const isLoading = linesRaw === undefined

  // --- Derived data dari Dexie ---
  const stats = useMemo(() => {
    if (!lines.length && !allRecords.length) {
      return { totalParts: 0, totalRows: 0, totalCompleted: 0, overallPct: 0, lineData: [], categories: [] }
    }

    // Buat index kolom per department untuk evaluasi kelengkapan
    const columnsByDept = {}
    allColumns.forEach(col => {
      if (!columnsByDept[col.department_id]) columnsByDept[col.department_id] = []
      columnsByDept[col.department_id].push(col)
    })

    // Buat index exception rules per department
    const rulesByDept = {}
    allExceptionRules.forEach(rule => {
      if (!rulesByDept[rule.department_id]) rulesByDept[rule.department_id] = []
      rulesByDept[rule.department_id].push(rule)
    })

    // Buat index lokasi per line+dept
    const locationsByLine = {}
    allLocations.forEach(loc => {
      if (!locationsByLine[loc.line_id]) locationsByLine[loc.line_id] = []
      locationsByLine[loc.line_id].push(loc)
    })

    // Buat index record per lokasi
    const recordsByLocation = {}
    allRecords.forEach(rec => {
      if (!recordsByLocation[rec.location_id]) recordsByLocation[rec.location_id] = []
      recordsByLocation[rec.location_id].push(rec)
    })

    // Hitung per Line
    const displayLines = lines || []

    const lineData = displayLines.map(line => {
      const lineLocations = locationsByLine[line.id] || []

      const locationItems = lineLocations.map(loc => {
        const locRecords = recordsByLocation[loc.id] || []
        const deptCols = columnsByDept[loc.department_id] || []
        const deptRules = rulesByDept[loc.department_id] || []
        const allComplete = locRecords.length > 0 &&
          locRecords.every(r => evaluateRowCompleteness(r.components, deptCols, deptRules))
        return { id: loc.id, name: loc.name, complete: allComplete }
      })

      // Hitung total baris dan yang sudah lengkap untuk line ini
      let lineTotalRows = 0
      let lineCompletedRows = 0
      lineLocations.forEach(loc => {
        const locRecords = recordsByLocation[loc.id] || []
        const deptCols = columnsByDept[loc.department_id] || []
        const deptRules = rulesByDept[loc.department_id] || []
        lineTotalRows += locRecords.length
        lineCompletedRows += locRecords.filter(r =>
          evaluateRowCompleteness(r.components, deptCols, deptRules)
        ).length
      })

      return {
        id: line.id,
        name: line.name,
        totalRows: lineTotalRows,
        completedRows: lineCompletedRows,
        locations: locationItems,
      }
    })

    const totalRows = lineData.reduce((s, l) => s + l.totalRows, 0)
    const totalCompleted = lineData.reduce((s, l) => s + l.completedRows, 0)
    const overallPct = totalRows > 0 ? Math.round((totalCompleted / totalRows) * 100) : 0

    // --- Grafik Breakdown Dinamis ---
    // Cari chart_grouping_column_key dari departments (ambil dari dept pertama)
    let groupingKey = null
    let groupingColumnLabel = 'Kategori'
    if (departments.length > 0 && departments[0].chart_grouping_column_key) {
      groupingKey = departments[0].chart_grouping_column_key
      // Cari label kolom
      const foundCol = allColumns.find(c => c.key === groupingKey)
      if (foundCol) groupingColumnLabel = foundCol.label
    } else if (allColumns.length > 0) {
      // Fallback: kolom select atau text pertama yang visible
      const fallbackCol = allColumns.find(c => c.is_visible !== false && (c.type === 'select' || c.type === 'text'))
      if (fallbackCol) {
        groupingKey = fallbackCol.key
        groupingColumnLabel = fallbackCol.label
      }
    }

    // Kelompokkan records berdasarkan groupingKey
    const catMap = {}
    if (groupingKey) {
      allRecords.forEach(r => {
        const raw = String((r.components || {})[groupingKey] || '').trim()
        if (!raw) return
        const keyLower = raw.toLowerCase()
        if (!catMap[keyLower]) catMap[keyLower] = { count: 0, label: raw }
        catMap[keyLower].count += 1
      })
    }
    const categories = Object.values(catMap)
      .map(entry => ({ name: entry.label, count: entry.count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20)

    return {
      totalParts: allRecords.length,
      totalRows,
      totalCompleted,
      overallPct,
      lineData,
      categories,
      groupingColumnLabel,
    }
  }, [lines, allRecords, allLocations, allColumns, allExceptionRules, departments])

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
              width: '32px', height: '32px', borderRadius: '8px',
              background: '#e6f4ea', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#188038" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" />
              </svg>
            </div>
            <h1 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#1f2328', lineHeight: 1.3 }}>
              Plant Sourcing
            </h1>
          </div>

          {/* Right: user info + admin shortcut + logout */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {userRole === 'admin' && (
              <button
                onClick={() => navigate('/admin/settings')}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '6px 12px', borderRadius: '6px', fontSize: '13px',
                  background: '#e6f4ea', color: '#188038', border: '1px solid #c6e6d0',
                  cursor: 'pointer', fontWeight: 500, fontFamily: 'Inter, system-ui, sans-serif',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = '#d4edda' }}
                onMouseLeave={e => { e.currentTarget.style.background = '#e6f4ea' }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
                Panel Admin
              </button>
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
                  className="btn-secondary"
                  style={{ padding: '6px 12px', fontSize: '13px', color: '#5f6368' }}
                >
                  Keluar
                </button>
              </>
            )}
            {!currentUser && (
              <button onClick={() => navigate('/login')} className="btn-primary" style={{ padding: '6px 16px', fontSize: '13px' }}>
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
            <CategoryBar categories={stats.categories} groupingColumnLabel={stats.groupingColumnLabel} />
          </>
        )}
      </main>

    </div>
  )
}