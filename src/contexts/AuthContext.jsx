import { createContext, useContext, useState } from 'react'

const AuthContext = createContext()

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}

export function AuthProvider({ children }) {
  // Mocked state for phase 1
  const [currentUser, setCurrentUser] = useState({ uid: 'mock-admin', email: 'admin@example.com' })
  const [userRole, setUserRole] = useState('admin')
  const [loading, setLoading] = useState(false)

  async function login(email, password) {
    console.log('Mock login:', email)
    setCurrentUser({ uid: 'mock-admin', email })
    setUserRole('admin')
    return { user: { uid: 'mock-admin', email } }
  }

  async function logout() {
    console.log('Mock logout')
    setCurrentUser(null)
    setUserRole(null)
  }

  const value = {
    currentUser,
    userRole,
    login,
    logout,
    loading
  }

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  )
}
