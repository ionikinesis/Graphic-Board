import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'

const isBoard = new URLSearchParams(window.location.search).has('board')

async function mount() {
  const root = ReactDOM.createRoot(document.getElementById('root'))
  if (isBoard) {
    const { default: BoardView } = await import('./BoardView.jsx')
    root.render(<BoardView />)
  } else {
    const { default: App } = await import('./App.jsx')
    root.render(<React.StrictMode><App /></React.StrictMode>)
  }
}

mount()
