import { useDesk } from '../lib/context.js'
import ItemGraphic from './ItemGraphic.jsx'

export function ghostPos(drag, id) {
  const r = drag.rects[id]
  if (!r) return null
  return { x: drag.cx - drag.grab.x + (r.left - drag.anchor.left), y: drag.cy - drag.grab.y + (r.top - drag.anchor.top) }
}

// 拖拽时跟着光标走的半透明图标（幽灵图标），以及“Move to …”提示。
export default function DragGhost({ hint }) {
  const { drag, byId } = useDesk()
  if (!drag) return null
  return (
    <div className="drag-layer">
      {drag.ids.slice(0, 12).map(id => {
        const item = byId[id]
        const p = ghostPos(drag, id)
        if (!item || !p) return null
        return (
          <div key={id} className="item item-desktop ghost" style={{ left: p.x, top: p.y }}>
            <span className="item-graphic">
              <ItemGraphic item={item} size={48} />
            </span>
            <span className="item-label">{item.name}</span>
          </div>
        )
      })}
      {drag.ids.length > 1 && (
        <span className="ghost-count" style={{ left: drag.cx + 12, top: drag.cy - 22 }}>
          {drag.ids.length}
        </span>
      )}
      {hint && (
        <span className={`drag-hint ${drag.valid ? '' : 'no'}`} style={{ left: drag.cx + 16, top: drag.cy + 18 }}>
          {hint}
        </span>
      )}
    </div>
  )
}
