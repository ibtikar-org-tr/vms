import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import App from './App'
import { AuthProvider } from './contexts/AuthContext'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <AuthProvider>
        <App />
        <Toaster
          position="top-center"
          toastOptions={{
            className: 'text-sm font-medium',
            style: {
              borderRadius: '0.375rem',
              border: '1px solid #d8dee6',
              boxShadow: '0 1px 0 rgba(21, 32, 43, 0.04)',
            },
          }}
        />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
