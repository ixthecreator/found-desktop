// 桌面图标网格。位置按像素存储，网格只用来对齐和找空位。
export const CELL_W = 90
export const CELL_H = 88
export const PAD = 8
export const ICON_W = 84
export const ICON_H = 76

const rowsFor = desk => Math.max(1, Math.floor((desk.h - PAD) / CELL_H))
const colsFor = desk => Math.max(1, Math.floor((desk.w - PAD) / CELL_W))
const key = c => `${c.col},${c.row}`

export const cellToXY = (col, row) => ({ x: PAD + col * CELL_W, y: PAD + row * CELL_H })
const xyToCell = (x, y) => ({
  col: Math.max(0, Math.round((x - PAD) / CELL_W)),
  row: Math.max(0, Math.round((y - PAD) / CELL_H)),
})

// 浏览器窗口变小时，把图标限制在可见范围内（只影响显示，不改存储的坐标）。
export function clampPos(item, desk) {
  return {
    x: Math.max(0, Math.min(item.x ?? 0, desk.w - ICON_W)),
    y: Math.max(0, Math.min(item.y ?? 0, desk.h - ICON_H)),
  }
}

// 按列从上往下排图标；每一组（比如每一年）从新的一列开始。时间线排列就靠它。
export function arrangeLayout(groups, desk) {
  const rows = rowsFor(desk)
  const pos = {}
  const columns = []
  let col = 0
  for (const ids of groups) {
    if (!ids.length) continue
    columns.push(col)
    ids.forEach((id, i) => {
      pos[id] = cellToXY(col + Math.floor(i / rows), i % rows)
    })
    col += Math.ceil(ids.length / rows)
  }
  return { pos, columns }
}

export function takenCells(items, desk, exclude = new Set()) {
  const taken = new Set()
  for (const it of items) {
    if (it.parent !== 'desktop' || exclude.has(it.id)) continue
    const p = clampPos(it, desk)
    taken.add(key(xyToCell(p.x, p.y)))
  }
  return taken
}

// 找离 (x, y) 最近的空格子：从中心一圈一圈往外找。
// 找到后标记为已占用，这样一次放好几个文件也不会重叠。
export function nearestFreeCell(x, y, taken, desk) {
  const rows = rowsFor(desk)
  const cols = colsFor(desk)
  const start = xyToCell(x, y)
  start.row = Math.min(start.row, rows - 1)
  start.col = Math.min(start.col, cols - 1)
  for (let r = 0; r < Math.max(rows, cols); r++) {
    const ring = []
    for (let dc = -r; dc <= r; dc++) {
      for (let dr = -r; dr <= r; dr++) {
        if (Math.max(Math.abs(dc), Math.abs(dr)) !== r) continue
        const c = { col: start.col + dc, row: start.row + dr }
        if (c.col < 0 || c.row < 0 || c.row >= rows || c.col >= cols) continue
        ring.push({ ...c, d: dc * dc + dr * dr })
      }
    }
    ring.sort((a, b) => a.d - b.d)
    const free = ring.find(c => !taken.has(key(c)))
    if (free) {
      taken.add(key(free))
      return cellToXY(free.col, free.row)
    }
  }
  return cellToXY(start.col, start.row)
}

// 从左上角开始按列往下找第一个空格子。
function firstFreeCell(taken, desk) {
  const rows = rowsFor(desk)
  const cols = colsFor(desk)
  for (let col = 0; col < cols; col++) {
    for (let row = 0; row < rows; row++) {
      const c = { col, row }
      if (!taken.has(key(c))) {
        taken.add(key(c))
        return cellToXY(col, row)
      }
    }
  }
  return cellToXY(cols - 1, rows - 1)
}

// 给新建或上传的文件找位置：指定了 at 就放在它附近，否则从左上角找第一个空位。
export function placeNew(items, count, desk, at = null) {
  const taken = takenCells(items, desk)
  return Array.from({ length: count }, () =>
    at ? nearestFreeCell(at.x, at.y, taken, desk) : firstFreeCell(taken, desk),
  )
}
