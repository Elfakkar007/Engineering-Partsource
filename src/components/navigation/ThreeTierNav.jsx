/**
 * ThreeTierNav.jsx
 *
 * Wrapper yang mengomposisi navigasi 3-tier:
 *   - Breadcrumb: Dashboard > Line X > Department aktif > Location aktif
 *   - DepartmentTabs (Tier 2)
 *   - LocationTabs (Tier 3)
 *
 * Diletakkan di bawah Header/SyncStatusBar dan di atas Toolbar + Data Grid.
 * DESIGN_v2.md §2 — Navigasi 3-Tier Layout
 */

import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useNavigation } from '../../contexts/NavigationContext'
import DepartmentTabs from './DepartmentTabs'
import LocationTabs from './LocationTabs'

/* ------------------------------------------------------------------ */
/*  Breadcrumb component                                               */
/* ------------------------------------------------------------------ */
function Breadcrumb({ lineId, lineName, deptName, locName }) {
  const crumbs = [
    { label: 'Dashboard', to: '/' },
    ...(lineId ? [{ label: lineName || lineId, to: `/line/${lineId}` }] : []),
    ...(deptName ? [{ label: deptName }] : []),
    ...(locName ? [{ label: locName }] : []),
  ]

  return (
    <nav
      aria-label="Breadcrumb"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        padding: '8px 16px',
        fontSize: '12px',
        fontFamily: 'Inter, system-ui, sans-serif',
        color: '#5f6368',
        borderBottom: '1px solid #f1f3f4',
        background: '#ffffff',
        flexShrink: 0,
        overflowX: 'auto',
        scrollbarWidth: 'none',
        whiteSpace: 'nowrap',
      }}
    >
      {crumbs.map((crumb, i) => (
        <span key={i} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {i > 0 && (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
              stroke="#c4c7ca" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          )}
          {crumb.to ? (
            <Link
              to={crumb.to}
              style={{
                color: '#1a73e8',
                textDecoration: 'none',
                fontWeight: 400,
              }}
              onMouseOver={(e) => { e.currentTarget.style.textDecoration = 'underline' }}
              onMouseOut={(e) => { e.currentTarget.style.textDecoration = 'none' }}
            >
              {crumb.label}
            </Link>
          ) : (
            <span style={{ color: '#1f2328', fontWeight: 500 }}>{crumb.label}</span>
          )}
        </span>
      ))}
    </nav>
  )
}

/* ------------------------------------------------------------------ */
/*  Main component                                                      */
/* ------------------------------------------------------------------ */
/**
 * @param {Object}   props
 * @param {string}   [props.lineName]    - Display name untuk Line aktif
 * @param {Object}   [props.completionMap] - { [departmentId]: boolean }
 */
export default function ThreeTierNav({ lineName, completionMap = {} }) {
  const {
    activeLineId,
    activeDepartmentId,
    activeLocationId,
    departments,
    locations,
  } = useNavigation()

  // Resolve nama display dari ID
  const activeDept = useMemo(
    () => departments.find(d => d.id === activeDepartmentId),
    [departments, activeDepartmentId]
  )

  const activeLoc = useMemo(
    () => locations.find(l => l.id === activeLocationId),
    [locations, activeLocationId]
  )

  return (
    <div
      id="three-tier-nav"
      style={{
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        borderBottom: '1px solid #dadce0',
      }}
    >
      {/* Breadcrumb */}
      <Breadcrumb
        lineId={activeLineId}
        lineName={lineName}
        deptName={activeDept?.name}
        locName={activeLoc?.name}
      />

      {/* Tier 2: Department tabs */}
      <DepartmentTabs completionMap={completionMap} />

      {/* Tier 3: Location tabs — hanya tampil jika ada department aktif */}
      {activeDepartmentId && <LocationTabs />}
    </div>
  )
}
