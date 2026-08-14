/**
 * HierarchyManager.jsx
 *
 * Panel kelola hierarki Line 鈫?Department 鈫?Location 鈥?SRS v2.0 搂4
 *
 * Semua perubahan langsung disimpan ke Dexie cache (lines_cache, departments_cache,
 * locations_cache) sehingga ThreeTierNav langsung mencerminkan struktur terbaru.
 * ID di-generate secara lokal (UUID-lite) untuk mode offline-first.
 */

import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../lib/db'
import { useToast } from '../../contexts/ToastContext'
import { logActivity } from '../../lib/activityLog'

/* ---- simple local ID generator ---- */
function localId() {
  return 'local_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}

/* ------------------------------------------------------------------ */
/*  Section wrapper                                                      */
/* ------------------------------------------------------------------ */
function Section({ title, children }) {
  return (
    <div style={{ marginBottom: '24px', border: '1px solid #dadce0', borderRadius: '10px', overflow: 'hidden' }}>
      <div style={{ padding: '12px 16px', background: '#f8f9fa', borderBottom: '1px solid #dadce0' }}>
        <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: '#1f2328' }}>{title}</h4>
      </div>
      <div style={{ padding: '16px' }}>{children}</div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  InlineAddForm                                                        */
/* ------------------------------------------------------------------ */
function InlineAddForm({ placeholder, onAdd, onCancel }) {
  const [name, setName] = useState('')
  return (
    <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
      <input
        value={name} onChange={e => setName(e.target.value)}
        placeholder={placeholder}
        autoFocus
        onKeyDown={e => { if (e.key === 'Enter') { onAdd(name); } if (e.key === 'Escape') onCancel() }}
        style={{ flex: 1, padding: '6px 10px', fontSize: '13px', border: '1px solid #1a73e8', borderRadius: '6px', outline: 'none' }}
      />
      <button className="btn-primary" style={{ padding: '6px 14px', fontSize: '12px' }} onClick={() => onAdd(name)}>Simpan</button>
      <button className="btn-secondary" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={onCancel}>Batal</button>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Lines Manager                                                        */
/* ------------------------------------------------------------------ */
function LinesManager({ userId }) {
  const lines = useLiveQuery(() => db.lines_cache.toArray().then(r => r.sort((a,b) => (a.order??0)-(b.order??0))), [], [])
  const [adding, setAdding] = useState(false)
  const [editId, setEditId] = useState(null)
  const [editName, setEditName] = useState('')
  const { addToast } = useToast()

  async function handleAdd(name) {
    if (!name.trim()) { addToast('Nama Line tidak boleh kosong.', 'error'); return }
    const id = localId()
    const maxOrder = Math.max(0, ...(lines || []).map(l => l.order || 0))
    await db.lines_cache.add({ id, name: name.trim(), order: maxOrder + 1 })
    addToast(`Line "${name}" ditambahkan.`, 'success')
    logActivity('tambah_line', userId, { name }, 'line', id)
    setAdding(false)
  }

  async function handleDelete(line) {
    if (!confirm(`Hapus Line "${line.name}"? Semua data di Line ini juga akan terpengaruh.`)) return
    await db.lines_cache.delete(line.id)
    addToast(`Line "${line.name}" dihapus.`, 'success')
    logActivity('hapus_line', userId, { name: line.name }, 'line', line.id)
  }

  async function handleSaveEdit(line) {
    if (!editName.trim()) return
    await db.lines_cache.update(line.id, { name: editName.trim() })
    addToast('Nama Line diperbarui.', 'success')
    setEditId(null)
  }

  return (
    <Section title="Line (Lini Produksi)">
      <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {(lines || []).map(line => (
          <li key={line.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', background: '#f8f9fa', borderRadius: '6px' }}>
            {editId === line.id ? (
              <>
                <input value={editName} onChange={e => setEditName(e.target.value)}
                  autoFocus
                  onKeyDown={e => { if (e.key === 'Enter') handleSaveEdit(line); if (e.key === 'Escape') setEditId(null) }}
                  style={{ flex: 1, padding: '4px 8px', fontSize: '13px', border: '1px solid #1a73e8', borderRadius: '5px', outline: 'none' }} />
                <button className="btn-primary" style={{ padding: '4px 12px', fontSize: '12px' }} onClick={() => handleSaveEdit(line)}>Simpan</button>
                <button className="btn-secondary" style={{ padding: '4px 10px', fontSize: '12px' }} onClick={() => setEditId(null)}>Batal</button>
              </>
            ) : (
              <>
                <span style={{ flex: 1, fontSize: '13px', fontWeight: 500, color: '#1f2328' }}>{line.name}</span>
                <button className="btn-secondary" style={{ padding: '3px 10px', fontSize: '11px' }}
                  onClick={() => { setEditId(line.id); setEditName(line.name) }}>Edit</button>
                <button style={{ padding: '3px 10px', fontSize: '11px', background: 'none', border: '1px solid #d93025', color: '#d93025', borderRadius: '5px', cursor: 'pointer' }}
                  onClick={() => handleDelete(line)}>Hapus</button>
              </>
            )}
          </li>
        ))}
      </ul>
      {adding ? (
        <InlineAddForm placeholder="Nama Line baru (mis. Line 1)" onAdd={handleAdd} onCancel={() => setAdding(false)} />
      ) : (
        <button className="btn-secondary" style={{ marginTop: '10px', padding: '5px 14px', fontSize: '12px' }} onClick={() => setAdding(true)}>+ Tambah Line</button>
      )}
    </Section>
  )
}

/* ------------------------------------------------------------------ */
/*  Departments Manager                                                  */
/* ------------------------------------------------------------------ */
function DepartmentsManager({ userId }) {
  const depts = useLiveQuery(() => db.departments_cache.toArray().then(r => r.sort((a,b) => (a.order??0)-(b.order??0))), [], [])
  const [adding, setAdding] = useState(false)
  const [editId, setEditId] = useState(null)
  const [editName, setEditName] = useState('')
  const { addToast } = useToast()

  async function handleAdd(name) {
    if (!name.trim()) { addToast('Nama Department tidak boleh kosong.', 'error'); return }
    const id = localId()
    const maxOrder = Math.max(0, ...(depts || []).map(d => d.order || 0))
    await db.departments_cache.add({ id, name: name.trim(), order: maxOrder + 1 })
    addToast(`Department "${name}" ditambahkan.`, 'success')
    logActivity('tambah_department', userId, { name }, 'department', id)
    setAdding(false)
  }

  async function handleDelete(dept) {
    if (!confirm(`Hapus Department "${dept.name}"? Skema kolom dan data terkait akan terpengaruh.`)) return
    await db.departments_cache.delete(dept.id)
    addToast(`Department "${dept.name}" dihapus.`, 'success')
    logActivity('hapus_department', userId, { name: dept.name }, 'department', dept.id)
  }

  async function handleSaveEdit(dept) {
    if (!editName.trim()) return
    await db.departments_cache.update(dept.id, { name: editName.trim() })
    addToast('Nama Department diperbarui.', 'success')
    setEditId(null)
  }

  return (
    <Section title="Department (Bidang Teknis)">
      <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {(depts || []).map(dept => (
          <li key={dept.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', background: '#f8f9fa', borderRadius: '6px' }}>
            {editId === dept.id ? (
              <>
                <input value={editName} onChange={e => setEditName(e.target.value)}
                  autoFocus
                  onKeyDown={e => { if (e.key === 'Enter') handleSaveEdit(dept); if (e.key === 'Escape') setEditId(null) }}
                  style={{ flex: 1, padding: '4px 8px', fontSize: '13px', border: '1px solid #1a73e8', borderRadius: '5px', outline: 'none' }} />
                <button className="btn-primary" style={{ padding: '4px 12px', fontSize: '12px' }} onClick={() => handleSaveEdit(dept)}>Simpan</button>
                <button className="btn-secondary" style={{ padding: '4px 10px', fontSize: '12px' }} onClick={() => setEditId(null)}>Batal</button>
              </>
            ) : (
              <>
                <span style={{ flex: 1, fontSize: '13px', fontWeight: 500, color: '#1f2328' }}>{dept.name}</span>
                <button className="btn-secondary" style={{ padding: '3px 10px', fontSize: '11px' }}
                  onClick={() => { setEditId(dept.id); setEditName(dept.name) }}>Edit</button>
                <button style={{ padding: '3px 10px', fontSize: '11px', background: 'none', border: '1px solid #d93025', color: '#d93025', borderRadius: '5px', cursor: 'pointer' }}
                  onClick={() => handleDelete(dept)}>Hapus</button>
              </>
            )}
          </li>
        ))}
      </ul>
      {adding ? (
        <InlineAddForm placeholder="Nama Department baru (mis. Mekanik)" onAdd={handleAdd} onCancel={() => setAdding(false)} />
      ) : (
        <button className="btn-secondary" style={{ marginTop: '10px', padding: '5px 14px', fontSize: '12px' }} onClick={() => setAdding(true)}>+ Tambah Department</button>
      )}
    </Section>
  )
}

/* ------------------------------------------------------------------ */
/*  Locations Manager                                                    */
/* ------------------------------------------------------------------ */
function LocationsManager({ userId }) {
  const lines = useLiveQuery(() => db.lines_cache.toArray().then(r => r.sort((a,b) => (a.order??0)-(b.order??0))), [], [])
  const depts = useLiveQuery(() => db.departments_cache.toArray().then(r => r.sort((a,b) => (a.order??0)-(b.order??0))), [], [])
  const locations = useLiveQuery(() => db.locations_cache.toArray(), [], [])
  const [filterLine, setFilterLine] = useState('')
  const [filterDept, setFilterDept] = useState('')
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [newLine, setNewLine] = useState('')
  const [newDept, setNewDept] = useState('')
  const [editId, setEditId] = useState(null)
  const [editName, setEditName] = useState('')
  const { addToast } = useToast()

  const filteredLocs = (locations || []).filter(loc =>
    (!filterLine || loc.line_id === filterLine) &&
    (!filterDept || loc.department_id === filterDept)
  )

  async function handleAdd() {
    if (!newName.trim() || !newLine || !newDept) {
      addToast('Isi nama, line, dan department terlebih dahulu.', 'error'); return
    }
    const id = localId()
    const maxOrder = Math.max(0, ...(locations || []).filter(l => l.line_id === newLine && l.department_id === newDept).map(l => l.order || 0))
    await db.locations_cache.add({ id, name: newName.trim(), line_id: newLine, department_id: newDept, order: maxOrder + 1 })
    addToast(`Lokasi "${newName}" ditambahkan.`, 'success')
    logActivity('tambah_lokasi', userId, { name: newName }, 'location', id)
    setAdding(false); setNewName(''); setNewLine(''); setNewDept('')
  }

  async function handleDelete(loc) {
    if (!confirm(`Hapus Lokasi "${loc.name}"?`)) return
    await db.locations_cache.delete(loc.id)
    addToast(`Lokasi "${loc.name}" dihapus.`, 'success')
  }

  async function handleSaveEdit(loc) {
    if (!editName.trim()) return
    await db.locations_cache.update(loc.id, { name: editName.trim() })
    addToast('Nama Lokasi diperbarui.', 'success')
    setEditId(null)
  }

  const lineLabel = id => lines?.find(l => l.id === id)?.name || id
  const deptLabel = id => depts?.find(d => d.id === id)?.name || id

  return (
    <Section title="Location (Titik Survey)">
      {/* Filter */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '12px', flexWrap: 'wrap' }}>
        <select value={filterLine} onChange={e => setFilterLine(e.target.value)}
          style={{ padding: '5px 10px', fontSize: '12px', border: '1px solid #dadce0', borderRadius: '6px' }}>
          <option value="">Semua Line</option>
          {(lines || []).map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
        <select value={filterDept} onChange={e => setFilterDept(e.target.value)}
          style={{ padding: '5px 10px', fontSize: '12px', border: '1px solid #dadce0', borderRadius: '6px' }}>
          <option value="">Semua Dept</option>
          {(depts || []).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </div>

      {filteredLocs.length === 0 ? (
        <p style={{ fontSize: '13px', color: '#80868b', textAlign: 'center', padding: '20px 0' }}>Belum ada lokasi.</p>
      ) : (
        <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '5px', maxHeight: '280px', overflowY: 'auto' }}>
          {filteredLocs.map(loc => (
            <li key={loc.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 10px', background: '#f8f9fa', borderRadius: '6px' }}>
              {editId === loc.id ? (
                <>
                  <input value={editName} onChange={e => setEditName(e.target.value)} autoFocus
                    onKeyDown={e => { if (e.key === 'Enter') handleSaveEdit(loc); if (e.key === 'Escape') setEditId(null) }}
                    style={{ flex: 1, padding: '4px 8px', fontSize: '12px', border: '1px solid #1a73e8', borderRadius: '4px', outline: 'none' }} />
                  <button className="btn-primary" style={{ padding: '3px 10px', fontSize: '11px' }} onClick={() => handleSaveEdit(loc)}>Simpan</button>
                  <button className="btn-secondary" style={{ padding: '3px 8px', fontSize: '11px' }} onClick={() => setEditId(null)}>Batal</button>
                </>
              ) : (
                <>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: '13px', fontWeight: 500, color: '#1f2328' }}>{loc.name}</span>
                    <span style={{ marginLeft: '8px', fontSize: '11px', color: '#80868b' }}>{lineLabel(loc.line_id)} / {deptLabel(loc.department_id)}</span>
                  </div>
                  <button className="btn-secondary" style={{ padding: '2px 8px', fontSize: '11px' }}
                    onClick={() => { setEditId(loc.id); setEditName(loc.name) }}>Edit</button>
                  <button style={{ padding: '2px 8px', fontSize: '11px', background: 'none', border: '1px solid #d93025', color: '#d93025', borderRadius: '4px', cursor: 'pointer' }}
                    onClick={() => handleDelete(loc)}>Hapus</button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Add Location Form */}
      {adding ? (
        <div style={{ marginTop: '12px', padding: '12px', background: '#f0f7ff', borderRadius: '8px', border: '1px solid #c2d7f7' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '10px' }}>
            <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Nama Lokasi"
              style={{ padding: '6px 8px', fontSize: '12px', border: '1px solid #dadce0', borderRadius: '5px' }} />
            <select value={newLine} onChange={e => setNewLine(e.target.value)}
              style={{ padding: '6px 8px', fontSize: '12px', border: '1px solid #dadce0', borderRadius: '5px' }}>
              <option value="">Pilih Line</option>
              {(lines || []).map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
            <select value={newDept} onChange={e => setNewDept(e.target.value)}
              style={{ padding: '6px 8px', fontSize: '12px', border: '1px solid #dadce0', borderRadius: '5px' }}>
              <option value="">Pilih Department</option>
              {(depts || []).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn-primary" style={{ padding: '5px 14px', fontSize: '12px' }} onClick={handleAdd}>Simpan</button>
            <button className="btn-secondary" style={{ padding: '5px 12px', fontSize: '12px' }} onClick={() => setAdding(false)}>Batal</button>
          </div>
        </div>
      ) : (
        <button className="btn-secondary" style={{ marginTop: '10px', padding: '5px 14px', fontSize: '12px' }} onClick={() => setAdding(true)}>+ Tambah Lokasi</button>
      )}
    </Section>
  )
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                       */
/* ------------------------------------------------------------------ */
export default function HierarchyManager({ userId = '' }) {
  return (
    <div>
      <LinesManager userId={userId} />
      <DepartmentsManager userId={userId} />
      <LocationsManager userId={userId} />
    </div>
  )
}
