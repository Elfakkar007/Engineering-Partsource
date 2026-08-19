/**
 * UnmatchedReport.jsx
 *
 * Laporan Admin "Belum Ketemu Kode" - SRS v2.0 par.7
 *
 * Menampilkan daftar baris records yang:
 *   - item_code_mode = 'auto' (mode auto aktif)
 *   - kolom Item Code (is_item_code_column=true) kosong / NaN
 *
 * Berguna agar Admin tahu part/spesifikasi mana yang perlu
 * ditambahkan ke reference_catalog supaya matching bisa berjalan.
 *
 * Seluruh query dari Dexie (offline-first).
 */

import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../lib/db'

/* ------------------------------------------------------------------ */
/*  UnmatchedReport                                                      */
/* ------------------------------------------------------------------ */
export default function UnmatchedReport() {
  const departments = useLiveQuery(
    () => db.departments_cache.toArray().then(r => r.sort((a, b) => (a.order ?? 0) - (b.order ?? 0))),
    [], []
  )
  const allColumns = useLiveQuery(() => db.columns_config.toArray(), [], [])
  const allRecords = useLiveQuery(
    () => db.records.filter(r => !r.isDeleted && (r.item_code_mode ?? 'auto') === 'auto').toArray(),
    [], []
  )

  // Per department: temukan kolom pemicu dan kolom item code
  const deptMeta = useMemo(() => {
    const map = {}
    for (const dept of (departments || [])) {
      const deptCols = (allColumns || []).filter(c => c.department_id === dept.id)
      map[dept.id] = {
        name: dept.name,
        triggerCol: deptCols.find(c => c.is_ref_trigger),
        itemCodeCol: deptCols.find(c => c.is_item_code_column),
      }
    }
    return map
  }, [departments, allColumns])

  // Kelompokkan baris yang belum dapat kode per department
  const report = useMemo(() => {
    const groups = {}
    for (const row of (allRecords || [])) {
      const meta = deptMeta[row.department_id]
      if (!meta?.itemCodeCol) continue // department belum dikonfigurasi

      const itemCodeVal = (row.components || {})[meta.itemCodeCol.key]
      const isEmpty = itemCodeVal === null || itemCodeVal === undefined || itemCodeVal === ''
      if (!isEmpty) continue // sudah punya kode

      if (!groups[row.department_id]) groups[row.department_id] = { meta, rows: [] }
      groups[row.department_id].rows.push(row)
    }
    return Object.entries(groups)
  }, [allRecords, deptMeta])

  const totalUnmatched = report.reduce((s, [, g]) => s + g.rows.length, 0)

  return (
    <div>
      {/* Ringkasan */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <div style={{
          padding: '10px 18px', borderRadius: '10px', fontSize: '14px', fontWeight: 600,
          background: totalUnmatched > 0 ? '#fce8e6' : '#e6f4ea',
          color: totalUnmatched > 0 ? '#d93025' : '#188038',
          border: `1px solid ${totalUnmatched > 0 ? '#f5c6c4' : '#b7dfcb'}`,
        }}>
          {totalUnmatched === 0
            ? '✓ Semua baris Mode Auto sudah memiliki kode item'
            : `⚠ ${totalUnmatched} baris Mode Auto belum memiliki kode item`}
        </div>
        <span style={{ fontSize: '12px', color: '#80868b' }}>
          Hanya menampilkan baris yang item_code_mode=auto dan kolom Item Code kosong.
        </span>
      </div>

      {report.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#80868b' }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#dadce0"
            strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
            style={{ display: 'block', margin: '0 auto 12px' }}>
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
          <p style={{ fontWeight: 600, color: '#1f2328', margin: '0 0 4px' }}>Tidak ada yang perlu dilaporkan</p>
          <p style={{ fontSize: '12px', margin: 0 }}>
            Semua baris Mode Auto sudah mendapatkan kode, atau belum ada kolom Item Code yang dikonfigurasi.
          </p>
        </div>
      ) : (
        report.map(([deptId, group]) => (
          <DeptGroup key={deptId} group={group} />
        ))
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  DeptGroup - tabel per department                                    */
/* ------------------------------------------------------------------ */
function DeptGroup({ group }) {
  const { meta, rows } = group
  const { name: deptName, triggerCol, itemCodeCol } = meta

  return (
    <div style={{ marginBottom: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
        <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: '#1f2328' }}>
          {deptName}
        </h4>
        <span style={{
          padding: '1px 10px', borderRadius: '10px', fontSize: '11px', fontWeight: 600,
          background: '#fce8e6', color: '#d93025',
        }}>
          {rows.length} baris
        </span>
        {triggerCol && (
          <span style={{ fontSize: '11px', color: '#5f6368' }}>
            Kolom pemicu: <strong>{triggerCol.label}</strong>
          </span>
        )}
      </div>

      <div style={{ border: '1px solid #dadce0', borderRadius: '8px', overflow: 'hidden', maxHeight: '300px', overflowY: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
          <thead style={{ position: 'sticky', top: 0 }}>
            <tr style={{ background: '#f8f9fa', borderBottom: '1px solid #dadce0' }}>
              <th style={{ padding: '7px 10px', textAlign: 'left', color: '#5f6368', fontWeight: 600, width: '40px' }}>#</th>
              {triggerCol && (
                <th style={{ padding: '7px 10px', textAlign: 'left', color: '#5f6368', fontWeight: 600 }}>
                  {triggerCol.label} (Pemicu)
                </th>
              )}
              <th style={{ padding: '7px 10px', textAlign: 'left', color: '#5f6368', fontWeight: 600 }}>
                {itemCodeCol?.label || 'Item Code'}
              </th>
              <th style={{ padding: '7px 10px', textAlign: 'left', color: '#5f6368', fontWeight: 600 }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => {
              const triggerVal = triggerCol ? (row.components || {})[triggerCol.key] : null
              const codeVal = itemCodeCol ? (row.components || {})[itemCodeCol.key] : null
              const hasCode = codeVal !== null && codeVal !== undefined && codeVal !== ''
              const hasTrigger = triggerVal !== null && triggerVal !== undefined && triggerVal !== ''

              return (
                <tr key={row.id} style={{ borderBottom: '1px solid #f1f3f4' }}>
                  <td style={{ padding: '7px 10px', color: '#80868b' }}>{idx + 1}</td>
                  {triggerCol && (
                    <td style={{ padding: '7px 10px', color: hasTrigger ? '#1f2328' : '#d93025', fontStyle: hasTrigger ? 'normal' : 'italic' }}>
                      {hasTrigger ? String(triggerVal) : '(kosong)'}
                    </td>
                  )}
                  <td style={{ padding: '7px 10px' }}>
                    {hasCode
                      ? <code style={{ color: '#188038', fontFamily: 'monospace', fontWeight: 600 }}>{String(codeVal)}</code>
                      : <span style={{ color: '#d93025', fontStyle: 'italic' }}>—</span>}
                  </td>
                  <td style={{ padding: '7px 10px' }}>
                    <span style={{
                      fontSize: '11px', padding: '1px 8px', borderRadius: '10px',
                      background: hasTrigger ? '#fef7e0' : '#fce8e6',
                      color: hasTrigger ? '#b06000' : '#d93025',
                      fontWeight: 500,
                    }}>
                      {hasTrigger ? 'Nilai ada, tidak cocok di katalog' : 'Kolom pemicu kosong'}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <p style={{ margin: '6px 0 0', fontSize: '11px', color: '#80868b' }}>
        💡 Tambahkan entri ke Reference Catalog Department <strong>{deptName}</strong> di tab "Aturan Kode" untuk baris yang "Nilai ada, tidak cocok di katalog".
      </p>
    </div>
  )
}
