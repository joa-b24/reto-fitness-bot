import { useRef, useState } from 'react'
import { uploadToCloudinary, cloudinaryReady } from '../../lib/cloudinary'
import { Icon } from './Icon'
import styles from './PhotoUpload.module.css'

/**
 * Drag-and-drop / click photo uploader.
 * Props:
 *   onUploaded(url: string) — called with the Cloudinary URL when done
 *   folder                 — Cloudinary folder (default 'fitquest')
 *   label                  — button label
 *   compact                — smaller inline variant
 */
export function PhotoUpload({ onUploaded, folder = 'fitquest', label = 'Subir foto', compact = false }) {
  const inputRef  = useRef(null)
  const [state, setState] = useState('idle') // idle | uploading | error
  const [drag,  setDrag]  = useState(false)
  const [errMsg, setErrMsg] = useState('')

  async function handleFile(file) {
    if (!file || !file.type.startsWith('image/')) return
    setState('uploading')
    setErrMsg('')
    try {
      const url = await uploadToCloudinary(file, folder)
      setState('idle')
      onUploaded?.(url)
    } catch (e) {
      setState('error')
      setErrMsg(e.message)
    }
  }

  function onInputChange(e) {
    handleFile(e.target.files?.[0])
    e.target.value = ''
  }

  function onDrop(e) {
    e.preventDefault()
    setDrag(false)
    handleFile(e.dataTransfer.files?.[0])
  }

  if (!cloudinaryReady) {
    return (
      <div className={styles.notReady}>
        <Icon name="alert-triangle" size={14} color="var(--warn)" />
        Cloudinary no configurado — edita <code>frontend/.env.local</code>
      </div>
    )
  }

  if (compact) {
    return (
      <button
        type="button"
        className={styles.compactBtn}
        disabled={state === 'uploading'}
        onClick={() => inputRef.current?.click()}
      >
        <Icon name="camera" size={14} color="var(--accent)" />
        {state === 'uploading' ? 'Subiendo…' : label}
        <input ref={inputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={onInputChange} />
      </button>
    )
  }

  return (
    <div
      className={`${styles.dropzone} ${drag ? styles.dragOver : ''} ${state === 'error' ? styles.hasError : ''}`}
      onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
      onDragLeave={() => setDrag(false)}
      onDrop={onDrop}
      onClick={() => inputRef.current?.click()}
    >
      <input ref={inputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={onInputChange} />
      {state === 'uploading' ? (
        <>
          <Icon name="activity" size={24} color="var(--accent)" />
          <p className={styles.dropLabel}>Subiendo…</p>
        </>
      ) : (
        <>
          <Icon name="camera" size={24} color={state === 'error' ? 'var(--danger)' : 'var(--text-3)'} />
          <p className={styles.dropLabel}>{state === 'error' ? errMsg : label}</p>
          <p className={styles.dropHint}>Arrastra o haz clic para seleccionar</p>
        </>
      )}
    </div>
  )
}
