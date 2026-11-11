import { useEffect, useRef, useState } from 'react'
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
import { BinIcon, DesktopIcon, FolderIcon, InfoIcon, NoteIcon, PictureIcon, ResetIcon, SearchIcon } from './components/icons.jsx'
import { DeskContext } from './lib/context.js'
import { hasFiles, readImageFile } from './lib/images.js'
import { compareBy, groupItems, indexBy, isDescendant, isTrashed, isoDate, uniqueName, viewerSiblings } from './lib/items.js'
import { ICON_H, ICON_W, arrangeLayout, cellToXY, clampPos, nearestFreeCell, placeNew, takenCells } from './lib/layout.js'
import { clearState, loadState, saveState } from './lib/storage.js'

const TASKBAR_H = 30 // 任务栏高度；桌面可用高度要减掉它
// 设置的默认值；网格对齐开着，用自带壁纸，提示气泡没关过
const DEFAULT_SETTINGS = { alignToGrid: true, wallpaper: null, tipDismissed: false }
// 各种窗口刚打开时多大
const WIN_SIZE = { explorer: [660, 450], viewer: [620, 500], notepad: [470, 400], search: [720, 470] }

// 把v限制在lo到hi之间
const clamp = (v, lo, hi) => Math.max(lo, Math.min(v, hi))
// 桌面多大；整个浏览器窗口减掉任务栏
const measureDesk = () => ({ w: window.innerWidth, h: window.innerHeight - TASKBAR_H })

// 初始文件列表；从items.json来；没写坐标的桌面图标按当前屏幕大小自动排成几列
function initialItems(desk) {
  const items = data.items.map(it => ({ ...it }))
  const flow = items.filter(it => it.parent === 'desktop' && it.x == null).map(it => it.id)
  const { pos } = arrangeLayout([flow], desk)
  return items.map(it => (pos[it.id] ? { ...it, ...pos[it.id] } : it))
}

// 新窗口的初始状态；普通窗口一个个往右下错开，错7个再从头来；
// centered给第一次打开时的README用，放屏幕偏右；
// 屏幕太小就把窗口缩到放得下；history是文件夹窗口的后退记录
function makeWindow(id, kind, target, n, desk, z, centered = false) {
  const [w0, h0] = WIN_SIZE[kind]
  const w = Math.min(w0, desk.w - 16)
  const h = Math.min(h0, desk.h - 16)
  const x = centered ? desk.w - w - Math.min(160, desk.w * 0.1) : 200 + (n % 7) * 28
  const y = centered ? (desk.h - h) / 2 - 20 : 30 + (n % 7) * 28
  return { id, kind, target, history: [], x: clamp(x, 0, desk.w - w), y: clamp(y, 0, desk.h - h), w, h, z, min: false, max: false }
}

// 最上面那个没最小化的窗口；关掉或最小化当前窗口后，焦点交给它；一个都没有就返回null
function topWindowId(windows, exceptId) {
  const open = windows.filter(w => !w.min && w.id !== exceptId).sort((a, b) => b.z - a.z)
  return open.length > 0 ? open[0].id : null
}

