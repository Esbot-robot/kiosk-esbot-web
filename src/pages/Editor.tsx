import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Project } from '../types/config'

/**
 * Editor de módulos — WYSIWYG con dos pestañas (Pantalla inicial / Pantalla Ruleta).
 * Estructura base: se construye contra los mockups de Figma en la siguiente fase.
 */
export function Editor() {
  const { projectId } = useParams<{ projectId: string }>()

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

  if (isLoading) return <p className="p-12 text-slate-500">Cargando proyecto...</p>
  if (!proyecto) return <p className="p-12 text-red-600">Proyecto no encontrado.</p>

  return (
    <div className="p-12">
      <h2 className="text-2xl font-bold text-indigo-600">{proyecto.nombre}</h2>
      <p className="mt-4 text-slate-600">
        Editor en construcción — aquí van las pestañas "Pantalla inicial" y "Pantalla
        Ruleta" con el preview editable y la configuración de voces (TTS).
      </p>
      <pre className="mt-8 max-h-96 overflow-auto rounded-lg bg-slate-900 p-6 text-xs text-green-400">
        {JSON.stringify(proyecto.config, null, 2)}
      </pre>
    </div>
  )
}
