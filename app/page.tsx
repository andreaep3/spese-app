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
  const [caricamento, setCaricamento] = useState(false)

  const [userId, setUserId] = useState<string | null>(null)
  const [emailUtente, setEmailUtente] = useState('')
  const [ruolo, setRuolo] = useState<Ruolo>(null)

  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')

  const [data, setData] = useState(new Date().toISOString().split('T')[0])
  const [cosa, setCosa] = useState('')
  const [quanto, setQuanto] = useState('')
  const [meseFiltro, setMeseFiltro] = useState('tutti')
  const [ricerca, setRicerca] = useState('')

  useEffect(() => {
    init()

    const { data: { subscription } } =
      supabase.auth.onAuthStateChange(async (_event, session) => {
        if (session?.user) {
          await inizializzaUtente(session.user.id, session.user.email || '')
        } else {
          reset()
        }
      })

    return () => subscription.unsubscribe()
  }, [])

  async function init() {
    const { data: { session } } = await supabase.auth.getSession()

    if (session?.user) {
      await inizializzaUtente(session.user.id, session.user.email || '')
    }

    setAuthLoading(false)
  }

  function reset() {
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
        setErrore('Errore ruolo')
        return null
      }

      setRuolo(data.role)
      return data.role
    } finally {
      setRoleLoading(false)
    }
  }

  async function caricaSpese() {
    setCaricamento(true)

    const { data, error } = await supabase
      .from('spese')
      .select('*')
      .order('data', { ascending: false })

    if (!error) setSpese(data || [])
    setCaricamento(false)
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

    const { data: nuova, error } = await supabase
      .from('spese')
      .insert([
        {
          data,
          cosa,
          quanto: Number(quanto),
          pagato: false,
        },
      ])
      .select()
      .single()

    if (!error) setSpese((p) => [nuova, ...p])

    setCosa('')
    setQuanto('')
  }

  async function cambiaPagato(id: string, pagato: boolean) {
    if (ruolo !== 'admin') return

    await supabase
      .from('spese')
      .update({ pagato: !pagato })
      .eq('id', id)

    setSpese((p) =>
      p.map((s) =>
        s.id === id ? { ...s, pagato: !pagato } : s
      )
    )
  }

  async function eliminaSpesa(id: string) {
    if (ruolo !== 'admin') return

    await supabase.from('spese').delete().eq('id', id)
    setSpese((p) => p.filter((s) => s.id !== id))
  }

  const filtrate = useMemo(() => {
    let r = spese

    if (meseFiltro !== 'tutti') {
      r = r.filter((s) => s.data.slice(0, 7) === meseFiltro)
    }

    if (ricerca) {
      r = r.filter((s) =>
        s.cosa.toLowerCase().includes(ricerca.toLowerCase())
      )
    }

    return r
  }, [spese, meseFiltro, ricerca])

  const daPagare = filtrate.filter((s) => !s.pagato)
  const storico = filtrate.filter((s) => s.pagato)

  const totale = daPagare.reduce((a, b) => a + b.quanto, 0)

  if (authLoading || (userId && roleLoading)) {
    return <div style={{ padding: 40 }}>Caricamento...</div>
  }

  if (!userId) {
    return (
      <div style={{ padding: 40 }}>
        <form onSubmit={login}>
          <input value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} />
          <input type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} />
          <button>Login</button>
        </form>
      </div>
    )
  }

  return (
    <div style={{ padding: 40 }}>
      <h1>App spese</h1>

      <p>{emailUtente} - ruolo: {ruolo}</p>

      <button onClick={logout}>Esci</button>

      <h2>Totale: {totale} €</h2>

      {ruolo === 'admin' && (
        <form onSubmit={aggiungiSpesa}>
          <input value={cosa} onChange={(e) => setCosa(e.target.value)} />
          <input value={quanto} onChange={(e) => setQuanto(e.target.value)} />
          <button>Aggiungi</button>
        </form>
      )}

      <h3>Da pagare</h3>
      {daPagare.map((s) => (
        <div key={s.id}>
          {s.cosa} - {s.quanto}
          {ruolo === 'admin' && (
            <>
              <button onClick={() => cambiaPagato(s.id, s.pagato)}>✔</button>
              <button onClick={() => eliminaSpesa(s.id)}>❌</button>
            </>
          )}
        </div>
      ))}

      <h3>Storico</h3>
      {storico.map((s) => (
        <div key={s.id}>
          {s.cosa} - {s.quanto}
        </div>
      ))}
    </div>
  )
}