// 桌面图标网格；位置按像素存，网格只管对齐和找空位
export const CELL_W = 90 // 一格多宽
export const CELL_H = 88 // 一格多高
export const PAD = 8 // 桌面边上留白
export const ICON_W = 84 // 图标本身多宽
export const ICON_H = 76 // 图标本身多高，连文字一起算

// 桌面能放几行、几列；再小也至少一行一列
const rowsFor = desk => Math.max(1, Math.floor((desk.h - PAD) / CELL_H))
const colsFor = desk => Math.max(1, Math.floor((desk.w - PAD) / CELL_W))
// 格子的key；当成对象的键，查有没有被占
const key = c => `${c.col},${c.row}`

// 格子转像素
export const cellToXY = (col, row) => ({ x: PAD + col * CELL_W, y: PAD + row * CELL_H })
// 像素转格子；四舍五入到最近的一格
const xyToCell = (x, y) => ({
  col: Math.max(0, Math.round((x - PAD) / CELL_W)),
  row: Math.max(0, Math.round((y - PAD) / CELL_H)),
})

// 浏览器变小时把图标拉回屏幕里；只管显示，不改存的坐标
export function clampPos(item, desk) {
  return {
    x: Math.max(0, Math.min(item.x || 0, desk.w - ICON_W)),
    y: Math.max(0, Math.min(item.y || 0, desk.h - ICON_H)),
  }
}

// 按列从上往下排；每组另起一列，比如一年一列；时间线排列就靠它
// 返回每个图标的位置，外加每组从第几列开始，用来摆年份标签
export function arrangeLayout(groups, desk) {
  const rows = rowsFor(desk)
  const pos = {}
  const columns = []
  let col = 0
  for (const ids of groups) {
    if (!ids.length) continue // 空组不占列
    columns.push(col)
    ids.forEach((id, i) => {
      pos[id] = cellToXY(col + Math.floor(i / rows), i % rows)
    })
    col += Math.ceil(ids.length / rows) // 一列放不下就往右接着放
  }
  return { pos, columns }
}

// 桌面上哪些格子被占了；返回{ key: true }；exclude里的不算，比如正在拖的那几个
export function takenCells(items, desk, exclude = []) {
  const taken = {}
  for (const it of items) {
    if (it.parent !== 'desktop' || exclude.includes(it.id)) continue
    const p = clampPos(it, desk)
    taken[key(xyToCell(p.x, p.y))] = true
  }
  return taken
}

// 找离(x, y)最近的空格；从起点一圈圈往外找；
// 找到就标成已占，一次放好几个也不会叠在一起
export function nearestFreeCell(x, y, taken, desk) {
  const rows = rowsFor(desk)
  const cols = colsFor(desk)
  const start = xyToCell(x, y)
  // 起点在桌面外面就先拉回来
  start.row = Math.min(start.row, rows - 1)
  start.col = Math.min(start.col, cols - 1)
  for (let r = 0; r < Math.max(rows, cols); r++) {
    const ring = []
    for (let dc = -r; dc <= r; dc++) {
      for (let dr = -r; dr <= r; dr++) {
        if (Math.max(Math.abs(dc), Math.abs(dr)) !== r) continue // 只要这一圈的边，里面的上一轮看过了
        const c = { col: start.col + dc, row: start.row + dr }
        if (c.col < 0 || c.row < 0 || c.row >= rows || c.col >= cols) continue
        ring.push({ ...c, d: dc * dc + dr * dr })
      }
    }
    // 同一圈里离起点近的优先
    ring.sort((a, b) => a.d - b.d)
    const free = ring.find(c => !taken[key(c)])
    if (free) {
      taken[key(free)] = true
      return cellToXY(free.col, free.row)
    }
  }
  // 整个桌面都满了；只能叠在起点上
  return cellToXY(start.col, start.row)
}

// 从左上角按列往下找第一个空格
function firstFreeCell(taken, desk) {
  const rows = rowsFor(desk)
  const cols = colsFor(desk)
  for (let col = 0; col < cols; col++) {
    for (let row = 0; row < rows; row++) {
      const c = { col, row }
      if (!taken[key(c)]) {
        taken[key(c)] = true
        return cellToXY(col, row)
      }
    }
  }
  // 满了就放右下角
  return cellToXY(cols - 1, rows - 1)
}

// 给新建、上传的文件找位置；给了at就放它附近，不然从左上角找第一个空位
export function placeNew(items, count, desk, at = null) {
  const taken = takenCells(items, desk)
  const spots = []
  for (let i = 0; i < count; i++) {
    spots.push(at ? nearestFreeCell(at.x, at.y, taken, desk) : firstFreeCell(taken, desk))
  }
  return spots
}
