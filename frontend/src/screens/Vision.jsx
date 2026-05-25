import { useState } from 'react'
import useSWR from 'swr'
import { fetcher } from '../lib/api'
import { Icon } from '../components/ui/Icon'
import { Chip } from '../components/ui/Chip'
import { PhotoUpload } from '../components/ui/PhotoUpload'
import styles from './Vision.module.css'

const FILTERS = [
  { id: 'todas',  label: 'Todas'    },
  { id: 'imagen', label: 'Imágenes' },
  { id: 'cita',   label: 'Citas'    },
  { id: 'meta',   label: 'Metas'    },
]

// Gradient presets for tiles without URL
const GRADIENTS = [
  'linear-gradient(135deg, #d4ff3a22, #d4ff3a08)',
  'linear-gradient(135deg, #8b9eff22, #8b9eff08)',
  'linear-gradient(135deg, #c084fc22, #c084fc08)',
  'linear-gradient(135deg, #ffb84d22, #ffb84d08)',
  'linear-gradient(135deg, #5dd8a822, #5dd8a808)',
]

function TileIcon({ tipo }) {
  const map = { imagen: 'image', cita: 'quote', meta: 'target' }
  return <Icon name={map[tipo] || 'star'} size={16} color="var(--text-3)" />
}

function VisionTile({ tile, idx }) {
  const gradient = tile.color
    ? `linear-gradient(135deg, ${tile.color}22, ${tile.color}08)`
    : GRADIENTS[idx % GRADIENTS.length]

  if (tile.tipo === 'imagen') {
    return (
      <div
        className={styles.tile}
        style={{ background: tile.url ? undefined : gradient }}
      >
        {tile.url
          ? <img src={tile.url} alt={tile.titulo || ''} className={styles.tileImg} />
          : (
            <div className={styles.tilePlaceholder}>
              <Icon name="image" size={28} color="var(--text-3)" />
            </div>
          )
        }
        {tile.titulo && <p className={styles.tileCaption}>{tile.titulo}</p>}
      </div>
    )
  }

  if (tile.tipo === 'cita') {
    return (
      <div
        className={`${styles.tile} ${styles.tileCita}`}
        style={{ borderColor: tile.color || 'var(--border)' }}
      >
        <Icon name="quote" size={20} color={tile.color || 'var(--text-3)'} strokeWidth={1.5} />
        <p className={styles.citeText}>"{tile.texto}"</p>
        {tile.autor && <p className={styles.citeAuthor}>— {tile.autor}</p>}
      </div>
    )
  }

  if (tile.tipo === 'meta') {
    return (
      <div
        className={`${styles.tile} ${styles.tileMeta}`}
        style={{ background: gradient, borderColor: tile.color || 'var(--border)' }}
      >
        <div className={styles.metaTag} style={{ color: tile.color || 'var(--accent)', borderColor: tile.color || 'var(--accent)' }}>
          META
        </div>
        <p className={styles.metaTitle}>{tile.titulo}</p>
        {tile.texto && <p className={styles.metaDesc}>{tile.texto}</p>}
      </div>
    )
  }

  return null
}

const EMPTY_FORM = { tipo: 'imagen', titulo: '', texto: '', autor: '', color: '', url: '' }

