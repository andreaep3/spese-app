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

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        await inizializzaUtente(session.user.id, session.user.email || '')
      } else {
        resetUtente()
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function bootstrap() {
    const {
      data: { session },
    } = await supabase.auth.getSession()

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

  async function caricaRuolo(id: string): Promise<Ruolo> {
    try {
      setRoleLoading(true)

      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', id)
        .single()

      if (error) {
        console.error(error)
        setErrore('Errore lettura ruolo')
        setRuolo(null)
        return null
      }

      const ruoloDb = data?.role as Ruolo

      if (ruoloDb !== 'admin' && ruoloDb !== 'viewer') {
        setErrore('Ruolo non valido')
        setRuolo(null)
        return null
      }

      setRuolo(ruoloDb)
      return ruoloDb
    } catch (err) {
      console.error(err)
      setRuolo(null)
      return null
    } finally {
      setRoleLoading(false)
    }
  }

  async function caricaSpese() {
    const { data, error } = await supabase
      .from('spese')
      .select('*')
      .order('data', { ascending: false })

    if (!error) setSpese(data || [])
  }

  async function login(e: FormEvent) {
    e.preventDefault()

    await supabase.auth.signInWithPassword({
      email: loginEmail,
      password: loginPassword,
    })
  }

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

    setCosa('')
    setQuanto('')

    await caricaSpese()
  }

  const totale = useMemo(
    () => spese.filter((s) => !s.pagato).reduce((a, b) => a + b.quanto, 0),
    [spese]
  )

  // ✅ FIX BLOCCO LOADING
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

      <h2>Totale da pagare: {totale} €</h2>

      {ruolo === 'admin' && (
        <form onSubmit={aggiungiSpesa}>
          <input
            value={cosa}
            onChange={(e) => setCosa(e.target.value)}
            placeholder="Cosa"
          />
          <input
            value={quanto}
            onChange={(e) => setQuanto(e.target.value)}
            placeholder="Quanto"
          />
          <button>Aggiungi</button>
        </form>
      )}

      <ul>
        {spese.map((s) => (
          <li key={s.id}>
            {s.cosa} - {s.quanto}€
          </li>
        ))}
      </ul>
    </div>
  )
}