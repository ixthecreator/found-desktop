// 文件树相关的纯函数；不碰state，只管算
// 每个条目的parent是'desktop'、'trash'，或者某个文件夹的id

// 详细列表“类型”那一栏显示什么
export const TYPE_LABEL = {
  image: 'JPEG Image',
  note: 'Text Document',
  folder: 'File Folder',
  bin: 'Recycle Bin',
}

// 按类型排序时的先后；回收站最前，图片最后
const TYPE_RANK = { bin: 0, folder: 1, note: 2, image: 3 }
// 按类型分组时每组的标题
const TYPE_GROUP = { bin: 'System', folder: 'Folders', note: 'Notes', image: 'Pictures' }

// 按名字比；numeric让IMG_2排在IMG_10前面，sensitivity忽略大小写
const byName = (a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })

// 排序规则；按名字、按日期、按类型；日期、类型一样时再按名字
export function compareBy(key) {
  if (key === 'date') return (a, b) => (a.date || '').localeCompare(b.date || '') || byName(a, b)
  if (key === 'type') return (a, b) => TYPE_RANK[a.type] - TYPE_RANK[b.type] || byName(a, b)
  return byName
}

// 某个文件归到哪一组；按日期就看年份，没日期的单独一组
function groupLabel(key, item) {
  if (key === 'date') return item.date ? item.date.slice(0, 4) : 'Undated'
  if (key === 'type') return TYPE_GROUP[item.type]
  return ''
}

// 把排好序的列表按年份或类型分组；文件夹里的分组显示、桌面时间线都用它
// 组内顺序不变；组和组之间，类型按固定顺序，年份从早到晚
export function groupItems(list, key) {
  if (key === 'none') return [{ label: '', items: list }]
  const groups = {} // { 组名: [文件] }
  const labels = [] // 出现过的组名
  for (const it of list) {
    const label = groupLabel(key, it)
    if (!groups[label]) {
      groups[label] = []
      labels.push(label)
    }
    groups[label].push(it)
  }
  const order = key === 'type' ? Object.values(TYPE_GROUP) : labels.sort()
  return order.filter(label => groups[label]).map(label => ({ label, items: groups[label] }))
}

// 列表转成{ id: 条目 }；按id查方便
export function indexBy(list) {
  const map = {}
  for (const it of list) map[it.id] = it
  return map
}

// id是不是ancestorId本身，或者在它里面，几层都算；防止把文件夹拖进它自己
export function isDescendant(byId, id, ancestorId) {
  let cur = byId[id]
  while (cur) {
    if (cur.id === ancestorId) return true
    cur = byId[cur.parent] // 一层层往上找
  }
  return false
}

// 在不在回收站里；扔掉的文件夹里面的东西也算
export function isTrashed(byId, id) {
  let cur = byId[id]
  while (cur) {
    if (cur.parent === 'trash') return true
    cur = byId[cur.parent]
  }
  return false
}

// 位置显示成什么名字；桌面、回收站，或者文件夹名
// 找不到这个文件夹就当在桌面上
export function locationName(byId, parent) {
  if (parent === 'desktop') return 'Desktop'
  if (parent === 'trash') return 'Recycle Bin'
  return byId[parent] ? byId[parent].name : 'Desktop'
}

// 地址栏的路径，比如['Desktop', 'My Pictures']；从当前文件夹一路往上拼
export function pathOf(byId, folderId) {
  if (folderId === 'desktop') return ['Desktop']
  if (folderId === 'trash') return ['Recycle Bin']
  const parts = []
  let cur = byId[folderId]
  while (cur) {
    parts.unshift(cur.name)
    if (cur.parent === 'desktop' || cur.parent === 'trash') {
      parts.unshift(locationName(byId, cur.parent))
      break
    }
    cur = byId[cur.parent]
  }
  return parts
}

// 文件夹窗口里“向上”去哪；桌面已经是最顶上，返回null，按钮变灰
export function parentOf(byId, folderId) {
  if (folderId === 'desktop') return null
  if (folderId === 'trash') return 'desktop'
  return byId[folderId] ? byId[folderId].parent : 'desktop'
}

// 搜索匹配；文件名或笔记内容里有这个词就算，不分大小写；没输入就全都算
export function matches(item, query) {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return item.name.toLowerCase().includes(q) || (item.text || '').toLowerCase().includes(q)
}

// 看图窗口能前后翻的图片；跟当前这张在同一个地方的，按名字排
export function viewerSiblings(items, item) {
  return items.filter(it => it.type === 'image' && it.parent === item.parent).sort(compareBy('name'))
}

// 同一个地方不许重名；重了就在扩展名前面加(2)、(3)……；不分大小写
export function uniqueName(items, parent, base) {
  const taken = items.filter(it => it.parent === parent).map(it => it.name.toLowerCase())
  if (!taken.includes(base.toLowerCase())) return base
  // 拆成文件名、扩展名；点在开头的不算扩展名
  const dot = base.lastIndexOf('.')
  const stem = dot > 0 ? base.slice(0, dot) : base
  const ext = dot > 0 ? base.slice(dot) : ''
  let n = 2
  while (taken.includes(`${stem} (${n})${ext}`.toLowerCase())) n++
  return `${stem} (${n})${ext}`
}

// 日期统一存成YYYY-MM-DD，用本地时区；这种格式直接按字符串比就是按时间排
export function isoDate(ms = Date.now()) {
  const d = new Date(ms)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// 显示的时候转成M/D/YYYY；跟老系统一个样
export function formatDate(iso) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-').map(Number)
  return `${m}/${d}/${y}`
}
