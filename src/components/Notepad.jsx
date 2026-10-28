import { useState } from 'react'
import { useDesk } from '../lib/context.js'

export default function Notepad({ win }) {
  const { byId, api } = useDesk()
  const [wrap, setWrap] = useState(true)
  const item = byId[win.target]
  if (!item) return null
  const text = item.text ?? ''

  const menuBelow = (e, entries) => {
    const r = e.currentTarget.getBoundingClientRect()
    api.openMenu(r.left, r.bottom, entries)
  }
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
  const formatMenu = [{ label: 'Word Wrap', checked: wrap, onClick: () => setWrap(w => !w) }]

  return (
    <div className="notepad">
      <nav className="menubar">
        <button onClick={e => menuBelow(e, fileMenu)}>File</button>
        <button onClick={e => menuBelow(e, formatMenu)}>Format</button>
      </nav>
      <textarea
        className={`notepad-text ${wrap ? '' : 'nowrap'}`}
        value={text}
        spellCheck={false}
        aria-label={item.name}
        onChange={e => api.updateItem(item.id, { text: e.target.value })}
      />
      <footer className="statusbar">
        <span>{text.length} characters</span>
        <span className="status-hint">Changes are saved automatically</span>
      </footer>
    </div>
  )
}
