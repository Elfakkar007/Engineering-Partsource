/**
 * EditableCell.jsx
 *
 * Generic inline-edit cell renderer, 100% config-driven dari columns_config.
 *
 * Tipe yang didukung (SRS v2.0 par.4):
 *   text        -> textarea (auto-resize)
 *   number      -> input[type=number]
 *   select      -> dropdown dari column.select_options
 *   gdrive_link -> GdrivePreview (Portal hover/tap preview)
 *
 * Perilaku khusus (Tahap 8d - SRS v2.0 par.7):
 *   is_item_code_column = true
 *     -> Tampilkan toggle Auto/Manual di sudut kanan atas sel.
 *        Mode Auto (item_code_mode='auto') -> sel read-only, nilai hasil matching.
 *        Mode Manual (item_code_mode='manual') -> sel bisa diedit bebas.
 *   is_ref_trigger = true
 *     -> Saat editing, tampilkan autocomplete dropdown dari getSuggestions()
 *        (substring search ke reference_catalog Dexie, offline-first).
 *        User klik rekomendasi -> nilai langsung di-commit + dropdown tutup.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import GdrivePreview from './GdrivePreview'
import { getSuggestions } from '../../lib/itemCodeEngine'

/* ------------------------------------------------------------------ */
/*  Save indicator - centang kecil muncul sesaat setelah simpan        */
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
/*  SelectChip - chip berwarna untuk kolom type=select                  */
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

  return (
    <span style={{
      display: 'inline-block', padding: '1px 7px', borderRadius: '10px',
      fontSize: '11px', fontWeight: 500, ...(toneStyle[tone] || toneStyle.default),
    }}>
      {value}
    </span>
  )
}

