import { useLayoutEffect, useRef, useState } from 'react'

// 右键菜单。每一项是 { label, onClick, checked, bold, disabled, submenu }，'-' 表示分隔线。
export default function ContextMenu({ menu, onClose }) {
  if (!menu) return null
  return <MenuList entries={menu.entries} x={menu.x} y={menu.y} onClose={onClose} />
}

function MenuList({ entries, x, y, onClose }) {
  const ref = useRef(null)
  const [pos, setPos] = useState({ x, y })
  const [sub, setSub] = useState(null)

  useLayoutEffect(() => {
    const r = ref.current.getBoundingClientRect()
    setPos({
      x: x + r.width > window.innerWidth ? Math.max(0, window.innerWidth - r.width - 2) : x,
      y: y + r.height > window.innerHeight ? Math.max(0, window.innerHeight - r.height - 2) : y,
    })
  }, [x, y])

  return (
    <div className="ctx-menu" ref={ref} style={{ left: pos.x, top: pos.y }} role="menu">
      {entries.map((entry, i) => {
        if (entry === '-') return <div key={i} className="ctx-sep" />
        const open = sub?.index === i
        const className = ['ctx-item', entry.bold && 'bold', entry.disabled && 'disabled', open && 'open']
          .filter(Boolean)
          .join(' ')
        return (
          <div
            key={i}
            className={className}
            role="menuitem"
            aria-disabled={entry.disabled || undefined}
            onMouseEnter={e => {
              if (!entry.submenu) return setSub(null)
              const r = e.currentTarget.getBoundingClientRect()
              setSub({ index: i, x: r.right - 3, y: r.top - 3 })
            }}
            onClick={e => {
              if (entry.disabled || entry.submenu) return
              e.stopPropagation()
              onClose()
              entry.onClick?.()
            }}
          >
            <span className="ctx-check">{entry.checked ? '✓' : ''}</span>
            <span className="ctx-label">{entry.label}</span>
            {entry.submenu && <span className="ctx-arrow">▶</span>}
            {open && <MenuList entries={entry.submenu} x={sub.x} y={sub.y} onClose={onClose} />}
          </div>
        )
      })}
    </div>
  )
}
