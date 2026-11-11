import { useState } from 'react'
import { useDesk } from '../lib/context.js'
import { compareBy, isDescendant, isTrashed, matches } from '../lib/items.js'
import ItemTile from './ItemTile.jsx'
import { DetailsHead, Panel } from './TaskPane.jsx'

// “What kind?”的选项；[值, 显示的文字]
const KINDS = [
  ['all', 'All files and folders'],
  ['image', 'Pictures'],
  ['note', 'Notes'],
  ['folder', 'Folders'],
]

// 搜索窗口；按名字或笔记内容、类型、年份、位置筛所有文件；
// 结果能直接拖到文件夹、桌面上，所以选中范围单独用'search:窗口id'表示
export default function SearchWindow({ win }) {
  const { items, byId, api } = useDesk()
  const [q, setQ] = useState('')
  const [kind, setKind] = useState('all')
  const [year, setYear] = useState('any')
  const [where, setWhere] = useState('everywhere')
  const [sort, setSort] = useState('name')
  const scope = 'search:' + win.id

  // “When was it made?”的选项；所有文件出现过的年份
  const years = []
  for (const it of items) {
    const y = it.date ? it.date.slice(0, 4) : null
    if (y && !years.includes(y)) years.push(y)
  }
  years.sort()
  const folders = items.filter(it => it.type === 'folder' && !isTrashed(byId, it.id)).sort(compareBy('name'))
  // 依次按类型、年份、位置、文字筛；默认不搜回收站，除非“Look in”选了回收站
  const results = items
    .filter(it => {
      if (it.type === 'bin') return false
      if (kind !== 'all' && it.type !== kind) return false
      if (year !== 'any' && !(it.date && it.date.startsWith(year))) return false
      const trashed = isTrashed(byId, it.id)
      if (where === 'trash') return trashed && matches(it, q)
      if (trashed) return false
      if (where === 'desktop' && it.parent !== 'desktop') return false
      if (where !== 'everywhere' && where !== 'desktop' && (it.id === where || !isDescendant(byId, it.id, where))) return false
      return matches(it, q)
    })
    .sort(compareBy(sort))

  // Clear按钮；条件全部恢复默认，排序不动
  const reset = () => {
    setQ('')
    setKind('all')
    setYear('any')
    setWhere('everywhere')
  }

  return (
    <>
      <div className="explorer-main">
        <aside className="taskpane search-pane">
          <Panel title="Search by any or all of these">
            <label className="field">
              Name, or a word inside a note:
              <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="e.g. lake, IMG, biscuit" />
            </label>
            <div className="field">
              What kind?
              {KINDS.map(([value, label]) => (
                <label key={value} className="radio">
                  <input type="radio" name={'kind-' + win.id} checked={kind === value} onChange={() => setKind(value)} />
                  {label}
                </label>
              ))}
            </div>
            <label className="field">
              When was it made?
              <select value={year} onChange={e => setYear(e.target.value)}>
                <option value="any">Don't remember</option>
                {years.map(y => (
                  <option key={y}>{y}</option>
                ))}
              </select>
            </label>
            <label className="field">
              Look in:
              <select value={where} onChange={e => setWhere(e.target.value)}>
                <option value="everywhere">Everywhere</option>
                <option value="desktop">Desktop only</option>
                {folders.map(f => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
                <option value="trash">Recycle Bin</option>
              </select>
            </label>
            <button className="xp-btn" onClick={reset}>
              Clear
            </button>
          </Panel>
        </aside>
        <div
          className="ex-content view-details with-location"
          onPointerDown={e => !e.target.closest('[data-item]') && api.select(scope, [])}
        >
          <DetailsHead sort={sort} onSort={setSort} showLocation />
          <div className="ex-grid">
            {results.map(it => (
              <ItemTile key={it.id} item={it} scope={scope} variant="row" showLocation />
            ))}
          </div>
          {!results.length && <p className="empty">Nothing matches. Try fewer words, or look Everywhere.</p>}
        </div>
      </div>
      <footer className="statusbar">
        <span>
          {results.length} result{results.length === 1 ? '' : 's'}
        </span>
        <span className="status-hint">Drag results onto a folder or the desktop to move them</span>
      </footer>
    </>
  )
}
