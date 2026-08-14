/**
 * El trozo de URL de un evento, sacado de su nombre.
 *
 * Vive fuera del formulario porque el servidor lo calcula por su cuenta al
 * crear el evento: el navegador solo muestra una vista previa, y un enlace que
 * viaja impreso en los QR de la pared no puede depender de lo que llegue en el
 * cuerpo de una petición.
 *
 * Las tildes se quitan descomponiendo el texto y borrando los acentos, no
 * reemplazándolas: sin eso "Liga Páramo" salía como `liga-p-ramo`, porque la
 * "á" no es a-z y caía en el mismo saco que un espacio. La ñ se vuelve n por el
 * mismo camino, que es lo normal en una URL.
 */
export function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}
