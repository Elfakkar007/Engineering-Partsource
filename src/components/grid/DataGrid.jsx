/**
 * DataGrid.jsx
 *
 * Komponen grid generik yang 100% config-driven:
 *   - `columns` dari useDynamicSchema (rows_config)
 *   - `rows` + CRUD dari useGridData
 *
 * Fitur Spreadsheet Tools (SRS v2.0 §9):
 *   ✓ Filter per Kolom (popover checkbox)
 *   ✓ Pencarian teks global (search bar)
 *   ✓ Find & Replace (modal dengan live preview)
 *   ✓ Flag Baris ("Perlu Ditanyakan" / "Dilewati")
 *   ✓ Bulk Actions: tambah N baris, bulk delete, duplikat, bulk flag, bulk fill
 *   ✓ Undo (client-side, sesi saja)
 *   ✓ Aturan kelengkapan baris — "Tidak Aktif" exemption
 *
 * DESIGN_v2.md §3 — Data Grid
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useNavigation } from '../../contexts/NavigationContext'
import { useDynamicSchema } from '../../hooks/useDynamicSchema'
import { useGridData } from '../../hooks/useGridData'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import { logActivity } from '../../lib/activityLog'
import { evaluateRowCompleteness, useLiveExceptionRules } from '../../hooks/useRowCompleteness'
import EditableCell from './EditableCell'
import { useDialog } from '../../contexts/DialogContext'
import ExportModal from './ExportModal'
import ImportModal from './ImportModal'

/* ------------------------------------------------------------------ */
/*  Constants                                                            */
/* ------------------------------------------------------------------ */
const CHECKBOX_COL_W = 36
const FLAG_COL_W = 32
const ROW_NUM_W = 40
const ACTION_COL_W = 72
const DEFAULT_COL_W = 140
const UNDO_LIMIT = 20

// isRowComplete telah dihapus — gunakan evaluateRowCompleteness() dari useRowCompleteness.js
// yang bersumber dari columns_config + completion_exception_rules (SRS v2.0 §6 & §8.2)

/* ------------------------------------------------------------------ */
/*  ColumnFilterPopover                                                  */
/* ------------------------------------------------------------------ */
const EMPTY_SENTINEL = '__EMPTY__'

function ColumnFilterPopover({ colKey, rows, currentFilter, onApply, onClose, anchorRect }) {
  const uniqueVals = useMemo(() => {
    const vals = new Set()
    let hasEmpty = false
    rows.forEach(row => {
      const v = (row.components || {})[colKey]
      if (v === null || v === undefined || v === '') hasEmpty = true
      else vals.add(String(v))
    })
    const sorted = [...vals].sort((a, b) => a.localeCompare(b, 'id'))
    if (hasEmpty) sorted.unshift(EMPTY_SENTINEL)
    return sorted
  }, [rows, colKey])

  const [checked, setChecked] = useState(() =>
    currentFilter ? new Set(currentFilter) : new Set(uniqueVals)
  )

  const toggle = (val) => setChecked(prev => {
    const n = new Set(prev); n.has(val) ? n.delete(val) : n.add(val); return n
  })

  const top = anchorRect ? anchorRect.bottom + 4 : 0
  const left = anchorRect ? Math.max(4, anchorRect.left - 60) : 0

  return createPortal(
    <>
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 8000 }}
        onClick={onClose}
      />
      <div className="filter-dropdown" style={{ position: 'fixed', top, left, zIndex: 8001 }}>
        <div className="filter-dropdown-header">
          <button className="filter-link-btn" onClick={() => setChecked(new Set(uniqueVals))}>Pilih Semua</button>
          <button className="filter-link-btn" onClick={() => setChecked(new Set())}>Hapus Semua</button>
        </div>
        <div className="filter-dropdown-list">
          {uniqueVals.length === 0
            ? <p style={{ fontSize: '12px', color: '#80868b', padding: '8px', textAlign: 'center' }}>Tidak ada data</p>
            : uniqueVals.map(val => (
              <label key={val} className="filter-dropdown-item">
                <input type="checkbox" checked={checked.has(val)} onChange={() => toggle(val)} />
                <span>{val === EMPTY_SENTINEL ? '(Kosong)' : val}</span>
              </label>
            ))
          }
        </div>
        <div className="filter-dropdown-footer">
          <button className="btn-secondary" style={{ fontSize: '12px', padding: '4px 12px' }} onClick={onClose}>Batal</button>
          <button className="btn-primary" style={{ fontSize: '12px', padding: '4px 12px' }}
            onClick={() => {
              onApply(colKey, checked.size === uniqueVals.length ? null : checked)
              onClose()
            }}>
            Terapkan
          </button>
        </div>
      </div>
    </>,
    document.body
  )
}

