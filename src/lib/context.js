import { createContext, useContext } from 'react'

export const DeskContext = createContext(null)
export const useDesk = () => useContext(DeskContext)
