import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './styles.css'

// 入口；把整个桌面挂到index.html的#root上
createRoot(document.getElementById('root')).render(<App />)
