import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { eliminarConfigRobot, publicarConfigRobot } from '../lib/storage'
import { Modal } from '../components/Modal'
import {
  COLORES_OPCIONES_DEFAULT,
  COLOR_TEXTO_OPCION_DEFAULT,
  LIMITES,
  normalizarConfigAgente,
  type AgenteConfig,
  type EventConfig,
  type Pregunta,
  type Project,
} from '../types/config'
import { DialogBoton, DialogColoresOpciones, DialogTexto, DialogTts, DialogTextoSimple } from '../components/editor/DialogTexto'
import { DialogPregunta } from '../components/editor/DialogPregunta'
import { DialogArchivo } from '../components/editor/DialogArchivo'
import { AgentPanel, AgentPreview } from '../components/editor/AgentEditor'
import { IconoGuardar, IconoLapiz, IconoMas, IconoOnda, IconoPlay, IconoVolumen } from '../components/iconos'

type Pestana = 'inicial' | 'ruleta' | 'agente'

type Dialogo =
  | { tipo: 'titulo' }
  | { tipo: 'subtitulo' }
  | { tipo: 'boton' }
  | { tipo: 'logo' }
  | { tipo: 'tts-inicial'; campo: CampoTtsInicial; titulo: string }
  | { tipo: 'tts-ruleta'; campo: CampoTtsRuleta; titulo: string }
  | { tipo: 'fondo'; pantalla: Pestana }
  | { tipo: 'video' }
  | { tipo: 'secuencia' }
  | { tipo: 'pregunta'; index: number | null }
  | { tipo: 'colores-opciones' }

type CampoTtsInicial =
  | 'tts_toca_pantalla'
  | 'tts_llega_stand'
  | 'tts_despedida_stand'
  | 'tts_reanuda_patrulla'
  | 'tts_sigueme'
type CampoTtsRuleta = 'tts_acierta' | 'tts_no_acierta' | 'tts_agradecimiento' | 'tts_sin_respuesta'

const TTS_INICIAL: { campo: CampoTtsInicial; label: string }[] = [
  { campo: 'tts_toca_pantalla', label: 'Cuando usuario toca la pantalla' },
  { campo: 'tts_llega_stand', label: 'Cuando robot llega al stand' },
  { campo: 'tts_despedida_stand', label: 'Despedida en el stand' },
  { campo: 'tts_reanuda_patrulla', label: 'Cuando el robot reanuda patrulla' },
]

/** Los TTS de la ruleta a mostrar dependen de los tipos de pregunta del proyecto */
function ttsRuletaVisibles(preguntas: Pregunta[]): { campo: CampoTtsRuleta; label: string }[] {
  const hayCalif = preguntas.some((p) => p.tipo === 'calificacion')
  // "trivia" incluye el caso sin preguntas (comportamiento por defecto)
  const hayTrivia = preguntas.length === 0 || preguntas.some((p) => p.tipo !== 'calificacion')
  const lista: { campo: CampoTtsRuleta; label: string }[] = []
  if (hayTrivia) {
    lista.push({ campo: 'tts_acierta', label: 'Cuando el usuario acierta (trivia)' })
    lista.push({ campo: 'tts_no_acierta', label: 'Cuando el usuario no acierta (trivia)' })
  }
  if (hayCalif) {
    lista.push({ campo: 'tts_agradecimiento', label: 'Agradecimiento (calificación)' })
  }
  lista.push({ campo: 'tts_sin_respuesta', label: 'Cuando no hubo respuesta' })
  return lista
}

function Lapiz({ onClick, title }: { onClick: () => void; title?: string }) {
  return (
    <button
      onClick={onClick}
      title={title ?? 'Editar'}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#2f3b52] shadow-md ring-2 ring-slate-400/70 transition-transform hover:scale-110"
    >
      <IconoLapiz />
    </button>
  )
}

function ItemPanel({
  icono,
  label,
  detalle,
  onClick,
}: {
  icono: React.ReactNode
  label: string
  detalle: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-start gap-3 rounded-lg px-3 py-3 text-left transition-colors hover:bg-indigo-50"
    >
      <span className="mt-0.5 shrink-0 text-blue-700">{icono}</span>
      <span className="min-w-0">
        <span className="block truncate font-semibold text-slate-800">{label}</span>
        <span className="block truncate text-sm text-slate-500">{detalle}</span>
      </span>
    </button>
  )
}

