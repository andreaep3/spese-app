resta bloccato
'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Spesa = {
  id: string
  data: string
  cosa: string
  quanto: number
  pagato: boolean
  'created at': string
}

type Ruolo = 'admin' | 'viewer' | null

export default function Home() {
  const [spese, setSpese] = useState<Spesa[]>([])
  const [errore, setErrore] = useState('')
  const [caricamento, setCaricamento] = useState(true)

  const [userId, setUserId] = useState<string | null>(null)
  const [emailUtente, setEmailUtente] = useState('')
  const [ruolo, setRuolo] = useState<Ruolo>(null)
  const [authLoading, setAuthLoading] = useState(true)

  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')

  const [data, setData] = useState(new Date().toISOString().split('T')[0])
  const [cosa, setCosa] = useState('')
  const [quanto, setQuanto] = useState('')
  const [meseFiltro, setMeseFiltro] = useState('tutti')
  const [ricerca, setRicerca] = useState('')

  useEffect(() => {
    controllaSessione()

    const timeout = setTimeout(() => {
      setAuthLoading(false)
    }, 5000)

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      try {
        if (session?.user) {
          setUserId(session.user.id)
          setEmailUtente(session.user.email || '')
          await caricaRuolo(session.user.id)
          await caricaSpese()
        } else {
          setUserId(null)
          setEmailUtente('')
          setRuolo(null)
          setSpese([])
        }
      } catch (error) {
        console.error('Errore onAuthStateChange:', error)
        setErrore('Errore nel cambio stato login')
      } finally {
        setAuthLoading(false)
      }
    })

    return () => {
      clearTimeout(timeout)
      subscription.unsubscribe()
    }
  }, [])

  async function controllaSessione() {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (session?.user) {
        setUserId(session.user.id)
        setEmailUtente(session.user.email || '')
        await caricaRuolo(session.user.id)
        await caricaSpese()
      } else {
        setUserId(null)
        setEmailUtente('')
        setRuolo(null)
        setSpese([])
      }
    } catch (error) {
      console.error('Errore controllaSessione:', error)
      setErrore('Errore nel controllo sessione')
    } finally {
      setAuthLoading(false)
    }
  }

  async function caricaRuolo(id: string) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', id)
        .single()

      if (error) {
        setErrore("Non riesco a leggere il ruolo dell'utente")
        setRuolo(null)
        return
      }

      setRuolo(data.role as Ruolo)
    } catch (error) {
      console.error('Errore caricaRuolo:', error)
      setErrore('Errore nel caricamento del ruolo')
      setRuolo(null)
    }
  }

  async function caricaSpese() {
    try {
      setCaricamento(true)

      const { data, error } = await supabase
        .from('spese')
        .select('*')
        .order('data', { ascending: false })

      if (error) {
        setErrore(error.message)
        return
      }

      setErrore('')
      setSpese(data || [])
    } catch (error) {
      console.error('Errore caricaSpese:', error)
      setErrore('Errore nel caricamento spese')
    } finally {
      setCaricamento(false)
    }
  }

  async function login(e: FormEvent) {
    e.preventDefault()

    if (!loginEmail || !loginPassword) {
      setErrore('Inserisci email e password')
      return
    }

    setErrore('')

    const { error } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password: loginPassword,
    })

    if (error) {
      setErrore(error.message)
    }
  }

  async function logout() {
    await supabase.auth.signOut()
    setLoginEmail('')
    setLoginPassword('')
    setErrore('')
  }

  async function aggiungiSpesa(e: FormEvent) {
    e.preventDefault()

    if (ruolo !== 'admin') return

    if (!data || !cosa.trim() || !quanto) {
      setErrore('Compila tutto')
      return
    }

    const importo = Number(quanto)

    if (Number.isNaN(importo) || importo <= 0) {
      setErrore('Inserisci un importo valido')
      return
    }

    const { data: nuovaSpesa, error } = await supabase
      .from('spese')
      .insert([
        {
          data,
          cosa: cosa.trim(),
          quanto: importo,
          pagato: false,
        },
      ])
      .select()
      .single()

    if (error) {
      setErrore(error.message)
      return
    }

    setSpese((prev) => [nuovaSpesa, ...prev])
    setData(new Date().toISOString().split('T')[0])
    setCosa('')
    setQuanto('')
    setErrore('')
  }

  async function cambiaPagato(id: string, valoreAttuale: boolean) {
    if (ruolo !== 'admin') return

    const nuovoValore = !valoreAttuale

    const { error } = await supabase
      .from('spese')
      .update({ pagato: nuovoValore })
      .eq('id', id)

    if (error) {
      setErrore(error.message)
      return
    }

    setErrore('')
    setSpese((prev) =>
      prev.map((spesa) =>
        spesa.id === id ? { ...spesa, pagato: nuovoValore } : spesa
      )
    )
  }

  async function eliminaSpesa(id: string) {
    if (ruolo !== 'admin') return

    const conferma = window.confirm('Vuoi eliminare questa spesa?')
    if (!conferma) return

    const { error } = await supabase.from('spese').delete().eq('id', id)

    if (error) {
      setErrore(error.message)
      return
    }

    setErrore('')
    setSpese((prev) => prev.filter((spesa) => spesa.id !== id))
  }

  const mesiDisponibili = useMemo(() => {
    const mesiUnici = Array.from(
      new Set(
        spese
          .filter((spesa) => spesa.data)
          .map((spesa) => spesa.data.slice(0, 7))
      )
    )

    return mesiUnici.sort().reverse()
  }, [spese])

  const speseFiltrate = useMemo(() => {
    let risultato = spese

    if (meseFiltro !== 'tutti') {
      risultato = risultato.filter(
        (spesa) => spesa.data.slice(0, 7) === meseFiltro
      )
    }

    if (ricerca.trim() !== '') {
      const r = ricerca.toLowerCase().trim()

      risultato = risultato.filter((spesa) => {
        const testoCosa = spesa.cosa.toLowerCase()
        const testoData = spesa.data.toLowerCase()
        const testoImporto = String(spesa.quanto).toLowerCase()

        return (
          testoCosa.includes(r) ||
          testoData.includes(r) ||
          testoImporto.includes(r)
        )
      })
    }

    return risultato
  }, [spese, meseFiltro, ricerca])

  const daPagare = useMemo(
    () =>
      speseFiltrate
        .filter((spesa) => !spesa.pagato)
        .sort((a, b) => b.data.localeCompare(a.data)),
    [speseFiltrate]
  )

  const storico = useMemo(
    () =>
      speseFiltrate
        .filter((spesa) => spesa.pagato)
        .sort((a, b) => b.data.localeCompare(a.data)),
    [speseFiltrate]
  )

  const totaleDaPagare = useMemo(
    () => daPagare.reduce((acc, spesa) => acc + Number(spesa.quanto), 0),
    [daPagare]
  )

  function formattaMese(mese: string) {
    const [anno, meseNumero] = mese.split('-')
    const data = new Date(Number(anno), Number(meseNumero) - 1, 1)

    return data.toLocaleDateString('it-IT', {
      month: 'long',
      year: 'numeric',
    })
  }

  function formattaData(data: string) {
    if (!data) return ''
    return new Date(data).toLocaleDateString('it-IT')
  }

  function formattaImporto(importo: number) {
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR',
    }).format(importo)
  }

  if (authLoading) {
    return (
      <main
        style={{
          minHeight: '100vh',
          background: '#020617',
          color: '#e5e7eb',
          display: 'grid',
          placeItems: 'center',
          fontFamily: 'Inter, sans-serif',
        }}
      >
        Caricamento...
      </main>
    )
  }

  if (!userId) {
    return (
      <>
        <style jsx global>{`
          html,
          body {
            margin: 0;
            padding: 0;
            background: #020617;
            color: #e5e7eb;
            font-family: Inter, Arial, sans-serif;
          }
          * {
            box-sizing: border-box;
          }
          .login-page {
            min-height: 100vh;
            display: grid;
            place-items: center;
            padding: 20px;
            background:
              radial-gradient(circle at top, rgba(37, 99, 235, 0.14), transparent 30%),
              linear-gradient(180deg, #020617 0%, #0f172a 100%);
          }
          .login-card {
            width: 100%;
            max-width: 420px;
            background: rgba(30, 41, 59, 0.96);
            border: 1px solid #334155;
            border-radius: 20px;
            padding: 24px;
            box-shadow: 0 16px 40px rgba(0, 0, 0, 0.28);
          }
          .title {
            margin: 0 0 18px 0;
            font-size: 30px;
            font-weight: 900;
            color: #f8fafc;
          }
          .input {
            width: 100%;
            padding: 13px 14px;
            border-radius: 12px;
            border: 1px solid #334155;
            background: #0f172a;
            color: #e5e7eb;
            margin-bottom: 12px;
          }
          .button {
            width: 100%;
            border: none;
            border-radius: 12px;
            padding: 12px 16px;
            cursor: pointer;
            font-weight: 800;
            background: linear-gradient(135deg, #2563eb, #1d4ed8);
            color: #fff;
          }
          .error {
            margin-top: 14px;
            color: #fca5a5;
            font-weight: 700;
          }
          .note {
            margin-top: 12px;
            color: #94a3b8;
            font-size: 14px;
          }
        `}</style>

        <main className="login-page">
          <div className="login-card">
            <h1 className="title">Login</h1>

            <form onSubmit={login}>
              <input
                className="input"
                type="email"
                placeholder="Email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
              />

              <input
                className="input"
                type="password"
                placeholder="Password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
              />

              <button className="button" type="submit">
                Entra
              </button>
            </form>

            {errore && <p className="error">Errore: {errore}</p>}

            <p className="note">
              Admin = lettura e scrittura. Viewer = sola lettura.
            </p>
          </div>
        </main>
      </>
    )
  }

  return (
    <>
      <style jsx global>{`
        :root {
          color-scheme: dark;
        }

        html,
        body {
          margin: 0;
          padding: 0;
          background: #020617;
          color: #e5e7eb;
          font-family:
            Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont,
            'Segoe UI', sans-serif;
        }

        * {
          box-sizing: border-box;
        }

        button,
        input,
        select {
          font: inherit;
        }

        input::placeholder {
          color: #94a3b8;
        }

        .page {
          min-height: 100vh;
          padding: 32px 20px;
          background:
            radial-gradient(circle at top, rgba(37, 99, 235, 0.14), transparent 30%),
            linear-gradient(180deg, #020617 0%, #0f172a 100%);
        }

        .container {
          width: 100%;
          max-width: 940px;
          margin: 0 auto;
        }

        .card {
          background: rgba(30, 41, 59, 0.96);
          border: 1px solid #334155;
          border-radius: 20px;
          padding: 24px;
          box-shadow: 0 16px 40px rgba(0, 0, 0, 0.28);
          backdrop-filter: blur(10px);
        }

        .card + .card {
          margin-top: 18px;
        }

        .title-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
          margin-bottom: 18px;
        }

        .title {
          margin: 0;
          font-size: 32px;
          line-height: 1.05;
          font-weight: 900;
          color: #f8fafc;
          letter-spacing: -0.03em;
        }

        .subtitle {
          margin: 6px 0 0 0;
          color: #94a3b8;
          font-size: 14px;
        }

        .section-title {
          margin: 0 0 16px 0;
          font-size: 22px;
          font-weight: 900;
          color: #f8fafc;
        }

        .form-grid {
          display: grid;
          gap: 12px;
          margin-bottom: 16px;
        }

        .input,
        .select {
          width: 100%;
          padding: 13px 14px;
          border-radius: 12px;
          border: 1px solid #334155;
          background: #0f172a;
          color: #e5e7eb;
          outline: none;
        }

        .button {
          border: none;
          border-radius: 12px;
          padding: 10px 14px;
          cursor: pointer;
          font-weight: 800;
        }

        .button-primary {
          background: linear-gradient(135deg, #2563eb, #1d4ed8);
          color: #ffffff;
        }

        .button-success {
          background: linear-gradient(135deg, #16a34a, #15803d);
          color: #ffffff;
        }

        .button-secondary {
          background: linear-gradient(135deg, #475569, #334155);
          color: #ffffff;
        }

        .button-danger {
          background: linear-gradient(135deg, #dc2626, #b91c1c);
          color: #ffffff;
        }

        .button-ghost {
          background: #0f172a;
          color: #e5e7eb;
          border: 1px solid #334155;
        }

        .error {
          margin-top: 14px;
          color: #fca5a5;
          font-weight: 700;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
          align-items: end;
        }

        .search-box {
          margin-top: 16px;
        }

        .stat-label {
          margin: 0;
          font-size: 13px;
          font-weight: 800;
          color: #94a3b8;
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }

        .stat-value {
          margin: 8px 0 0 0;
          font-size: 34px;
          font-weight: 900;
          color: #f87171;
        }

        .list {
          display: grid;
          gap: 12px;
        }

        .item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 14px;
          flex-wrap: wrap;
          padding: 16px;
          border-radius: 14px;
          border: 1px solid #334155;
          background: #0f172a;
        }

        .item-storico {
          background: #020617;
        }

        .item-left {
          min-width: 180px;
          flex: 1;
        }

        .item-title {
          margin: 0 0 6px 0;
          font-size: 18px;
          font-weight: 900;
          color: #f8fafc;
        }

        .item-date {
          margin: 0;
          color: #94a3b8;
          font-size: 14px;
        }

        .item-right {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .amount {
          font-size: 20px;
          font-weight: 900;
          color: #f8fafc;
          min-width: 115px;
          text-align: right;
        }

        .badge {
          display: inline-flex;
          align-items: center;
          padding: 7px 10px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 900;
          text-transform: uppercase;
        }

        .badge-open {
          background: rgba(239, 68, 68, 0.12);
          color: #fca5a5;
          border: 1px solid rgba(239, 68, 68, 0.3);
        }

        .badge-paid {
          background: rgba(34, 197, 94, 0.12);
          color: #86efac;
          border: 1px solid rgba(34, 197, 94, 0.28);
        }

        .empty {
          margin: 0;
          color: #94a3b8;
        }

        .top-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
          flex-wrap: wrap;
          margin-bottom: 12px;
        }

        .small-note {
          color: #94a3b8;
          font-size: 14px;
          margin: 0;
        }

        @media (max-width: 820px) {
          .stats-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 720px) {
          .page {
            padding: 20px 14px;
          }

          .card {
            padding: 18px;
          }

          .title {
            font-size: 28px;
          }

          .section-title {
            font-size: 20px;
          }

          .stat-value {
            font-size: 28px;
          }

          .amount {
            text-align: left;
            min-width: auto;
          }

          .item-right {
            width: 100%;
            justify-content: flex-start;
          }
        }
      `}</style>

      <main className="page">
        <div className="container">
          <div className="card">
            <div className="title-row">
              <div>
                <h1 className="title">App spese</h1>
                <p className="subtitle">
                  {emailUtente} · ruolo: {ruolo === 'admin' ? 'admin' : 'viewer'}
                </p>
              </div>

              <button className="button button-ghost" onClick={logout}>
                Esci
              </button>
            </div>

            {ruolo === 'admin' && (
              <form onSubmit={aggiungiSpesa}>
                <div className="form-grid">
                  <input
                    className="input"
                    type="date"
                    value={data}
                    onChange={(e) => setData(e.target.value)}
                  />

                  <input
                    className="input"
                    type="text"
                    placeholder="Cosa"
                    value={cosa}
                    onChange={(e) => setCosa(e.target.value)}
                  />

                  <input
                    className="input"
                    type="number"
                    placeholder="Quanto"
                    value={quanto}
                    onChange={(e) => setQuanto(e.target.value)}
                  />
                </div>

                <button type="submit" className="button button-primary">
                  Aggiungi spesa
                </button>
              </form>
            )}

            {ruolo === 'viewer' && (
              <p className="small-note">
                Sei in sola lettura. Puoi vedere tutto ma non modificare.
              </p>
            )}

            {errore && <p className="error">Errore: {errore}</p>}
          </div>

          <div className="card">
            <div className="stats-grid">
              <div>
                <p className="stat-label">Totale da pagare</p>
                <p className="stat-value">
                  {formattaImporto(totaleDaPagare)}
                </p>
              </div>

              <div>
                <label
                  htmlFor="meseFiltro"
                  className="stat-label"
                  style={{ display: 'block', marginBottom: 8 }}
                >
                  Filtro mese
                </label>

                <select
                  id="meseFiltro"
                  className="select"
                  value={meseFiltro}
                  onChange={(e) => setMeseFiltro(e.target.value)}
                >
                  <option value="tutti">Tutti i mesi</option>
                  {mesiDisponibili.map((mese) => (
                    <option key={mese} value={mese}>
                      {formattaMese(mese)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="search-box">
              <label
                htmlFor="ricerca"
                className="stat-label"
                style={{ display: 'block', marginBottom: 8 }}
              >
                Cerca
              </label>

              <input
                id="ricerca"
                className="input"
                type="text"
                placeholder="Cerca per nome, data o importo..."
                value={ricerca}
                onChange={(e) => setRicerca(e.target.value)}
              />
            </div>
          </div>

          <section className="card">
            <div className="top-row">
              <h2 className="section-title">Da pagare</h2>
              <p className="small-note">{daPagare.length} voci</p>
            </div>

            {caricamento ? (
              <p className="empty">Caricamento...</p>
            ) : daPagare.length === 0 ? (
              <p className="empty">Nessuna spesa da pagare</p>
            ) : (
              <div className="list">
                {daPagare.map((spesa) => (
                  <div key={spesa.id} className="item">
                    <div className="item-left">
                      <p className="item-title">{spesa.cosa}</p>
                      <p className="item-date">{formattaData(spesa.data)}</p>
                    </div>

                    <div className="item-right">
                      <span className="badge badge-open">Da pagare</span>
                      <div className="amount">
                        {formattaImporto(Number(spesa.quanto))}
                      </div>

                      {ruolo === 'admin' && (
                        <>
                          <button
                            type="button"
                            onClick={() => cambiaPagato(spesa.id, spesa.pagato)}
                            className="button button-success"
                          >
                            Segna pagato
                          </button>

                          <button
                            type="button"
                            onClick={() => eliminaSpesa(spesa.id)}
                            className="button button-danger"
                          >
                            Elimina
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="card">
            <div className="top-row">
              <h2 className="section-title">Storico</h2>
              <p className="small-note">{storico.length} voci</p>
            </div>

            {caricamento ? (
              <p className="empty">Caricamento...</p>
            ) : storico.length === 0 ? (
              <p className="empty">Nessuna spesa nello storico</p>
            ) : (
              <div className="list">
                {storico.map((spesa) => (
                  <div key={spesa.id} className="item item-storico">
                    <div className="item-left">
                      <p className="item-title">{spesa.cosa}</p>
                      <p className="item-date">{formattaData(spesa.data)}</p>
                    </div>

                    <div className="item-right">
                      <span className="badge badge-paid">Pagato</span>
                      <div className="amount">
                        {formattaImporto(Number(spesa.quanto))}
                      </div>

                      {ruolo === 'admin' && (
                        <>
                          <button
                            type="button"
                            onClick={() => cambiaPagato(spesa.id, spesa.pagato)}
                            className="button button-secondary"
                          >
                            Rimetti da pagare
                          </button>

                          <button
                            type="button"
                            onClick={() => eliminaSpesa(spesa.id)}
                            className="button button-danger"
                          >
                            Elimina
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
    </>
  )
}