import { useDesk } from '../lib/context.js'
import { BinIcon, FolderIcon, NoteIcon } from './icons.jsx'

export default function ItemGraphic({ item, size = 48, open = false }) {
  const { trashCount } = useDesk()
  if (item.type === 'folder') return <FolderIcon size={size} open={open} />
  if (item.type === 'note') return <NoteIcon size={size} />
  if (item.type === 'bin') return <BinIcon size={size} full={trashCount > 0} />
  const small = size <= 20
  return (
    <span className={`thumb ${small ? 'small' : ''}`} style={{ width: size, height: Math.round(size * (small ? 1 : 0.74)) }}>
      <img src={item.thumb || item.src} alt="" draggable={false} loading="lazy" />
    </span>
  )
}
