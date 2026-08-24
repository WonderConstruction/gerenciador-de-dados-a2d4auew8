import React, { createContext, useContext, useEffect, useState } from 'react'
import pb from '@/lib/pocketbase/client'
import { RecordModel } from 'pocketbase'

interface AuthContextType {
  user: RecordModel | null
  token: string | null
  isLoading: boolean
  login: (email: string, pass: string) => Promise<void>
  loginAsDemo: () => Promise<void>
  logout: () => void
  register: (name: string, email: string, pass: string) => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<RecordModel | null>(pb.authStore.record)
  const [token, setToken] = useState<string | null>(pb.authStore.token)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Initial check
    setUser(pb.authStore.record)
    setToken(pb.authStore.token)
    setIsLoading(false)

    // Subscribe to auth state changes
    const unsubscribe = pb.authStore.onChange((newToken, newModel) => {
      setToken(newToken)
      setUser(newModel)
    })

    return () => {
      unsubscribe()
    }
  }, [])

  const login = async (email: string, pass: string) => {
    await pb.collection('users').authWithPassword(email, pass)
  }

  const loginAsDemo = async () => {
    try {
      await pb.collection('users').authWithPassword('obrunolimaus@gmail.com', 'Skip@Pass')
    } catch {
      // If auth fails for any reason, create or retry
      try {
        await pb.collection('users').create({
          email: 'obrunolimaus@gmail.com',
          password: 'Skip@Pass',
          passwordConfirm: 'Skip@Pass',
          name: 'Bruno Lima',
        })
        await pb.collection('users').authWithPassword('obrunolimaus@gmail.com', 'Skip@Pass')
      } catch (err) {
        console.error('Demo login fallback error:', err)
      }
    }
  }

  const register = async (name: string, email: string, pass: string) => {
    await pb.collection('users').create({
      name,
      email,
      password: pass,
      passwordConfirm: pass,
    })
    await pb.collection('users').authWithPassword(email, pass)
  }

  const logout = () => {
    pb.authStore.clear()
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        login,
        loginAsDemo,
        logout,
        register,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
