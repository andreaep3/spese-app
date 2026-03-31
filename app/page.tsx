'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Spesa = {
  id: string
  data: string
  cosa: string
  quanto: number
  pagato: boolean
}

type Ruolo = 'admin' | 'viewer' | null

export default function Home() {
  const [spese, setSpese] = useState<Spesa[]>([])
  const [errore, setErrore] = useState('')

  const [authLoading, setAuthLoading] = useState(true)
  const [roleLoading, setRoleLoading] = useState(false)
  const [caricamentoSpese, setCaricamentoSpese] = useState(false)

  const [userId, setUserId] = useState<string | null>(null)
  const [emailUtente, setEmailUtente] = useState('')
  const [ruolo, setRuolo] = useState<Ruolo>(null)

  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')

  const [data, setData] = useState(new Date().toISOString().split('T')[0])
  const [cosa, setCosa] = useState('')
  const [quanto, setQuanto] = useState('')

  useEffect(() => {
    bootstrap()

    const { data: { subscription } } =
      supabase.auth.onAuthStateChange(async (_event, session) => {
        if (session?.user) {
          await inizializzaUtente(session.user.id, session.user.email || '')
        } else {
          resetUtente()
        }
      })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  async function bootstrap() {
    const { data: { session } } = await supabase.auth.getSession()

    if (session?.user) {
      await inizializzaUtente(session.user.id, session.user.email || '')
    }

    setAuthLoading(false)
  }

  function resetUtente() {
    setUserId(null)
    setEmailUtente('')
    setRuolo(null)
    setSpese([])
  }

  async function inizializzaUtente(id: string, email: string) {
    setUserId(id)
    setEmailUtente(email)

    const ruoloLetto = await caricaRuolo(id)

    if (!ruoloLetto) return

    await caricaSpese()
  }

  // 🔥 QUI IL DEBUG
  async function caricaRuolo(id: string): Promise<Ruolo> {
    try {
      setRoleLoading(true)

      console.log('USER ID:', id)

      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', id)
        .single()

      console.log('DATA:', data)
      console.log('ERROR:', error)

      if (error) {
        setErrore('Errore lettura ruolo')

        // 🔥 TEST: forza admin
        setRuolo('admin')

        return 'admin'
      }

      setRuolo(data.role)
      return data.role
    } catch (err) {
      console.error('ERRORE GRAVE:', err)
      setRuolo(null)
      return null
    } finally {
      setRoleLoading(false)
    }
  }

  async function caricaSpese() {
    setCaricamentoSpese(true)

    const { data, error } = await supabase
      .from('spese')
      .select('*')
      .order('data', { ascending: false })

    if (!error) {
      setSpese(data || [])
    }

    setCaricamentoSpese(false)
  }

  async function login(e: FormEvent) {
    e.preventDefault()

    await supabase.auth.signInWithPassword({
      email: loginEmail,
      password: loginPassword,
    })
  }

  // 🔥 LOGOUT SICURO
  async function logout() {
    await supabase.auth.signOut()
    window.location.reload()
  }

  async function aggiungiSpesa(e: FormEvent) {
    e.preventDefault()

    if (ruolo !== 'admin') return

    await supabase.from('spese').insert([
      {
        data,
        cosa,
        quanto: Number(quanto),
        pagato: false,
      },
    ])

    await caricaSpese()
  }

  if (authLoading || (userId && roleLoading)) {
    return <div style={{ padding: 40 }}>Caricamento...</div>
  }

  if (!userId) {
    return (
      <form onSubmit={login} style={{ padding: 40 }}>
        <input
          placeholder="email"
          value={loginEmail}
          onChange={(e) => setLoginEmail(e.target.value)}
        />
        <input
          placeholder="password"
          type="password"
          value={loginPassword}
          onChange={(e) => setLoginPassword(e.target.value)}
        />
        <button>Login</button>
      </form>
    )
  }

  return (
    <div style={{ padding: 40 }}>
      <h1>App spese</h1>

      <p>
        {emailUtente} - ruolo: {ruolo}
      </p>

      <button onClick={logout}>Esci</button>

      {ruolo === 'admin' && (
        <form onSubmit={aggiungiSpesa}>
          <input value={cosa} onChange={(e) => setCosa(e.target.value)} />
          <input value={quanto} onChange={(e) => setQuanto(e.target.value)} />
          <button>Aggiungi</button>
        </form>
      )}

      <ul>
        {spese.map((s) => (
          <li key={s.id}>
            {s.cosa} - {s.quanto}
          </li>
        ))}
      </ul>
    </div>
  )
}