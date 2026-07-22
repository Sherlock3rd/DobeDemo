import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'

const rootNode = document.getElementById('root')

if (!rootNode) {
  throw new Error('无法启动工业城市 Demo：缺少 #root 挂载节点。')
}

createRoot(rootNode).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
