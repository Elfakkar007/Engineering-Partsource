/**
 * EditableCell.jsx
 *
 * Generic inline-edit cell renderer yang 100% config-driven dari columns_config.
 *
 * Tipe yang didukung (SRS v2.0 §4):
 *   'text'        → textarea (auto-resize)
 *   'number'      → input[type=number]
 *   'select'      → dropdown dari column.select_options
 *   'gdrive_link' → GdrivePreview (Portal hover/tap preview)
 *
 * Properti kolom khusus:
 *   is_readonly: true → sel tidak bisa diedit manual dari grid (mis. col_4 Code Material)
 *
 * DESIGN_v2.md §3 — editable-cell
 */

import { useState, useEffect, useRef } from 'react'
import GdrivePreview from './GdrivePreview'

/* ------------------------------------------------------------------ */
/*  Save indicator — ✓ kecil yang muncul sesaat setelah simpan         */
/* ------------------------------------------------------------------ */
function SaveIndicator() {
  return (
    <span style={{
      position: 'absolute', top: '2px', right: '4px',
      fontSize: '10px', color: '#188038', pointerEvents: 'none',
      animation: 'fadeInOut 1.5s ease forwards',
    }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 6L9 17l-5-5" />
      </svg>
    </span>
  )
}

/* ------------------------------------------------------------------ */
/*  Chip for select columns                                             */
/* ------------------------------------------------------------------ */
function SelectChip({ value, options }) {
  const opt = options?.find(o => (typeof o === 'string' ? o : o.value) === value)
  const tone = opt?.tone || 'default'

  const toneStyle = {
    active:   { background: '#e6f4ea', color: '#188038' },
    inactive: { background: '#f1f3f4', color: '#5f6368' },
    warning:  { background: '#fef7e0', color: '#b06000' },
    danger:   { background: '#fce8e6', color: '#d93025' },
    default:  { background: '#e8f0fe', color: '#1a73e8' },
  }

  const style = toneStyle[tone] || toneStyle.default

  return (
    <span style={{
      display: 'inline-block', padding: '1px 7px', borderRadius: '10px',
      fontSize: '11px', fontWeight: 500, ...style,
    }}>
      {value}
    </span>
  )
}

/* ------------------------------------------------------------------ */
/*  EditableCell                                                         */
/* ------------------------------------------------------------------ */
/**
 * @param {Object}   props
 * @param {*}        props.value         - nilai sel saat ini
 * @param {Object}   props.column        - kolom dari useDynamicSchema: { key, type, label, select_options, is_readonly, width }
 * @param {number}   props.rowId         - Dexie ID baris
 * @param {boolean}  props.canEdit       - permission edit
 * @param {Function} props.onSave        - async (rowId, colKey, value) => void
 * @param {boolean}  [props.highlight]   - highlight latar (mis. saat baris dipilih)
 */
export default function EditableCell({ value, column, rowId, canEdit, onSave, highlight }) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState('')
  const [showSaved, setShowSaved] = useState(false)
  const inputRef = useRef(null)
  const timerRef = useRef(null)

  const { key: colKey, type = 'text', is_readonly = false, select_options = [] } = column

  // Readonly cells: canEdit tapi kolom dikunci — is_readonly override
  const effectiveCanEdit = canEdit && !is_readonly

  const displayValue = (value === null || value === undefined || value === '') ? null : value

  function startEdit() {
    if (!effectiveCanEdit) return
    setEditValue(displayValue != null ? String(displayValue) : '')
    setIsEditing(true)
  }

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      if (type !== 'select' && inputRef.current.select) inputRef.current.select()
      if (type === 'text') {
        inputRef.current.style.height = '40px'
        inputRef.current.style.height = inputRef.current.scrollHeight + 'px'
      }
    }
  }, [isEditing, type])

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current) }, [])

  async function commit(overrideValue) {
    setIsEditing(false)
    let newValue = overrideValue !== undefined ? overrideValue : editValue
    if (type === 'number') newValue = newValue === '' ? null : Number(newValue)

    const oldStr = displayValue != null ? String(displayValue) : (type === 'number' ? null : '')
    const newStr = newValue !== null ? String(newValue) : null
    if (newStr === oldStr) return

    try {
      await onSave(rowId, colKey, newValue)
      setShowSaved(true)
      timerRef.current = setTimeout(() => setShowSaved(false), 1500)
    } catch (err) {
      console.error(`[EditableCell] save failed: ${colKey}`, err)
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') { e.preventDefault(); commit() }
    else if (e.key === 'Escape') setIsEditing(false)
  }

  /* ------------------------------------------------------------------ */
  /*  Render editing state                                                */
  /* ------------------------------------------------------------------ */
  if (isEditing) {
    let input

    if (type === 'select') {
      const rawOptions = select_options.map(o => typeof o === 'string' ? { value: o, label: o } : o)
      input = (
        <select
          ref={inputRef}
          className="grid-cell-select"
          value={editValue}
          onChange={(e) => {
            const v = e.target.value
            setEditValue(v)
            setIsEditing(false)
            onSave(rowId, colKey, v).then(() => {
              setShowSaved(true)
              timerRef.current = setTimeout(() => setShowSaved(false), 1500)
            }).catch(console.error)
          }}
          onBlur={() => setIsEditing(false)}
          onKeyDown={handleKeyDown}
        >
          {rawOptions.map(o => (
            <option key={o.value} value={o.value}>{o.label || o.value || '— Pilih —'}</option>
          ))}
        </select>
      )
    } else if (type === 'number') {
      input = (
        <>
          <input
            ref={inputRef}
            type="number"
            className="grid-cell-input"
            style={{ position: 'absolute', inset: 0, zIndex: 10,
              boxShadow: 'rgba(0,0,0,0.15) 0 4px 16px', borderRadius: '2px', background: '#fff' }}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={commit}
            onKeyDown={handleKeyDown}
          />
          {showSaved && <SaveIndicator />}
        </>
      )
    } else if (type === 'gdrive_link') {
      // Edit mode for gdrive_link: plain URL text input
      input = (
        <>
          <input
            ref={inputRef}
            type="url"
            className="grid-cell-input"
            style={{ position: 'absolute', inset: 0, zIndex: 10,
              boxShadow: 'rgba(0,0,0,0.15) 0 4px 16px', borderRadius: '2px', background: '#fff' }}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={commit}
            onKeyDown={handleKeyDown}
            placeholder="Tempel URL Google Drive..."
          />
          {showSaved && <SaveIndicator />}
        </>
      )
    } else {
      // Default: text textarea
      input = (
        <>
          <textarea
            ref={inputRef}
            className="grid-cell-input grid-cell-textarea"
            style={{
              position: 'absolute', left: 0, top: 0, width: '100%', minHeight: '40px',
              height: 'auto', zIndex: 10, boxShadow: 'rgba(0,0,0,0.15) 0 4px 16px',
              borderRadius: '2px', background: '#fff', resize: 'none', overflow: 'hidden',
              wordWrap: 'break-word', whiteSpace: 'pre-wrap',
            }}
            value={editValue}
            onChange={(e) => {
              setEditValue(e.target.value)
              e.target.style.height = '40px'
              e.target.style.height = e.target.scrollHeight + 'px'
            }}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commit() }
              else if (e.key === 'Escape') setIsEditing(false)
            }}
          />
          {showSaved && <SaveIndicator />}
        </>
      )
    }

    return (
      <td style={{ position: 'relative', overflow: 'visible', ...(highlight ? { background: '#e8f0fe' } : {}) }}>
        {input}
      </td>
    )
  }

  /* ------------------------------------------------------------------ */
  /*  Render display state                                                 */
  /* ------------------------------------------------------------------ */
  // gdrive_link: Preview component
  if (type === 'gdrive_link' && displayValue) {
    return (
      <td style={{ overflow: 'visible', ...(highlight ? { background: '#e8f0fe' } : {}) }}>
        <GdrivePreview url={displayValue} canEdit={effectiveCanEdit} onEdit={startEdit} />
        {showSaved && <SaveIndicator />}
      </td>
    )
  }

  // select: chip display
  if (type === 'select' && displayValue) {
    return (
      <td
        style={{ cursor: effectiveCanEdit ? 'pointer' : 'default', ...(highlight ? { background: '#e8f0fe' } : {}) }}
        onClick={effectiveCanEdit ? startEdit : undefined}
      >
        <div className="grid-cell-display" style={{ position: 'relative' }}>
          <SelectChip value={displayValue} options={select_options} />
          {showSaved && <SaveIndicator />}
        </div>
      </td>
    )
  }

  // is_readonly: render with visual cue
  if (is_readonly) {
    return (
      <td
        title="Kolom ini diisi otomatis"
        style={{
          background: displayValue ? '#f8f9fa' : '#f1f3f4',
          ...(highlight ? { background: '#e8f0fe' } : {}),
        }}
      >
        <div style={{
          padding: '6px 8px', fontSize: '12px', color: displayValue ? '#1f2328' : '#80868b',
          fontStyle: displayValue ? 'normal' : 'italic', userSelect: 'none',
        }}>
          {displayValue ?? '(auto)'}
        </div>
      </td>
    )
  }

  // Default: text / number display
  const isEmpty = displayValue === null
  return (
    <td
      style={{ cursor: effectiveCanEdit ? 'pointer' : 'default', ...(highlight ? { background: '#e8f0fe' } : {}) }}
      onClick={effectiveCanEdit ? startEdit : undefined}
    >
      <div
        className={`grid-cell-display${!effectiveCanEdit ? ' grid-cell-display--readonly' : ''}${isEmpty ? ' grid-cell-display--empty' : ''}`}
        title={displayValue != null ? String(displayValue) : undefined}
        style={{ position: 'relative' }}
      >
        <span>{displayValue != null ? String(displayValue) : '—'}</span>
        {showSaved && <SaveIndicator />}
      </div>
    </td>
  )
}
