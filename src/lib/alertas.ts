/**
 * Avisos emergentes del panel (SweetAlert2).
 *
 * La librería se carga con import() dinámico: no entra en el paquete inicial
 * del panel y se descarga solo la primera vez que se muestra un aviso. Es el
 * mismo criterio que se usó para cargar las páginas del admin por separado.
 *
 * El tamaño y la tipografía se ajustan en index.css con la clase
 * .alerta-guardado (SweetAlert2 mide todo en em, así que basta con bajar el
 * font-size del popup para que el icono, el título y el ancho se reduzcan
 * en la misma proporción).
 */

/**
 * "Cambios guardados": toast arriba a la derecha, 3 s con barra de tiempo.
 * Pasar el mouse por encima lo pausa, para alcanzar a leerlo.
 */
export async function avisoGuardado(titulo = 'Cambios guardados') {
  const { default: Swal } = await import('sweetalert2')
  return Swal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 3000,
    timerProgressBar: true,
    customClass: { popup: 'alerta-toast' },
    didOpen: (toast) => {
      toast.onmouseenter = Swal.stopTimer
      toast.onmouseleave = Swal.resumeTimer
    },
  }).fire({
    icon: 'success',
    title: titulo,
  })
}

/**
 * Error (no se pudo guardar, sin conexión): ventana arriba a la derecha, 6 s
 * con barra de tiempo, porque trae la causa y hay que alcanzar a leerla.
 */
export async function avisoError(titulo: string, texto?: string) {
  const { default: Swal } = await import('sweetalert2')
  return Swal.fire({
    position: 'top-end',
    icon: 'error',
    title: titulo,
    text: texto,
    showConfirmButton: false,
    timer: 6000,
    timerProgressBar: true,
    customClass: { popup: 'alerta-guardado' },
  })
}
