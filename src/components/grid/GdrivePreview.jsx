/**
 * GdrivePreview.jsx
 *
 * Komponen preview link Google Drive untuk kolom bertipe `gdrive_link`.
 * - Desktop: hover popover menggunakan React Portal (z-index tinggi, escape overflow clipping)
 * - Mobile: tap membuka modal fullscreen menggunakan React Portal
 *
 * SRS v2.0 §4 — tipe kolom gdrive_link
 * DESIGN_v2.md §3 — photo-link-cell
 */

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

/* ------------------------------------------------------------------ */
/*  Helper: ekstrak Google Drive File ID dari berbagai format URL       */
/* ------------------------------------------------------------------ */
export function extractDriveFileId(url) {
  if (!url || typeof url !== 'string') return null
  let match = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/)
  if (match) return match[1]
  match = url.match(/[?&]id=([a-zA-Z0-9_-]+)/)
  if (match) return match[1]
  return null
}

/* ------------------------------------------------------------------ */
/*  Preview image content (shared by popover & modal)                   */
/* ------------------------------------------------------------------ */
function PreviewImage({ thumbnailUrl, onError, hasError }) {
  if (hasError) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
        padding: '16px', color: '#80868b', fontSize: '12px', textAlign: 'center',
      }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <path d="m21 15-5-5L5 21" />
        </svg>
        <span>Preview tidak tersedia — pastikan file di-share publik</span>
      </div>
    )
  }
  return (
    <img
      src={thumbnailUrl}
      alt="Preview"
      onError={onError}
      style={{ maxWidth: '100%', maxHeight: '400px', objectFit: 'contain', display: 'block' }}
    />
  )
}

/* ------------------------------------------------------------------ */
/*  GdrivePreview Component                                              */
/* ------------------------------------------------------------------ */
/**
 * @param {Object}   props
 * @param {string}   props.url        - URL Google Drive
 * @param {boolean}  [props.canEdit]  - boleh mulai edit
 * @param {Function} [props.onEdit]   - callback saat klik edit
 */
export default function GdrivePreview({ url, canEdit, onEdit }) {
  const [showPopover, setShowPopover] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [imgError, setImgError] = useState(false)
  const [popoverPos, setPopoverPos] = useState({ top: 0, left: 0 })
  const hoverTimer = useRef(null)
  const cellRef = useRef(null)

  const fileId = extractDriveFileId(url)
  const thumbnailUrl = fileId ? `https://drive.google.com/thumbnail?id=${fileId}&sz=w800` : null
  const hasHover = typeof window !== 'undefined' && window.matchMedia('(hover: hover)').matches

  useEffect(() => { setImgError(false) }, [url])
  useEffect(() => () => { if (hoverTimer.current) clearTimeout(hoverTimer.current) }, [])

  function handleMouseEnter() {
    if (!hasHover || !thumbnailUrl) return
    if (cellRef.current) {
      const rect = cellRef.current.getBoundingClientRect()
      // Smart positioning: prefer below, flip above if near bottom of viewport
      const top = rect.bottom + window.scrollY + 4
      const left = Math.max(8, rect.left + window.scrollX)
      setPopoverPos({ top, left })
    }
    hoverTimer.current = setTimeout(() => setShowPopover(true), 250)
  }

  function handleMouseLeave() {
    if (hoverTimer.current) clearTimeout(hoverTimer.current)
    setShowPopover(false)
  }

  function handleLinkClick(e) {
    if (!hasHover && thumbnailUrl) {
      e.preventDefault()
      e.stopPropagation()
      setShowModal(true)
    } else {
      e.stopPropagation()
    }
  }

  return (
    <div
      ref={cellRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{ height: '100%' }}
    >
      {/* Display cell */}
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          padding: '6px 8px', height: '100%', overflow: 'hidden',
          cursor: canEdit ? 'pointer' : 'default',
        }}
        onClick={canEdit ? onEdit : undefined}
      >
        {/* Drive icon */}
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#1a73e8"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
          <polyline points="22,6 12,13 2,6" />
        </svg>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={handleLinkClick}
          style={{
            color: '#1a73e8', fontSize: '12px', textDecoration: 'none',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}
          onMouseOver={(e) => { e.currentTarget.style.textDecoration = 'underline' }}
          onMouseOut={(e) => { e.currentTarget.style.textDecoration = 'none' }}
        >
          {fileId ? 'Lihat Foto' : url}
        </a>
      </div>

      {/* Desktop hover popover — Portal (z-index: 9500) */}
      {showPopover && thumbnailUrl && createPortal(
        <div
          onMouseEnter={() => { if (hoverTimer.current) clearTimeout(hoverTimer.current); setShowPopover(true) }}
          onMouseLeave={handleMouseLeave}
          style={{
            position: 'absolute',
            top: `${popoverPos.top}px`,
            left: `${popoverPos.left}px`,
            zIndex: 9500,       // Tinggi — di atas header & nav
            background: '#fff',
            borderRadius: '8px',
            boxShadow: 'rgba(0,0,0,0.2) 0 4px 20px',
            padding: '8px',
            maxWidth: '300px',
            minWidth: '160px',
            pointerEvents: 'auto',
          }}
        >
          <PreviewImage
            thumbnailUrl={thumbnailUrl}
            hasError={imgError}
            onError={() => setImgError(true)}
          />
        </div>,
        document.body
      )}

      {/* Mobile tap modal — Portal (z-index: 9600) */}
      {showModal && thumbnailUrl && createPortal(
        <div
          onClick={() => setShowModal(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
            zIndex: 9600, display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '16px',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#fff', borderRadius: '12px', padding: '16px',
              maxWidth: '90vw', width: '100%',
            }}
          >
            {/* Close */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8px' }}>
              <button
                onClick={() => setShowModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: '#5f6368' }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <PreviewImage thumbnailUrl={thumbnailUrl} hasError={imgError} onError={() => setImgError(true)} />
            <div style={{ display: 'flex', gap: '8px', marginTop: '12px', justifyContent: 'flex-end' }}>
              <a
                href={url} target="_blank" rel="noopener noreferrer"
                style={{
                  padding: '6px 14px', background: '#1a73e8', color: '#fff',
                  borderRadius: '6px', fontSize: '13px', textDecoration: 'none',
                }}
              >
                Buka di Drive
              </a>
              <button
                onClick={() => setShowModal(false)}
                style={{
                  padding: '6px 14px', background: '#f1f3f4', border: 'none',
                  borderRadius: '6px', fontSize: '13px', cursor: 'pointer',
                }}
              >
                Tutup
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