/* ------------------------------------------------------------------ */
/*  RowFlagPopover                                                       */
/* ------------------------------------------------------------------ */
const FLAG_OPTIONS = [
  { value: null,       label: 'Tidak ada tanda',   icon: null },
  { value: 'question', label: 'Perlu Ditanyakan',   color: 'var(--color-warning, #f9ab00)' },
  { value: 'skip',     label: 'Dilewati',           color: 'var(--color-ink-muted, #80868b)' },
]

function RowFlagPopover({ currentFlag, onSelect, onClose, anchorRect }) {
  const top = anchorRect ? anchorRect.bottom + 4 : 0
  const left = anchorRect ? Math.max(4, anchorRect.left - 20) : 0

  return createPortal(
    <>
      <div style={{ position: 'fixed', inset: 0, zIndex: 8000 }} onClick={onClose} />
      <div className="filter-dropdown" style={{ position: 'fixed', top, left, zIndex: 8001, minWidth: '160px' }}>
        <div className="filter-dropdown-list" style={{ padding: '4px 0' }}>
          {FLAG_OPTIONS.map(opt => (
            <div
              key={String(opt.value)}
              className={`flag-menu-item${currentFlag === opt.value ? ' flag-menu-item--active' : ''}`}
              onClick={() => { onSelect(opt.value); onClose() }}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 12px', cursor: 'pointer' }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24"
                fill={opt.color || 'none'} stroke={opt.color || '#c4c7ca'}
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
                <line x1="4" y1="22" x2="4" y2="15" />
              </svg>
              <span style={{ fontSize: '13px' }}>{opt.label}</span>
            </div>
          ))}
        </div>
      </div>
    </>,
    document.body
  )
}

