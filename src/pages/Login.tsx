import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import loginBg from '../assets/login_bg.png'

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
      {/* Card a la izquierda, sobre el espacio libre del fondo */}
      <form
        onSubmit={entrar}
        className="w-full max-w-md rounded-2xl bg-white/90 p-10 shadow-2xl backdrop-blur-sm"
      >
        <h1 className="text-3xl font-bold text-slate-800">Kiosk Esbot</h1>
        <p className="mt-1 text-slate-500">Panel de administración</p>

        <label className="mt-8 block text-sm font-medium text-slate-700">
          Correo
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 focus:border-indigo-500 focus:outline-none"
          />
        </label>

        <label className="mt-4 block text-sm font-medium text-slate-700">
          Contraseña
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 focus:border-indigo-500 focus:outline-none"
          />
        </label>

        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={cargando}
          className="mt-8 w-full rounded-lg bg-indigo-600 py-3 font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
        >
          {cargando ? 'Entrando...' : 'Iniciar sesión'}
        </button>
      </form>
    </div>
  )
}
