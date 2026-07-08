import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { publicarConfigRobot } from '../lib/storage'
import { LIMITES, type EventConfig, type Pregunta, type Project } from '../types/config'
import { DialogBoton, DialogTexto, DialogTts, DialogTextoSimple } from '../components/editor/DialogTexto'
import { DialogPregunta } from '../components/editor/DialogPregunta'
import { DialogArchivo } from '../components/editor/DialogArchivo'
import { IconoGuardar, IconoLapiz, IconoMas, IconoOnda, IconoPlay, IconoVolumen } from '../components/iconos'

type Pestana = 'inicial' | 'ruleta'

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

type CampoTtsInicial =
  | 'tts_toca_pantalla'
  | 'tts_llega_stand'
  | 'tts_despedida_stand'
  | 'tts_reanuda_patrulla'
  | 'tts_sigueme'
type CampoTtsRuleta = 'tts_acierta' | 'tts_no_acierta' | 'tts_sin_respuesta'

const TTS_INICIAL: { campo: CampoTtsInicial; label: string }[] = [
  { campo: 'tts_toca_pantalla', label: 'Cuando usuario toca la pantalla' },
  { campo: 'tts_llega_stand', label: 'Cuando robot llega al stand' },
  { campo: 'tts_despedida_stand', label: 'Despedida en el stand' },
  { campo: 'tts_reanuda_patrulla', label: 'Cuando el robot reanuda patrulla' },
  { campo: 'tts_sigueme', label: 'Al invitar a seguirlo (quiz ganado)' },
]

const TTS_RULETA: { campo: CampoTtsRuleta; label: string }[] = [
  { campo: 'tts_acierta', label: 'Cuando usuario acierta pregunta' },
  { campo: 'tts_no_acierta', label: 'Cuando usuario no acierta pregunta' },
  { campo: 'tts_sin_respuesta', label: 'Cuando no hubo respuesta' },
]

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
  const queryClient = useQueryClient()
  const [pestana, setPestana] = useState<Pestana>('inicial')
  const [dialogo, setDialogo] = useState<Dialogo | null>(null)
  const [nombre, setNombre] = useState('')
  const [config, setConfig] = useState<EventConfig | null>(null)
  const [guardadoOk, setGuardadoOk] = useState(false)

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

  if (isLoading || !config) {
    return <p className="p-12 text-slate-500">Cargando proyecto...</p>
  }

  const ini = config.pantalla_inicial
  const rul = config.pantalla_ruleta

  function setInicial(cambios: Partial<EventConfig['pantalla_inicial']>) {
    setConfig((c) => c && { ...c, pantalla_inicial: { ...c.pantalla_inicial, ...cambios } })
  }
  function setRuleta(cambios: Partial<EventConfig['pantalla_ruleta']>) {
    setConfig((c) => c && { ...c, pantalla_ruleta: { ...c.pantalla_ruleta, ...cambios } })
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

  const estiloFondo = (url: string) =>
    url
      ? { backgroundImage: `url(${url})`, backgroundSize: 'cover', backgroundPosition: 'center' }
      : { background: 'linear-gradient(160deg, #1e2a4a 0%, #10173a 100%)' }

  return (
    <div className="flex h-full flex-col">
      {/* Barra superior: nombre + pestañas */}
      <div className="flex items-center justify-between border-b border-slate-200 bg-white pl-10">
        <input
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          className="w-96 rounded px-2 py-4 text-2xl font-bold text-indigo-600 focus:bg-slate-50 focus:outline-none"
          title="Nombre del proyecto (clic para editar)"
        />
        <div className="flex">
          {(['inicial', 'ruleta'] as Pestana[]).map((p) => (
            <button
              key={p}
              onClick={() => setPestana(p)}
              className={`px-8 py-5 font-medium transition-colors ${
                pestana === p
                  ? 'border-b-2 border-indigo-600 bg-slate-50 text-indigo-600'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {p === 'inicial' ? 'Pantalla inicial' : 'Pantalla Ruleta'}
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

                <div className="mt-10 flex items-center gap-2">
                  <span
                    className="rounded-full px-12 py-4 text-xl font-bold"
                    style={{
                      color: ini.boton.color_texto || '#ffffff',
                      backgroundColor: ini.boton.color_fondo || '#031046',
                      border: `4px solid ${ini.boton.color_contorno || '#FFD700'}`,
                    }}
                  >
                    {ini.boton.texto || 'JUGAR AHORA'}
                  </span>
                  <Lapiz title="Editar botón" onClick={() => setDialogo({ tipo: 'boton' })} />
                </div>
              </div>
            </div>
          ) : (
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
              <div className="flex h-full flex-col items-center justify-center gap-5">
                {/* Ruleta simulada (el diseño real vive en la app) */}
                <div
                  className="h-48 w-48 rounded-full border-8 border-yellow-500 shadow-xl"
                  style={{
                    background:
                      'conic-gradient(#4648d4 0deg 120deg, #2196f3 120deg 240deg, #f44336 240deg 360deg)',
                  }}
                />
                <p className="px-10 text-center text-xl font-bold text-white">
                  {rul.preguntas[0]?.texto || 'Aquí aparecerá la pregunta'}
                </p>
                <div className="flex flex-wrap justify-center gap-3 px-10">
                  {(rul.preguntas[0]?.opciones ?? ['Opción 1', 'Opción 2']).map((op, i) => (
                    <span
                      key={i}
                      className="rounded-lg bg-indigo-700 px-6 py-3 font-semibold text-white"
                    >
                      {op}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ─── Panel derecho ─── */}
        <aside className="flex w-96 flex-col border-l border-slate-200 bg-white">
          <div className="flex-1 overflow-y-auto p-6">
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
                : TTS_RULETA.map(({ campo, label }) => (
                    <ItemPanel
                      key={campo}
                      icono={<IconoVolumen />}
                      label={label}
                      detalle={rul[campo] ? `Trigger: ${rul[campo]}` : 'Vacío'}
                      onClick={() => setDialogo({ tipo: 'tts-ruleta', campo, titulo: `Tts: ${label.toLowerCase()}` })}
                    />
                  ))}
            </div>

            <hr className="my-5 border-slate-200" />

            {pestana === 'inicial' ? (
              <div className="space-y-1">
                <ItemPanel
                  icono={<IconoPlay />}
                  label="Video para patrullaje"
                  detalle={ini.video_patrullaje_url ? 'Video cargado ✓' : 'Vacío'}
                  onClick={() => setDialogo({ tipo: 'video' })}
                />
              </div>
            ) : (
              <div>
                {/* Qué hace el robot al terminar el quiz */}
                <p className="font-semibold text-slate-800">Después del quiz</p>
                <div className="mt-2 space-y-2">
                  {(
                    [
                      { valor: 'guiar_al_stand', label: 'Guiar al stand', detalle: 'Dice "sígueme" y reproduce la secuencia de Temi' },
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
          </div>

          <div className="border-t border-slate-200 p-6">
            <button
              onClick={() => guardar.mutate()}
              disabled={guardar.isPending}
              className="flex w-full items-center justify-center gap-3 rounded-lg bg-indigo-600 py-4 text-lg font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
            >
              <IconoGuardar />
              {guardar.isPending ? 'Guardando...' : guardadoOk ? 'Guardado ✓' : 'Guardar'}
            </button>
            {guardar.isError && (
              <p className="mt-2 text-sm text-red-600">Error al guardar. Intenta de nuevo.</p>
            )}
          </div>
        </aside>
      </div>

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
          maxCaracteres={LIMITES.BOTON_MAX}
          onGuardar={(boton) => setInicial({ boton })}
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
