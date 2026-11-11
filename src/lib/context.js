import { createContext, useContext } from 'react'

// 全局状态、操作都走Context；省得props一层层往下传
// 里面有什么看App.jsx里的ctx；items、选中、拖拽状态，还有api里的所有操作
export const DeskContext = createContext(null)
// 组件里直接useDesk()拿
export const useDesk = () => useContext(DeskContext)