export function Editor() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [pestana, setPestana] = useState<Pestana>('inicial')
  const [vistaAgente, setVistaAgente] = useState('inicio')
  const [dialogo, setDialogo] = useState<Dialogo | null>(null)
  const [nombre, setNombre] = useState('')
  const [config, setConfig] = useState<EventConfig | null>(null)
  const [guardadoOk, setGuardadoOk] = useState(false)
  const [errorGuardar, setErrorGuardar] = useState('')
  const [confirmarBorrar, setConfirmarBorrar] = useState(false)
  const [mostrarPantallaPausa, setMostrarPantallaPausa] = useState(false)

  const { data: proyecto, isLoading } = useQuery({
    queryKey: ['project', projectId],
    queryFn: async (): Promise<Project> => {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single()
      if (error) throw error
      return data as Project
    },
    enabled: !!projectId,
  })

  useEffect(() => {
    if (proyecto) {
      setNombre(proyecto.nombre)
      // Migración: proyectos guardados antes de existir "despues_quiz"
      const cfg = structuredClone(proyecto.config)
      if (!cfg.pantalla_ruleta.despues_quiz) {
        cfg.pantalla_ruleta.despues_quiz = {
          modo: 'guiar_al_stand',
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          secuencia_guia: (cfg.pantalla_inicial as any).secuencia_guia ?? '',
        }
      }
      if (!cfg.pantalla_ruleta.colores_opciones) {
        cfg.pantalla_ruleta.colores_opciones = ['', '', '']
      }
      if (!cfg.pantalla_ruleta.colores_texto_opciones) {
        cfg.pantalla_ruleta.colores_texto_opciones = ['', '', '']
      }
      // Preguntas viejas sin tipo → trivia por defecto
      for (const preg of cfg.pantalla_ruleta.preguntas) {
        if (!preg.tipo) preg.tipo = 'trivia'
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((cfg.pantalla_ruleta as any).tts_agradecimiento === undefined) {
        cfg.pantalla_ruleta.tts_agradecimiento = '¡Gracias por tu opinión!'
      }
      if (!cfg.pantalla_inicial.destino_boton) {
        cfg.pantalla_inicial.destino_boton = 'quiz'
      }
      if (!cfg.pantalla_inicial.pantalla_al_pausar) {
        cfg.pantalla_inicial.pantalla_al_pausar = 'inicial'
      }
      if (!cfg.pantalla_inicial.boton_agente) {
        cfg.pantalla_inicial.boton_agente = {
          ...cfg.pantalla_inicial.boton,
          texto: 'HABLAR CON TEMI',
        }
      }
      cfg.agente_ia = normalizarConfigAgente(cfg.agente_ia)
      if (
        cfg.pantalla_inicial.pantalla_al_pausar === 'agente' &&
        cfg.agente_ia.modo_escucha_inicial === 'automatico'
      ) {
        cfg.agente_ia.modo_escucha_inicial = 'por_boton'
      }
      setConfig(cfg)
    }
  }, [proyecto])

  const guardar = useMutation({
    mutationFn: async () => {
      if (!config || !projectId) return
      const nuevaConfig: EventConfig = { ...config, version: config.version + 1 }
      const { error } = await supabase
        .from('projects')
        .update({ nombre, config: nuevaConfig })
        .eq('id', projectId)
      if (error) throw error
      setConfig(nuevaConfig)

      // Republicar el JSON de los robots que tengan este proyecto fijado
      const { data: robots } = await supabase
        .from('robots')
        .select('serial')
        .eq('project_id', projectId)
      for (const robot of robots ?? []) {
        await publicarConfigRobot(robot.serial, nuevaConfig)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      setGuardadoOk(true)
      setTimeout(() => setGuardadoOk(false), 2500)
    },
  })

  // Robots fijados a este proyecto (para advertir al eliminar)
  const { data: robotsFijados } = useQuery({
    queryKey: ['robots-proyecto', projectId],
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase
        .from('robots')
        .select('serial')
        .eq('project_id', projectId)
        .order('serial')
      if (error) throw error
      return (data as { serial: string }[]).map((r) => r.serial)
    },
    enabled: !!projectId,
  })

  const borrar = useMutation({
    mutationFn: async () => {
      if (!projectId) return
      // 1. desfijar robots + borrar su config publicada
      const seriales = robotsFijados ?? []
      for (const s of seriales) await eliminarConfigRobot(s)
      await supabase.from('robots').delete().eq('project_id', projectId)
      // 2. borrar los archivos (fondos/logo/video) del proyecto — best effort
      try {
        const { data: files } = await supabase.storage.from('media').list(projectId)
        if (files && files.length) {
          await supabase.storage.from('media').remove(files.map((f) => `${projectId}/${f.name}`))
        }
      } catch {
        // si falla la limpieza de media no se bloquea el borrado del proyecto
      }
      // 3. borrar el proyecto
      const { error } = await supabase.from('projects').delete().eq('id', projectId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      queryClient.invalidateQueries({ queryKey: ['robots'] })
      navigate('/proyectos')
    },
  })

  if (isLoading || !config) {
    return <p className="p-12 text-slate-500">Cargando proyecto...</p>
  }

  const ini = config.pantalla_inicial
  const rul = config.pantalla_ruleta
  const agente = config.agente_ia

  function setInicial(cambios: Partial<EventConfig['pantalla_inicial']>) {
    setConfig((c) => c && { ...c, pantalla_inicial: { ...c.pantalla_inicial, ...cambios } })
  }
  function setRuleta(cambios: Partial<EventConfig['pantalla_ruleta']>) {
    setConfig((c) => c && { ...c, pantalla_ruleta: { ...c.pantalla_ruleta, ...cambios } })
  }
  function setAgente(agente_ia: AgenteConfig) {
    setConfig((c) => {
      if (!c) return c
      return {
        ...c,
        agente_ia,
        pantalla_inicial:
          !agente_ia.activo && c.pantalla_inicial.pantalla_al_pausar === 'agente'
            ? { ...c.pantalla_inicial, pantalla_al_pausar: 'inicial' }
            : c.pantalla_inicial,
      }
    })
  }

  function seleccionarPantallaPausa(valor: EventConfig['pantalla_inicial']['pantalla_al_pausar']) {
    setConfig((c) => {
      if (!c || (valor === 'agente' && !c.agente_ia.activo)) return c
      return {
        ...c,
        pantalla_inicial: { ...c.pantalla_inicial, pantalla_al_pausar: valor },
        agente_ia:
          valor === 'agente' && c.agente_ia.modo_escucha_inicial === 'automatico'
            ? { ...c.agente_ia, modo_escucha_inicial: 'por_boton' }
            : c.agente_ia,
      }
    })
    setErrorGuardar('')
    setMostrarPantallaPausa(false)
  }

  function guardarPregunta(index: number | null, pregunta: Pregunta) {
    const preguntas = [...rul.preguntas]
    if (index === null) preguntas.push(pregunta)
    else preguntas[index] = pregunta
    setRuleta({ preguntas })
  }

  function eliminarPregunta(index: number) {
    setRuleta({ preguntas: rul.preguntas.filter((_, i) => i !== index) })
  }

  /** Valida y guarda; bloquea si "guiar al stand" no tiene secuencia (rompería el robot) */
  function intentarGuardar() {
    if (ini.pantalla_al_pausar === 'agente' && !agente.activo) {
      setPestana('agente')
      setErrorGuardar(
        'La pantalla al pausar intenta abrir el Agente IA, pero el agente estÃ¡ desactivado.',
      )
      return
    }
    if (!agente.activo && ini.destino_boton !== 'quiz') {
      setPestana('inicial')
      setErrorGuardar(
        'El botón principal intenta abrir el Agente IA, pero el agente está desactivado.',
      )
      return
    }
    if (
      ini.pantalla_al_pausar !== 'agente' &&
      rul.despues_quiz.modo === 'guiar_al_stand' &&
      !rul.despues_quiz.secuencia_guia.trim()
    ) {
      setPestana('ruleta')
      setErrorGuardar('Falta el nombre de la secuencia de Temi para "Guiar al stand". Escríbelo antes de guardar.')
      return
    }
    setErrorGuardar('')
    guardar.mutate()
  }

  const estiloFondo = (url: string) =>
    url
      ? { backgroundImage: `url(${url})`, backgroundSize: 'cover', backgroundPosition: 'center' }
      : { background: 'linear-gradient(160deg, #1e2a4a 0%, #10173a 100%)' }

  return (
    <div className="flex h-full flex-col">
      {/* Barra superior: nombre + pestañas */}
      <div className="flex items-center justify-between border-b border-slate-200 bg-white pl-10">
        <div className="py-2">
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            className="w-96 rounded px-2 text-2xl font-bold text-indigo-600 focus:bg-slate-50 focus:outline-none"
            title="Nombre del proyecto (clic para editar)"
          />
          <p className="px-2 text-sm text-slate-400">Versión {config.version}</p>
        </div>
        <div className="flex">
          <div
            className={`relative flex items-center border-b-2 transition-colors ${
              pestana === 'inicial'
                ? 'border-indigo-600 bg-slate-50 text-indigo-600'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <button
              type="button"
              onClick={() => setMostrarPantallaPausa((visible) => !visible)}
              className="ml-5 flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              aria-label="Configurar pantalla al pausar el video"
              title="Pantalla al pausar el video"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none" aria-hidden="true">
                <path
                  d="M9.6 3.2 10 5a7.5 7.5 0 0 1 4 0l.4-1.8 2.2.9-.8 1.7a7.6 7.6 0 0 1 2.8 2.8l1.7-.8.9 2.2-1.8.4a7.5 7.5 0 0 1 0 4l1.8.4-.9 2.2-1.7-.8a7.6 7.6 0 0 1-2.8 2.8l.8 1.7-2.2.9L14 19a7.5 7.5 0 0 1-4 0l-.4 1.8-2.2-.9.8-1.7a7.6 7.6 0 0 1-2.8-2.8l-1.7.8-.9-2.2 1.8-.4a7.5 7.5 0 0 1 0-4L2.8 10l.9-2.2 1.7.8a7.6 7.6 0 0 1 2.8-2.8l-.8-1.7 2.2-.9Z"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                />
                <circle cx="12" cy="12" r="2.7" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => {
                setPestana('inicial')
                setMostrarPantallaPausa(false)
              }}
              className="py-5 pl-2 pr-8 font-medium"
            >
              Pantalla inicial
            </button>

            {mostrarPantallaPausa && (
              <div className="absolute left-3 top-[calc(100%+8px)] z-50 w-72 rounded-xl border border-slate-200 bg-white p-3 text-left text-slate-800 shadow-xl">
                <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Pantalla al pausar el video
                </p>
                {(
                  [
                    ['inicial', 'Pantalla inicial general'],
                    ['agente', 'Agente IA'],
                  ] as const
                ).map(([valor, label]) => {
                  const seleccionado = ini.pantalla_al_pausar === valor
                  const deshabilitado = valor === 'agente' && !agente.activo
                  return (
                    <button
                      key={valor}
                      type="button"
                      disabled={deshabilitado}
                      onClick={() => seleccionarPantallaPausa(valor)}
                      className={`mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                        seleccionado
                          ? 'bg-indigo-50 text-indigo-700'
                          : 'text-slate-600 hover:bg-slate-50'
                      } ${deshabilitado ? 'cursor-not-allowed opacity-45' : ''}`}
                    >
                      <span
                        className={`flex h-4 w-4 items-center justify-center rounded-full border ${
                          seleccionado ? 'border-indigo-600' : 'border-slate-300'
                        }`}
                      >
                        {seleccionado && <span className="h-2 w-2 rounded-full bg-indigo-600" />}
                      </span>
                      {label}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {(['ruleta', 'agente'] as Pestana[]).map((p) => (
            <button
              key={p}
              onClick={() => {
                setPestana(p)
                setMostrarPantallaPausa(false)
              }}
              className={`px-8 py-5 font-medium transition-colors ${
                pestana === p
                  ? 'border-b-2 border-indigo-600 bg-slate-50 text-indigo-600'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {p === 'ruleta' ? 'Pantalla Ruleta' : 'Agente IA'}
            </button>
          ))}
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* ─── Preview (columna izquierda) ─── */}
        <div className="flex flex-1 items-center justify-center overflow-y-auto p-10">
          {pestana === 'inicial' ? (
            <div
              className="relative aspect-[16/10] w-full max-w-3xl overflow-hidden rounded-xl shadow-lg"
              style={estiloFondo(ini.fondo_url)}
            >
              <div className="absolute right-3 top-3">
                <Lapiz
                  title="Cambiar imagen de fondo"
                  onClick={() => setDialogo({ tipo: 'fondo', pantalla: 'inicial' })}
                />
              </div>
              <div className="flex h-full flex-col items-center pt-8">
                {/* Logo de la empresa (imgLogo en el robot) */}
                <div className="flex items-center gap-2">
                  {ini.logo_url ? (
                    <img src={ini.logo_url} alt="" className="h-20 max-w-72 object-contain" />
                  ) : (
                    <div className="flex h-20 w-56 items-center justify-center rounded-lg border-2 border-dashed border-white/50 text-sm text-white/70">
                      Logo de la empresa
                    </div>
                  )}
                  <Lapiz title="Cambiar logo" onClick={() => setDialogo({ tipo: 'logo' })} />
                </div>

                {/* Título y subtítulo: franjas de lado a lado, como en el robot */}
                <div className="relative mt-6 w-full">
                  <p
                    className="w-full px-16 py-2 text-center text-2xl font-bold"
                    style={{
                      color: ini.titulo.color_texto || '#1e2a4a',
                      backgroundColor: ini.titulo.color_fondo || '#ffffff',
                    }}
                  >
                    {ini.titulo.texto || 'Título (clic en el lápiz)'}
                  </p>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <Lapiz title="Editar título" onClick={() => setDialogo({ tipo: 'titulo' })} />
                  </div>
                </div>

                <div className="relative w-full">
                  <p
                    className="w-full px-16 py-2 text-center text-xl font-semibold"
                    style={{
                      color: ini.subtitulo.color_texto || '#1e2a4a',
                      backgroundColor: ini.subtitulo.color_fondo || '#ffffff',
                    }}
                  >
                    {ini.subtitulo.texto || 'Subtítulo'}
                  </p>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <Lapiz title="Editar subtítulo" onClick={() => setDialogo({ tipo: 'subtitulo' })} />
                  </div>
                </div>

                <div className="mt-10 flex items-center gap-3">
                  {(ini.destino_boton === 'ambos'
                    ? [
                        { boton: ini.boton, textoDefault: 'JUGAR AHORA' },
                        { boton: ini.boton_agente, textoDefault: 'HABLAR CON TEMI' },
                      ]
                    : [
                        {
                          boton: ini.boton,
                          textoDefault:
                            ini.destino_boton === 'agente' ? 'HABLAR CON TEMI' : 'JUGAR AHORA',
                        },
                      ]
                  ).map(({ boton, textoDefault }, index) => (
                    <span
                      key={index}
                      className="rounded-full px-10 py-4 text-lg font-bold"
                      style={{
                        color: boton.color_texto || '#ffffff',
                        backgroundColor: boton.color_fondo || '#031046',
                        border: `4px solid ${boton.color_contorno || '#FFD700'}`,
                      }}
                    >
                      {boton.texto || textoDefault}
                    </span>
                  ))}
                  <Lapiz title="Editar botón" onClick={() => setDialogo({ tipo: 'boton' })} />
                </div>
              </div>
            </div>
          ) : pestana === 'ruleta' ? (
            <div
              className="relative aspect-[16/10] w-full max-w-3xl overflow-hidden rounded-xl shadow-lg"
              style={estiloFondo(rul.fondo_url)}
            >
              <div className="absolute right-3 top-3">
                <Lapiz
                  title="Cambiar imagen de fondo"
                  onClick={() => setDialogo({ tipo: 'fondo', pantalla: 'ruleta' })}
                />
              </div>
              <div className="flex h-full flex-col items-center justify-center gap-4 px-6">
                {/* Ruleta simulada (el diseño real vive en la app) */}
                <div
                  className="h-44 w-44 rounded-full border-8 border-yellow-500 shadow-xl"
                  style={{
                    background:
                      'conic-gradient(#4648d4 0deg 120deg, #2196f3 120deg 240deg, #f44336 240deg 360deg)',
                  }}
                />
                <p className="px-10 text-center text-xl font-bold text-white">
                  {rul.preguntas[0]?.texto || 'Aquí aparecerá la pregunta'}
                </p>

                {/* Botones como en el robot: 2 arriba, el 3ro centrado abajo */}
                {(() => {
                  const opciones = rul.preguntas[0]?.opciones ?? ['Opción 1', 'Opción 2', 'Opción 3']
                  const colorDe = (i: number) =>
                    rul.colores_opciones?.[i] || COLORES_OPCIONES_DEFAULT[i]
                  const colorTextoDe = (i: number) =>
                    rul.colores_texto_opciones?.[i] || COLOR_TEXTO_OPCION_DEFAULT
                  const botonClase =
                    'rounded-full px-4 py-3 text-center font-bold shadow-md text-sm'
                  return (
                    <div className="relative w-full max-w-xl">
                      <div className="flex w-full gap-2">
                        {opciones.slice(0, 2).map((op, i) => (
                          <span
                            key={i}
                            className={`${botonClase} flex-1`}
                            style={{ backgroundColor: colorDe(i), color: colorTextoDe(i) }}
                          >
                            {op}
                          </span>
                        ))}
                      </div>
                      {opciones[2] !== undefined && (
                        <div className="mt-2 flex justify-center">
                          <span
                            className={`${botonClase} w-[calc(50%-4px)]`}
                            style={{ backgroundColor: colorDe(2), color: colorTextoDe(2) }}
                          >
                            {opciones[2]}
                          </span>
                        </div>
                      )}
                      <div className="absolute -right-12 top-1/2 -translate-y-1/2">
                        <Lapiz
                          title="Colores de las opciones"
                          onClick={() => setDialogo({ tipo: 'colores-opciones' })}
                        />
                      </div>
                    </div>
                  )
                })()}
              </div>
            </div>
          ) : (
            <AgentPreview
              agente={agente}
              vistaId={vistaAgente}
              onVistaChange={setVistaAgente}
            />
          )}
        </div>

        {/* ─── Panel derecho ─── */}
        <aside
          className={`flex flex-col border-l border-slate-200 bg-white ${
            pestana === 'agente' ? 'w-[430px]' : 'w-96'
          }`}
        >
          <div className="flex-1 overflow-y-auto p-6">
            {pestana === 'agente' ? (
              <AgentPanel
                agente={agente}
                vistaId={vistaAgente}
                esPantallaInicialApp={ini.pantalla_al_pausar === 'agente'}
                videoPatrullajeUrl={ini.video_patrullaje_url}
                onEditarVideoPatrullaje={() => setDialogo({ tipo: 'video' })}
                onVistaChange={setVistaAgente}
                onChange={setAgente}
              />
            ) : (
              <>
            <h3 className="flex items-center gap-3 text-xl font-bold text-slate-900">
              <IconoOnda /> Configuración de voces (TTS)
            </h3>

            <div className="mt-4 space-y-1">
              {pestana === 'inicial'
                ? TTS_INICIAL.map(({ campo, label }) => (
                    <ItemPanel
                      key={campo}
                      icono={<IconoVolumen />}
                      label={label}
                      detalle={ini[campo] ? `Trigger: ${ini[campo]}` : 'Vacío'}
                      onClick={() => setDialogo({ tipo: 'tts-inicial', campo, titulo: `Tts: ${label.toLowerCase()}` })}
                    />
                  ))
                : ttsRuletaVisibles(rul.preguntas).map(({ campo, label }) => (
                    <ItemPanel
                      key={campo}
                      icono={<IconoVolumen />}
                      label={label}
                      detalle={rul[campo] ? `Trigger: ${rul[campo]}` : 'Vacío'}
                      onClick={() => setDialogo({ tipo: 'tts-ruleta', campo, titulo: `Tts: ${label.toLowerCase()}` })}
                    />
                  ))}
            </div>

            {(pestana !== 'inicial' || ini.pantalla_al_pausar !== 'agente') && (
              <hr className="my-5 border-slate-200" />
            )}

            {pestana === 'inicial' ? (
              ini.pantalla_al_pausar !== 'agente' ? (
                <div className="space-y-1">
                  <ItemPanel
                    icono={<IconoPlay />}
                    label="Video para patrullaje"
                    detalle={ini.video_patrullaje_url ? 'Video cargado ✓' : 'Vacío'}
                    onClick={() => setDialogo({ tipo: 'video' })}
                  />
                </div>
              ) : null
            ) : (
              <div>
                {/* Qué hace el robot al terminar el quiz */}
                <p className="font-semibold text-slate-800">Después del quiz</p>
                <div className="mt-2 space-y-2">
                  {(
                    [
                      { valor: 'guiar_al_stand', label: 'Guiar al stand', detalle: 'Reproduce la secuencia de Temi' },
                      { valor: 'seguir_patrulla', label: 'Continuar patrullaje', detalle: 'Solo responde y retoma su ruta' },
                    ] as const
                  ).map((opcion) => (
                    <label
                      key={opcion.valor}
                      className={`flex cursor-pointer items-start gap-3 rounded-lg border px-4 py-3 transition-colors ${
                        rul.despues_quiz.modo === opcion.valor
                          ? 'border-indigo-500 bg-indigo-50'
                          : 'border-slate-200 hover:border-indigo-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="despues_quiz"
                        checked={rul.despues_quiz.modo === opcion.valor}
                        onChange={() =>
                          setRuleta({ despues_quiz: { ...rul.despues_quiz, modo: opcion.valor } })
                        }
                        className="mt-1 accent-indigo-600"
                      />
                      <span>
                        <span className="block font-medium text-slate-800">{opcion.label}</span>
                        <span className="block text-sm text-slate-500">{opcion.detalle}</span>
                      </span>
                    </label>
                  ))}
                </div>
                {rul.despues_quiz.modo === 'guiar_al_stand' && (
                  <div className="mt-1">
                    <ItemPanel
                      icono={<IconoPlay />}
                      label="Secuencia para guía"
                      detalle={rul.despues_quiz.secuencia_guia || 'Vacío — escribe el nombre de Temi Center'}
                      onClick={() => setDialogo({ tipo: 'secuencia' })}
                    />
                  </div>
                )}

                <hr className="my-5 border-slate-200" />

                <div className="flex items-center justify-between">
                  <p className="font-semibold text-slate-800">Preguntas</p>
                  <button
                    onClick={() => setDialogo({ tipo: 'pregunta', index: null })}
                    className="flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-indigo-50"
                    title="Agregar pregunta"
                  >
                    <IconoMas />
                  </button>
                </div>
                <div className="mt-2 space-y-1">
                  {rul.preguntas.map((pregunta, i) => (
                    <ItemPanel
                      key={i}
                      icono={<IconoVolumen />}
                      label={`${i + 1} pregunta`}
                      detalle={`Preg: ${pregunta.texto}`}
                      onClick={() => setDialogo({ tipo: 'pregunta', index: i })}
                    />
                  ))}
                </div>
                <p className="mt-2 text-right text-sm text-slate-400">
                  Min. {LIMITES.PREGUNTAS_MIN}
                </p>
                {rul.preguntas.length < LIMITES.PREGUNTAS_MIN && (
                  <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
                    Agrega al menos {LIMITES.PREGUNTAS_MIN} preguntas para que la ruleta funcione.
                  </p>
                )}
              </div>
            )}
              </>
            )}
          </div>

          <div className="border-t border-slate-200 p-6">
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmarBorrar(true)}
                disabled={guardar.isPending || borrar.isPending}
                title="Eliminar proyecto"
                className="rounded-lg border border-red-300 px-5 py-4 font-semibold text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
              >
                Eliminar
              </button>
              <button
                onClick={intentarGuardar}
                disabled={guardar.isPending}
                className="flex flex-1 items-center justify-center gap-3 rounded-lg bg-indigo-600 py-4 text-lg font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
              >
                <IconoGuardar />
                {guardar.isPending ? 'Guardando...' : guardadoOk ? 'Guardado ✓' : 'Guardar'}
              </button>
            </div>
            {errorGuardar && <p className="mt-2 text-sm text-red-600">{errorGuardar}</p>}
            {guardar.isError && (
              <p className="mt-2 text-sm text-red-600">Error al guardar. Intenta de nuevo.</p>
            )}
          </div>
        </aside>
      </div>

      {/* ─── Confirmar eliminación ─── */}
      {confirmarBorrar && (
        <Modal
          titulo="Eliminar proyecto"
          textoAceptar={borrar.isPending ? 'Eliminando...' : 'Sí, eliminar'}
          aceptarDeshabilitado={borrar.isPending}
          onCancelar={() => setConfirmarBorrar(false)}
          onAceptar={() => borrar.mutate()}
        >
          <p className="text-slate-700">
            Vas a eliminar el proyecto <span className="font-semibold">"{nombre}"</span>. Esta acción
            no se puede deshacer y se borrarán también sus imágenes y videos.
          </p>

          {(robotsFijados?.length ?? 0) > 0 ? (
            <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <p className="font-semibold">⚠️ Este proyecto está fijado a estos robots:</p>
              <ul className="mt-1 list-disc pl-5">
                {robotsFijados!.map((s) => (
                  <li key={s} className="font-mono">
                    {s}
                  </li>
                ))}
              </ul>
              <p className="mt-2">
                Al eliminarlo, esos robots quedarán <span className="font-semibold">sin proyecto</span>{' '}
                y volverán a su configuración por defecto en el próximo reinicio.
              </p>
            </div>
          ) : (
            <p className="mt-4 text-sm text-slate-500">
              Este proyecto no está fijado a ningún robot.
            </p>
          )}

          {borrar.isError && (
            <p className="mt-3 text-sm text-red-600">No se pudo eliminar. Intenta de nuevo.</p>
          )}
        </Modal>
      )}

      {/* ─── Diálogos ─── */}
      {dialogo?.tipo === 'titulo' && (
        <DialogTexto
          titulo="Editar titulo"
          valor={ini.titulo}
          maxCaracteres={LIMITES.TITULO_MAX}
          onGuardar={(titulo) => setInicial({ titulo })}
          onCerrar={() => setDialogo(null)}
        />
      )}
      {dialogo?.tipo === 'subtitulo' && (
        <DialogTexto
          titulo="Editar subtitulo"
          valor={ini.subtitulo}
          maxCaracteres={LIMITES.SUBTITULO_MAX}
          onGuardar={(subtitulo) => setInicial({ subtitulo })}
          onCerrar={() => setDialogo(null)}
        />
      )}
      {dialogo?.tipo === 'boton' && (
        <DialogBoton
          valor={ini.boton}
          valorAgente={ini.boton_agente}
          destino={ini.destino_boton}
          agenteActivo={agente.activo}
          maxCaracteres={LIMITES.BOTON_MAX}
          onGuardar={(boton, destino_boton, boton_agente) =>
            setInicial({ boton, destino_boton, boton_agente })
          }
          onCerrar={() => setDialogo(null)}
        />
      )}
      {dialogo?.tipo === 'tts-inicial' && (
        <DialogTts
          titulo={dialogo.titulo}
          valor={ini[dialogo.campo]}
          maxCaracteres={LIMITES.TTS_MAX}
          onGuardar={(texto) => setInicial({ [dialogo.campo]: texto })}
          onCerrar={() => setDialogo(null)}
        />
      )}
      {dialogo?.tipo === 'tts-ruleta' && (
        <DialogTts
          titulo={dialogo.titulo}
          valor={rul[dialogo.campo]}
          maxCaracteres={LIMITES.TTS_MAX}
          onGuardar={(texto) => setRuleta({ [dialogo.campo]: texto })}
          onCerrar={() => setDialogo(null)}
        />
      )}
      {dialogo?.tipo === 'logo' && (
        <DialogArchivo
          titulo="Cambiar logo de la empresa"
          tipo="imagen"
          projectId={projectId!}
          nota="Resolución recomendada: 512 × 512 px, PNG con fondo transparente"
          onSubido={(url) => setInicial({ logo_url: url })}
          onCerrar={() => setDialogo(null)}
        />
      )}
      {dialogo?.tipo === 'fondo' && (
        <DialogArchivo
          titulo="Cambiar imagen de fondo"
          tipo="imagen"
          projectId={projectId!}
          onSubido={(url) =>
            dialogo.pantalla === 'inicial' ? setInicial({ fondo_url: url }) : setRuleta({ fondo_url: url })
          }
          onCerrar={() => setDialogo(null)}
        />
      )}
      {dialogo?.tipo === 'video' && (
        <DialogArchivo
          titulo="Cargar video para patrullaje"
          tipo="video"
          projectId={projectId!}
          onSubido={(url) => setInicial({ video_patrullaje_url: url })}
          onCerrar={() => setDialogo(null)}
        />
      )}
      {dialogo?.tipo === 'secuencia' && (
        <DialogTextoSimple
          titulo="Secuencia para guía"
          etiqueta="Escribe el nombre de la secuencia creada en Temi center"
          valor={rul.despues_quiz.secuencia_guia}
          onGuardar={(secuencia_guia) =>
            setRuleta({ despues_quiz: { ...rul.despues_quiz, secuencia_guia } })
          }
          onCerrar={() => setDialogo(null)}
        />
      )}
      {dialogo?.tipo === 'colores-opciones' && (
        <DialogColoresOpciones
          valoresFondo={rul.colores_opciones ?? ['', '', '']}
          valoresTexto={rul.colores_texto_opciones ?? ['', '', '']}
          onGuardar={(colores_opciones, colores_texto_opciones) =>
            setRuleta({ colores_opciones, colores_texto_opciones })
          }
          onCerrar={() => setDialogo(null)}
        />
      )}
      {dialogo?.tipo === 'pregunta' && (
        <DialogPregunta
          titulo={
            dialogo.index === null
              ? 'Configuración - nueva pregunta'
              : `Configuración - ${dialogo.index + 1} pregunta`
          }
          valor={dialogo.index === null ? null : rul.preguntas[dialogo.index]}
          puedeEliminar={dialogo.index !== null && rul.preguntas.length > LIMITES.PREGUNTAS_MIN}
          onGuardar={(pregunta) => guardarPregunta(dialogo.index, pregunta)}
          onEliminar={() => dialogo.index !== null && eliminarPregunta(dialogo.index)}
          onCerrar={() => setDialogo(null)}
        />
      )}
    </div>
  )
}
