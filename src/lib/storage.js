// 整理结果存在访客自己的浏览器里；刷新也还在
// key带版本号；以后数据格式大改就换个key，旧数据直接不认
const KEY = 'found-desktop:v1'

// 读存档；没有、或者坏了就当没有
export function loadState() {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? JSON.parse(raw) : null
  } catch (e) {
    return null
  }
}

// 写存档；存满了、被禁用了就返回false，让App弹提示
export function saveState(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
    return true
  } catch (e) {
    return false
  }
}

// 重置桌面时清掉存档
export function clearState() {
  localStorage.removeItem(KEY)
}