/* ------------------------------------------------------------------ */
/*  AutocompleteDropdown - untuk kolom is_ref_trigger                   */
/* ------------------------------------------------------------------ */
function AutocompleteDropdown({ suggestions, onSelect, onClose }) {
  if (!suggestions || suggestions.length === 0) return null

  return (
    <div style={{
      position: 'absolute', top: '100%', left: 0, right: 0,
      background: '#fff', border: '1px solid #1a73e8',
      borderTop: 'none', borderRadius: '0 0 6px 6px',
      boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
      zIndex: 200, maxHeight: '180px', overflowY: 'auto',
    }}>
      {suggestions.map(s => (
        <div
          key={s.id}
          onMouseDown={e => { e.preventDefault(); onSelect(s) }}
          style={{
            padding: '6px 10px', cursor: 'pointer', fontSize: '12px',
            borderBottom: '1px solid #f1f3f4',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}
          onMouseEnter={e => e.currentTarget.style.background = '#f0f7ff'}
          onMouseLeave={e => e.currentTarget.style.background = '#fff'}
        >
          <span style={{ color: '#1f2328' }}>{s.search_key}</span>
          <code style={{ fontSize: '11px', color: '#188038', fontFamily: 'monospace', marginLeft: '8px' }}>
            {s.item_code}
          </code>
        </div>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  ItemCodeModeToggle - badge toggle Auto/Manual                       */
/* ------------------------------------------------------------------ */
function ItemCodeModeToggle({ mode, canToggle, onToggle }) {
  const isAuto = (mode ?? 'auto') === 'auto'
  return (
    <button
      title={isAuto ? 'Mode Auto: klik untuk Manual (edit bebas)' : 'Mode Manual: klik untuk Auto (hasil matching)'}
      disabled={!canToggle}
      onClick={e => { e.stopPropagation(); onToggle(isAuto ? 'manual' : 'auto') }}
      style={{
        position: 'absolute', top: '2px', left: '3px',
        fontSize: '9px', lineHeight: 1, fontWeight: 700,
        padding: '1px 5px', borderRadius: '6px', cursor: canToggle ? 'pointer' : 'default',
        border: 'none',
        background: isAuto ? '#e6f4ea' : '#fef7e0',
        color: isAuto ? '#188038' : '#b06000',
        zIndex: 5,
        letterSpacing: '0.02em',
      }}
    >
      {isAuto ? 'AUTO' : 'MNL'}
    </button>
  )
}

/* ------------------------------------------------------------------ */
/*  EditableCell                                                         */
/* ------------------------------------------------------------------ */
/**
 * @param {Object}   props
 * @param {*}        props.value               - nilai sel saat ini
 * @param {Object}   props.column              - kolom dari useDynamicSchema
 * @param {number}   props.rowId               - Dexie ID baris
 * @param {boolean}  props.canEdit             - permission edit
 * @param {Function} props.onSave              - async (rowId, colKey, value) => void
 * @param {boolean}  [props.highlight]         - highlight latar
 * @param {string}   [props.itemCodeMode]      - 'auto'|'manual' (hanya untuk is_item_code_column)
 * @param {Function} [props.onToggleMode]      - async (rowId, newMode) => void
 * @param {string}   [props.departmentId]      - diperlukan untuk autocomplete is_ref_trigger
 */
export default function EditableCell({
  value, column, rowId, canEdit, onSave, highlight,
  itemCodeMode, onToggleMode, departmentId,
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState('')
  const [showSaved, setShowSaved] = useState(false)
  const [suggestions, setSuggestions] = useState([])
  const inputRef = useRef(null)
  const timerRef = useRef(null)

  const {
    key: colKey,
    type = 'text',
    is_readonly = false,
    select_options = [],
    is_item_code_column = false,
    is_ref_trigger = false,
  } = column

  // Kolom item code mode Auto -> read-only (matching engine yang mengisi)
  const effectiveMode = is_item_code_column ? (itemCodeMode ?? 'auto') : null
  const isItemCodeAutoMode = is_item_code_column && effectiveMode === 'auto'

  // Readonly efektif: is_readonly kolom, atau kolom item code dalam mode auto
  const effectiveCanEdit = canEdit && !is_readonly && !isItemCodeAutoMode

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

  // Autocomplete: fetch suggestions saat user mengetik di kolom ref_trigger
  const fetchSuggestions = useCallback(async (text) => {
    if (!is_ref_trigger || !departmentId || !text.trim()) {
      setSuggestions([]); return
    }
    const results = await getSuggestions(text, departmentId, 8)
    setSuggestions(results)
  }, [is_ref_trigger, departmentId])

  async function commit(overrideValue) {
    setIsEditing(false)
    setSuggestions([])
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
    else if (e.key === 'Escape') { setIsEditing(false); setSuggestions([]) }
  }

  function handleSelectSuggestion(suggestion) {
    setSuggestions([])
    commit(suggestion.search_key)
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
      // Default text / ref_trigger text (dengan autocomplete)
      input = (
        <>
          <textarea
            ref={inputRef}
            className="grid-cell-input grid-cell-textarea"
            style={{
              position: 'absolute', left: 0, top: 0, width: '100%', minHeight: '40px',
              height: 'auto', zIndex: 10, boxShadow: 'rgba(0,0,0,0.15) 0 4px 16px',
              borderRadius: suggestions.length > 0 ? '2px 2px 0 0' : '2px',
              background: '#fff', resize: 'none', overflow: 'hidden',
              wordWrap: 'break-word', whiteSpace: 'pre-wrap',
            }}
            value={editValue}
            onChange={(e) => {
              setEditValue(e.target.value)
              e.target.style.height = '40px'
              e.target.style.height = e.target.scrollHeight + 'px'
              fetchSuggestions(e.target.value)
            }}
            onBlur={() => {
              // Delay blur agar onMouseDown suggestion sempat fired dulu,
              // baru commit() dipanggil — sama seperti number/gdrive_link onBlur={commit}
              setTimeout(() => { commit(); setSuggestions([]) }, 150)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commit() }
              else if (e.key === 'Escape') { setIsEditing(false); setSuggestions([]) }
            }}
          />
          {/* Autocomplete dropdown (hanya untuk is_ref_trigger) */}
          {is_ref_trigger && (
            <AutocompleteDropdown
              suggestions={suggestions}
              onSelect={handleSelectSuggestion}
              onClose={() => setSuggestions([])}
            />
          )}
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
      <td style={{ overflow: 'visible', position: 'relative', ...(highlight ? { background: '#e8f0fe' } : {}) }}>
        {is_item_code_column && (
          <ItemCodeModeToggle mode={effectiveMode} canToggle={canEdit} onToggle={m => onToggleMode?.(rowId, m)} />
        )}
        <GdrivePreview url={displayValue} canEdit={effectiveCanEdit} onEdit={startEdit} />
        {showSaved && <SaveIndicator />}
      </td>
    )
  }

  // select: chip display
  if (type === 'select' && displayValue) {
    return (
      <td
        style={{ cursor: effectiveCanEdit ? 'pointer' : 'default', position: 'relative', ...(highlight ? { background: '#e8f0fe' } : {}) }}
        onClick={effectiveCanEdit ? startEdit : undefined}
      >
        <div className="grid-cell-display" style={{ position: 'relative' }}>
          <SelectChip value={displayValue} options={select_options} />
          {showSaved && <SaveIndicator />}
        </div>
      </td>
    )
  }

  // is_item_code_column: tampilkan toggle + handle auto mode visual
  if (is_item_code_column) {
    const isEmpty = !displayValue
    return (
      <td
        style={{
          cursor: isItemCodeAutoMode ? 'default' : (effectiveCanEdit ? 'pointer' : 'default'),
          position: 'relative',
          background: isItemCodeAutoMode
            ? (isEmpty ? '#fff8f0' : '#f0fdf4')
            : (highlight ? '#e8f0fe' : undefined),
        }}
        onClick={isItemCodeAutoMode ? undefined : (effectiveCanEdit ? startEdit : undefined)}
        title={isItemCodeAutoMode
          ? (isEmpty ? 'Mode Auto: belum ada kode dari katalog' : 'Mode Auto: kode dari katalog')
          : 'Mode Manual: klik untuk edit'}
      >
        <ItemCodeModeToggle
          mode={effectiveMode}
          canToggle={canEdit}
          onToggle={m => onToggleMode?.(rowId, m)}
        />
        <div style={{
          padding: '6px 8px 6px 32px', fontSize: '12px',
          color: isEmpty ? '#b06000' : (isItemCodeAutoMode ? '#188038' : '#1f2328'),
          fontFamily: 'monospace', fontStyle: isEmpty ? 'italic' : 'normal',
          fontWeight: isEmpty ? 400 : 600,
          userSelect: isItemCodeAutoMode ? 'none' : undefined,
        }}>
          {isEmpty
            ? (isItemCodeAutoMode ? '— belum cocok —' : '—')
            : String(displayValue)}
        </div>
        {showSaved && <SaveIndicator />}
      </td>
    )
  }

  // is_readonly: render dengan visual cue
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

  // Default: text / number / ref_trigger display
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
        {/* Hint icon untuk kolom pemicu */}
        {is_ref_trigger && !isEmpty && (
          <span style={{ marginLeft: '4px', fontSize: '9px', color: '#1a73e8', opacity: 0.6 }}>⚡</span>
        )}
        {showSaved && <SaveIndicator />}
      </div>
    </td>
  )
}
