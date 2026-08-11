/**
 * ItemCodeRuleManager.jsx
 *
 * Panel kelola aturan kode barang (item_code_rules) & Reference Catalog
 * SRS v2.0 §7 & DESIGN_v2.md §5 (ItemCodeRuleBuilder)
 *
 * Bagian 1: Template Builder per Department
 *   - Input template dengan chip insert kolom & {seq:N}
 *   - Preview live hasil generate
 *   - Simpan ke Dexie item_code_rules
 *
 * Bagian 2: Reference Catalog Viewer/Manager
 *   - Tabel match_signature → item_code
 *   - Tambah entry baru
 *   - Hapus entry yang salah
 */

import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../lib/db'
import { useToast } from '../../contexts/ToastContext'
import { parseItemCodeTemplate } from '../../lib/itemCodeEngine'

/* ------------------------------------------------------------------ */
/*  Template Builder                                                      */
/* ------------------------------------------------------------------ */
function TemplateBuilder({ deptId, columns }) {
  const rule = useLiveQuery(() =>
    deptId ? db.item_code_rules.where('department_id').equals(deptId).first() : undefined,
    [deptId]
  )

  const [template, setTemplate] = useState('')
  const [targetKey, setTargetKey] = useState('')
  const [seqScope, setSeqScope] = useState('per_department')
  const [saving, setSaving] = useState(false)
  const [initialized, setInitialized] = useState(false)
  const { addToast } = useToast()

  // Sync state dari rule yang di-load Dexie
  if (rule !== undefined && !initialized) {
    if (rule) {
      setTemplate(rule.template || '')
      setTargetKey(rule.target_column_key || '')
      setSeqScope(rule.seq_scope || 'per_department')
    }
    setInitialized(true)
  }

  // Preview: generate contoh kode dengan nilai dummy
  const previewComponents = Object.fromEntries((columns || []).map(col => [col.key, col.label.slice(0, 4).toUpperCase()]))
  const previewCode = template ? parseItemCodeTemplate(template, previewComponents, 1) : ''

  function insertToken(token) {
    setTemplate(prev => prev + `{${token}}`)
  }

  async function handleSave() {
    if (!template.trim()) { addToast('Template tidak boleh kosong.', 'error'); return }
    if (!targetKey) { addToast('Pilih kolom target (untuk auto-fill kode).', 'error'); return }
    setSaving(true)
    try {
      if (rule?.id) {
        await db.item_code_rules.update(rule.id, {
          template: template.trim(),
          target_column_key: targetKey,
          seq_scope: seqScope,
        })
      } else {
        await db.item_code_rules.add({
          department_id: deptId,
          template: template.trim(),
          target_column_key: targetKey,
          seq_scope: seqScope,
          next_seq: 0,
        })
      }
      addToast('Aturan kode berhasil disimpan.', 'success')
      setInitialized(false) // reset agar re-sync
    } catch (err) {
      addToast('Gagal menyimpan: ' + err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const autoColumns = (columns || []).filter(c => !c.is_auto)

  return (
    <div style={{ marginBottom: '20px', padding: '16px', background: '#f8f9fa', borderRadius: '10px', border: '1px solid #dadce0' }}>
      <h4 style={{ margin: '0 0 14px', fontSize: '14px', fontWeight: 600, color: '#1f2328' }}>Template Kode Material</h4>

      {/* Template Input */}
      <div style={{ marginBottom: '12px' }}>
        <label style={{ fontSize: '12px', fontWeight: 500, color: '#5f6368', display: 'block', marginBottom: '4px' }}>Template String:</label>
        <input value={template} onChange={e => setTemplate(e.target.value)}
          placeholder="mis. {col_1}{col_3}{seq:3}"
          style={{ width: '100%', padding: '8px 10px', fontSize: '13px', border: '1px solid #dadce0', borderRadius: '6px', fontFamily: 'monospace', boxSizing: 'border-box' }} />
      </div>

      {/* Chip insert: kolom */}
      <div style={{ marginBottom: '12px' }}>
        <p style={{ margin: '0 0 6px', fontSize: '11px', color: '#80868b' }}>Klik untuk sisipkan ke template:</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
          {autoColumns.map(col => (
            <button key={col.key} type="button" onClick={() => insertToken(col.key)}
              style={{ padding: '3px 10px', fontSize: '11px', background: '#e8f0fe', color: '#1a73e8', border: '1px solid #c5d9f8', borderRadius: '12px', cursor: 'pointer', fontFamily: 'monospace' }}>
              {'{' + col.key + '}'}
            </button>
          ))}
          {[1, 2, 3, 4].map(n => (
            <button key={n} type="button" onClick={() => insertToken(`seq:${n}`)}
              style={{ padding: '3px 10px', fontSize: '11px', background: '#fef7e0', color: '#b06000', border: '1px solid #f9d980', borderRadius: '12px', cursor: 'pointer', fontFamily: 'monospace' }}>
              {'{seq:' + n + '}'}
            </button>
          ))}
        </div>
      </div>

      {/* Preview */}
      {previewCode && (
        <div style={{ marginBottom: '12px', padding: '8px 12px', background: '#fff', borderRadius: '6px', border: '1px solid #e8eaed' }}>
          <span style={{ fontSize: '11px', color: '#80868b' }}>Preview: </span>
          <code style={{ fontSize: '15px', fontWeight: 700, color: '#188038' }}>{previewCode}</code>
        </div>
      )}

      {/* Target Column & Scope */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
        <div>
          <label style={{ fontSize: '12px', fontWeight: 500, color: '#5f6368', display: 'block', marginBottom: '4px' }}>Kolom Target (auto-fill kode):</label>
          <select value={targetKey} onChange={e => setTargetKey(e.target.value)}
            style={{ width: '100%', padding: '6px 8px', fontSize: '12px', border: '1px solid #dadce0', borderRadius: '5px' }}>
            <option value="">— Pilih kolom —</option>
            {(columns || []).filter(c => c.is_auto || c.key.includes('code') || c.key.includes('kode')).map(col => (
              <option key={col.key} value={col.key}>{col.label}</option>
            ))}
            {(columns || []).filter(c => !(c.is_auto || c.key.includes('code') || c.key.includes('kode'))).map(col => (
              <option key={col.key} value={col.key}>{col.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={{ fontSize: '12px', fontWeight: 500, color: '#5f6368', display: 'block', marginBottom: '4px' }}>Cakupan Counter:</label>
          <select value={seqScope} onChange={e => setSeqScope(e.target.value)}
            style={{ width: '100%', padding: '6px 8px', fontSize: '12px', border: '1px solid #dadce0', borderRadius: '5px' }}>
            <option value="per_department">Per Department</option>
            <option value="per_template_prefix">Per Prefix Template</option>
          </select>
        </div>
      </div>

      <button className="btn-primary" style={{ padding: '7px 20px', fontSize: '13px' }} onClick={handleSave} disabled={saving}>
        {saving ? 'Menyimpan...' : 'Simpan Aturan'}
      </button>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Reference Catalog                                                    */
/* ------------------------------------------------------------------ */
function ReferenceCatalog({ deptId, columns }) {
  const catalog = useLiveQuery(() =>
    deptId ? db.reference_catalog.where('department_id').equals(deptId).toArray() : [],
    [deptId], []
  )
  const [search, setSearch] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [newSig, setNewSig] = useState('')
  const [newCode, setNewCode] = useState('')
  const [newTriggerKey, setNewTriggerKey] = useState('')
  const { addToast } = useToast()

  const triggerCols = (columns || []).filter(c => c.is_ref_trigger)

  const filtered = (catalog || []).filter(entry => {
    const sig = typeof entry.match_signature === 'string' ? entry.match_signature : JSON.stringify(entry.match_signature || {})
    return sig.toLowerCase().includes(search.toLowerCase()) || (entry.item_code || '').toLowerCase().includes(search.toLowerCase())
  })

  async function handleDelete(entry) {
    if (!confirm('Hapus entri katalog ini?')) return
    await db.reference_catalog.delete(entry.id)
    addToast('Entri katalog dihapus.', 'success')
  }

  async function handleAdd() {
    if (!newSig.trim() || !newCode.trim() || !newTriggerKey) {
      addToast('Isi semua field.', 'error'); return
    }
    await db.reference_catalog.add({
      department_id: deptId,
      match_signature: JSON.stringify({ [newTriggerKey]: newSig.trim() }),
      item_code: newCode.trim(),
      source: 'manual',
      created_at: new Date().toISOString(),
    })
    addToast('Entri katalog ditambahkan.', 'success')
    setShowAdd(false); setNewSig(''); setNewCode(''); setNewTriggerKey('')
  }

  const renderSig = (sig) => {
    try {
      const obj = typeof sig === 'string' ? JSON.parse(sig) : sig
      return Object.entries(obj).map(([k, v]) => `${k}=${v}`).join(', ')
    } catch { return String(sig) }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: '#1f2328' }}>
          Reference Catalog <span style={{ fontSize: '12px', color: '#80868b', fontWeight: 400 }}>({catalog?.length || 0} entri)</span>
        </h4>
        <button className="btn-secondary" style={{ padding: '5px 14px', fontSize: '12px' }} onClick={() => setShowAdd(v => !v)}>
          {showAdd ? 'Batal' : '+ Tambah Entri'}
        </button>
      </div>

      {showAdd && (
        <div style={{ marginBottom: '12px', padding: '12px', background: '#e8f0fe', borderRadius: '8px', border: '1px solid #c2d7f7' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '8px' }}>
            <div>
              <label style={{ fontSize: '11px', color: '#5f6368', display: 'block', marginBottom: '3px' }}>Kolom Trigger:</label>
              <select value={newTriggerKey} onChange={e => setNewTriggerKey(e.target.value)}
                style={{ width: '100%', padding: '5px 6px', fontSize: '12px', border: '1px solid #dadce0', borderRadius: '4px' }}>
                <option value="">— Pilih —</option>
                {triggerCols.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                {triggerCols.length === 0 && (columns || []).map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: '11px', color: '#5f6368', display: 'block', marginBottom: '3px' }}>Nilai Spesifikasi:</label>
              <input value={newSig} onChange={e => setNewSig(e.target.value)} placeholder="mis. Bearing 6204 ZZ"
                style={{ width: '100%', padding: '5px 6px', fontSize: '12px', border: '1px solid #dadce0', borderRadius: '4px', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize: '11px', color: '#5f6368', display: 'block', marginBottom: '3px' }}>Item Code:</label>
              <input value={newCode} onChange={e => setNewCode(e.target.value)} placeholder="mis. 15A1MEKB001"
                style={{ width: '100%', padding: '5px 6px', fontSize: '12px', border: '1px solid #dadce0', borderRadius: '4px', fontFamily: 'monospace', boxSizing: 'border-box' }} />
            </div>
          </div>
          <button className="btn-primary" style={{ padding: '5px 14px', fontSize: '12px' }} onClick={handleAdd}>Simpan Entri</button>
        </div>
      )}

      <div style={{ position: 'relative', marginBottom: '10px' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari spesifikasi atau kode..."
          style={{ width: '100%', padding: '6px 10px 6px 30px', fontSize: '12px', border: '1px solid #dadce0', borderRadius: '6px', boxSizing: 'border-box' }} />
        <svg style={{ position: 'absolute', left: '9px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
          width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#80868b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      </div>

      {filtered.length === 0 ? (
        <p style={{ textAlign: 'center', color: '#80868b', fontSize: '12px', padding: '20px 0' }}>Belum ada entri catalog.</p>
      ) : (
        <div style={{ border: '1px solid #dadce0', borderRadius: '8px', overflow: 'hidden', maxHeight: '260px', overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead style={{ position: 'sticky', top: 0 }}>
              <tr style={{ background: '#f8f9fa', borderBottom: '1px solid #dadce0' }}>
                <th style={{ padding: '7px 10px', textAlign: 'left', color: '#5f6368', fontWeight: 600 }}>Spesifikasi (Signature)</th>
                <th style={{ padding: '7px 10px', textAlign: 'left', color: '#5f6368', fontWeight: 600 }}>Item Code</th>
                <th style={{ padding: '7px 10px', textAlign: 'left', color: '#5f6368', fontWeight: 600 }}>Sumber</th>
                <th style={{ padding: '7px 10px', textAlign: 'center', color: '#5f6368', fontWeight: 600, width: '60px' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(entry => (
                <tr key={entry.id} style={{ borderBottom: '1px solid #f1f3f4' }}>
                  <td style={{ padding: '7px 10px', color: '#1f2328' }}>{renderSig(entry.match_signature)}</td>
                  <td style={{ padding: '7px 10px' }}>
                    <code style={{ fontFamily: 'monospace', fontWeight: 600, color: '#188038' }}>{entry.item_code}</code>
                  </td>
                  <td style={{ padding: '7px 10px' }}>
                    <span style={{
                      fontSize: '11px', padding: '1px 6px', borderRadius: '8px',
                      background: entry.source === 'seed' ? '#f1f3f4' : entry.source === 'generated' ? '#e8f0fe' : '#e6f4ea',
                      color: entry.source === 'seed' ? '#80868b' : entry.source === 'generated' ? '#1a73e8' : '#188038',
                    }}>{entry.source || 'manual'}</span>
                  </td>
                  <td style={{ padding: '7px 10px', textAlign: 'center' }}>
                    <button onClick={() => handleDelete(entry)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#d93025', fontSize: '14px' }}>✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                       */
/* ------------------------------------------------------------------ */
export default function ItemCodeRuleManager() {
  const departments = useLiveQuery(() => db.departments_cache.orderBy('order').toArray(), [], [])
  const [activeDeptId, setActiveDeptId] = useState(null)

  const effectiveDeptId = activeDeptId || departments?.[0]?.id || null

  const columns = useLiveQuery(() =>
    effectiveDeptId
      ? db.columns_config.where('department_id').equals(effectiveDeptId).sortBy('order')
      : [],
    [effectiveDeptId], []
  )

  return (
    <div>
      {/* Department Switcher */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {(departments || []).map(dept => (
          <button key={dept.id} onClick={() => setActiveDeptId(dept.id)}
            style={{
              padding: '6px 16px', borderRadius: '20px', fontSize: '13px', fontWeight: 500, cursor: 'pointer',
              border: `1.5px solid ${effectiveDeptId === dept.id ? '#1a73e8' : '#dadce0'}`,
              background: effectiveDeptId === dept.id ? '#e8f0fe' : '#fff',
              color: effectiveDeptId === dept.id ? '#1a73e8' : '#5f6368',
            }}>
            {dept.name}
          </button>
        ))}
      </div>

      {effectiveDeptId ? (
        <>
          <TemplateBuilder deptId={effectiveDeptId} columns={columns} />
          <div style={{ border: '1px solid #dadce0', borderRadius: '10px', padding: '16px' }}>
            <ReferenceCatalog deptId={effectiveDeptId} columns={columns} />
          </div>
        </>
      ) : (
        <p style={{ color: '#80868b', textAlign: 'center', padding: '40px 0' }}>
          Pilih Department di atas untuk mengelola aturan kode.
        </p>
      )}
    </div>
  )
}
