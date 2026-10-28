// 文件树相关的纯函数。每个条目的 parent 是 'desktop'、'trash' 或某个文件夹的 id。

export const TYPE_LABEL = {
  image: 'JPEG Image',
  note: 'Text Document',
  folder: 'File Folder',
  bin: 'Recycle Bin',
}

const TYPE_RANK = { bin: 0, folder: 1, note: 2, image: 3 }
const TYPE_GROUP = { bin: 'System', folder: 'Folders', note: 'Notes', image: 'Pictures' }

const byName = (a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })

// 排序规则：按名称（数字按大小排，IMG_2 排在 IMG_10 前面）、按日期、或按类型。
export function compareBy(key) {
  if (key === 'date') return (a, b) => (a.date || '').localeCompare(b.date || '') || byName(a, b)
  if (key === 'type') return (a, b) => TYPE_RANK[a.type] - TYPE_RANK[b.type] || byName(a, b)
  return byName
}

function groupLabel(key, item) {
  if (key === 'date') return item.date ? item.date.slice(0, 4) : 'Undated'
  if (key === 'type') return TYPE_GROUP[item.type]
  return ''
}

// 把排好序的列表按年份或类型分组，用于“按年份分组”和时间线排列。
export function groupItems(list, key) {
  if (key === 'none') return [{ label: '', items: list }]
  const groups = new Map()
  for (const it of list) {
    const label = groupLabel(key, it)
    if (!groups.has(label)) groups.set(label, [])
    groups.get(label).push(it)
  }
  const order = key === 'type' ? Object.values(TYPE_GROUP) : [...groups.keys()].sort()
  return order.filter(label => groups.has(label)).map(label => ({ label, items: groups.get(label) }))
}

export const indexBy = list => Object.fromEntries(list.map(it => [it.id, it]))

// id 是不是 ancestorId 本身，或者在它里面（任意层级）。用来防止把文件夹拖进它自己。
export function isDescendant(byId, id, ancestorId) {
  const seen = new Set()
  let cur = byId[id]
  while (cur && !seen.has(cur.id)) {
    if (cur.id === ancestorId) return true
    seen.add(cur.id)
    cur = byId[cur.parent]
  }
  return false
}

// 是否在回收站里，包括被删除的文件夹里面的东西。
export function isTrashed(byId, id) {
  const seen = new Set()
  let cur = byId[id]
  while (cur && !seen.has(cur.id)) {
    if (cur.parent === 'trash') return true
    seen.add(cur.id)
    cur = byId[cur.parent]
  }
  return false
}

export function locationName(byId, parent) {
  if (parent === 'desktop') return 'Desktop'
  if (parent === 'trash') return 'Recycle Bin'
  return byId[parent]?.name ?? 'Desktop'
}

export function pathOf(byId, folderId) {
  if (folderId === 'desktop') return ['Desktop']
  if (folderId === 'trash') return ['Recycle Bin']
  const parts = []
  let cur = byId[folderId]
  while (cur && parts.length < 20) {
    parts.unshift(cur.name)
    if (cur.parent === 'desktop' || cur.parent === 'trash') {
      parts.unshift(locationName(byId, cur.parent))
      break
    }
    cur = byId[cur.parent]
  }
  return parts
}

// 文件夹窗口里“向上”按钮要去的地方。
export function parentOf(byId, folderId) {
  if (folderId === 'desktop') return null
  if (folderId === 'trash') return 'desktop'
  return byId[folderId]?.parent ?? 'desktop'
}

// 搜索匹配：文件名或笔记内容里包含关键词（不区分大小写）。
export function matches(item, query) {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return item.name.toLowerCase().includes(q) || (item.text || '').toLowerCase().includes(q)
}

export function viewerSiblings(items, item) {
  return items.filter(it => it.type === 'image' && it.parent === item.parent).sort(compareBy('name'))
}

export function uniqueName(items, parent, base) {
  const taken = new Set(items.filter(it => it.parent === parent).map(it => it.name.toLowerCase()))
  if (!taken.has(base.toLowerCase())) return base
  const dot = base.lastIndexOf('.')
  const stem = dot > 0 ? base.slice(0, dot) : base
  const ext = dot > 0 ? base.slice(dot) : ''
  for (let n = 2; ; n++) {
    const name = `${stem} (${n})${ext}`
    if (!taken.has(name.toLowerCase())) return name
  }
}

export function isoDate(ms = Date.now()) {
  const d = new Date(ms)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function formatDate(iso) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-').map(Number)
  return `${m}/${d}/${y}`
}
