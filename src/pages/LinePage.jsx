import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import MainLayout from '../components/layout/MainLayout'
import ThreeTierNav from '../components/navigation/ThreeTierNav'
import DataGrid from '../components/grid/DataGrid'
import { useNavigation } from '../contexts/NavigationContext'

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */
function formatLineName(lineId) {
  const num = lineId?.replace('line', '')
  return num ? `Line ${num}` : lineId
}

function getUserLineId(assignedLine) {
  if (!assignedLine) return null
  if (typeof assignedLine === 'number') return `line${assignedLine}`
  if (typeof assignedLine === 'string' && !assignedLine.startsWith('line')) return `line${assignedLine}`
  return assignedLine
}

/* ------------------------------------------------------------------ */
/*  Main LinePage Component                                           */
/* ------------------------------------------------------------------ */
export default function LinePage() {
  const { lineId } = useParams()
  const navigate = useNavigate()
  const { currentUser, userRole } = useAuth()
  const { locations, activeLocationId } = useNavigation()

  // Permission check
  const userLineId = getUserLineId(currentUser?.assignedLine)
  const canEdit = userRole === 'admin' || (userRole === 'intern' && userLineId === lineId)

  const lineName = formatLineName(lineId)
  const activeLocation = locations?.find(l => l.id === activeLocationId)
  const activeLocationName = activeLocation ? activeLocation.name : activeLocationId

  return (
    <MainLayout>
      {/* ---- 3-Tier Navigation (Breadcrumb + Dept Tabs + Location Tabs) ---- */}
      <ThreeTierNav lineName={lineName} />

      {/* ---- Main Content ---- */}
      <main style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>

        {/* ---- Permission warning for wrong-line interns ---- */}
        {!canEdit && userRole === 'intern' && (
          <div className="permission-banner">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>
              Read-only — Anda hanya memiliki akses edit ke{' '}
              <strong>{formatLineName(userLineId)}</strong>, bukan {lineName}.
            </span>
          </div>
        )}

        <DataGrid locationName={activeLocationName} canEdit={canEdit} />
      </main>
    </MainLayout>
  )
}