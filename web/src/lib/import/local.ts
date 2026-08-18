import { sanitizeHtml } from '../sanitize'
import { textToHtml } from '../text'

export interface ImportedDoc {
  title: string
  html: string
}

export const ACCEPTED_EXTENSIONS = '.txt,.md,.markdown,.rtf,.html,.htm,.docx,.fountain,.text'

function baseName(name: string): string {
  return (
    name
      .replace(/\.[^.]+$/, '')
      .replace(/[_-]+/g, ' ')
      .trim() || 'Guion importado'
  )
}

/** Markdown mínimo: encabezados, negrita, cursiva y separadores. */
function markdownToHtml(md: string): string {
  const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const inline = (s: string) =>
    escape(s)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|\W)\*(?!\s)(.+?)\*/g, '$1<em>$2</em>')
      .replace(/==(.+?)==/g, '<mark>$1</mark>')
      .replace(/__(.+?)__/g, '<u>$1</u>')

  const out: string[] = []
  let list: string[] | null = null
  const flush = () => {
    if (list) {
      out.push(`<ul>${list.map((li) => `<li>${li}</li>`).join('')}</ul>`)
      list = null
    }
  }

  for (const rawLine of md.replace(/\r\n?/g, '\n').split('\n')) {
    const line = rawLine.trimEnd()
    const heading = /^(#{1,3})\s+(.*)$/.exec(line)
    const bullet = /^[-*+]\s+(.*)$/.exec(line)
    if (heading) {
      flush()
      out.push(`<h${heading[1].length}>${inline(heading[2])}</h${heading[1].length}>`)
    } else if (bullet) {
      list = list || []
      list.push(inline(bullet[1]))
    } else if (!line.trim()) {
      flush()
    } else {
      flush()
      out.push(`<p>${inline(line)}</p>`)
    }
  }
  flush()
  return out.join('') || '<p></p>'
}

/** RTF sin librería: quita grupos de control y deja el texto legible. */
function rtfToText(rtf: string): string {
  return rtf
    .replace(/\\'([0-9a-f]{2})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\\par[d]?/g, '\n')
    .replace(/\\line/g, '\n')
    .replace(/\{\\\*[^{}]*\}/g, '')
    .replace(/\\[a-z]+-?\d*\s?/gi, '')
    .replace(/[{}]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export async function importFile(file: File): Promise<ImportedDoc> {
  const name = file.name.toLowerCase()
  const title = baseName(file.name)

  if (name.endsWith('.docx')) {
    const mammoth = await import('mammoth/mammoth.browser')
    const buffer = await file.arrayBuffer()
    const result = await mammoth.convertToHtml({ arrayBuffer: buffer })
    return { title, html: sanitizeHtml(result.value) }
  }

  const text = await file.text()

  if (name.endsWith('.html') || name.endsWith('.htm')) {
    return { title, html: sanitizeHtml(text) }
  }
  if (name.endsWith('.rtf')) {
    return { title, html: textToHtml(rtfToText(text)) }
  }
  if (name.endsWith('.md') || name.endsWith('.markdown')) {
    return { title, html: sanitizeHtml(markdownToHtml(text)) }
  }
  return { title, html: textToHtml(text) }
}

export async function importFiles(files: FileList | File[]): Promise<ImportedDoc[]> {
  const out: ImportedDoc[] = []
  for (const file of Array.from(files)) {
    try {
      out.push(await importFile(file))
    } catch {
      out.push({ title: baseName(file.name), html: '<p>No se pudo leer este archivo.</p>' })
    }
  }
  return out
}
