import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { GoogleOAuthProvider } from '@react-oauth/google'
import { ThemeProvider } from './context/ThemeContext' // Import this

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <GoogleOAuthProvider clientId="293017598453-67m9kq9mcqamtlmvodi7i2uiod4h9141.apps.googleusercontent.com">
      <ThemeProvider> {/* Wrap App */}
        <App />
      </ThemeProvider>
    </GoogleOAuthProvider>
  </StrictMode>,
)