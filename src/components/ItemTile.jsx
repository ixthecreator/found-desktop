import { useDesk } from '../lib/context.js'
import { TYPE_LABEL, formatDate, locationName } from '../lib/items.js'
import ItemGraphic from './ItemGraphic.jsx'
import RenameField from './RenameField.jsx'

// 单个文件、文件夹长什么样；variant是'desktop'就是桌面图标，'tile'是文件夹里的缩略图，'row'是详细列表的一行；
// data-drop标记它能不能接东西，文件夹、回收站能；拖的时候靠它找目标
export default function ItemTile({ item, scope, variant, style, showLocation = false }) {
  const { selection, renaming, drag, api, byId } = useDesk()
  const selected = selection.scope === scope && selection.ids.includes(item.id)
  const dropId = item.type === 'folder' ? item.id : item.type === 'bin' ? 'trash' : undefined
  const dropHover = Boolean(drag && dropId && drag.over === dropId && drag.valid)
  // 正在被拖的原图标变淡
  const moving = Boolean(drag && drag.scope === scope && drag.ids.includes(item.id))
  const className = ['item', `item-${variant}`, selected && 'selected', dropHover && 'drop-hover', moving && 'moving']
    .filter(Boolean)
    .join(' ')

  // 桌面和窗口里可能同时显示同一个文件；只在发起改名的那一处出输入框
  const host = variant === 'desktop' ? 'desktop' : 'list'
  const isRenaming = renaming !== null && renaming.id === item.id && renaming.host === host
  const label = isRenaming ? <RenameField item={item} /> : <span className="item-label">{item.name}</span>
  const props = {
    className,
    style,
    title: hint(item),
    'data-item': item.id,
    'data-scope': scope,
    'data-drop': dropId,
    onPointerDown: e => api.itemPointerDown(e, item, scope),
    onDoubleClick: () => api.open(item.id, variant === 'desktop' ? null : scope),
    onContextMenu: e => api.itemContextMenu(e, item, scope, variant),
    onDragStart: e => e.preventDefault(), // 关掉浏览器自带的拖拽；用自己写的那套
  }

  if (variant === 'row') {
    return (
      <div {...props}>
        <span className="cell cell-name col-name">
          <ItemGraphic item={item} size={16} open={dropHover} />
          {label}
        </span>
        {showLocation && <span className="cell col-where">{locationName(byId, item.parent)}</span>}
        <span className="cell col-type">{TYPE_LABEL[item.type]}</span>
        <span className="cell col-date">{formatDate(item.date)}</span>
      </div>
    )
  }

  return (
    <div {...props}>
      <span className="item-graphic">
        <ItemGraphic item={item} size={variant === 'tile' ? 76 : 48} open={dropHover} />
      </span>
      {label}
    </div>
  )
}

// 鼠标悬停时的提示
function hint(item) {
  if (item.type === 'folder') return `${item.name}\nDouble-click to open. Drop files on it to file them here.`
  if (item.type === 'bin') return 'Recycle Bin\nDrop files here to throw them away.'
  return `${item.name}\nDouble-click to open. Drag to move.`
}