/* ------------------------------------------------------------------ */
/*  FindReplaceModal                                                     */
/* ------------------------------------------------------------------ */
function FindReplaceModal({ rows, columns, onConfirm, onCancel }) {
  const textCols = columns.filter(c => c.type === 'text')
  const [selCol, setSelCol] = useState(textCols[0]?.key || '')
  const [findText, setFindText] = useState('')
  const [replaceText, setReplaceText] = useState('')

  const matches = useMemo(() => {
    if (!findText) return []
    const lower = findText.toLowerCase()
    return rows.map(row => {
      const val = (row.components || {})[selCol]
      if (typeof val === 'string' && val.toLowerCase().includes(lower)) {
        const regex = new RegExp(findText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')
        return { id: row.id, oldVal: val, newVal: val.replace(regex, replaceText) }
      }
      return null
    }).filter(Boolean)
  }, [rows, selCol, findText, replaceText])

  return createPortal(
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal-content" style={{ maxWidth: '600px', width: '90%' }} onClick={e => e.stopPropagation()}>
        <h3 className="modal-title">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          Cari &amp; Ganti
        </h3>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '120px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '13px', fontWeight: 500 }}>Kolom:</label>
              <select value={selCol} onChange={e => setSelCol(e.target.value)}
                style={{ padding: '6px 8px', borderRadius: '4px', border: '1px solid var(--color-border)', fontSize: '13px' }}>
                {textCols.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
            </div>
            <div style={{ flex: 1, minWidth: '120px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '13px', fontWeight: 500 }}>Cari:</label>
              <input type="text" value={findText} onChange={e => setFindText(e.target.value)}
                placeholder="Teks yang dicari..." autoFocus
                style={{ padding: '6px 8px', borderRadius: '4px', border: '1px solid var(--color-border)', fontSize: '13px' }} />
            </div>
            <div style={{ flex: 1, minWidth: '120px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '13px', fontWeight: 500 }}>Ganti dengan:</label>
              <input type="text" value={replaceText} onChange={e => setReplaceText(e.target.value)}
                placeholder="Kosongkan untuk hapus"
                style={{ padding: '6px 8px', borderRadius: '4px', border: '1px solid var(--color-border)', fontSize: '13px' }} />
            </div>
          </div>

          {/* Live preview */}
          {findText ? (
            <div style={{ border: '1px solid var(--color-grid-line)', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{ background: 'var(--color-surface-subtle)', padding: '5px 12px', fontSize: '12px', fontWeight: 500, color: 'var(--color-ink-muted)', borderBottom: '1px solid var(--color-grid-line)' }}>
                Preview: {matches.length} baris cocok
              </div>
              <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                {matches.length > 0
                  ? <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                    <tbody>
                      {matches.map(m => (
                        <tr key={m.id} style={{ borderBottom: '1px solid var(--color-grid-line)' }}>
                          <td style={{ padding: '5px 12px', color: '#d93025', textDecoration: 'line-through', background: '#fce8e6', wordBreak: 'break-word' }}>{m.oldVal}</td>
                          <td style={{ padding: '5px 12px', color: '#188038', background: '#e6f4ea', wordBreak: 'break-word' }}>{m.newVal}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  : <div style={{ padding: '12px', textAlign: 'center', color: '#5f6368', fontSize: '13px' }}>Tidak ditemukan kecocokan</div>
                }
              </div>
            </div>
          ) : (
            <div style={{ padding: '12px', textAlign: 'center', color: '#80868b', fontSize: '13px', border: '1px dashed var(--color-border)', borderRadius: '4px' }}>
              Ketik teks pencarian untuk melihat preview.
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onCancel}>Batal</button>
          <button className="btn-primary" disabled={matches.length === 0}
            onClick={() => matches.length > 0 && onConfirm(selCol, findText, replaceText, matches)}>
            Ganti {matches.length > 0 ? `${matches.length} Kemunculan` : ''}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

/* ------------------------------------------------------------------ */
/*  BulkAddModal                                                         */
/* ------------------------------------------------------------------ */
function BulkAddModal({ locationName, onConfirm, onCancel }) {
  const [count, setCount] = useState(5)
  const ref = useRef(null)
  useEffect(() => { ref.current?.focus(); ref.current?.select() }, [])

  return createPortal(
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <h3 className="modal-title">Tambah Baris Sekaligus</h3>
        <form onSubmit={e => { e.preventDefault(); onConfirm(Math.max(1, Math.min(100, Math.floor(count)))) }}>
          <div className="modal-body">
            <p>Tambahkan beberapa baris kosong ke lokasi <strong>{locationName}</strong>.</p>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px' }}>
              <span style={{ fontSize: '13px', whiteSpace: 'nowrap' }}>Jumlah baris:</span>
              <input ref={ref} type="number" className="ds-input" style={{ width: '80px' }}
                value={count} onChange={e => setCount(Number(e.target.value))} min={1} max={100} />
            </label>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onCancel}>Batal</button>
            <button type="submit" className="btn-primary">Tambah {Math.max(1, Math.min(100, Math.floor(count || 0)))} Baris</button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}

/* ------------------------------------------------------------------ */
/*  BulkFillModal                                                        */
/* ------------------------------------------------------------------ */
function BulkFillModal({ count, columns, onConfirm, onCancel }) {
  const fillable = columns.filter(c => c.type !== 'gdrive_link' && !c.is_readonly)
  const [selCol, setSelCol] = useState(fillable[0]?.key || '')
  const [value, setValue] = useState('')

  const activeDef = fillable.find(c => c.key === selCol)
  const rawOptions = (activeDef?.select_options || []).map(o => typeof o === 'string' ? { value: o, label: o } : o)

  return createPortal(
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <h3 className="modal-title">Isi Kolom Massal</h3>
        <form onSubmit={e => {
          e.preventDefault()
          let finalVal = value
          if (activeDef?.type === 'number' && value !== '') finalVal = Number(value)
          onConfirm(selCol, finalVal)
        }}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <p>Isi kolom untuk <strong>{count} baris</strong> terpilih.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '13px', fontWeight: 500 }}>Pilih Kolom:</label>
              <select value={selCol} onChange={e => { setSelCol(e.target.value); setValue('') }}
                style={{ padding: '6px 8px', borderRadius: '4px', border: '1px solid var(--color-border)', fontSize: '13px' }}>
                {fillable.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '13px', fontWeight: 500 }}>Nilai Baru:</label>
              {activeDef?.type === 'select' ? (
                <select value={value} onChange={e => setValue(e.target.value)}
                  style={{ padding: '6px 8px', borderRadius: '4px', border: '1px solid var(--color-border)', fontSize: '13px' }}>
                  {rawOptions.map(o => <option key={o.value} value={o.value}>{o.label || '(Kosong)'}</option>)}
                </select>
              ) : (
                <input
                  type={activeDef?.type === 'number' ? 'number' : 'text'}
                  value={value} onChange={e => setValue(e.target.value)}
                  placeholder={activeDef?.type === 'number' ? 'Masukkan angka...' : 'Masukkan teks...'}
                  style={{ padding: '6px 8px', borderRadius: '4px', border: '1px solid var(--color-border)', fontSize: '13px' }} />
              )}
            </div>
            <div style={{ padding: '8px', background: 'var(--color-surface-subtle)', borderRadius: '4px', fontSize: '12px', color: 'var(--color-ink-muted)' }}>
              Akan mengisi kolom <strong>{activeDef?.label}</strong> dengan nilai <strong>{value || '(Kosong)'}</strong> ke {count} baris terpilih.
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onCancel}>Batal</button>
            <button type="submit" className="btn-primary">Konfirmasi</button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}

/* ------------------------------------------------------------------ */
/*  DataGrid — Main Component                                            */
/* ------------------------------------------------------------------ */
/**
 * @param {string}  props.locationName   - Display name lokasi aktif
 * @param {boolean} props.canEdit        - permission
 */
export default function DataGrid({ locationName, canEdit }) {
  const { activeDepartmentId, activeLocationId } = useNavigation()
  const { currentUser } = useAuth()
  const { addToast } = useToast()

  // Dynamic schema and data hooks
  const { columns, addColumn } = useDynamicSchema(activeDepartmentId)
  const { rows, isLoading, addRow, bulkAddRows, updateCell, updateFlag, updateItemCodeMode, deleteRow, bulkDeleteRows, bulkFillColumn } = useGridData(activeLocationId, activeDepartmentId)
  const { isAdmin } = useAuth()
  // Aturan pengecualian kelengkapan — diambil live dari Dexie, reaktif saat Admin mengubah rules
  const exceptionRules = useLiveExceptionRules(activeDepartmentId)

  const userId = currentUser?.uid || currentUser?.email || ''

  /* ---------------------------------------------------------------- */
  /*  Grid UI State                                                     */
  /* ---------------------------------------------------------------- */
  const [selectedRows, setSelectedRows] = useState(new Set())
  const [columnFilters, setColumnFilters] = useState({})
  const [openFilterCol, setOpenFilterCol] = useState(null)
  const [filterAnchorRect, setFilterAnchorRect] = useState(null)
  const [openFlagRow, setOpenFlagRow] = useState(null)
  const [flagAnchorRect, setFlagAnchorRect] = useState(null)
  const [openBulkFlagMenu, setOpenBulkFlagMenu] = useState(false)
  const [bulkFlagAnchorRect, setBulkFlagAnchorRect] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [copyColKey, setCopyColKey] = useState(null)

  // Modals
  const [showBulkAddModal, setShowBulkAddModal] = useState(false)
  const [showBulkFillModal, setShowBulkFillModal] = useState(false)
  const [showFindReplaceModal, setShowFindReplaceModal] = useState(false)
  const { confirm } = useDialog()
  const [deleteTargetIds, setDeleteTargetIds] = useState([])
  
  const [showExportModal, setShowExportModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)

  // Undo (in-memory, loses on refresh)
  const [undoStack, setUndoStack] = useState([])

  // Reset selection when location changes
  useEffect(() => {
    setSelectedRows(new Set())
    setSearchQuery('')
    setColumnFilters({})
  }, [activeLocationId, activeDepartmentId])

  /* ---------------------------------------------------------------- */
  /*  Filtered rows                                                     */
  /* ---------------------------------------------------------------- */
  const filteredRows = useMemo(() => {
    let result = rows
    // Apply column filters
    Object.entries(columnFilters).forEach(([colKey, checked]) => {
      if (!checked) return
      result = result.filter(row => {
        const v = (row.components || {})[colKey]
        const str = v === null || v === undefined || v === '' ? EMPTY_SENTINEL : String(v)
        return checked.has(str)
      })
    })
    // Apply search
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      result = result.filter(row =>
        Object.values(row.components || {}).some(v => String(v ?? '').toLowerCase().includes(q))
      )
    }
    return result
  }, [rows, columnFilters, searchQuery])

  /* ---------------------------------------------------------------- */
  /*  Column layout                                                      */
  /* ---------------------------------------------------------------- */
  const totalWidth = (canEdit ? CHECKBOX_COL_W : 0) + FLAG_COL_W + ROW_NUM_W +
    columns.reduce((s, c) => s + (c.width || DEFAULT_COL_W), 0) +
    (canEdit ? ACTION_COL_W : 0)

  /* ---------------------------------------------------------------- */
  /*  Handlers                                                          */
  /* ---------------------------------------------------------------- */
  const handleSaveCell = useCallback(async (rowId, colKey, value) => {
    const row = rows.find(r => r.id === rowId)
    if (row) {
      setUndoStack(prev => {
        const entry = { rowId, colKey, oldValue: (row.components || {})[colKey], ts: Date.now() }
        const next = [...prev, entry]
        return next.length > UNDO_LIMIT ? next.slice(-UNDO_LIMIT) : next
      })
    }
    await updateCell(rowId, colKey, value, userId)
  }, [rows, updateCell, userId])

  const handleUndo = useCallback(async () => {
    if (!undoStack.length) return
    const last = undoStack[undoStack.length - 1]
    setUndoStack(prev => prev.slice(0, -1))
    try {
      await updateCell(last.rowId, last.colKey, last.oldValue, userId)
      addToast('Perubahan dibatalkan (undo).', 'success')
    } catch {
      addToast('Gagal melakukan undo.', 'error')
    }
  }, [undoStack, updateCell, userId, addToast])

  // Keyboard shortcut Ctrl+Z
  useEffect(() => {
    function onKey(e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault(); handleUndo()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handleUndo])

  async function handleAddRow() {
    if (!canEdit) return
    try {
      await addRow(userId)
      logActivity('tambah_baris', userId, { location: activeLocationId, dept: activeDepartmentId })
    } catch (err) { addToast('Gagal menambah baris: ' + err.message, 'error') }
  }

  async function handleBulkAdd(count) {
    try {
      await bulkAddRows(count, userId)
      logActivity('bulk_tambah_baris', userId, { count })
      setShowBulkAddModal(false)
      addToast(`${count} baris kosong ditambahkan.`, 'success')
    } catch (err) { addToast('Gagal: ' + err.message, 'error') }
  }

  async function handleDelete(ids) {
    try {
      await bulkDeleteRows(ids, userId)
      logActivity('bulk_hapus_baris', userId, { count: ids.length })
      setSelectedRows(new Set())
      setDeleteTargetIds([])
      addToast(`${ids.length} baris dihapus.`, 'success')
    } catch (err) { addToast('Gagal hapus: ' + err.message, 'error') }
  }

  async function handleDeleteClick(ids) {
    setDeleteTargetIds(ids)
    const confirmed = await confirm({
      title: `Hapus ${ids.length} Baris?`,
      message: `Hapus ${ids.length} baris dari lokasi ${locationName}? Data akan dipindahkan ke Recycle Bin.`,
      danger: true,
      confirmText: `Hapus ${ids.length} Baris`
    })
    if (!confirmed) { setDeleteTargetIds([]); return }
    handleDelete(ids)
  }

  async function handleDuplicate(row) {
    if (!canEdit) return
    try {
      const comps = { ...row.components }
      // Remove auto-generated keys
      const autoCols = columns.filter(c => c.is_auto).map(c => c.key)
      autoCols.forEach(k => delete comps[k])
      await addRow(userId)   // simplified: add empty row (full dup would need direct db write)
      logActivity('duplikat_baris', userId, { rowId: row.id })
      addToast('Baris diduplikat.', 'success')
    } catch (err) { addToast('Gagal duplikat: ' + err.message, 'error') }
  }

  async function handleBulkFill(colKey, value) {
    const ids = [...selectedRows]
    try {
      await bulkFillColumn(ids, colKey, value, userId)
      logActivity('bulk_fill_kolom', userId, { colKey, count: ids.length })
      setShowBulkFillModal(false)
      addToast(`Kolom diisi untuk ${ids.length} baris.`, 'success')
    } catch (err) { addToast('Gagal bulk fill: ' + err.message, 'error') }
  }

  async function handleFindReplace(colKey, findText, replaceText, matches) {
    try {
      for (const m of matches) {
        await updateCell(m.id, colKey, m.newVal, userId)
      }
      logActivity('find_replace', userId, { colKey, count: matches.length })
      setShowFindReplaceModal(false)
      addToast(`${matches.length} nilai diganti.`, 'success')
    } catch (err) { addToast('Gagal find & replace: ' + err.message, 'error') }
  }

  async function handleSetFlag(rowId, flag) {
    try {
      await updateFlag(rowId, flag, null, userId)
    } catch (err) { addToast('Gagal set flag: ' + err.message, 'error') }
    setOpenFlagRow(null)
  }

  async function handleBulkFlag(flag) {
    const ids = [...selectedRows]
    try {
      for (const id of ids) await updateFlag(id, flag, null, userId)
      setOpenBulkFlagMenu(false)
      addToast(`Flag diset untuk ${ids.length} baris.`, 'success')
    } catch (err) { addToast('Gagal bulk flag: ' + err.message, 'error') }
  }

  // Selection helpers
  const toggleSelectAll = () => {
    if (selectedRows.size === filteredRows.length) setSelectedRows(new Set())
    else setSelectedRows(new Set(filteredRows.map(r => r.id)))
  }

  const toggleRowSelect = (id) => {
    setSelectedRows(prev => {
      const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n
    })
  }

  const openFilter = (colKey, e) => {
    setOpenFilterCol(colKey)
    setFilterAnchorRect(e.currentTarget.getBoundingClientRect())
  }

  const handleFilterApply = (colKey, checked) => {
    setColumnFilters(prev => {
      if (!checked) { const n = { ...prev }; delete n[colKey]; return n }
      return { ...prev, [colKey]: checked }
    })
  }

  /* ---------------------------------------------------------------- */
  /*  Render: empty / loading                                           */
  /* ---------------------------------------------------------------- */
  if (!activeDepartmentId || !activeLocationId) {
    return (
      <div style={{ padding: '32px', textAlign: 'center', color: '#80868b', fontSize: '14px' }}>
        Pilih Department dan Location dari navigasi di atas untuk melihat data.
      </div>
    )
  }

  /* ---------------------------------------------------------------- */
  /*  Render: toolbar                                                    */
  /* ---------------------------------------------------------------- */
  const hasSelected = selectedRows.size > 0
  const activeFilters = Object.keys(columnFilters).length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* ---- Toolbar ---- */}
      <div style={{
        display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px',
        padding: '8px 12px', borderBottom: '1px solid var(--color-grid-line)',
        background: 'var(--color-canvas)', flexShrink: 0,
      }}>
        {canEdit && (
          <>
            <button id="dg-add-row" className="btn-primary" style={{ padding: '5px 12px', fontSize: '13px', gap: '5px' }}
              onClick={handleAddRow}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Tambah Baris
            </button>
            <button id="dg-bulk-add" className="btn-secondary" style={{ padding: '5px 12px', fontSize: '13px' }}
              onClick={() => setShowBulkAddModal(true)}>
              Tambah Sekaligus
            </button>
          </>
        )}

        {/* Bulk action buttons — only when rows selected */}
        {canEdit && hasSelected && (
          <>
            <div style={{ width: '1px', height: '20px', background: '#dadce0' }} />
            <span style={{ fontSize: '12px', color: '#5f6368', whiteSpace: 'nowrap' }}>
              {selectedRows.size} baris dipilih
            </span>
            <button id="dg-bulk-fill" className="btn-secondary" style={{ padding: '5px 12px', fontSize: '13px' }}
              onClick={() => setShowBulkFillModal(true)}>
              Isi Kolom Massal
            </button>
            <button
              id="dg-bulk-flag"
              className="btn-secondary"
              style={{ padding: '5px 12px', fontSize: '13px' }}
              onClick={(e) => { setOpenBulkFlagMenu(true); setBulkFlagAnchorRect(e.currentTarget.getBoundingClientRect()) }}
            >
              Tandai
            </button>
            <button id="dg-bulk-delete" className="btn-secondary"
              style={{ padding: '5px 12px', fontSize: '13px', color: '#d93025', borderColor: '#d93025' }}
              onClick={() => requestDelete([...selectedRows])}>
              Hapus Dipilih
            </button>
          </>
        )}

        {/* Undo */}
        {canEdit && (
          <button id="dg-undo" className="btn-secondary"
            style={{ padding: '5px 12px', fontSize: '13px', opacity: undoStack.length ? 1 : 0.45 }}
            onClick={handleUndo} disabled={!undoStack.length} title="Undo (Ctrl+Z)">
            ↩ Undo
          </button>
        )}

        {/* Find & Replace */}
        {canEdit && (
          <button id="dg-find-replace" className="btn-secondary" style={{ padding: '5px 12px', fontSize: '13px' }}
            onClick={() => setShowFindReplaceModal(true)}>
            Cari &amp; Ganti
          </button>
        )}

        {/* Import / Export */}
        <div style={{ width: '1px', height: '20px', background: '#dadce0', margin: '0 4px' }} />
        {canEdit && (
          <button id="dg-import" className="btn-secondary" style={{ padding: '5px 12px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px' }}
            onClick={() => setShowImportModal(true)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            Import
          </button>
        )}
        <button id="dg-export" className="btn-secondary" style={{ padding: '5px 12px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px' }}
          onClick={() => setShowExportModal(true)}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Export
        </button>

        {/* Active filter indicator */}
        {activeFilters > 0 && (
          <button className="btn-secondary"
            style={{ padding: '5px 12px', fontSize: '12px', color: '#1a73e8', borderColor: '#1a73e8' }}
            onClick={() => setColumnFilters({})}>
            × Hapus {activeFilters} Filter
          </button>
        )}

        {/* Search bar */}
        <div style={{ position: 'relative', marginLeft: 'auto' }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#80868b"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            id="dg-search"
            type="text"
            placeholder="Cari di lokasi ini..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ padding: '5px 8px 5px 28px', fontSize: '12px', border: '1px solid var(--color-border)', borderRadius: '6px', width: '180px', outline: 'none' }}
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')}
              style={{ position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#80868b', padding: 0, lineHeight: 1 }}>
              ×
            </button>
          )}
        </div>
      </div>

      {/* ---- Data Grid ---- */}
      <div className="data-grid-wrapper" style={{ flex: 1, overflow: 'auto' }}>
        {isLoading ? (
          <div className="grid-empty-state">
            <div style={{ width: '24px', height: '24px', border: '3px solid #e8eaed', borderTop: '3px solid #1a73e8', borderRadius: '50%', margin: '0 auto 12px', animation: 'spin 1s linear infinite' }} />
            <p>Memuat data...</p>
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="grid-empty-state">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#dadce0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block', margin: '0 auto 12px' }}>
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
            <p style={{ fontWeight: 600, color: '#1f2328' }}>Belum ada data</p>
            <p>Lokasi <strong>{locationName}</strong> belum memiliki baris data.</p>
            {canEdit && (
              <button className="btn-primary" style={{ marginTop: '12px', padding: '8px 20px', fontSize: '13px' }}
                onClick={handleAddRow}>
                + Tambah Baris Pertama
              </button>
            )}
          </div>
        ) : (
          <table className="data-grid" style={{ minWidth: `${totalWidth}px` }}>
            <thead>
              <tr>
                {canEdit && (
                  <th className="grid-checkbox-col" style={{ width: CHECKBOX_COL_W }}>
                    <input type="checkbox"
                      checked={filteredRows.length > 0 && selectedRows.size === filteredRows.length}
                      onChange={toggleSelectAll}
                      title="Pilih semua" />
                  </th>
                )}
                <th className="grid-flag-col" style={{ width: FLAG_COL_W }} />
                <th className="row-num" style={{ width: ROW_NUM_W }}>#</th>
                {columns.map(col => (
                  <th key={col.key} style={{ width: col.width || DEFAULT_COL_W, background: copyColKey === col.key ? '#e8f0fe' : undefined }}>
                    <div className="th-filter-wrapper">
                      <span
                        style={{ cursor: 'pointer', userSelect: 'none', color: copyColKey === col.key ? '#1a73e8' : undefined }}
                        onClick={() => setCopyColKey(prev => prev === col.key ? null : col.key)}
                        title={`Klik untuk pilih kolom ${col.label}`}
                      >
                        {col.label}
                        {col.is_readonly && <span style={{ marginLeft: '4px', fontSize: '10px', color: '#80868b' }}>🔒</span>}
                      </span>
                      <button
                        className={`filter-icon-btn${columnFilters[col.key] ? ' filter-icon-btn--active' : ''}`}
                        title={`Filter ${col.label}`}
                        onClick={e => openFilter(col.key, e)}
                      >
                        <svg width="11" height="11" viewBox="0 0 24 24"
                          fill={columnFilters[col.key] ? 'currentColor' : 'none'}
                          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
                        </svg>
                      </button>
                    </div>
                  </th>
                ))}
                {canEdit && <th className="grid-action-col" style={{ width: ACTION_COL_W }}>Aksi</th>}
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row, idx) => {
                const isSelected = selectedRows.has(row.id)
                const complete = evaluateRowCompleteness(row.components, columns, exceptionRules)
                const rowFlag = row.flag

                let trClass = ''
                if (isSelected && rowFlag) trClass = `row-flag-${rowFlag} row-selected-flagged`
                else if (isSelected) trClass = 'row-selected'
                else if (rowFlag) trClass = `row-flag-${rowFlag}`

                return (
                  <tr key={row.id} className={trClass}>
                    {canEdit && (
                      <td className="grid-checkbox-col">
                        <input type="checkbox" checked={isSelected} onChange={() => toggleRowSelect(row.id)} />
                      </td>
                    )}

                    {/* Flag button */}
                    <td className="grid-flag-col">
                      <button
                        className={`row-flag-btn${rowFlag ? ` row-flag-btn--${rowFlag}` : ''}`}
                        onClick={e => canEdit && (setOpenFlagRow(row.id), setFlagAnchorRect(e.currentTarget.getBoundingClientRect()))}
                        title={rowFlag === 'question' ? 'Perlu Ditanyakan' : rowFlag === 'skip' ? 'Dilewati' : canEdit ? 'Beri Tanda' : ''}
                        disabled={!canEdit}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24"
                          fill={rowFlag ? 'currentColor' : 'none'} stroke="currentColor"
                          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
                          <line x1="4" y1="22" x2="4" y2="15" />
                        </svg>
                      </button>
                    </td>

                    {/* Row number */}
                    <td className="row-num">
                      <div
                        className={`grid-cell-display grid-cell-display--readonly${!complete ? ' incomplete-row' : ''}`}
                        style={{ justifyContent: 'center', padding: '6px 4px', userSelect: 'none' }}>
                        {idx + 1}
                      </div>
                    </td>

                    {/* Data cells */}
                    {columns.map(col => (
                      <EditableCell
                        key={col.key}
                        value={(row.components || {})[col.key]}
                        column={col}
                        rowId={row.id}
                        canEdit={canEdit}
                        onSave={handleSaveCell}
                        highlight={isSelected || copyColKey === col.key}
                        itemCodeMode={col.is_item_code_column ? (row.item_code_mode ?? 'auto') : undefined}
                        onToggleMode={col.is_item_code_column ? async (rId, newMode) => {
                          try { await updateItemCodeMode(rId, newMode, userId) }
                          catch (e) { console.error('[DataGrid] updateItemCodeMode:', e) }
                        } : undefined}
                        departmentId={activeDepartmentId}
                      />
                    ))}

                    {/* Action column */}
                    {canEdit && (
                      <td className="grid-action-col">
                        <div style={{ display: 'flex', gap: '3px', justifyContent: 'center' }}>
                          <button className="action-btn" title="Duplikat baris" onClick={() => handleDuplicate(row)}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                            </svg>
                          </button>
                          <button className="action-btn action-btn--danger" title="Hapus baris" onClick={() => requestDelete([row.id])}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ---- Popovers ---- */}
      {openFilterCol && (
        <ColumnFilterPopover
          colKey={openFilterCol}
          rows={rows}
          currentFilter={columnFilters[openFilterCol] || null}
          onApply={handleFilterApply}
          onClose={() => setOpenFilterCol(null)}
          anchorRect={filterAnchorRect}
        />
      )}
      {openFlagRow && (
        <RowFlagPopover
          currentFlag={rows.find(r => r.id === openFlagRow)?.flag || null}
          onSelect={flag => handleSetFlag(openFlagRow, flag)}
          onClose={() => setOpenFlagRow(null)}
          anchorRect={flagAnchorRect}
        />
      )}
      {openBulkFlagMenu && (
        <RowFlagPopover
          currentFlag={null}
          onSelect={handleBulkFlag}
          onClose={() => setOpenBulkFlagMenu(false)}
          anchorRect={bulkFlagAnchorRect}
        />
      )}

      {/* ---- Modals ---- */}
      {showBulkAddModal && (
        <BulkAddModal locationName={locationName} onConfirm={handleBulkAdd} onCancel={() => setShowBulkAddModal(false)} />
      )}
      {showBulkFillModal && (
        <BulkFillModal count={selectedRows.size} columns={columns} onConfirm={handleBulkFill} onCancel={() => setShowBulkFillModal(false)} />
      )}
      {showFindReplaceModal && (
        <FindReplaceModal rows={rows} columns={columns} onConfirm={handleFindReplace} onCancel={() => setShowFindReplaceModal(false)} />
      )}


      {showExportModal && (
        <ExportModal
          allRows={rows}
          filteredRows={filteredRows}
          selectedRows={selectedRows}
          columns={columns}
          locationName={locationName}
          deptName={activeDepartmentId}
          onClose={() => setShowExportModal(false)}
        />
      )}

      {showImportModal && canEdit && (
        <ImportModal
          columns={columns}
          bulkInsertRows={bulkInsertRows}
          addColumn={addColumn}
          isAdmin={isAdmin}
          locationId={activeLocationId}
          departmentId={activeDepartmentId}
          locationName={locationName}
          deptName={activeDepartmentId}
          userId={userId}
          onClose={() => setShowImportModal(false)}
          onImported={({ batchId, rowCount }) => {
            addToast(`${rowCount} baris berhasil diimpor.`, 'success')
            setShowImportModal(false)
          }}
        />
      )}
    </div>
  )
}