// 整个应用的状态都在这；核心是items；
// 每个文件只记parent（在哪）和x/y（在桌面哪个位置）；所有整理操作说白了就是改这两个字段；
// 桌面、文件夹窗口、搜索结果各自从items里筛出要显示的
export default function App() {
  const [saved] = useState(loadState) // 上次的存档；只在第一次渲染时读
  const [desk, setDesk] = useState(measureDesk)
  const [items, setItems] = useState(() => (saved ? saved.items : initialItems(measureDesk())))
  const [settings, setSettings] = useState(() => ({ ...DEFAULT_SETTINGS, ...(saved ? saved.settings : {}) }))
  // 第一次来的访客直接打开README；有存档的就不打扰了
  const [windows, setWindows] = useState(() => (saved ? [] : [makeWindow('w1', 'notepad', 'readme', 0, measureDesk(), 1, true)]))
  // 当前激活的窗口；null就是焦点在桌面上
  const [activeId, setActiveId] = useState(saved ? null : 'w1')
  // 选中了什么；scope是在哪选的，桌面、某个文件夹窗口，或者'search:窗口id'
  const [selection, setSelection] = useState({ scope: 'desktop', ids: [] })
  const [renaming, setRenaming] = useState(null) // { id, host }；正在改哪个文件的名字，在桌面上还是在窗口里
  const [menu, setMenu] = useState(null) // 当前弹出的右键菜单
  const [dialog, setDialog] = useState(null) // 当前的确认对话框
  const [startOpen, setStartOpen] = useState(false)
  const [drag, setDrag] = useState(null) // 正在拖的文件；画幽灵图标、高亮目标都看它
  const [band, setBand] = useState(null) // 框选的矩形
  const [arrangeLabels, setArrangeLabels] = useState([]) // 时间线排列后顶上那排年份
  const [saveError, setSaveError] = useState(null) // 存不进localStorage时是'shown'；访客把提示关了就是'dismissed'

  const deskRef = useRef(null)
  const fileInputRef = useRef(null) // 隐藏的选文件框
  const uploadTarget = useRef({ parent: 'desktop', at: null }) // 选好的图片放哪
  const pendingRef = useRef(null) // 按住了某个图标；动起来才算拖
  const bandRef = useRef(null) // 桌面框选的起点
  const nextWin = useRef(2) // 下一个窗口的编号；w1给了README
  const zTop = useRef(1) // 目前最高的z-index；激活窗口就+1
  const labelTimer = useRef(null) // 年份标签几秒后自动消失

  // 每次渲染现算；文件不多，不用缓存
  const byId = indexBy(items)
  const trashCount = items.filter(it => it.parent === 'trash').length

  // 自动存到localStorage；停手250ms再写，免得记事本每敲一个字就存一次；
  // 访客啥都没动就不存，下次打开按那时的屏幕大小重新排；
  // 存满了（一般是加的图片太多）就弹提示，下次存成功再收起来
  const firstState = useRef({ items, settings })
  useEffect(() => {
    if (items === firstState.current.items && settings === firstState.current.settings) return
    const t = setTimeout(() => {
      if (saveState({ items, settings })) setSaveError(null)
      else setSaveError(e => e || 'shown')
    }, 250)
    return () => clearTimeout(t)
  }, [items, settings])

  // 浏览器窗口大小变了，桌面跟着变
  useEffect(() => {
    const onResize = () => setDesk(measureDesk())
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  /* ---------- 窗口 ---------- */
  // 同一次点击里可能连着开好几个窗口；所以改windows都用 setWindows(ws => ...) 的写法，
  // 每一步都在上一步的结果上改，不会互相覆盖

  // 激活窗口；提到最上面，最小化了就还原
  function focusWindow(id) {
    zTop.current += 1
    const z = zTop.current
    setWindows(ws => ws.map(w => (w.id === id ? { ...w, min: false, z } : w)))
    setActiveId(id)
  }

  // 同一个文件只开一个窗口，搜索窗口全局就一个；已经开着就直接激活
  function openWindow(kind, target) {
    const existing = windows.find(w => w.kind === kind && (kind === 'search' || w.target === target))
    if (existing) {
      focusWindow(existing.id)
      return
    }
    const id = 'w' + nextWin.current
    nextWin.current += 1
    zTop.current += 1
    const win = makeWindow(id, kind, target, nextWin.current, desk, zTop.current)
    setWindows(ws => [...ws, win])
    setActiveId(id)
  }

  // 关窗口；关的是当前窗口就把焦点交给下一个
  function closeWindow(id) {
    setWindows(ws => ws.filter(w => w.id !== id))
    if (activeId === id) setActiveId(topWindowId(windows, id))
  }

  // 最小化；同样把焦点交出去
  function minimizeWindow(id) {
    setWindows(ws => ws.map(w => (w.id === id ? { ...w, min: true } : w)))
    if (activeId === id) setActiveId(topWindowId(windows, id))
  }

  // 改窗口的某几个字段，比如位置、大小
  const patchWindow = (id, patch) => setWindows(ws => ws.map(w => (w.id === id ? { ...w, ...patch } : w)))
  const toggleMax = id => setWindows(ws => ws.map(w => (w.id === id ? { ...w, max: !w.max } : w)))

  // 点任务栏按钮；是当前窗口就最小化，不是就激活
  function taskClick(id) {
    const w = windows.find(x => x.id === id)
    if (!w) return
    if (activeId === id && !w.min) minimizeWindow(id)
    else focusWindow(id)
  }

  // 文件夹窗口里跳到别处；旧位置记进后退记录
  function navigate(winId, target) {
    const w = windows.find(x => x.id === winId)
    if (!w || w.target === target) return
    patchWindow(winId, { target, history: [...w.history, w.target] })
  }

  // 后退；回到记录里的上一个位置
  function back(winId) {
    const w = windows.find(x => x.id === winId)
    if (!w || w.history.length === 0) return
    const last = w.history[w.history.length - 1]
    patchWindow(winId, { target: last, history: w.history.slice(0, -1) })
  }

  // 双击打开；图片进看图窗口，笔记进记事本，文件夹、回收站进文件夹窗口；
  // 在文件夹窗口里双击子文件夹不开新窗口，原地跳过去；搜索结果里双击还是开新窗口
  function open(id, fromScope = null) {
    const item = byId[id]
    if (!item) return
    const isPlace = item.type === 'folder' || item.type === 'bin'
    const target = item.type === 'bin' ? 'trash' : id
    if (isPlace && fromScope && !fromScope.startsWith('search:')) {
      const hosts = windows.filter(w => w.kind === 'explorer' && w.target === fromScope).sort((a, b) => b.z - a.z)
      if (hosts.length > 0) {
        navigate(hosts[0].id, target)
        return
      }
    }
    if (isPlace) openWindow('explorer', target)
    else openWindow(item.type === 'image' ? 'viewer' : 'notepad', id)
  }

  // 下面两个是常用的快捷写法
  const openFolder = target => openWindow('explorer', target)
  const openSearch = () => openWindow('search', null)

  // 看图窗口翻上一张、下一张；只在同一个地方的图片里翻，到头了从另一头接着来
  function stepViewer(winId, d) {
    const w = windows.find(x => x.id === winId)
    const item = w ? byId[w.target] : null
    if (!item) return
    const sibs = viewerSiblings(items, item)
    if (sibs.length < 2) return
    const i = sibs.findIndex(s => s.id === item.id)
    patchWindow(winId, { target: sibs[(i + d + sibs.length) % sibs.length].id })
  }

  // 在看图窗口里删；先翻到下一张，没有下一张就关窗口
  function deleteFromViewer(winId) {
    const w = windows.find(x => x.id === winId)
    const item = w ? byId[w.target] : null
    if (!item) return
    if (viewerSiblings(items, item).length > 1) stepViewer(winId, 1)
    else closeWindow(winId)
    trashItems([item.id])
  }

  // 打开文件所在的文件夹，顺便选中它
  function openContaining(item) {
    openWindow('explorer', item.parent)
    setSelection({ scope: item.parent, ids: [item.id] })
  }

  /* ---------- 文件操作 ---------- */

  // 改某个文件的几个字段，比如名字、笔记内容
  const updateItem = (id, patch) => setItems(its => its.map(it => (it.id === id ? { ...it, ...patch } : it)))
  const select = (scope, ids) => setSelection({ scope, ids })

  // 扔进回收站；parent改成'trash'，prevParent记住原来在哪，还原的时候用；
  // 回收站图标本身扔不掉；扔掉的顺便从选中里去掉，正在改名的也取消
  function trashItems(ids) {
    const toTrash = ids.filter(id => id !== 'bin')
    if (toTrash.length === 0) return
    setItems(its =>
      its.map(it => (toTrash.includes(it.id) && it.parent !== 'trash' ? { ...it, prevParent: it.parent, parent: 'trash' } : it)),
    )
    setSelection(s => ({ ...s, ids: s.ids.filter(id => !toTrash.includes(id)) }))
    setRenaming(null)
  }

  // 从回收站还原；放回prevParent；原来的文件夹也没了，就放回桌面，挑离原位置最近的空格
  function restoreItems(ids) {
    const taken = takenCells(items, desk)
    const plan = {}
    for (const id of ids) {
      const it = byId[id]
      if (!it || it.parent !== 'trash') continue
      const home = it.prevParent
      const homeOk = home === 'desktop' || (home && home !== 'trash' && byId[home] && !isTrashed(byId, home))
      if (homeOk && home !== 'desktop') plan[id] = { parent: home }
      else plan[id] = { parent: 'desktop', ...nearestFreeCell(it.x || 0, it.y || 0, taken, desk) }
    }
    setItems(items.map(it => (plan[it.id] ? { ...it, ...plan[it.id], prevParent: undefined } : it)))
    setSelection({ scope: 'trash', ids: [] })
  }

  // 彻底删除；从items里拿掉，文件夹里的东西一起删；
  // 相关窗口直接关掉；别的窗口后退记录里也去掉这些文件夹，免得后退跳到不存在的地方
  function removeForever(ids) {
    const doomed = items.filter(it => ids.some(id => isDescendant(byId, it.id, id))).map(it => it.id)
    setItems(items.filter(it => !doomed.includes(it.id)))
    setWindows(ws =>
      ws.filter(w => !doomed.includes(w.target)).map(w => ({ ...w, history: w.history.filter(t => !doomed.includes(t)) })),
    )
    setSelection(s => ({ ...s, ids: s.ids.filter(id => !doomed.includes(id)) }))
  }

  // 彻底删除前的确认文字；一个文件就写名字，多个就写数量
  function deleteMessage(ids) {
    const what = ids.length === 1 ? `'${byId[ids[0]].name}'` : `these ${ids.length} items`
    return `Are you sure you want to permanently delete ${what}? This can't be undone.`
  }

  // 先弹确认框，点了才真删
  function deleteForever(ids) {
    setDialog({
      title: 'Confirm File Delete',
      message: deleteMessage(ids),
      confirmLabel: 'Delete',
      onConfirm: () => removeForever(ids),
    })
  }

  // 清空回收站；同样先确认
  function emptyTrash() {
    const ids = items.filter(it => it.parent === 'trash').map(it => it.id)
    if (ids.length === 0) return
    setDialog({
      title: ids.length === 1 ? 'Confirm File Delete' : 'Confirm Multiple File Delete',
      message: deleteMessage(ids),
      confirmLabel: 'Empty Bin',
      onConfirm: () => removeForever(ids),
    })
  }

  // 把一堆文件挪到某个文件夹或桌面；整理最核心的就是这个；
  // 回收站图标跳过；文件夹不能放进它自己或者它的子文件夹；已经在那的也跳过；
  // 挪到桌面的从左上角找空位放
  function moveTo(ids, target) {
    const movable = ids.filter(
      id => id !== 'bin' && byId[id] && byId[id].parent !== target && (target === 'desktop' || !isDescendant(byId, target, id)),
    )
    if (movable.length === 0) return
    const spots = target === 'desktop' ? placeNew(items, movable.length, desk) : []
    setItems(
      items.map(it => {
        const i = movable.indexOf(it.id)
        if (i < 0) return it
        const moved = { ...it, parent: target, prevParent: undefined }
        if (spots[i]) {
          moved.x = spots[i].x
          moved.y = spots[i].y
        }
        return moved
      }),
    )
    setSelection({ scope: target, ids: movable })
  }

  // 新建文件夹或笔记；自动避开重名，在桌面上找空位；
  // 建完直接进入改名状态；openAfter为true就直接打开记事本，开始菜单的New Note用
  function createItem(type, parent = 'desktop', at = null, openAfter = false) {
    const base = type === 'folder' ? 'New Folder' : 'New Text Document.txt'
    // id用时间加随机数；够用了，不会撞
    const item = {
      id: type + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
      type,
      name: uniqueName(items, parent, base),
      parent,
      date: isoDate(),
    }
    if (type === 'note') item.text = ''
    if (parent === 'desktop') {
      const spot = placeNew(items, 1, desk, at)[0]
      item.x = spot.x
      item.y = spot.y
    }
    setItems([...items, item])
    setSelection({ scope: parent, ids: [item.id] })
    if (openAfter) openWindow('notepad', item.id)
    else setRenaming({ id: item.id, host: parent === 'desktop' ? 'desktop' : 'list' })
  }

  // host说明在哪改名；桌面上一个文件和窗口里同一个文件，只让一处出输入框
  const startRename = (id, host = 'list') => setRenaming({ id, host })
  const cancelRename = () => setRenaming(null)

  // 确认改名；去掉文件名里不让用的字符；跟同一个地方的别的文件重名了，自动加(2)、(3)；
  // 改成空的或者没变就当没改
  function commitRename(id, raw) {
    setRenaming(null)
    const item = byId[id]
    const name = raw.replace(/[\\/:*?"<>|]/g, '').trim()
    if (!item || !name || name === item.name) return
    updateItem(id, { name: uniqueName(items.filter(it => it.id !== id), item.parent, name) })
  }

  // 加图片；先压成base64（见lib/images.js），再当成新的图片加进items；
  // 拖到桌面就放在松手的地方附近；拖进文件夹窗口就直接归到那个文件夹；
  // 不是图片的文件直接忽略；读不出来的跳过，不影响别的
  async function addFiles(files, parent, at) {
    const loaded = []
    for (const file of files) {
      if (!file.type.startsWith('image/')) continue
      try {
        const src = await readImageFile(file)
        loaded.push({ file, src })
      } catch (err) {
        console.warn(err)
      }
    }
    if (loaded.length === 0) return
    const spots = parent === 'desktop' ? placeNew(items, loaded.length, desk, at) : []
    const stamp = Date.now().toString(36)
    const added = []
    loaded.forEach((one, i) => {
      const img = {
        id: 'up-' + stamp + '-' + i,
        type: 'image',
        name: uniqueName([...items, ...added], parent, one.file.name),
        parent,
        date: isoDate(one.file.lastModified),
        src: one.src,
        credit: 'you',
      }
      if (spots[i]) {
        img.x = spots[i].x
        img.y = spots[i].y
      }
      added.push(img)
    })
    // 读图要等一会儿，这期间items可能又变了；用 its => 的写法接在最新的后面，不会把别的改动盖掉
    setItems(its => [...its, ...added])
    setSelection({ scope: parent, ids: added.map(it => it.id) })
  }

  // “Add Pictures…”；点一下隐藏的<input type="file">，弹出系统的选文件窗口；
  // 先记住选好的图片放哪，选完在onChange里用
  function pickFiles(parent = 'desktop', at = null) {
    uploadTarget.current = { parent, at }
    fileInputRef.current.click()
  }

  // dragover里必须preventDefault；不然浏览器不让往这放文件
  function fileDragOver(e) {
    if (!hasFiles(e)) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }

  // 从电脑里把图片拖进来；放桌面上就记下松手的位置
  function dropFiles(e, parent) {
    if (!hasFiles(e)) return
    e.preventDefault()
    let at = null
    if (parent === 'desktop' && e.currentTarget === deskRef.current) {
      const r = deskRef.current.getBoundingClientRect()
      at = { x: e.clientX - r.left - ICON_W / 2, y: e.clientY - r.top - 24 }
    }
    addFiles(Array.from(e.dataTransfer.files), parent, at)
  }

  // 自动排桌面；按名字、按类型，或者按日期排成时间线；
  // 时间线是一年一列，顶上显示几秒年份；回收站永远在第一列最上面
  function arrangeDesktop(key) {
    const onDesk = items.filter(it => it.parent === 'desktop')
    const bin = onDesk.filter(it => it.type === 'bin').map(it => it.id)
    const rest = onDesk.filter(it => it.type !== 'bin').sort(compareBy(key))
    const groups = key === 'name' ? [{ label: '', items: rest }] : groupItems(rest, key)
    const { pos, columns } = arrangeLayout([bin, ...groups.map(g => g.items.map(it => it.id))], desk)
    setItems(items.map(it => (pos[it.id] ? { ...it, ...pos[it.id] } : it)))
    setSelection({ scope: 'desktop', ids: [] })
    clearTimeout(labelTimer.current)
    if (key === 'name') {
      setArrangeLabels([])
      return
    }
    // 回收站占了第一列，标签要往后错一列
    const offset = bin.length > 0 ? 1 : 0
    setArrangeLabels(groups.map((g, i) => ({ label: g.label, x: cellToXY(columns[i + offset], 0).x })))
    labelTimer.current = setTimeout(() => setArrangeLabels([]), 4500)
  }

  // 换壁纸；null就是换回自带的
  const setWallpaper = src => setSettings(s => ({ ...s, wallpaper: src }))

  // 重置桌面；全部恢复成刚捡到时的样子；提示气泡不再弹，人家已经看过了
  function resetDesktop() {
    setDialog({
      title: 'Reset Desktop',
      icon: <ResetIcon size={40} />,
      message: 'Put everything back the way it was found? Your folders, names, notes and added pictures will be lost.',
      confirmLabel: 'Reset',
      onConfirm: () => {
        clearState()
        setItems(initialItems(desk))
        setSettings({ ...DEFAULT_SETTINGS, tipDismissed: true })
        setWindows([])
        setActiveId(null)
        setSelection({ scope: 'desktop', ids: [] })
        setRenaming(null)
      },
    })
  }

  /* ---------- 右键菜单 ---------- */

  // 在(x, y)弹出菜单；entries的格式见ContextMenu.jsx
  const openMenu = (x, y, entries) => setMenu({ x, y, entries })

  // 右键文件；它不在选中里就先改成只选它，再弹菜单；在选中里就对整个选中操作
  function itemContextMenu(e, item, scope, variant) {
    e.preventDefault()
    e.stopPropagation()
    const inSelection = selection.scope === scope && selection.ids.includes(item.id)
    const sel = inSelection ? selection.ids : [item.id]
    if (!inSelection) setSelection({ scope, ids: sel })
    const host = variant === 'desktop' ? 'desktop' : 'list'
    openMenu(e.clientX, e.clientY, itemMenu(item, sel, host))
  }

  // 文件的右键菜单；回收站图标、回收站里的文件、普通文件各不一样
  function itemMenu(item, sel, host) {
    if (item.type === 'bin') {
      return [
        { label: 'Open', bold: true, onClick: () => open('bin') },
        '-',
        { label: 'Empty Recycle Bin', disabled: trashCount === 0, onClick: emptyTrash },
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
    const ids = sel.filter(id => id !== 'bin')
    // “Move to”里能选的文件夹；扔掉的不算，选中的文件夹自己和它里面的也不算
    const folders = items
      .filter(f => f.type === 'folder' && !isTrashed(byId, f.id) && !ids.some(id => isDescendant(byId, f.id, id)))
      .sort(compareBy('name'))
    // 全都已经在那了，这一项就变灰
    const allIn = target => ids.every(id => byId[id] && byId[id].parent === target)
    const entries = [
      // 一次最多开6个；免得选了一堆，窗口铺满屏幕
      { label: 'Open', bold: true, onClick: () => sel.slice(0, 6).forEach(id => open(id)) },
    ]
    if (item.type === 'image') entries.push({ label: 'Set as Desktop Background', onClick: () => setWallpaper(item.src) })
    const moveMenu = [{ label: 'Desktop', disabled: allIn('desktop'), onClick: () => moveTo(ids, 'desktop') }]
    if (folders.length > 0) moveMenu.push('-')
    folders.forEach(f => moveMenu.push({ label: f.name, disabled: allIn(f.id), onClick: () => moveTo(ids, f.id) }))
    entries.push(
      '-',
      { label: 'Move to', submenu: moveMenu },
      '-',
      { label: 'Delete', onClick: () => trashItems(ids) },
      { label: 'Rename', disabled: sel.length !== 1, onClick: () => startRename(item.id, host) },
    )
    return entries
  }

  // 桌面空白处的右键菜单；新建的东西放在右键的地方附近
  function desktopContextMenu(e) {
    const r = deskRef.current.getBoundingClientRect()
    const at = { x: e.clientX - r.left - ICON_W / 2, y: e.clientY - r.top - 24 }
    const entries = [
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
    ]
    // 换过壁纸才有“换回原来的”
    if (settings.wallpaper) entries.push({ label: 'Restore Original Wallpaper', onClick: () => setWallpaper(null) })
    entries.push('-', { label: 'Reset Desktop…', onClick: resetDesktop })
    openMenu(e.clientX, e.clientY, entries)
  }

  /* ---------- 鼠标：选择、拖放 ---------- */

  // 拖拽第1步；按下图标；记下可能要拖哪些；
  // 这时候还不算拖，鼠标挪超过5px才算（见onPointerMove）
  function itemPointerDown(e, item, scope) {
    if (e.button !== 0) return
    if (deskRef.current.contains(e.target)) setActiveId(null) // 点了桌面图标，焦点回到桌面
    // 额外功能；按着Ctrl、Cmd、Shift点就是加选、减选
    const additive = e.ctrlKey || e.metaKey || e.shiftKey
    const current = selection.scope === scope ? selection.ids : []
    let ids
    // 点已经选中的不动，方便一起拖；点别的就只选它
    if (additive) {
      ids = current.includes(item.id) ? current.filter(id => id !== item.id) : [...current, item.id]
      setSelection({ scope, ids })
      if (!ids.includes(item.id)) return // 刚取消选中的不能拖
    } else if (current.includes(item.id)) {
      ids = current
    } else {
      ids = [item.id]
      setSelection({ scope, ids })
    }
    // 记下是在哪按的；开始拖时只在这里面找图标，不会找到别的窗口里同一个文件
    const root = e.currentTarget.closest('.desktop, .ex-content') || document
    pendingRef.current = { ids, scope, root, sx: e.clientX, sy: e.clientY, clickedId: item.id, additive, started: false }
  }

  // 在桌面空白处按下；开始框选
  function desktopPointerDown(e) {
    if (e.button !== 0) return
    setActiveId(null)
    // 额外功能；按着Ctrl、Cmd、Shift框选，就在原来选中的基础上加
    const additive = e.ctrlKey || e.metaKey || e.shiftKey
    const base = additive && selection.scope === 'desktop' ? selection.ids : []
    setSelection({ scope: 'desktop', ids: base })
    const r = deskRef.current.getBoundingClientRect()
    bandRef.current = { x0: e.clientX - r.left, y0: e.clientY - r.top, left: r.left, top: r.top, base }
  }

  // 拖拽第3步；找光标底下能放的地方；
  // elementsFromPoint拿到光标下面所有元素，跳过正在拖的图标本身；
  // 返回第一个带data-drop的；桌面、文件夹、回收站、窗口内容区都有
  function dropTargetAt(x, y, p) {
    for (const el of document.elementsFromPoint(x, y)) {
      const itemEl = el.closest('[data-item]')
      if (itemEl && itemEl.dataset.scope === p.scope && p.ids.includes(itemEl.dataset.item)) continue
      const target = el.closest('[data-drop]')
      if (target) return target.dataset.drop
    }
    return null
  }

  // 能不能放这；决定目标高不高亮，松手后真不真挪；
  // 'none'是窗口的边框、标题栏，不接受；桌面在哪都能放，拖到桌面上就是挪位置
  function canDrop(p, over) {
    if (!over || over === 'none') return false
    const movable = p.ids.filter(id => id !== 'bin')
    if (over === 'desktop') return true
    if (over === 'desktop:list') return p.scope !== 'desktop' && movable.length > 0
    if (over === 'trash') return p.scope !== 'trash' && movable.length > 0
    if (over === p.scope) return false
    if (!byId[over] || byId[over].type !== 'folder') return false
    return movable.length > 0 && movable.every(id => !isDescendant(byId, over, id))
  }

  // 拖拽第4步；松手后执行；放回收站就是删，放文件夹就是挪进去；
  // 放桌面就按松手的位置改坐标；开着网格对齐就吸到最近的空格
  function handleDrop(p, over, cx, cy) {
    // 回收站图标只能在桌面上挪位置，别的地方一律不去
    const ids = p.ids.filter(id => byId[id] && (id !== 'bin' || over === 'desktop'))
    if (over === 'trash') {
      trashItems(ids)
      return
    }
    if (over !== 'desktop') {
      moveTo(ids, over === 'desktop:list' ? 'desktop' : over)
      return
    }

    const r = deskRef.current.getBoundingClientRect()
    // 正在拖的那几个原来的格子不算占用
    const taken = settings.alignToGrid ? takenCells(items, desk, ids) : null
    const placed = {}
    for (const id of ids) {
      const g = ghostPos({ ...p, cx, cy }, id)
      if (!g) continue
      let pos = { x: clamp(g.x - r.left, 0, desk.w - ICON_W), y: clamp(g.y - r.top, 0, desk.h - ICON_H) }
      if (taken) pos = nearestFreeCell(pos.x, pos.y, taken, desk)
      placed[id] = pos
    }
    setItems(items.map(it => (placed[it.id] ? { ...it, ...placed[it.id], parent: 'desktop', prevParent: undefined } : it)))
    setSelection({ scope: 'desktop', ids: Object.keys(placed) })
  }

  // 拖拽第2步；鼠标挪动；超过5px才真开始拖，免得把单击当成拖；
  // 之后每挪一下都更新幽灵图标的位置和底下的目标；桌面框选也在这处理
  function onPointerMove(e) {
    const p = pendingRef.current
    if (p) {
      if (!p.started) {
        const dx = e.clientX - p.sx
        const dy = e.clientY - p.sy
        if (dx * dx + dy * dy < 25) return // 没超过5px
        p.started = true
        // 记下每个图标开始拖时在哪；幽灵图标按这个保持相对位置
        p.rects = {}
        for (const id of p.ids) {
          const el = p.root.querySelector(`[data-item="${id}"][data-scope="${p.scope}"]`)
          if (el) p.rects[id] = el.getBoundingClientRect()
        }
        p.anchor = p.rects[p.clickedId] || { left: p.sx, top: p.sy }
        // 抓的是图标的哪个点；拖的时候这个点一直跟着光标
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

    // 框选；算出矩形，跟它有重叠的桌面图标都选上
    const b = bandRef.current
    if (!b) return
    const x1 = e.clientX - b.left
    const y1 = e.clientY - b.top
    const rect = { x: Math.min(b.x0, x1), y: Math.min(b.y0, y1), w: Math.abs(x1 - b.x0), h: Math.abs(y1 - b.y0) }
    if (rect.w < 3 && rect.h < 3) return // 手抖不算
    setBand(rect)
    const hits = items
      .filter(it => {
        if (it.parent !== 'desktop') return false
        const pos = clampPos(it, desk)
        return pos.x < rect.x + rect.w && pos.x + ICON_W > rect.x && pos.y < rect.y + rect.h && pos.y + ICON_H > rect.y
      })
      .map(it => it.id)
    // 原来选中的加上框到的；重复的去掉
    const ids = b.base.concat(hits.filter(id => !b.base.includes(id)))
    setSelection({ scope: 'desktop', ids })
  }

  // 松手；结束拖拽或者框选；
  // 没拖只是单击了已经多选中的某一个，就改成只选它
  function onPointerUp(e) {
    const p = pendingRef.current
    pendingRef.current = null
    if (p && p.started) {
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

  // 点到菜单外面就把右键菜单、开始菜单都关了
  function onGlobalPointerDown(e) {
    if (!e.target.closest('.ctx-menu')) setMenu(null)
    if (!e.target.closest('.start-menu, .start-button')) setStartOpen(false)
  }

  // 额外功能；快捷键；
  // Esc关菜单、对话框，F3或Ctrl+F搜索，Ctrl+A全选；
  // Delete删除，在回收站里就是彻底删；F2改名，Enter打开，看图时左右键翻页；
  // 焦点在输入框里不管，免得影响打字；有对话框时也不管
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
    if (tag === 'BUTTON' && (e.key === 'Enter' || e.key === ' ')) return // 让按钮自己处理回车、空格
    const mod = e.metaKey || e.ctrlKey
    const key = e.key
    if (key === 'F3' || (mod && key.toLowerCase() === 'f')) {
      e.preventDefault()
      openSearch()
      return
    }
    const active = windows.find(w => w.id === activeId && !w.min)
    if (active && active.kind === 'viewer' && (key === 'ArrowLeft' || key === 'ArrowRight')) {
      e.preventDefault()
      stepViewer(active.id, key === 'ArrowLeft' ? -1 : 1)
      return
    }
    const scope = selection.scope
    if (mod && key.toLowerCase() === 'a') {
      if (scope.startsWith('search:')) return // 搜索结果不让全选
      e.preventDefault()
      setSelection({ scope, ids: items.filter(it => it.parent === scope).map(it => it.id) })
      return
    }
    // 选中里可能有已经删掉的；先过滤一下
    const live = selection.ids.filter(id => byId[id])
    if (live.length === 0) return
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

  // 全局监听；不写依赖，每次渲染都重新绑一遍；这样调到的永远是最新的函数，读到的是最新的state
  useEffect(() => {
    // 文件拖到不接受的地方；拦住，不然浏览器会直接打开这个文件，页面就没了
    function stopFileDrop(e) {
      if (hasFiles(e)) e.preventDefault()
    }
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('pointerdown', onGlobalPointerDown)
    window.addEventListener('keydown', onKeyDown) // 额外功能；快捷键
    window.addEventListener('dragover', stopFileDrop)
    window.addEventListener('drop', stopFileDrop)
    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointerdown', onGlobalPointerDown)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('dragover', stopFileDrop)
      window.removeEventListener('drop', stopFileDrop)
    }
  })

  /* ---------- 渲染 ---------- */

  // 窗口标题、图标；标题栏、任务栏都用；返回null说明窗口对应的文件已经没了，不画
  function windowInfo(w) {
    if (w.kind === 'search') return { title: 'Search Results', icon: <SearchIcon size={16} /> }
    if (w.kind === 'explorer') {
      if (w.target === 'desktop') return { title: 'Desktop', icon: <DesktopIcon size={16} /> }
      if (w.target === 'trash') return { title: 'Recycle Bin', icon: <BinIcon size={16} full={trashCount > 0} /> }
      if (!byId[w.target]) return null
      return { title: byId[w.target].name, icon: <FolderIcon size={16} open /> }
    }
    const it = byId[w.target]
    if (!it) return null
    if (w.kind === 'viewer') return { title: it.name + ' - Picture Viewer', icon: <PictureIcon size={16} /> }
    return { title: it.name + ' - Notepad', icon: <NoteIcon size={16} /> }
  }
  // { 窗口id: 标题和图标 }
  const titles = {}
  windows.forEach(w => {
    titles[w.id] = windowInfo(w)
  })

  // 拖的时候光标旁边的提示，比如“Move to My Pictures”；
  // 在原地挪、放回原处就不提示
  function dragHint(d) {
    if (!d) return null
    const over = d.over
    const scope = d.scope
    if (!d.valid) {
      if (over && over !== 'desktop' && over !== 'none' && over !== scope) return "Can't move here"
      return null
    }
    if (over === 'trash') return 'Move to Recycle Bin'
    if (over === 'desktop' || over === 'desktop:list') {
      if (scope === 'desktop') return null
      return scope === 'trash' ? 'Restore to Desktop' : 'Move to Desktop'
    }
    return 'Move to ' + byId[over].name
  }

  // 所有操作都放进api；通过Context交给各个组件调
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
    showTip: () => setSettings(s => ({ ...s, tipDismissed: false })),
  }

  // 右下角的提示气泡；保存失败的警告比新手提示优先
  let balloon = null
  if (saveError === 'shown') {
    balloon = {
      title: "Your changes aren't being saved",
      text: "The browser's storage is full, probably because of added pictures. Delete a few of them and empty the Recycle Bin to keep saving.",
      onClose: () => setSaveError('dismissed'),
    }
  } else if (!settings.tipDismissed) {
    balloon = {
      title: 'Someone left their desktop behind',
      text: 'Drag files into folders or into piles. Double-click to open, right-click for more. Drop your own pictures anywhere on the screen.',
      onClose: () => setSettings(s => ({ ...s, tipDismissed: true })),
    }
  }

  // 塞进Context的全部东西
  const ctx = { items, byId, settings, selection, renaming, drag, band, desk, trashCount, arrangeLabels, api }

  return (
    <DeskContext.Provider value={ctx}>
      {/* 整个屏幕都屏蔽浏览器自己的右键菜单；输入框除外，方便复制粘贴 */}
      <div className="screen" onContextMenu={e => !e.target.closest('input, textarea') && e.preventDefault()}>
        <Desktop deskRef={deskRef} />

        {/* 所有窗口；对应的文件没了的不画 */}
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

        {balloon && (
          <div className="balloon">
            <button className="balloon-x" onClick={balloon.onClose}>
              ×
            </button>
            <b>
              <InfoIcon /> {balloon.title}
            </b>
            <p>{balloon.text}</p>
          </div>
        )}

        <ContextMenu menu={menu} onClose={() => setMenu(null)} />
        <DragGhost hint={dragHint(drag)} />

        {/* 确认对话框；盖住整个屏幕，点完才能干别的；
            额外功能；确认按钮自动聚焦，直接按回车就是确认 */}
        {dialog && (
          <div className="modal-backdrop">
            <section className="window active dialog">
              <header className="titlebar">
                <span className="title-text">{dialog.title}</span>
                <div className="title-buttons">
                  <button className="tb-close" onClick={() => setDialog(null)} />
                </div>
              </header>
              <div className="window-body dialog-body">
                <div className="dialog-msg">
                  {dialog.icon || <BinIcon size={40} full />}
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

        {/* 隐藏的选文件框；选完清空value，同一张图还能再选一次 */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={e => {
            addFiles(Array.from(e.target.files), uploadTarget.current.parent, uploadTarget.current.at)
            e.target.value = ''
          }}
        />
      </div>
    </DeskContext.Provider>
  )
}
