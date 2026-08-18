/**
 * Limpieza de HTML importado (Drive, archivos .html, portapapeles).
 *
 * El guion acaba renderizándose con `dangerouslySetInnerHTML` en el prompter,
 * así que todo lo que entre de fuera pasa por aquí primero.
 */
const ALLOWED_TAGS = new Set([
  'P',
  'BR',
  'DIV',
  'SPAN',
  'STRONG',
  'B',
  'EM',
  'I',
  'U',
  'S',
  'MARK',
  'H1',
  'H2',
  'H3',
  'UL',
  'OL',
  'LI',
  'BLOCKQUOTE',
  'HR',
])

const ALLOWED_STYLE_PROPS = new Set([
  'color',
  'background-color',
  'font-weight',
  'font-style',
  'text-decoration',
  'text-align',
  'font-size',
])

/** Sólo colores/medidas: nada de `url()`, `expression()` ni variables. */
const SAFE_VALUE = /^[#a-zA-Z0-9 .,()%-]+$/

function cleanStyle(style: string): string {
  return style
    .split(';')
    .map((decl) => decl.trim())
    .filter(Boolean)
    .map((decl) => {
      const idx = decl.indexOf(':')
      if (idx < 0) return ''
      const prop = decl.slice(0, idx).trim().toLowerCase()
      const value = decl.slice(idx + 1).trim()
      if (!ALLOWED_STYLE_PROPS.has(prop)) return ''
      if (!SAFE_VALUE.test(value)) return ''
      return `${prop}: ${value}`
    })
    .filter(Boolean)
    .join('; ')
}

export function sanitizeHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html')

  doc
    .querySelectorAll('script, style, iframe, object, embed, link, meta, noscript, svg')
    .forEach((el) => el.remove())

  const walk = (node: Element) => {
    for (const child of Array.from(node.children)) walk(child)

    if (!ALLOWED_TAGS.has(node.tagName)) {
      // Se conserva el texto: desaparece la etiqueta, no el contenido.
      const parent = node.parentNode
      if (parent) {
        while (node.firstChild) parent.insertBefore(node.firstChild, node)
        parent.removeChild(node)
      }
      return
    }

    for (const attr of Array.from(node.attributes)) {
      const name = attr.name.toLowerCase()
      if (name === 'style') {
        const cleaned = cleanStyle(attr.value)
        if (cleaned) node.setAttribute('style', cleaned)
        else node.removeAttribute('style')
        continue
      }
      if (name === 'data-note' && attr.value === 'true') continue
      node.removeAttribute(attr.name)
    }
  }

  Array.from(doc.body.children).forEach((el) => walk(el))
  return doc.body.innerHTML.trim() || '<p></p>'
}
