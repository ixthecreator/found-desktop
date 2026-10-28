import { useCallback, useEffect, useRef, useState } from 'react'
import data from './data/items.json'
import ContextMenu from './components/ContextMenu.jsx'
import Desktop from './components/Desktop.jsx'
import DragGhost, { ghostPos } from './components/DragGhost.jsx'
import Explorer from './components/Explorer.jsx'
import Notepad from './components/Notepad.jsx'
import PictureViewer from './components/PictureViewer.jsx'
import SearchWindow from './components/SearchWindow.jsx'
import StartMenu from './components/StartMenu.jsx'
import Taskbar from './components/Taskbar.jsx'
import WindowFrame from './components/WindowFrame.jsx'
import { BinIcon, DesktopIcon, FolderIcon, InfoIcon, NoteIcon, PictureIcon, SearchIcon } from './components/icons.jsx'
import { DeskContext } from './lib/context.js'
import { hasFiles, readImageFile } from './lib/images.js'
import { compareBy, groupItems, indexBy, isDescendant, isTrashed, isoDate, uniqueName, viewerSiblings } from './lib/items.js'
import { ICON_H, ICON_W, arrangeLayout, cellToXY, clampPos, nearestFreeCell, placeNew, takenCells } from './lib/layout.js'
import { clearState, loadState, saveState } from './lib/storage.js'

const TASKBAR_H = 30
const DEFAULT_SETTINGS = { alignToGrid: true, wallpaper: null, tipDismissed: false }
const WIN_SIZE = { explorer: [660, 450], viewer: [620, 500], notepad: [470, 400], search: [720, 470] }

const clamp = (v, lo, hi) => Math.max(lo, Math.min(v, hi))
const measureDesk = () => ({ w: window.innerWidth, h: window.innerHeight - TASKBAR_H })

function initialItems(desk) {
  const items = data.items.map(it => ({ ...it }))
  const flow = items.filter(it => it.parent === 'desktop' && it.x == null).map(it => it.id)
  const { pos } = arrangeLayout([flow], desk)
  return items.map(it => (pos[it.id] ? { ...it, ...pos[it.id] } : it))
}

function makeWindow(id, kind, target, n, desk, z, centered = false) {
  const [w0, h0] = WIN_SIZE[kind]
  const w = Math.min(w0, desk.w - 16)
  const h = Math.min(h0, desk.h - 16)
  const x = centered ? desk.w - w - Math.min(160, desk.w * 0.1) : 200 + (n % 7) * 28
  const y = centered ? (desk.h - h) / 2 - 20 : 30 + (n % 7) * 28
  return { id, kind, target, history: [], x: clamp(x, 0, desk.w - w), y: clamp(y, 0, desk.h - h), w, h, z, min: false, max: false }
}

const topWindowId = (windows, exceptId) =>
  windows.filter(w => !w.min && w.id !== exceptId).sort((a, b) => b.z - a.z)[0]?.id ?? null

// useState 加一个始终指向最新值的 ref。
// 同一次点击里连续改好几次状态时（比如先移动再选中），每一步都能读到上一步的结果，
// 而不是这次渲染开始时的旧值。
function useLatestState(init) {
  const [value, setValue] = useState(init)
  const ref = useRef(value)
  const set = useCallback(next => {
    ref.current = typeof next === 'function' ? next(ref.current) : next
    setValue(ref.current)
  }, [])
  return [value, set, ref]
}

