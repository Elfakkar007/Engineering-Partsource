/**
 * LocationTabs.jsx
 *
 * Tier-3 Sub-tab navigation: daftar Location yang difilter per Department aktif.
 * Di mobile, ditampilkan sebagai horizontal-scroll strip (ditumpuk di bawah DepartmentTabs).
 * Tombol "+ Location" hanya terlihat oleh Admin.
 *
 * DESIGN_v2.md §2 — location-tabs
 */

import { useNavigation } from '../../contexts/NavigationContext'
import { useAuth } from '../../contexts/AuthContext'
import { useDialog } from '../../contexts/DialogContext'

/* ------------------------------------------------------------------ */
/*  Styles                                                              */
/* ------------------------------------------------------------------ */
const S = {
  wrapper: {
    display: 'flex',
    alignItems: 'center',
    overflowX: 'auto',
    scrollbarWidth: 'none',
    borderBottom: '1px solid #e8eaed',
    background: '#f8f9fa',
    paddingLeft: '16px',
    flexShrink: 0,
  },
  tab: (isActive) => ({
    display: 'flex',
    alignItems: 'center',
    padding: '6px 14px',
    fontSize: '12px',
    fontFamily: 'Inter, system-ui, sans-serif',
    fontWeight: isActive ? 600 : 400,
    color: isActive ? '#1a73e8' : '#5f6368',
    cursor: 'pointer',
    background: 'none',
    border: 'none',
    borderBottom: isActive ? '2px solid #1a73e8' : '2px solid transparent',
    whiteSpace: 'nowrap',
    transition: 'color 0.15s, border-bottom-color 0.15s',
    flexShrink: 0,
    outline: 'none',
    marginBottom: '-1px',
  }),
  addBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '6px 12px',
    fontSize: '11px',
    fontFamily: 'Inter, system-ui, sans-serif',
    color: '#80868b',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    flexShrink: 0,
    marginBottom: '-1px',
  },
  empty: {
    padding: '6px 16px',
    fontSize: '11px',
    color: '#80868b',
    fontFamily: 'Inter, system-ui, sans-serif',
    fontStyle: 'italic',
  },
}

/* ------------------------------------------------------------------ */
/*  Component                                                           */
/* ------------------------------------------------------------------ */
export default function LocationTabs() {
  const { locations, activeLocationId, activeDepartmentId, setActiveLocation } = useNavigation()
  const { alert } = useDialog()
  const { userRole } = useAuth()
  const isAdmin = userRole === 'admin'

  // Filter locations untuk department aktif (NavigationContext sudah handle ini via query,
  // namun kita filter ulang di sini untuk keamanan)
  const filteredLocations = (locations || [])
    .filter(loc => !activeDepartmentId || loc.department_id === activeDepartmentId)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))

  return (
    <div style={S.wrapper} role="tablist" aria-label="Location tabs">
      {filteredLocations.length === 0 ? (
        <span style={S.empty}>Belum ada Location di Department ini</span>
      ) : (
        filteredLocations.map(loc => {
          const isActive = loc.id === activeLocationId

          return (
            <button
              key={loc.id}
              id={`loc-tab-${loc.id}`}
              role="tab"
              aria-selected={isActive}
              style={S.tab(isActive)}
              onClick={() => setActiveLocation(loc.id)}
              onMouseOver={(e) => {
                if (!isActive) e.currentTarget.style.color = '#1a73e8'
              }}
              onMouseOut={(e) => {
                if (!isActive) e.currentTarget.style.color = '#5f6368'
              }}
            >
              {loc.name}
            </button>
          )
        })
      )}

      {/* "+ Location" hanya untuk Admin */}
      {isAdmin && (
        <button
          id="loc-tab-add"
          style={S.addBtn}
          title="Tambah Location baru"
          onClick={() => {
            // TODO Phase 5: buka form tambah location
            alert({ title: 'Info', message: 'Fitur tambah Location belum tersedia di versi ini.' })
          }}
        >
          <span style={{ fontSize: '13px', lineHeight: 1 }}>+</span>
          <span>Location</span>
        </button>
      )}
    </div>
  )
}
