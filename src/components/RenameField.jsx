import { useEffect, useRef } from 'react'
import { useDesk } from '../lib/context.js'

export default function RenameField({ item }) {
  const { api } = useDesk()
  const ref = useRef(null)
  const done = useRef(false)

  useEffect(() => {
    const el = ref.current
    el.focus()
    // 只选中文件名、不选扩展名，和系统的文件管理器一样。
    const dot = item.type === 'folder' ? -1 : item.name.lastIndexOf('.')
    el.setSelectionRange(0, dot > 0 ? dot : item.name.length)
  }, [item.name, item.type])

  const finish = commit => {
    if (done.current) return
    done.current = true
    if (commit) api.commitRename(item.id, ref.current.value)
    else api.cancelRename()
  }

  return (
    <input
      ref={ref}
      className="rename"
      defaultValue={item.name}
      spellCheck={false}
      onPointerDown={e => e.stopPropagation()}
      onDoubleClick={e => e.stopPropagation()}
      onKeyDown={e => {
        e.stopPropagation()
        if (e.key === 'Enter') finish(true)
        if (e.key === 'Escape') finish(false)
      }}
      onBlur={() => finish(true)}
    />
  )
}
