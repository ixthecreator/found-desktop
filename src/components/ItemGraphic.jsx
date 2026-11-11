import { useDesk } from '../lib/context.js'
import { BinIcon, FolderIcon, NoteIcon } from './icons.jsx'

// 文件的图形；文件夹、笔记、回收站用SVG图标，图片直接显示缩略图；
// open为true时文件夹画成打开的样子，拖着文件经过时用
export default function ItemGraphic({ item, size = 48, open = false }) {
  const { trashCount } = useDesk()
  if (item.type === 'folder') return <FolderIcon size={size} open={open} />
  if (item.type === 'note') return <NoteIcon size={size} />
  if (item.type === 'bin') return <BinIcon size={size} full={trashCount > 0} />
  // 详细列表里的小图标是正方形；别的地方按照片比例来
  const small = size <= 20
  return (
    <span className={`thumb ${small ? 'small' : ''}`} style={{ width: size, height: Math.round(size * (small ? 1 : 0.74)) }}>
      <img src={item.thumb || item.src} draggable={false} />
    </span>
  )
}
