import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { authApi } from '../api/client'

const AuthContext = createContext()

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(() => localStorage.getItem('pomegranate_token') || '')
  const [loading, setLoading] = useState(true)

  const logout = useCallback(() => {
    localStorage.removeItem('pomegranate_token')
    setToken('')
    setUser(null)
  }, [])

  useEffect(() => {
    if (!token) {
      setUser(null)
      setLoading(false)
      return
    }

    authApi.getMe()
      .then(({ data }) => {
        setUser(data.user)
      })
      .catch(() => {
        logout()
      })
      .finally(() => {
        setLoading(false)
      })
  }, [token, logout])

  const login = async (email, password) => {
    const { data } = await authApi.login({ email, password })
    localStorage.setItem('pomegranate_token', data.token)
    setToken(data.token)
    setUser(data.user)
    return data
  }

  const register = async (name, email, password) => {
    const { data } = await authApi.register({ name, email, password })
    localStorage.setItem('pomegranate_token', data.token)
    setToken(data.token)
    setUser(data.user)
    return data
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout }}>
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
