import { useDesk } from '../lib/context.js'

// 记事本窗口；直接改笔记的text；每敲一个字都写回items，App那边统一自动保存
export default function Notepad({ win }) {
  const { byId, api } = useDesk()
  const item = byId[win.target]
  if (!item) return null
  const text = item.text || ''

  const menuBelow = (e, entries) => {
    const r = e.currentTarget.getBoundingClientRect()
    api.openMenu(r.left, r.bottom, entries)
  }
  // File菜单；新建、删除、关闭
  const fileMenu = [
    { label: 'New', onClick: () => api.createItem('note', 'desktop', null, true) },
    '-',
    {
      label: 'Delete',
      disabled: item.parent === 'trash',
      onClick: () => {
        api.trashItems([item.id])
        api.closeWindow(win.id)
      },
    },
    { label: 'Close', onClick: () => api.closeWindow(win.id) },
  ]

  return (
    <div className="notepad">
      <nav className="menubar">
        <button onClick={e => menuBelow(e, fileMenu)}>File</button>
      </nav>
      <textarea
        className="notepad-text"
        value={text}
        onChange={e => api.updateItem(item.id, { text: e.target.value })}
      />
      <footer className="statusbar">
        <span>{text.length} characters</span>
        <span className="status-hint">Changes are saved automatically</span>
      </footer>
    </div>
  )
}