export function Vision({ user }) {
  const [filter, setFilter] = useState('todas')
  const [adding, setAdding] = useState(false)
  const [form, setForm]     = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const { data, isLoading, mutate } = useSWR(
    `/api/vision?user=${encodeURIComponent(user)}`,
    fetcher,
    { revalidateOnFocus: false }
  )

  function setField(k) { return e => setForm(f => ({ ...f, [k]: e.target.value })) }

  async function saveTile(urlOverride) {
    const payload = { ...form, user }
    if (urlOverride) payload.url = urlOverride
    if (!payload.titulo && !payload.texto && !payload.url) return
    setSaving(true)
    try {
      await fetch('/api/vision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      setForm(EMPTY_FORM)
      setAdding(false)
      await mutate()
    } finally {
      setSaving(false)
    }
  }

  const tiles = (Array.isArray(data) ? data : [])
    .filter((t) => filter === 'todas' || t.tipo === filter)

  return (
    <div className={styles.page}>
      {/* Mantra card */}
      <div className={styles.mantra}>
        <div className={styles.mantraLabel}>Mantra de la semana</div>
        <p className={styles.mantraText}>
          "La disciplina es elegir entre lo que quieres ahora y lo que más quieres."
        </p>
      </div>

      {/* Filter chips + add image button */}
      <div className={styles.filtersRow}>
        <div className={styles.filters}>
          {FILTERS.map((f) => (
            <Chip
              key={f.id}
              active={filter === f.id}
              color="var(--accent)"
              onClick={() => setFilter(f.id)}
            >
              {f.label}
            </Chip>
          ))}
        </div>
        <button
          type="button"
          className={styles.addImgBtn}
          onClick={() => setAdding(v => !v)}
        >
          <Icon name={adding ? 'x' : 'plus'} size={14} color="var(--accent)" />
          {adding ? 'Cancelar' : 'Añadir tile'}
        </button>
      </div>

      {adding && (
        <div className={styles.addImgPanel}>
          {/* Tipo */}
          <div className={styles.formRow}>
            {['imagen', 'cita', 'meta'].map(t => (
              <button
                key={t}
                type="button"
                className={`${styles.tipoBtn} ${form.tipo === t ? styles.tipoBtnActive : ''}`}
                onClick={() => setForm(f => ({ ...f, tipo: t }))}
              >
                <Icon name={t === 'imagen' ? 'image' : t === 'cita' ? 'quote' : 'target'} size={12} color={form.tipo === t ? 'var(--accent)' : 'var(--text-3)'} />
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>

          {/* Título */}
          <input className={styles.imgTituloInput} placeholder="Título" value={form.titulo} onChange={setField('titulo')} maxLength={80} />

          {/* Texto (para cita / meta) */}
          {(form.tipo === 'cita' || form.tipo === 'meta') && (
            <textarea className={styles.imgTituloInput} placeholder={form.tipo === 'cita' ? 'Texto de la cita' : 'Descripción de la meta'} value={form.texto} onChange={setField('texto')} rows={3} style={{ resize: 'vertical' }} />
          )}

          {/* Autor (solo cita) */}
          {form.tipo === 'cita' && (
            <input className={styles.imgTituloInput} placeholder="Autor (opcional)" value={form.autor} onChange={setField('autor')} maxLength={60} />
          )}

          {/* Color */}
          <div className={styles.colorRow}>
            <input type="color" className={styles.colorPicker} value={form.color || '#d4ff3a'} onChange={setField('color')} />
            <input className={styles.imgTituloInput} style={{ flex: 1 }} placeholder="Color hex (ej. #d4ff3a) — opcional" value={form.color} onChange={setField('color')} maxLength={7} />
          </div>

          {/* URL o upload (solo imagen) */}
          {form.tipo === 'imagen' && (
            <>
              <input className={styles.imgTituloInput} placeholder="URL de imagen (o sube abajo)" value={form.url} onChange={setField('url')} />
              <PhotoUpload
                onUploaded={url => saveTile(url)}
                folder="fitquest/vision"
                label="Subir imagen"
                compact={false}
              />
            </>
          )}

          {/* Guardar (para cita / meta, no imagen) */}
          {form.tipo !== 'imagen' && (
            <button
              type="button"
              className={styles.saveBtn}
              disabled={saving}
              onClick={() => saveTile()}
            >
              {saving ? 'Guardando…' : 'Guardar tile'}
            </button>
          )}

          {/* URL directa de imagen + botón guardar */}
          {form.tipo === 'imagen' && form.url && (
            <button type="button" className={styles.saveBtn} disabled={saving} onClick={() => saveTile()}>
              {saving ? 'Guardando…' : 'Guardar con URL'}
            </button>
          )}
        </div>
      )}

      {/* Masonry grid */}
      {isLoading ? (
        <div className={styles.empty}>Cargando…</div>
      ) : tiles.length === 0 ? (
        <div className={styles.empty}>
          <Icon name="eye" size={32} color="var(--text-3)" />
          <p>Tu vision board está vacío.</p>
          <p className={styles.emptyHint}>
            Agrega tiles en la pestaña <strong>Visión</strong> de tu Google Sheet
            con columnas: <code>Usuario, Tipo, Título, Texto, Autor, Color, URL</code>
          </p>
        </div>
      ) : (
        <div className={styles.masonry}>
          {tiles.map((tile, i) => (
            <VisionTile key={i} tile={tile} idx={i} />
          ))}
        </div>
      )}
    </div>
  )
}
