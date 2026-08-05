import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import App from './App'
import { AuthProvider } from '@/context/AuthContext'
import { ThemeProvider } from '@/context/ThemeContext'
import './index.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <App />
          <Toaster
            position="top-right"
            toastOptions={{
              // Toasts inherit the warm palette rather than the library default.
              style: {
                background: 'var(--color-surface)',
                color: 'var(--color-ink)',
                border: '1px solid var(--color-line)',
                borderRadius: 'var(--radius-inner)',
                fontSize: '0.875rem',
                boxShadow: 'var(--shadow-pop)',
              },
              success: { iconTheme: { primary: 'var(--color-sage)', secondary: 'var(--color-surface)' } },
              error: { iconTheme: { primary: 'var(--color-rose)', secondary: 'var(--color-surface)' } },
            }}
          />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  </StrictMode>,
)
