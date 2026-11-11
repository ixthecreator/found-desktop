import { useEffect, useRef } from 'react'
import { useDesk } from '../lib/context.js'

// 改名的输入框；回车或者点别处就确认；
// done防止回车确认完，输入框消失时失焦又确认一次
export default function RenameField({ item }) {
  const { api } = useDesk()
  const ref = useRef(null)
  const done = useRef(false)

  // 一出来就聚焦，全选，直接打字就是新名字
  useEffect(() => {
    ref.current.focus()
    ref.current.select()
  }, [])

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
      // 别让点击、双击、按键冒泡上去；不然会触发拖拽、打开文件、桌面快捷键
      onPointerDown={e => e.stopPropagation()}
      onDoubleClick={e => e.stopPropagation()}
      onKeyDown={e => {
        e.stopPropagation()
        if (e.key === 'Enter') finish(true)
        if (e.key === 'Escape') finish(false) // 额外功能；Esc取消改名
      }}
      onBlur={() => finish(true)}
    />
  )
}
