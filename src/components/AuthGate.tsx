import { useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { LockKeyhole } from 'lucide-react'
import { toast } from 'sonner'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { Button, Field, Input } from './ui'

export function AuthGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [checking, setChecking] = useState(isSupabaseConfigured)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  useEffect(() => {
    if (!supabase) return
    void supabase.auth.getSession().then(({ data }) => { setSession(data.session); setChecking(false) })
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next))
    return () => data.subscription.unsubscribe()
  }, [])

  if (!isSupabaseConfigured) return children
  if (checking) return <div className="auth-screen"><div className="auth-loader" /></div>
  if (session) return children

  async function login(event: React.FormEvent) {
    event.preventDefault()
    const { error } = await supabase!.auth.signInWithPassword({ email, password })
    if (error) toast.error(error.message)
  }

  return <div className="auth-screen"><div className="auth-brand"><img className="auth-logo" src="/rdr-logo-horizontal.png" alt="EP Rutas de Riobamba" /><p>Empresa Pública de Movilidad</p><h1>Gestión que se mueve<br />con información clara.</h1><span>Dashboard gerencial institucional · Riobamba</span></div><form className="auth-card" onSubmit={login}><div className="auth-lock"><LockKeyhole /></div><p className="eyebrow">Acceso seguro</p><h2>Bienvenido</h2><p>Ingresa con tu cuenta institucional para continuar.</p><Field label="Correo electrónico"><Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></Field><Field label="Contraseña"><Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required /></Field><Button type="submit">Iniciar sesión</Button><small>El acceso y las acciones se registran según tu rol.</small></form></div>
}
