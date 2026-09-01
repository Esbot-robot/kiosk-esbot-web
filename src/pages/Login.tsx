import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import loginBg from '../assets/login_bg.png'
import logoLogin from '../assets/logo-login.png'

interface CampoFlotanteProps {
  id: string
  etiqueta: string
  tipo: 'email' | 'password'
  valor: string
  onChange: (valor: string) => void
}

function CampoFlotante({ id, etiqueta, tipo, valor, onChange }: CampoFlotanteProps) {
  const [enFoco, setEnFoco] = useState(false)
  const [autocompletado, setAutocompletado] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const flotando = enFoco || valor.length > 0 || autocompletado

  useEffect(() => {
    const sincronizarAutocompletado = () => {
      const valorNativo = inputRef.current?.value ?? ''
      if (valorNativo && valorNativo !== valor) {
        setAutocompletado(true)
        onChange(valorNativo)
      }
    }
    const frame = requestAnimationFrame(sincronizarAutocompletado)
    const espera = window.setTimeout(sincronizarAutocompletado, 250)
    return () => {
      cancelAnimationFrame(frame)
      window.clearTimeout(espera)
    }
  }, [onChange, valor])

  return (
    <div className="relative pt-5">
      <label
        htmlFor={id}
        className={`pointer-events-none absolute left-0 font-semibold transition-all duration-200 ease-out ${
          flotando
            ? 'top-0 text-xs text-[#506798]'
            : 'top-7 text-[15px] text-[#6d7ea6]'
        }`}
      >
        {etiqueta}
      </label>
      <input
        id={id}
        ref={inputRef}
        type={tipo}
        value={valor}
        required
        autoComplete={tipo === 'email' ? 'email' : 'current-password'}
        onFocus={() => setEnFoco(true)}
        onBlur={() => setEnFoco(false)}
        onAnimationStart={(e) => {
          if (e.animationName === 'login-autofill-start') {
            setAutocompletado(true)
            onChange(e.currentTarget.value)
          }
        }}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 w-full border-b border-[#9aabcf] bg-transparent pb-1 text-base font-medium text-[#163d80] outline-none transition-colors placeholder:text-transparent focus:border-[#075fff]"
      />
    </div>
  )
}

export function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)
  const navigate = useNavigate()

  async function entrar(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setCargando(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setCargando(false)
    if (error) {
      setError('Credenciales incorrectas')
      return
    }
    navigate('/proyectos')
  }

  return (
    <div
      className="flex h-screen items-center bg-slate-100 bg-cover bg-center px-6 md:px-20"
      style={{ backgroundImage: `url(${loginBg})` }}
    >
      <form
        onSubmit={entrar}
        className="login-montserrat w-full max-w-[360px] rounded-[18px] bg-white px-8 py-9 shadow-[0_18px_44px_rgba(21,43,88,0.22)] sm:px-10"
      >
        <div className="flex flex-col items-center text-center">
          <img src={logoLogin} alt="Esbot" className="h-[66px] w-[66px] object-contain" />
          <h1 className="mt-5 text-2xl font-bold tracking-[-0.03em] text-[#002d73]">Login</h1>
          <p className="mt-1 text-sm font-semibold text-[#7786aa]">Kiosk Esbot</p>
        </div>

        <div className="mt-7 space-y-3">
          <CampoFlotante id="email" etiqueta="Email" tipo="email" valor={email} onChange={setEmail} />
          <CampoFlotante id="password" etiqueta="Password" tipo="password" valor={password} onChange={setPassword} />
        </div>

        {error && <p className="mt-5 text-center text-xs font-medium text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={cargando}
          className="mt-7 h-11 w-full rounded-md bg-gradient-to-r from-[#003edb] to-[#0977ff] text-sm font-semibold text-white shadow-[0_6px_12px_rgba(0,70,224,0.24)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {cargando ? 'Logging in...' : 'Log in'}
        </button>
      </form>
    </div>
  )
}
