'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'

import { getBrowserClient } from '@/lib/supabase'

interface AuthContextValue {
  user: User | null
  session: Session | null
  loading: boolean
  signOut: () => Promise<void>
  /** 当前访问令牌：调用需身份的 API 时放进 Authorization Bearer 头 */
  getAccessToken: () => Promise<string | null>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let supabase
    try {
      supabase = getBrowserClient()
    } catch {
      // 未配置 Supabase 环境变量：认证不可用，但页面仍可浏览
      setLoading(false)
      return
    }

    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setUser(data.session?.user ?? null)
      setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setUser(nextSession?.user ?? null)
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  const signOut = async () => {
    try {
      await getBrowserClient().auth.signOut()
    } catch {
      // 忽略登出网络错误，本地状态照常清空
    }
    setUser(null)
    setSession(null)
  }

  const getAccessToken = async (): Promise<string | null> => {
    try {
      const { data } = await getBrowserClient().auth.getSession()
      return data.session?.access_token ?? null
    } catch {
      return null
    }
  }

  return (
    <AuthContext.Provider value={{ user, session, loading, signOut, getAccessToken }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth 必须在 AuthProvider 内使用')
  return context
}
