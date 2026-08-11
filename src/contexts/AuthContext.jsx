import { createContext, useContext, useEffect, useState } from 'react'
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  signOut 
} from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '../lib/firebase'

const AuthContext = createContext()

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null)
  const [userRole, setUserRole] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Fetch user role from Firestore
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid))
          if (userDoc.exists()) {
            const userData = userDoc.data()
            setCurrentUser({ ...user, ...userData })
            setUserRole(userData.role)
          } else {
            console.warn('User document not found in Firestore for uid:', user.uid)
            setCurrentUser(user)
            setUserRole(null)
          }
        } catch (error) {
          console.error('Error fetching user data:', error)
          setCurrentUser(user)
          setUserRole(null)
        }
      } else {
        setCurrentUser(null)
        setUserRole(null)
      }
      setLoading(false)
    })

    return unsubscribe
  }, [])

  async function login(email, password) {
    const userCredential = await signInWithEmailAndPassword(auth, email, password)
    return userCredential
  }

  async function logout() {
    await signOut(auth)
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
