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

/** "Cambios guardados": arriba a la derecha y se cierra solo en 1,5 s */
export async function avisoGuardado(titulo = 'Cambios guardados') {
  const { default: Swal } = await import('sweetalert2')
  return Swal.fire({
    position: 'top-end',
    icon: 'success',
    title: titulo,
    showConfirmButton: false,
    timer: 1500,
    customClass: { popup: 'alerta-guardado' },
  })
}
