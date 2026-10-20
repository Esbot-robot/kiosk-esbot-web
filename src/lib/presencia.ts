import type { RealtimeChannel } from '@supabase/supabase-js'
import { useSyncExternalStore } from 'react'
import { supabase } from './supabase'

/**
 * Quién tiene el panel abierto, al instante (Supabase Presence, por websocket).
 *
 * Mientras la pestaña está a la vista, el panel se une a un canal y avisa que está
 * ahí; al ocultar la pestaña o cerrarla, sale. El canal es privado (solo con sesión
 * iniciada). La página Usuarios lee esa lista:
 * alguien que entra o sale aparece en el momento, sin esperar a una consulta. En el
 * aviso solo va el identificador de la persona, no el nombre (que se resuelve con la
 * lista de usuarios, que sí está protegida).
 *
 * Importante: cada vez que el panel se une al canal avisa UNA sola vez ("track").
 * Si se vuelve a avisar en el mismo canal (por ejemplo, para cambiar "a la vista" por
 * "oculta"), Presence suma otro aviso en lugar de reemplazar el anterior, y al irse la
 * persona el aviso viejo queda colgado: figuraría conectada hasta recargar la página.
 * Por eso, al ocultar la pestaña se sale del canal, y al volver se entra de nuevo.
 *
 * Presence no guarda historial: la hora de "la última vez" sigue en la base
 * (marcar_visto), y aquí solo se anota cuándo se vio salir a alguien desde este
 * navegador, para que "Hace instantes" sea exacto sin esperar al dato de la base.
 */
export interface EstadoPresencia {
  /** el canal ya entregó la lista (antes de eso no se sabe quién está conectado) */
  lista: boolean
  /** quién tiene el panel abierto y a la vista */
  conectados: ReadonlySet<string>
  /** hora (ms) en que se vio salir, o dejar de mirar el panel, a cada persona */
  salidas: ReadonlyMap<string, number>
}

let estado: EstadoPresencia = { lista: false, conectados: new Set(), salidas: new Map() }
const oyentes = new Set<() => void>()

function publicar(nuevo: EstadoPresencia) {
  estado = nuevo
  oyentes.forEach((oyente) => oyente())
}

/** El estado actual de la presencia; el componente se redibuja cuando cambia */
export function usePresencia(): EstadoPresencia {
  return useSyncExternalStore(
    (avisar) => {
      oyentes.add(avisar)
      return () => oyentes.delete(avisar)
    },
    () => estado
  )
}

/**
 * Une este panel al canal mientras la pestaña esté a la vista. Devuelve la función que
 * lo deja del todo (al cerrar la sesión).
 */
export function iniciarPresencia(userId: string): () => void {
  let canal: RealtimeChannel | null = null

  const unir = () => {
    if (canal) return
    // Al (re)entrar se parte de cero: lo que cambió mientras la pestaña estaba oculta no se
    // toma como una salida "de ahora" (la hora real la da la base).
    publicar({ lista: false, conectados: new Set(), salidas: estado.salidas })
    // Canal privado: solo entra quien tiene sesión iniciada (reglas en supabase/presencia_privada.sql)
    const nuevo = supabase.channel('panel-en-linea', { config: { private: true, presence: { key: userId } } })
    canal = nuevo
    nuevo
      .on('presence', { event: 'sync' }, () => {
        const conectados = new Set(Object.keys(nuevo.presenceState()))
        const salidas = new Map(estado.salidas)
        for (const clave of estado.conectados) {
          if (!conectados.has(clave)) salidas.set(clave, Date.now())
        }
        publicar({ lista: true, conectados, salidas })
      })
      .subscribe((estadoCanal) => {
        if (estadoCanal === 'SUBSCRIBED') void nuevo.track({})
        // Sin las reglas del canal privado (o sin red) no abre: la página Usuarios usa su respaldo
        if (estadoCanal === 'CHANNEL_ERROR' || estadoCanal === 'TIMED_OUT') {
          publicar({ lista: false, conectados: new Set(), salidas: estado.salidas })
        }
      })
  }

  const dejar = () => {
    if (!canal) return
    void supabase.removeChannel(canal)
    canal = null
  }

  const alCambiarPestana = () => {
    if (document.visibilityState === 'visible') unir()
    else dejar()
  }
  document.addEventListener('visibilitychange', alCambiarPestana)
  alCambiarPestana()

  return () => {
    document.removeEventListener('visibilitychange', alCambiarPestana)
    dejar()
    publicar({ lista: false, conectados: new Set(), salidas: new Map() })
  }
}
