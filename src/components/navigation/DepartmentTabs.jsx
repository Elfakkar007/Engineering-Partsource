/**
 * DepartmentTabs.jsx
 *
 * Tier-2 Tab navigation: daftar Department per Line aktif.
 * Setiap tab punya progress dot (6px) yang menunjukkan status kelengkapan.
 * Tombol "+ Department" hanya terlihat oleh Admin.
 *
 * DESIGN_v2.md §2 — department-tabs
 */

import { useNavigation } from '../../contexts/NavigationContext'
import { useAuth } from '../../contexts/AuthContext'

/* ------------------------------------------------------------------ */
/*  Styles (inline — tidak ada import CSS terpisah)                    */
/* ------------------------------------------------------------------ */
const S = {
  wrapper: {
    display: 'flex',
    alignItems: 'center',
    gap: '0',
    borderBottom: '1px solid #dadce0',
    overflowX: 'auto',
    scrollbarWidth: 'none',
    background: '#ffffff',
    paddingLeft: '16px',
    flexShrink: 0,
  },
  tab: (isActive) => ({
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 16px',
    fontSize: '13px',
    fontFamily: 'Inter, system-ui, sans-serif',
    fontWeight: isActive ? 600 : 400,
    color: isActive ? '#1f2328' : '#5f6368',
    cursor: 'pointer',
    background: 'none',
    border: 'none',
    borderBottom: isActive ? '2px solid #188038' : '2px solid transparent',
    whiteSpace: 'nowrap',
    transition: 'color 0.15s, border-bottom-color 0.15s',
    flexShrink: 0,
    // Remove button default styles
    outline: 'none',
    marginBottom: '-1px', // overlap the border-bottom of wrapper
  }),
  dot: (isComplete) => ({
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    background: isComplete ? '#188038' : '#c4c7ca',
    flexShrink: 0,
  }),
  addBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '8px 12px',
    fontSize: '12px',
    fontFamily: 'Inter, system-ui, sans-serif',
    color: '#5f6368',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    flexShrink: 0,
    marginBottom: '-1px',
  },
}

/* ------------------------------------------------------------------ */
/*  Component                                                           */
/* ------------------------------------------------------------------ */
/**
 * @param {Object}   props
 * @param {Object[]} [props.completionMap] - { [departmentId]: boolean } jika ada data completeness
 */
export default function DepartmentTabs({ completionMap = {} }) {
  const { departments, activeDepartmentId, setActiveDepartment } = useNavigation()
  const { userRole } = useAuth()
  const isAdmin = userRole === 'admin'

  if (!departments || departments.length === 0) {
    return (
      <div style={S.wrapper}>
        <span style={{ padding: '8px 16px', fontSize: '12px', color: '#80868b' }}>
          Belum ada Department — tambahkan melalui Admin Settings.
        </span>
        {isAdmin && (
          <button id="dept-tab-add" style={S.addBtn} title="Tambah Department baru">
            + Department
          </button>
        )}
      </div>
    )
  }

  const sorted = [...departments].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))

  return (
    <div style={S.wrapper} role="tablist" aria-label="Department tabs">
      {sorted.map(dept => {
        const isActive = dept.id === activeDepartmentId
        const isComplete = Boolean(completionMap[dept.id])

        return (
          <button
            key={dept.id}
            id={`dept-tab-${dept.id}`}
            role="tab"
            aria-selected={isActive}
            style={S.tab(isActive)}
            onClick={() => setActiveDepartment(dept.id)}
            onMouseOver={(e) => {
              if (!isActive) e.currentTarget.style.color = '#1f2328'
            }}
            onMouseOut={(e) => {
              if (!isActive) e.currentTarget.style.color = '#5f6368'
            }}
          >
            {dept.name}
            {/* Progress dot — DESIGN_v2 §2 tab-progress-dot */}
            <span
              style={S.dot(isComplete)}
              title={isComplete ? 'Department ini 100% lengkap' : 'Masih ada baris yang belum lengkap'}
            />
          </button>
        )
      })}

      {/* "+ Department" hanya untuk Admin */}
      {isAdmin && (
        <button
          id="dept-tab-add"
          style={S.addBtn}
          title="Tambah Department baru"
          onClick={() => {
            // TODO Phase 5: buka form tambah department
            window.alert('Schema Manager belum tersedia di versi ini.')
          }}
        >
          <span style={{ fontSize: '14px', lineHeight: 1 }}>+</span>
          <span>Department</span>
        </button>
      )}
    </div>
  )
}