// 整个应用的状态都在这里。核心是 items：每个文件只记 parent（在哪）和 x/y（桌面上的位置），
// 所有整理操作都只是改这两个字段，桌面、文件夹窗口、搜索结果再各自从 items 里筛出要显示的部分。
export default function App() {
  const [saved] = useState(loadState)
  const [desk, setDesk, deskSizeRef] = useLatestState(measureDesk)
  const [items, setItems, itemsRef] = useLatestState(() => saved?.items ?? initialItems(measureDesk()))
  const [settings, setSettings] = useState(() => ({ ...DEFAULT_SETTINGS, ...saved?.settings }))
  const [windows, setWindows, windowsRef] = useLatestState(() =>
    saved ? [] : [makeWindow('w1', 'notepad', 'readme', 0, measureDesk(), 1, true)],
  )
  const [activeId, setActiveId, activeRef] = useLatestState(saved ? null : 'w1')
  const [selection, setSelection] = useState({ scope: 'desktop', ids: [] })
  const [renaming, setRenaming] = useState(null) // { id, host }：正在重命名哪个文件，在桌面上还是在窗口里
  const [menu, setMenu] = useState(null)
  const [dialog, setDialog] = useState(null)
  const [startOpen, setStartOpen] = useState(false)
  const [drag, setDrag] = useState(null)
  const [band, setBand] = useState(null)
  const [arrangeLabels, setArrangeLabels] = useState([])
  const [poweredOn, setPoweredOn] = useState(true)

  const deskRef = useRef(null)
  const fileInputRef = useRef(null)
  const uploadTarget = useRef({ parent: 'desktop', at: null })
  const pendingRef = useRef(null) // 按住了某个图标，移动后才变成拖拽
  const bandRef = useRef(null) // 桌面框选
  const nextWin = useRef(2)
  const zTop = useRef(1)
  const labelTimer = useRef(null)

  const byId = indexBy(items)
  const trashCount = items.filter(it => it.parent === 'trash').length

  // 自动保存到 localStorage（停手 250ms 后才写，避免记事本每敲一个字就存一次）。
  // 访客没动过任何东西时不保存，下次打开会按当时的屏幕尺寸重新排版。
  const firstState = useRef({ items, settings })
  useEffect(() => {
    if (items === firstState.current.items && settings === firstState.current.settings) return
    const t = setTimeout(() => saveState({ items, settings }), 250)
    return () => clearTimeout(t)
  }, [items, settings])

  useEffect(() => {
    const onResize = () => setDesk(measureDesk())
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [setDesk])

  /* ---------- 窗口 ---------- */

  function focusWindow(id) {
    const w = windowsRef.current.find(x => x.id === id)
    if (!w) return
    if (w.z !== zTop.current || w.min) {
      const z = ++zTop.current
      setWindows(ws => ws.map(x => (x.id === id ? { ...x, min: false, z } : x)))
    }
    if (activeRef.current !== id) setActiveId(id)
  }

  function openWindow(kind, target) {
    const ws = windowsRef.current
    const existing = ws.find(w => w.kind === kind && (kind === 'search' || w.target === target))
    if (existing) return focusWindow(existing.id)
    const id = `w${nextWin.current++}`
    setWindows([...ws, makeWindow(id, kind, target, ws.length, deskSizeRef.current, ++zTop.current)])
    setActiveId(id)
  }

  function closeWindow(id) {
    const rest = windowsRef.current.filter(w => w.id !== id)
    setWindows(rest)
    if (activeRef.current === id) setActiveId(topWindowId(rest))
  }

  function minimizeWindow(id) {
    const ws = windowsRef.current.map(w => (w.id === id ? { ...w, min: true } : w))
    setWindows(ws)
    if (activeRef.current === id) setActiveId(topWindowId(ws))
  }

  const patchWindow = (id, patch) => setWindows(ws => ws.map(w => (w.id === id ? { ...w, ...patch } : w)))
  const toggleMax = id => setWindows(ws => ws.map(w => (w.id === id ? { ...w, max: !w.max } : w)))

  function taskClick(id) {
    const w = windowsRef.current.find(x => x.id === id)
    if (!w) return
    if (activeRef.current === id && !w.min) minimizeWindow(id)
    else focusWindow(id)
  }

  function navigate(winId, target) {
    const w = windowsRef.current.find(x => x.id === winId)
    if (!w || w.target === target) return
    patchWindow(winId, { target, history: [...w.history, w.target] })
  }

  function back(winId) {
    const w = windowsRef.current.find(x => x.id === winId)
    if (!w?.history.length) return
    patchWindow(winId, { target: w.history.at(-1), history: w.history.slice(0, -1) })
  }

  // 双击打开：图片 → 看图窗口，笔记 → 记事本，文件夹/回收站 → 文件夹窗口。
  // 在文件夹窗口里双击子文件夹时不开新窗口，而是在原窗口里跳过去。
  function open(id, fromScope = null) {
    const item = indexBy(itemsRef.current)[id]
    if (!item) return
    const isPlace = item.type === 'folder' || item.type === 'bin'
    const target = item.type === 'bin' ? 'trash' : id
    if (isPlace && fromScope && !fromScope.startsWith('search:')) {
      const host = windowsRef.current
        .filter(w => w.kind === 'explorer' && w.target === fromScope)
        .sort((a, b) => b.z - a.z)[0]
      if (host) return navigate(host.id, target)
    }
    if (isPlace) return openWindow('explorer', target)
    openWindow(item.type === 'image' ? 'viewer' : 'notepad', id)
  }

  const openFolder = target => openWindow('explorer', target)
  const openSearch = () => openWindow('search', null)

  function stepViewer(winId, d) {
    const w = windowsRef.current.find(x => x.id === winId)
    const item = w && indexBy(itemsRef.current)[w.target]
    if (!item) return
    const sibs = viewerSiblings(itemsRef.current, item)
    if (sibs.length < 2) return
    const i = sibs.findIndex(s => s.id === item.id)
    patchWindow(winId, { target: sibs[(i + d + sibs.length) % sibs.length].id })
  }

  function deleteFromViewer(winId) {
    const w = windowsRef.current.find(x => x.id === winId)
    const item = w && indexBy(itemsRef.current)[w.target]
    if (!item) return
    if (viewerSiblings(itemsRef.current, item).length > 1) stepViewer(winId, 1)
    else closeWindow(winId)
    trashItems([item.id])
  }

  function openContaining(item) {
    openWindow('explorer', item.parent)
    setSelection({ scope: item.parent, ids: [item.id] })
  }

  /* ---------- 文件操作 ---------- */

  const updateItem = (id, patch) => setItems(its => its.map(it => (it.id === id ? { ...it, ...patch } : it)))
  const select = (scope, ids) => setSelection({ scope, ids })

  // 移到回收站：parent 改成 'trash'，同时用 prevParent 记住原来在哪，方便还原。
  function trashItems(ids) {
    const set = new Set(ids.filter(id => id !== 'bin'))
    if (!set.size) return
    setItems(its => its.map(it => (set.has(it.id) && it.parent !== 'trash' ? { ...it, prevParent: it.parent, parent: 'trash' } : it)))
    setSelection(s => ({ ...s, ids: s.ids.filter(id => !set.has(id)) }))
    setRenaming(null)
  }

  // 从回收站还原：放回 prevParent；如果原文件夹也被删了，就放回桌面上离原位置最近的空格。
  function restoreItems(ids) {
    const list = itemsRef.current
    const lookup = indexBy(list)
    const d = deskSizeRef.current
    const taken = takenCells(list, d)
    const plan = {}
    for (const id of ids) {
      const it = lookup[id]
      if (!it || it.parent !== 'trash') continue
      const home = it.prevParent
      const parent = home && home !== 'trash' && (home === 'desktop' || (lookup[home] && !isTrashed(lookup, home))) ? home : 'desktop'
      plan[id] = parent === 'desktop' ? { parent, ...nearestFreeCell(it.x ?? 0, it.y ?? 0, taken, d) } : { parent }
    }
    setItems(list.map(it => (plan[it.id] ? { ...it, ...plan[it.id], prevParent: undefined } : it)))
    setSelection({ scope: 'trash', ids: [] })
  }

  // 彻底删除：从 items 里移除（文件夹里的东西一起删），并关掉相关窗口。
  function removeForever(ids) {
    const list = itemsRef.current
    const lookup = indexBy(list)
    const doomed = new Set(list.filter(it => ids.some(id => isDescendant(lookup, it.id, id))).map(it => it.id))
    setItems(list.filter(it => !doomed.has(it.id)))
    setWindows(ws => ws.filter(w => !doomed.has(w.target)))
    setSelection(s => ({ ...s, ids: s.ids.filter(id => !doomed.has(id)) }))
  }

  function deleteForever(ids) {
    const n = ids.length
    setDialog({
      title: 'Confirm File Delete',
      message: `Are you sure you want to permanently delete ${n === 1 ? `'${indexBy(itemsRef.current)[ids[0]]?.name}'` : `these ${n} items`}? This can't be undone.`,
      confirmLabel: 'Delete',
      onConfirm: () => removeForever(ids),
    })
  }

  function emptyTrash() {
    const ids = itemsRef.current.filter(it => it.parent === 'trash').map(it => it.id)
    if (!ids.length) return
    setDialog({
      title: 'Confirm Multiple File Delete',
      message: `Are you sure you want to permanently delete these ${ids.length} items? This can't be undone.`,
      confirmLabel: 'Empty Bin',
      onConfirm: () => removeForever(ids),
    })
  }

  // 把一组文件移到某个文件夹或桌面，是“整理”最核心的操作。
  // 会跳过回收站图标本身，也不允许把文件夹放进它自己或它的子文件夹里。
  function moveTo(ids, target) {
    const list = itemsRef.current
    const lookup = indexBy(list)
    const movable = ids.filter(
      id =>
        id !== 'bin' &&
        lookup[id] &&
        lookup[id].parent !== target &&
        (target === 'desktop' || !isDescendant(lookup, target, id)),
    )
    if (!movable.length) return
    const spots = target === 'desktop' ? placeNew(list, movable.length, deskSizeRef.current) : []
    setItems(
      list.map(it => {
        const i = movable.indexOf(it.id)
        return i < 0 ? it : { ...it, parent: target, prevParent: undefined, ...(spots[i] || {}) }
      }),
    )
    setSelection({ scope: target, ids: movable })
  }

  // 新建文件夹或笔记：自动避开重名，在桌面上找空位，然后直接进入重命名状态。
  function createItem(type, parent = 'desktop', at = null, openAfter = false) {
    const list = itemsRef.current
    const base = type === 'folder' ? 'New Folder' : 'New Text Document.txt'
    const item = {
      id: `${type}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`,
      type,
      name: uniqueName(list, parent, base),
      parent,
      date: isoDate(),
    }
    if (type === 'note') item.text = ''
    if (parent === 'desktop') Object.assign(item, placeNew(list, 1, deskSizeRef.current, at)[0])
    setItems([...list, item])
    setSelection({ scope: parent, ids: [item.id] })
    if (openAfter) openWindow('notepad', item.id)
    else setRenaming({ id: item.id, host: parent === 'desktop' ? 'desktop' : 'list' })
  }

  const startRename = (id, host = 'list') => setRenaming({ id, host })
  const cancelRename = () => setRenaming(null)

  function commitRename(id, raw) {
    setRenaming(null)
    const name = raw.replace(/[\\/:*?"<>|]/g, '').trim()
    if (name) updateItem(id, { name })
  }

  // 上传图片：先压缩成 base64（见 lib/images.js），再作为新的图片条目加进 items。
  // 拖到桌面上时放在松手位置附近；拖进文件夹窗口时直接归到那个文件夹。
  async function addFiles(files, parent, at) {
    const loaded = []
    for (const file of files.filter(f => f.type.startsWith('image/'))) {
      try {
        loaded.push({ file, src: await readImageFile(file) })
      } catch (err) {
        console.warn(err)
      }
    }
    if (!loaded.length) return
    const list = itemsRef.current
    const spots = parent === 'desktop' ? placeNew(list, loaded.length, deskSizeRef.current, at) : []
    const stamp = Date.now().toString(36)
    const added = []
    loaded.forEach(({ file, src }, i) => {
      added.push({
        id: `up-${stamp}-${i}`,
        type: 'image',
        name: uniqueName([...list, ...added], parent, file.name),
        parent,
        date: isoDate(file.lastModified),
        src,
        credit: 'you',
        ...(spots[i] || {}),
      })
    })
    setItems([...itemsRef.current, ...added])
    setSelection({ scope: parent, ids: added.map(it => it.id) })
  }

  // “Add Pictures…”按钮：点一下隐藏的 <input type="file">，弹出系统的选择文件窗口。
  function pickFiles(parent = 'desktop', at = null) {
    uploadTarget.current = { parent, at }
    fileInputRef.current?.click()
  }

  // 必须在 dragover 里 preventDefault，浏览器才允许把文件放在这里。
  function fileDragOver(e) {
    if (!hasFiles(e)) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }

  // 从电脑里把图片文件拖进来时触发。
  function dropFiles(e, parent) {
    if (!hasFiles(e)) return
    e.preventDefault()
    let at = null
    if (parent === 'desktop' && e.currentTarget === deskRef.current) {
      const r = deskRef.current.getBoundingClientRect()
      at = { x: e.clientX - r.left - ICON_W / 2, y: e.clientY - r.top - 24 }
    }
    addFiles([...e.dataTransfer.files], parent, at)
  }

  // 自动排列桌面：按名称、按类型，或按日期排成时间线（每一年单独占一列，顶部短暂显示年份）。
  function arrangeDesktop(key) {
    const list = itemsRef.current
    const onDesk = list.filter(it => it.parent === 'desktop')
    const bin = onDesk.filter(it => it.type === 'bin').map(it => it.id)
    const rest = onDesk.filter(it => it.type !== 'bin').sort(compareBy(key))
    const groups = key === 'name' ? [{ label: '', items: rest }] : groupItems(rest, key)
    const { pos, columns } = arrangeLayout([bin, ...groups.map(g => g.items.map(it => it.id))], deskSizeRef.current)
    setItems(list.map(it => (pos[it.id] ? { ...it, ...pos[it.id] } : it)))
    setSelection({ scope: 'desktop', ids: [] })
    clearTimeout(labelTimer.current)
    if (key === 'name') return setArrangeLabels([])
    const offset = bin.length ? 1 : 0
    setArrangeLabels(groups.map((g, i) => ({ label: g.label, x: cellToXY(columns[i + offset], 0).x })))
    labelTimer.current = setTimeout(() => setArrangeLabels([]), 4500)
  }

  const setWallpaper = src => setSettings(s => ({ ...s, wallpaper: src }))

  function resetDesktop() {
    setDialog({
      title: 'Reset Desktop',
      message: 'Put everything back the way it was found? Your folders, names, notes and added pictures will be lost.',
      confirmLabel: 'Reset',
      onConfirm: () => {
        clearState()
        setItems(initialItems(deskSizeRef.current))
        setSettings({ ...DEFAULT_SETTINGS, tipDismissed: true })
        setWindows([])
        setActiveId(null)
        setSelection({ scope: 'desktop', ids: [] })
        setRenaming(null)
      },
    })
  }

  /* ---------- 右键菜单 ---------- */

  const openMenu = (x, y, entries) => setMenu({ x, y, entries })

  function itemContextMenu(e, item, scope, variant) {
    e.preventDefault()
    e.stopPropagation()
    const inSelection = selection.scope === scope && selection.ids.includes(item.id)
    const sel = inSelection ? selection.ids : [item.id]
    if (!inSelection) setSelection({ scope, ids: sel })
    const host = variant === 'desktop' ? 'desktop' : 'list'
    openMenu(e.clientX, e.clientY, itemMenu(item, sel, host))
  }

  function itemMenu(item, sel, host) {
    if (item.type === 'bin') {
      return [
        { label: 'Open', bold: true, onClick: () => open('bin') },
        '-',
        { label: 'Empty Recycle Bin', disabled: !trashCount, onClick: emptyTrash },
      ]
    }
    if (item.parent === 'trash') {
      return [
        { label: 'Restore', bold: true, onClick: () => restoreItems(sel) },
        { label: 'Open', onClick: () => open(item.id) },
        '-',
        { label: 'Delete Permanently', onClick: () => deleteForever(sel) },
      ]
    }
    const lookup = indexBy(itemsRef.current)
    const ids = sel.filter(id => id !== 'bin')
    const folders = itemsRef.current
      .filter(f => f.type === 'folder' && !isTrashed(lookup, f.id) && !ids.some(id => isDescendant(lookup, f.id, id)))
      .sort(compareBy('name'))
    const allIn = target => ids.every(id => lookup[id]?.parent === target)
    return [
      { label: 'Open', bold: true, onClick: () => sel.slice(0, 6).forEach(id => open(id)) },
      ...(item.type === 'image' ? [{ label: 'Set as Desktop Background', onClick: () => setWallpaper(item.src) }] : []),
      '-',
      {
        label: 'Move to',
        submenu: [
          { label: 'Desktop', disabled: allIn('desktop'), onClick: () => moveTo(ids, 'desktop') },
          ...(folders.length ? ['-'] : []),
          ...folders.map(f => ({ label: f.name, disabled: allIn(f.id), onClick: () => moveTo(ids, f.id) })),
        ],
      },
      '-',
      { label: 'Delete', onClick: () => trashItems(ids) },
      { label: 'Rename', disabled: sel.length !== 1, onClick: () => startRename(item.id, host) },
    ]
  }

  function desktopContextMenu(e) {
    const r = deskRef.current.getBoundingClientRect()
    const at = { x: e.clientX - r.left - ICON_W / 2, y: e.clientY - r.top - 24 }
    openMenu(e.clientX, e.clientY, [
      {
        label: 'Arrange Icons By',
        submenu: [
          { label: 'Name', onClick: () => arrangeDesktop('name') },
          { label: 'Type', onClick: () => arrangeDesktop('type') },
          { label: 'Date (timeline)', onClick: () => arrangeDesktop('date') },
          '-',
          {
            label: 'Align to Grid',
            checked: settings.alignToGrid,
            onClick: () => setSettings(s => ({ ...s, alignToGrid: !s.alignToGrid })),
          },
        ],
      },
      '-',
      {
        label: 'New',
        submenu: [
          { label: 'Folder', onClick: () => createItem('folder', 'desktop', at) },
          { label: 'Text Document', onClick: () => createItem('note', 'desktop', at) },
        ],
      },
      { label: 'Add Pictures…', onClick: () => pickFiles('desktop', at) },
      '-',
      { label: 'Search…', onClick: openSearch },
      { label: 'Open Desktop as Folder', onClick: () => openFolder('desktop') },
      ...(settings.wallpaper ? [{ label: 'Restore Original Wallpaper', onClick: () => setWallpaper(null) }] : []),
      '-',
      { label: 'Reset Desktop…', onClick: resetDesktop },
    ])
  }

  /* ---------- 鼠标：选择、拖放 ---------- */

  // 拖拽第 1 步：按下图标。处理单选和多选（Cmd/Ctrl/Shift），记下“可能要拖的文件”。
  // 这时还不算拖拽，要等鼠标移动超过 5px（见 onPointerMove）。
  function itemPointerDown(e, item, scope) {
    if (e.button !== 0) return
    e.stopPropagation()
    if (deskRef.current?.contains(e.target)) setActiveId(null)
    const additive = e.ctrlKey || e.metaKey || e.shiftKey
    const current = selection.scope === scope ? selection.ids : []
    let ids
    if (additive) {
      ids = current.includes(item.id) ? current.filter(id => id !== item.id) : [...current, item.id]
      setSelection({ scope, ids })
      if (!ids.includes(item.id)) return
    } else if (current.includes(item.id)) {
      ids = current
    } else {
      ids = [item.id]
      setSelection({ scope, ids })
    }
    const root = e.currentTarget.closest('.desktop, .ex-content') ?? document
    pendingRef.current = { ids, scope, root, sx: e.clientX, sy: e.clientY, clickedId: item.id, additive, started: false }
  }

  // 在桌面空白处按下：开始框选。
  function desktopPointerDown(e) {
    if (e.button !== 0) return
    setActiveId(null)
    const additive = e.ctrlKey || e.metaKey || e.shiftKey
    const base = additive && selection.scope === 'desktop' ? selection.ids : []
    setSelection({ scope: 'desktop', ids: base })
    const r = deskRef.current.getBoundingClientRect()
    bandRef.current = { x0: e.clientX - r.left, y0: e.clientY - r.top, left: r.left, top: r.top, base }
  }

  // 拖拽第 3 步：找光标下面的放置目标。
  // elementsFromPoint 拿到光标下的所有元素，跳过正在被拖的图标本身，
  // 返回第一个带 data-drop 属性的元素（桌面、文件夹、回收站、窗口内容区）。
  function dropTargetAt(x, y, p) {
    for (const el of document.elementsFromPoint(x, y)) {
      const itemEl = el.closest('[data-item]')
      if (itemEl && itemEl.dataset.scope === p.scope && p.ids.includes(itemEl.dataset.item)) continue
      const target = el.closest('[data-drop]')
      if (target) return target.dataset.drop
    }
    return null
  }

  // 能不能放在这里：决定目标要不要高亮，以及松手后是否真的移动。
  function canDrop(p, over) {
    if (!over || over === 'none') return false
    const movable = p.ids.filter(id => id !== 'bin')
    if (over === 'desktop') return true
    if (over === 'desktop:list') return p.scope !== 'desktop' && movable.length > 0
    if (over === 'trash') return p.scope !== 'trash' && movable.length > 0
    if (over === p.scope) return false
    const lookup = indexBy(itemsRef.current)
    if (lookup[over]?.type !== 'folder') return false
    return movable.length > 0 && movable.every(id => !isDescendant(lookup, over, id))
  }

  // 拖拽第 4 步：松手后执行。放到回收站 → 删除；放到文件夹 → 移进去；
  // 放到桌面 → 按松手位置更新坐标（开着网格对齐时吸附到最近的空格）。
  function handleDrop(p, over, cx, cy) {
    const list = itemsRef.current
    const lookup = indexBy(list)
    const ids = p.ids.filter(id => lookup[id] && (id !== 'bin' || over === 'desktop'))
    if (over === 'trash') return trashItems(ids)
    if (over !== 'desktop') return moveTo(ids, over === 'desktop:list' ? 'desktop' : over)

    const r = deskRef.current.getBoundingClientRect()
    const d = deskSizeRef.current
    const taken = settings.alignToGrid ? takenCells(list, d, new Set(ids)) : null
    const placed = {}
    for (const id of ids) {
      const g = ghostPos({ ...p, cx, cy }, id)
      if (!g) continue
      let pos = { x: clamp(g.x - r.left, 0, d.w - ICON_W), y: clamp(g.y - r.top, 0, d.h - ICON_H) }
      if (taken) pos = nearestFreeCell(pos.x, pos.y, taken, d)
      placed[id] = pos
    }
    setItems(list.map(it => (placed[it.id] ? { ...it, ...placed[it.id], parent: 'desktop', prevParent: undefined } : it)))
    setSelection({ scope: 'desktop', ids: Object.keys(placed) })
  }

  // 拖拽第 2 步：鼠标移动。超过 5px 才正式开始拖（避免把单击误判成拖拽），
  // 之后每次移动都更新幽灵图标的位置和当前放置目标。桌面框选也在这里处理。
  function onPointerMove(e) {
    const p = pendingRef.current
    if (p) {
      if (!p.started) {
        if (Math.hypot(e.clientX - p.sx, e.clientY - p.sy) < 5) return
        p.started = true
        p.rects = {}
        for (const id of p.ids) {
          const el = p.root.querySelector(`[data-item="${CSS.escape(id)}"][data-scope="${CSS.escape(p.scope)}"]`)
          if (el) p.rects[id] = el.getBoundingClientRect()
        }
        p.anchor = p.rects[p.clickedId] ?? { left: p.sx, top: p.sy }
        p.grab = { x: clamp(p.sx - p.anchor.left, 0, ICON_W), y: clamp(p.sy - p.anchor.top, 0, ICON_H) }
        document.body.classList.add('is-dragging')
      }
      const over = dropTargetAt(e.clientX, e.clientY, p)
      setDrag({
        ids: p.ids,
        scope: p.scope,
        rects: p.rects,
        anchor: p.anchor,
        grab: p.grab,
        cx: e.clientX,
        cy: e.clientY,
        over,
        valid: canDrop(p, over),
      })
      return
    }

    const b = bandRef.current
    if (!b) return
    const x1 = e.clientX - b.left
    const y1 = e.clientY - b.top
    const rect = { x: Math.min(b.x0, x1), y: Math.min(b.y0, y1), w: Math.abs(x1 - b.x0), h: Math.abs(y1 - b.y0) }
    if (rect.w < 3 && rect.h < 3) return
    setBand(rect)
    const d = deskSizeRef.current
    const hits = itemsRef.current
      .filter(it => {
        if (it.parent !== 'desktop') return false
        const pos = clampPos(it, d)
        return pos.x < rect.x + rect.w && pos.x + ICON_W > rect.x && pos.y < rect.y + rect.h && pos.y + ICON_H > rect.y
      })
      .map(it => it.id)
    setSelection({ scope: 'desktop', ids: [...new Set([...b.base, ...hits])] })
  }

  // 松手：结束拖拽或框选。如果只是单击没拖动，就只选中点的那一个。
  function onPointerUp(e) {
    const p = pendingRef.current
    pendingRef.current = null
    if (p?.started) {
      document.body.classList.remove('is-dragging')
      setDrag(null)
      const over = dropTargetAt(e.clientX, e.clientY, p)
      if (canDrop(p, over)) handleDrop(p, over, e.clientX, e.clientY)
    } else if (p && !p.additive && p.ids.length > 1) {
      setSelection({ scope: p.scope, ids: [p.clickedId] })
    }
    if (bandRef.current) {
      bandRef.current = null
      setBand(null)
    }
  }

  function onPointerCancel() {
    pendingRef.current = null
    bandRef.current = null
    document.body.classList.remove('is-dragging')
    setDrag(null)
    setBand(null)
  }

  function onGlobalPointerDown(e) {
    if (!e.target.closest?.('.ctx-menu')) setMenu(null)
    if (!e.target.closest?.('.start-menu, .start-button')) setStartOpen(false)
  }

  function onKeyDown(e) {
    if (e.key === 'Escape') {
      setMenu(null)
      setStartOpen(false)
      setDialog(null)
      return
    }
    if (dialog) return
    const tag = e.target.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
    if (tag === 'BUTTON' && (e.key === 'Enter' || e.key === ' ')) return
    const mod = e.metaKey || e.ctrlKey
    const key = e.key
    if (key === 'F3' || (mod && key.toLowerCase() === 'f')) {
      e.preventDefault()
      return openSearch()
    }
    const active = windowsRef.current.find(w => w.id === activeRef.current && !w.min)
    if (active?.kind === 'viewer' && (key === 'ArrowLeft' || key === 'ArrowRight')) {
      e.preventDefault()
      return stepViewer(active.id, key === 'ArrowLeft' ? -1 : 1)
    }
    const { scope } = selection
    if (mod && key.toLowerCase() === 'a') {
      if (scope.startsWith('search:')) return
      e.preventDefault()
      return setSelection({ scope, ids: itemsRef.current.filter(it => it.parent === scope).map(it => it.id) })
    }
    const live = selection.ids.filter(id => itemsRef.current.some(it => it.id === id))
    if (!live.length) return
    if (key === 'Delete' || key === 'Backspace') {
      e.preventDefault()
      if (scope === 'trash') deleteForever(live)
      else trashItems(live)
    } else if (key === 'F2' && live.length === 1 && live[0] !== 'bin') {
      e.preventDefault()
      startRename(live[0], scope === 'desktop' ? 'desktop' : 'list')
    } else if (key === 'Enter') {
      e.preventDefault()
      live.slice(0, 6).forEach(id => open(id))
    }
  }

  // 全局监听只注册一次，但通过 handlers.current 总是调用最新的处理函数，避免读到旧的 state。
  const handlers = useRef(null)
  handlers.current = { onPointerMove, onPointerUp, onPointerCancel, onKeyDown, onGlobalPointerDown }
  useEffect(() => {
    const call = name => e => handlers.current[name](e)
    const listeners = [
      ['pointermove', call('onPointerMove')],
      ['pointerup', call('onPointerUp')],
      ['pointercancel', call('onPointerCancel')],
      ['keydown', call('onKeyDown')],
      ['pointerdown', call('onGlobalPointerDown'), true],
      // 文件被拖到不接受的地方时，阻止浏览器直接打开这个文件、离开页面。
      ['dragover', e => hasFiles(e) && e.preventDefault()],
      ['drop', e => hasFiles(e) && e.preventDefault()],
    ]
    for (const [type, fn, capture] of listeners) window.addEventListener(type, fn, capture)
    return () => {
      for (const [type, fn, capture] of listeners) window.removeEventListener(type, fn, capture)
    }
  }, [])

  /* ---------- 渲染 ---------- */

  function windowInfo(w) {
    if (w.kind === 'search') return { title: 'Search Results', icon: <SearchIcon size={16} /> }
    if (w.kind === 'explorer') {
      if (w.target === 'desktop') return { title: 'Desktop', icon: <DesktopIcon size={16} /> }
      if (w.target === 'trash') return { title: 'Recycle Bin', icon: <BinIcon size={16} full={trashCount > 0} /> }
      return byId[w.target] && { title: byId[w.target].name, icon: <FolderIcon size={16} open /> }
    }
    const it = byId[w.target]
    if (!it) return null
    if (w.kind === 'viewer') return { title: `${it.name} - Picture Viewer`, icon: <PictureIcon size={16} /> }
    return { title: `${it.name} - Notepad`, icon: <NoteIcon size={16} /> }
  }
  const titles = Object.fromEntries(windows.map(w => [w.id, windowInfo(w)]))

  function dragHint(d) {
    if (!d) return null
    const { over, valid, scope } = d
    if (!valid) return over && !['desktop', 'none', scope].includes(over) ? "Can't move here" : null
    if (over === 'trash') return 'Move to Recycle Bin'
    if (over === 'desktop' || over === 'desktop:list') {
      if (scope === 'desktop') return null
      return scope === 'trash' ? 'Restore to Desktop' : 'Move to Desktop'
    }
    return `Move to ${byId[over]?.name}`
  }

  const api = {
    itemPointerDown,
    itemContextMenu,
    desktopPointerDown,
    desktopContextMenu,
    open,
    openFolder,
    openSearch,
    select,
    startRename,
    commitRename,
    cancelRename,
    openMenu,
    patchWindow,
    focusWindow,
    closeWindow,
    minimizeWindow,
    toggleMax,
    navigate,
    back,
    taskClick,
    createItem,
    pickFiles,
    dropFiles,
    fileDragOver,
    trashItems,
    restoreItems,
    emptyTrash,
    moveTo,
    setWallpaper,
    stepViewer,
    deleteFromViewer,
    openContaining,
    updateItem,
    arrangeDesktop,
    resetDesktop,
    toggleStart: () => setStartOpen(o => !o),
    closeStart: () => setStartOpen(false),
    powerOff: () => setPoweredOn(false),
    showTip: () => setSettings(s => ({ ...s, tipDismissed: false })),
  }

  const ctx = { items, byId, settings, selection, renaming, drag, band, desk, trashCount, arrangeLabels, api }

  return (
    <DeskContext.Provider value={ctx}>
      <div className="screen" onContextMenu={e => !e.target.closest('input, textarea') && e.preventDefault()}>
        <Desktop deskRef={deskRef} />

        <div className="windows-layer">
          {windows.map(w =>
            titles[w.id] ? (
              <WindowFrame key={w.id} win={w} active={w.id === activeId} title={titles[w.id].title} icon={titles[w.id].icon}>
                {w.kind === 'explorer' && <Explorer win={w} />}
                {w.kind === 'viewer' && <PictureViewer win={w} />}
                {w.kind === 'notepad' && <Notepad win={w} />}
                {w.kind === 'search' && <SearchWindow win={w} />}
              </WindowFrame>
            ) : null,
          )}
        </div>

        {startOpen && <StartMenu owner={data.owner} />}
        <Taskbar windows={windows} titles={titles} activeId={activeId} startOpen={startOpen} />

        {!settings.tipDismissed && (
          <div className="balloon" role="status">
            <button
              className="balloon-x"
              aria-label="Close tip"
              onClick={() => setSettings(s => ({ ...s, tipDismissed: true }))}
            >
              ×
            </button>
            <b>
              <InfoIcon /> Someone left their desktop behind
            </b>
            <p>
              Drag files into folders or into piles. Double-click to open, right-click for more. Drop your own
              pictures anywhere on the screen.
            </p>
          </div>
        )}

        <ContextMenu menu={menu} onClose={() => setMenu(null)} />
        <DragGhost hint={dragHint(drag)} />

        {dialog && (
          <div className="modal-backdrop">
            <section className="window active dialog" role="alertdialog" aria-label={dialog.title}>
              <header className="titlebar">
                <span className="title-text">{dialog.title}</span>
                <div className="title-buttons">
                  <button className="tb-close" aria-label="Close" onClick={() => setDialog(null)} />
                </div>
              </header>
              <div className="window-body dialog-body">
                <div className="dialog-msg">
                  <BinIcon size={40} full />
                  <p>{dialog.message}</p>
                </div>
                <div className="dialog-buttons">
                  <button
                    className="xp-btn"
                    autoFocus
                    onClick={() => {
                      setDialog(null)
                      dialog.onConfirm()
                    }}
                  >
                    {dialog.confirmLabel}
                  </button>
                  <button className="xp-btn" onClick={() => setDialog(null)}>
                    Cancel
                  </button>
                </div>
              </div>
            </section>
          </div>
        )}

        {!poweredOn && (
          <button className="power-off" onClick={() => setPoweredOn(true)}>
            <span>It is now safe to turn off your computer.</span>
            <small>Click anywhere to turn it back on.</small>
          </button>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={e => {
            addFiles([...e.target.files], uploadTarget.current.parent, uploadTarget.current.at)
            e.target.value = ''
          }}
        />
      </div>
    </DeskContext.Provider>
  )
}
