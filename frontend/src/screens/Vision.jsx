import { useState } from 'react'
import useSWR from 'swr'
import { fetcher } from '../lib/api'
import { Icon } from '../components/ui/Icon'
import { Chip } from '../components/ui/Chip'
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

export function Vision({ user }) {
  const [filter, setFilter] = useState('todas')
  const { data, isLoading } = useSWR(
    `/api/vision?user=${encodeURIComponent(user)}`,
    fetcher,
    { revalidateOnFocus: false }
  )

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

      {/* Filter chips */}
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
