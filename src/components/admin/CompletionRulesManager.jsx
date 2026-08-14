/**
 * CompletionRulesManager.jsx
 *
 * UI Admin untuk mengelola completion_exception_rules di Dexie.
 * Admin dapat menambah/hapus aturan: "Jika kolom X = nilai Y, maka kolom Z tidak wajib diisi."
 *
 * SRS v2.0 搂8.2 鈥?Dynamic Completeness Engine
 */

import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../lib/db'
import { useToast } from '../../contexts/ToastContext'

function EmptyState() {
  return (
    <div style={{ textAlign: 'center', padding: '40px 20px', color: '#5f6368' }}>
      <div style={{ fontSize: '32px', marginBottom: '8px' }}>鈿栵笍</div>
      <p style={{ margin: 0, fontSize: '14px' }}>Belum ada aturan pengecualian.</p>
      <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#80868b' }}>
        Klik "Tambah Aturan" untuk membuat aturan baru.
      </p>
    </div>
  )
}

export default function CompletionRulesManager() {
  const { addToast } = useToast()

  // Form state
  const [showForm, setShowForm] = useState(false)
  const [formDeptId, setFormDeptId] = useState('')
  const [formCondKey, setFormCondKey] = useState('')
  const [formCondVal, setFormCondVal] = useState('')
  const [formExemptKeys, setFormExemptKeys] = useState([])

  // Live queries
  const departments = useLiveQuery(() => db.departments_cache.toArray().then(r => r.sort((a,b) => (a.order??0)-(b.order??0))), [], []) ?? []
  const allRules = useLiveQuery(() => db.completion_exception_rules.toArray(), [], []) ?? []
  const allColumns = useLiveQuery(() => db.columns_config.toArray(), [], []) ?? []

  // Kolom untuk department yang dipilih di form
  const formDeptColumns = formDeptId
    ? allColumns.filter(c => c.department_id === formDeptId).sort((a, b) => a.order - b.order)
    : []

  // Helper: cari label kolom
  function colLabel(deptId, key) {
    const col = allColumns.find(c => c.department_id === deptId && c.key === key)
    return col ? col.label : key
  }

  // Helper: cari nama department
  function deptName(id) {
    return departments.find(d => d.id === id)?.name || id
  }

  /* ---- Toggle pilihan exempt columns ---- */
  function toggleExempt(key) {
    setFormExemptKeys(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    )
  }

  /* ---- Reset form ---- */
  function resetForm() {
    setFormDeptId('')
    setFormCondKey('')
    setFormCondVal('')
    setFormExemptKeys([])
    setShowForm(false)
  }

  /* ---- Save rule ---- */
  async function handleSave() {
    if (!formDeptId) { addToast('Pilih Department.', 'error'); return }
    if (!formCondKey) { addToast('Pilih Kolom Kondisi.', 'error'); return }
    if (!formCondVal.trim()) { addToast('Isi Nilai Kondisi.', 'error'); return }
    if (formExemptKeys.length === 0) { addToast('Pilih minimal 1 kolom yang dibebaskan.', 'error'); return }

    try {
      await db.completion_exception_rules.add({
        department_id: formDeptId,
        condition_column_key: formCondKey,
        condition_value: formCondVal.trim(),
        exempt_column_keys: formExemptKeys,
        created_at: new Date().toISOString(),
      })
      addToast('Aturan berhasil ditambahkan.', 'success')
      resetForm()
    } catch (err) {
      addToast('Gagal menyimpan aturan: ' + err.message, 'error')
    }
  }

  /* ---- Delete rule ---- */
  async function handleDelete(id) {
    try {
      await db.completion_exception_rules.delete(id)
      addToast('Aturan dihapus.', 'success')
    } catch (err) {
      addToast('Gagal menghapus: ' + err.message, 'error')
    }
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#1f2328' }}>Aturan Pengecualian Kelengkapan</h2>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#5f6368' }}>
            Tentukan kondisi di mana kolom wajib boleh dikosongkan. Contoh: jika Status = "Tidak Aktif", maka Qty tidak wajib diisi.
          </p>
        </div>
        <button
          className="btn-primary"
          onClick={() => setShowForm(true)}
          style={{ padding: '8px 16px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}
        >
          + Tambah Aturan
        </button>
      </div>

      {/* Form tambah aturan */}
      {showForm && (
        <div style={{ border: '1px solid #d0d7de', borderRadius: '8px', marginBottom: '20px', overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', background: '#f6f8fa', borderBottom: '1px solid #e1e4e8', fontWeight: 600, fontSize: '14px', color: '#1f2328' }}>
            Tambah Aturan Baru
          </div>
          <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

            {/* Department */}
            <div>
              <label style={{ fontSize: '13px', fontWeight: 600, color: '#1f2328', display: 'block', marginBottom: '6px' }}>
                Department <span style={{ color: '#cf222e' }}>*</span>
              </label>
              <select
                value={formDeptId}
                onChange={e => { setFormDeptId(e.target.value); setFormCondKey(''); setFormExemptKeys([]) }}
                style={{ padding: '8px 10px', border: '1px solid #d0d7de', borderRadius: '6px', fontSize: '13px', width: '100%', maxWidth: '320px' }}
              >
                <option value="">Pilih department...</option>
                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>

            {formDeptId && (
              <>
                {/* Kondisi */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', maxWidth: '640px' }}>
                  <div>
                    <label style={{ fontSize: '13px', fontWeight: 600, color: '#1f2328', display: 'block', marginBottom: '6px' }}>
                      Kolom Kondisi <span style={{ color: '#cf222e' }}>*</span>
                    </label>
                    <select
                      value={formCondKey}
                      onChange={e => setFormCondKey(e.target.value)}
                      style={{ padding: '8px 10px', border: '1px solid #d0d7de', borderRadius: '6px', fontSize: '13px', width: '100%' }}
                    >
                      <option value="">Pilih kolom...</option>
                      {formDeptColumns.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '13px', fontWeight: 600, color: '#1f2328', display: 'block', marginBottom: '6px' }}>
                      Nilai Kondisi <span style={{ color: '#cf222e' }}>*</span>
                    </label>
                    <input
                      type="text"
                      value={formCondVal}
                      onChange={e => setFormCondVal(e.target.value)}
                      placeholder="contoh: Tidak Aktif"
                      style={{ padding: '8px 10px', border: '1px solid #d0d7de', borderRadius: '6px', fontSize: '13px', width: '100%' }}
                    />
                  </div>
                </div>

                {/* Exempt columns */}
                <div>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: '#1f2328', display: 'block', marginBottom: '6px' }}>
                    Kolom yang Dibebaskan (tidak wajib jika kondisi terpenuhi) <span style={{ color: '#cf222e' }}>*</span>
                  </label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {formDeptColumns.filter(c => c.is_required).map(c => (
                      <label key={c.key} style={{
                        display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 10px',
                        border: `1px solid ${formExemptKeys.includes(c.key) ? '#0969da' : '#d0d7de'}`,
                        borderRadius: '20px', cursor: 'pointer',
                        background: formExemptKeys.includes(c.key) ? '#ddf4ff' : '#fff',
                        fontSize: '12px',
                      }}>
                        <input type="checkbox" checked={formExemptKeys.includes(c.key)} onChange={() => toggleExempt(c.key)} style={{ margin: 0 }} />
                        {c.label}
                      </label>
                    ))}
                  </div>
                  {formDeptColumns.filter(c => c.is_required).length === 0 && (
                    <p style={{ fontSize: '12px', color: '#80868b', margin: '4px 0 0' }}>Tidak ada kolom wajib di department ini.</p>
                  )}
                </div>
              </>
            )}

            {/* Pratinjau aturan */}
            {formDeptId && formCondKey && formCondVal && formExemptKeys.length > 0 && (
              <div style={{ padding: '10px 14px', background: '#f6f8fa', border: '1px solid #e1e4e8', borderRadius: '6px', fontSize: '13px', color: '#5f6368' }}>
                馃搶 <strong>Pratinjau:</strong> Jika <strong>{colLabel(formDeptId, formCondKey)}</strong> = "<em>{formCondVal}</em>",
                maka kolom <strong>{formExemptKeys.map(k => colLabel(formDeptId, k)).join(', ')}</strong> tidak wajib diisi.
              </div>
            )}

            {/* Tombol */}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="btn-primary" onClick={handleSave} style={{ padding: '8px 18px' }}>Simpan Aturan</button>
              <button className="btn-secondary" onClick={resetForm} style={{ padding: '8px 18px' }}>Batal</button>
            </div>
          </div>
        </div>
      )}

      {/* Daftar rules */}
      {allRules.length === 0 ? <EmptyState /> : (
        <div style={{ border: '1px solid #d0d7de', borderRadius: '8px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: '#f6f8fa', borderBottom: '1px solid #e1e4e8' }}>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: '#5f6368' }}>Department</th>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: '#5f6368' }}>Kondisi</th>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: '#5f6368' }}>Kolom yang Dibebaskan</th>
                <th style={{ padding: '10px 16px', textAlign: 'center', fontWeight: 600, color: '#5f6368', width: '60px' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {allRules.map((rule, i) => (
                <tr key={rule.id} style={{ borderBottom: '1px solid #f1f3f4', background: i % 2 === 0 ? '#fff' : '#fafbfc' }}>
                  <td style={{ padding: '10px 16px', fontWeight: 600, color: '#1f2328' }}>{deptName(rule.department_id)}</td>
                  <td style={{ padding: '10px 16px', color: '#5f6368' }}>
                    <span style={{ color: '#1f2328', fontWeight: 500 }}>{colLabel(rule.department_id, rule.condition_column_key)}</span>
                    {' = '}
                    <span style={{ background: '#ddf4ff', color: '#0969da', padding: '1px 6px', borderRadius: '4px', fontSize: '12px' }}>"{rule.condition_value}"</span>
                  </td>
                  <td style={{ padding: '10px 16px' }}>
                    {(rule.exempt_column_keys || []).map(key => (
                      <span key={key} style={{ display: 'inline-block', background: '#e6f4ea', color: '#1a7f37', padding: '1px 8px', borderRadius: '20px', fontSize: '12px', marginRight: '4px' }}>
                        {colLabel(rule.department_id, key)}
                      </span>
                    ))}
                  </td>
                  <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                    <button
                      onClick={() => handleDelete(rule.id)}
                      style={{ padding: '4px 8px', background: 'none', border: '1px solid #cf222e', borderRadius: '4px', color: '#cf222e', cursor: 'pointer', fontSize: '12px' }}
                      title="Hapus aturan ini"
                    >
                      Hapus
                    </button>
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
