/**
 * NavigationContext.jsx
 *
 * Global context untuk state navigasi 3-tier:
 *   Tier 1: activeLineId
 *   Tier 2: activeDepartmentId
 *   Tier 3: activeLocationId
 *
 * State di-sync ke URL params sehingga deep-link dan browser back/forward berfungsi.
 *
 * Auto-fallback (sesuai instruksi Tahap 3):
 *   Jika departmentId atau locationId kosong saat diakses, otomatis pilih
 *   Department/Location pertama yang ada dari data cache Dexie.
 *
 * SRS v2.0 §4 — Hierarki Navigasi 3-Tier
 */

import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../lib/db'

/* ------------------------------------------------------------------ */
/*  Context                                                             */
/* ------------------------------------------------------------------ */
const NavigationContext = createContext(null)

export function useNavigation() {
  const ctx = useContext(NavigationContext)
  if (!ctx) throw new Error('useNavigation must be used within NavigationProvider')
  return ctx
}

/* ------------------------------------------------------------------ */
/*  Provider                                                            */
/* ------------------------------------------------------------------ */
export function NavigationProvider({ children }) {
  const navigate = useNavigate()
  const params = useParams()

  // State navigasi — diinisialisasi dari URL param jika ada
  const [activeLineId, setActiveLineIdState] = useState(params.lineId || null)
  const [activeDepartmentId, setActiveDepartmentIdState] = useState(params.departmentId || null)
  const [activeLocationId, setActiveLocationIdState] = useState(params.locationId || null)

  /* ---------------------------------------------------------------- */
  /*  Live queries dari Dexie cache                                    */
  /* ---------------------------------------------------------------- */
  const departments = useLiveQuery(
    () => db.departments_cache.toArray(),
    [],
    []
  )

  const locations = useLiveQuery(
    () => {
      if (!activeLineId || !activeDepartmentId) return []
      return db.locations_cache
        .where('department_id')
        .equals(activeDepartmentId)
        .toArray()
    },
    [activeLineId, activeDepartmentId],
    []
  )

  /* ---------------------------------------------------------------- */
  /*  Auto-fallback: Department                                         */
  /*  Jika activeDepartmentId belum diset & ada data, pilih yg pertama  */
  /* ---------------------------------------------------------------- */
  useEffect(() => {
    if (!activeDepartmentId && departments && departments.length > 0) {
      const sorted = [...departments].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      setActiveDepartmentIdState(sorted[0].id)
    }
  }, [activeDepartmentId, departments])

  /* ---------------------------------------------------------------- */
  /*  Auto-fallback: Location                                           */
  /*  Jika activeLocationId belum diset & ada data, pilih yg pertama    */
  /* ---------------------------------------------------------------- */
  useEffect(() => {
    if (!activeLocationId && locations && locations.length > 0) {
      const sorted = [...locations].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      setActiveLocationIdState(sorted[0].id)
    }
  }, [activeLocationId, locations])

  /* ---------------------------------------------------------------- */
  /*  Navigasi helpers — update state + URL serentak                  */
  /* ---------------------------------------------------------------- */
  const setActiveLine = useCallback((lineId) => {
    setActiveLineIdState(lineId)
    setActiveDepartmentIdState(null)   // reset tier bawah
    setActiveLocationIdState(null)
    navigate(`/line/${lineId}`)
  }, [navigate])

  const setActiveDepartment = useCallback((deptId) => {
    setActiveDepartmentIdState(deptId)
    setActiveLocationIdState(null)     // reset tier bawah
    if (activeLineId) {
      navigate(`/line/${activeLineId}/${deptId}`)
    }
  }, [navigate, activeLineId])

  const setActiveLocation = useCallback((locId) => {
    setActiveLocationIdState(locId)
    if (activeLineId && activeDepartmentId) {
      navigate(`/line/${activeLineId}/${activeDepartmentId}/${locId}`)
    }
  }, [navigate, activeLineId, activeDepartmentId])

  /* ---------------------------------------------------------------- */
  /*  Sync dari URL params jika berubah (e.g. browser back)           */
  /* ---------------------------------------------------------------- */
  useEffect(() => {
    if (params.lineId && params.lineId !== activeLineId) {
      setActiveLineIdState(params.lineId)
    }
    if (params.departmentId && params.departmentId !== activeDepartmentId) {
      setActiveDepartmentIdState(params.departmentId)
    }
    if (params.locationId && params.locationId !== activeLocationId) {
      setActiveLocationIdState(params.locationId)
    }
  }, [params.lineId, params.departmentId, params.locationId]) // eslint-disable-line

  const value = {
    activeLineId,
    activeDepartmentId,
    activeLocationId,
    departments: departments || [],
    locations: locations || [],
    setActiveLine,
    setActiveDepartment,
    setActiveLocation,
  }

  return (
    <NavigationContext.Provider value={value}>
      {children}
    </NavigationContext.Provider>
  )
}
