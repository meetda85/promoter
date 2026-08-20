import { useEffect, useRef, useState } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import TextStyle from '@tiptap/extension-text-style'
import Color from '@tiptap/extension-color'
import Highlight from '@tiptap/extension-highlight'
import TextAlign from '@tiptap/extension-text-align'
import Placeholder from '@tiptap/extension-placeholder'
import { FontSize, Note } from '../lib/editor/extensions'
import { HIGHLIGHT_COLORS, TEXT_COLORS } from '../lib/themes'
import { Sheet, Swatches } from './ui'

export interface ScriptEditorProps {
  /** Cambiar esta clave reinicia el editor con contenido nuevo. */
  docKey: string
  initialTitle: string
  initialHtml: string
  onSave: (title: string, html: string) => void | Promise<void>
  onBack: () => void
  /** Acción del botón principal; si falta, no se muestra. */
  onPrimary?: () => void
  primaryLabel?: string
  /** Texto de estado bajo el título (por ejemplo, «Guardado en el prompter»). */
  statusHint?: string
}

/**
 * Editor del guion, sin saber de dónde viene ni a dónde va.
 *
 * Lo usan el propio teleprompter y el mando: en un caso guarda en la base de
 * datos local y en el otro manda el guion por el enlace. Todo lo que se marque
 * aquí (color, resaltado, sombreado, tamaño de un párrafo suelto, notas) viaja
 * dentro del HTML y se pinta igual en el prompter.
 */
export function ScriptEditor({
  docKey,
  initialTitle,
  initialHtml,
  onSave,
  onBack,
  onPrimary,
  primaryLabel,
  statusHint,
}: ScriptEditorProps) {
  const [title, setTitle] = useState(initialTitle)
  const [colorSheet, setColorSheet] = useState<null | 'text' | 'highlight'>(null)
  const [dirty, setDirty] = useState(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // El mando recibe estado del prompter varias veces por segundo y se
  // redibuja; sin esta referencia, `onSave` cambiaría de identidad en cada
  // ciclo y el temporizador de autoguardado no llegaría a dispararse nunca.
  const saveRef = useRef(onSave)
  saveRef.current = onSave

  const editor = useEditor(
    {
      extensions: [
        StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
        Underline,
        TextStyle,
        Color,
        FontSize,
        Note,
        Highlight.configure({ multicolor: true }),
        TextAlign.configure({ types: ['heading', 'paragraph'] }),
        Placeholder.configure({ placeholder: 'Escribe o pega aquí tu guion…' }),
      ],
      content: initialHtml || '<p></p>',
      onUpdate: () => setDirty(true),
    },
    [docKey],
  )

  useEffect(() => {
    setTitle(initialTitle)
    setDirty(false)
  }, [docKey, initialTitle])

  // Autoguardado: en rodaje nadie se acuerda de pulsar «guardar».
  useEffect(() => {
    if (!dirty || !editor) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      void saveRef.current(title.trim() || 'Guion sin título', editor.getHTML())
      setDirty(false)
    }, 900)
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
  }, [dirty, title, editor])

  const saveNow = async () => {
    if (!editor) return
    await saveRef.current(title.trim() || 'Guion sin título', editor.getHTML())
    setDirty(false)
  }

  const on = (name: string, attrs?: Record<string, unknown>) =>
    editor?.isActive(name, attrs) ? 'true' : 'false'

  return (
    <div className="editor-shell">
      <div className="topbar">
        <button
          className="btn ghost icon"
          onClick={async () => {
            await saveNow()
            onBack()
          }}
          aria-label="Volver"
        >
          ‹
        </button>
        <input
          className="input grow"
          value={title}
          placeholder="Título del guion"
          onChange={(e) => {
            setTitle(e.target.value)
            setDirty(true)
          }}
        />
        {onPrimary && (
          <button
            className="btn primary"
            onClick={async () => {
              await saveNow()
              onPrimary()
            }}
          >
            {primaryLabel || 'Leer'}
          </button>
        )}
      </div>

      <div className="toolbar">
        <button
          className="tool"
          data-on={on('bold')}
          onClick={() => editor?.chain().focus().toggleBold().run()}
        >
          B
        </button>
        <button
          className="tool"
          data-on={on('italic')}
          style={{ fontStyle: 'italic' }}
          onClick={() => editor?.chain().focus().toggleItalic().run()}
        >
          I
        </button>
        <button
          className="tool"
          data-on={on('underline')}
          style={{ textDecoration: 'underline' }}
          onClick={() => editor?.chain().focus().toggleUnderline().run()}
        >
          U
        </button>
        <button
          className="tool"
          data-on={on('heading', { level: 2 })}
          onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
          title="Marcador de sección"
        >
          H
        </button>
        <button className="tool" onClick={() => setColorSheet('text')} title="Color del texto">
          <span style={{ color: 'var(--accent)' }}>A</span>
        </button>
        <button className="tool" onClick={() => setColorSheet('highlight')} title="Resaltado">
          <span
            style={{
              background: 'var(--accent)',
              color: '#17130a',
              padding: '0 4px',
              borderRadius: 4,
            }}
          >
            A
          </span>
        </button>
        <button
          className="tool"
          onClick={() => editor?.chain().focus().setFontSize('1.35em').run()}
          title="Aumentar esta parte"
        >
          A↑
        </button>
        <button
          className="tool"
          onClick={() => editor?.chain().focus().setFontSize('0.8em').run()}
          title="Reducir esta parte"
        >
          A↓
        </button>
        <button
          className="tool"
          onClick={() => editor?.chain().focus().unsetFontSize().run()}
          title="Tamaño normal"
        >
          A=
        </button>
        <button
          className="tool"
          data-on={on('note')}
          onClick={() => editor?.chain().focus().toggleNote().run()}
          title="Nota (no se lee)"
        >
          ✎
        </button>
        <button
          className="tool"
          data-on={on('bulletList')}
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
        >
          •
        </button>
        <button
          className="tool"
          onClick={() => editor?.chain().focus().setTextAlign('left').run()}
          data-on={on('paragraph', { textAlign: 'left' })}
        >
          ⇤
        </button>
        <button
          className="tool"
          onClick={() => editor?.chain().focus().setTextAlign('center').run()}
          data-on={on('paragraph', { textAlign: 'center' })}
        >
          ⇔
        </button>
        <button
          className="tool"
          onClick={() => editor?.chain().focus().unsetAllMarks().unsetTextAlign().run()}
          title="Quitar formato"
        >
          ⌫
        </button>
      </div>

      <div className="editor-body">
        <EditorContent editor={editor} />
      </div>

      <div
        style={{
          position: 'fixed',
          right: 'calc(var(--safe-right) + 16px)',
          bottom: 'calc(var(--safe-bottom) + 16px)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        {statusHint && !dirty && <span className="chip">{statusHint}</span>}
        <button className="btn" onClick={() => void saveNow()}>
          {dirty ? 'Guardar' : 'Guardado ✓'}
        </button>
      </div>

      {colorSheet && (
        <Sheet
          title={colorSheet === 'text' ? 'Color del texto' : 'Resaltado y sombreado'}
          onClose={() => setColorSheet(null)}
        >
          <div className="muted" style={{ marginBottom: 12 }}>
            Selecciona antes el trozo de texto que quieras cambiar.
          </div>
          <Swatches
            colors={colorSheet === 'text' ? TEXT_COLORS : HIGHLIGHT_COLORS}
            allowNone
            value={
              colorSheet === 'text'
                ? (editor?.getAttributes('textStyle').color as string | undefined)
                : (editor?.getAttributes('highlight').color as string | undefined)
            }
            onChange={(color) => {
              if (!editor) return
              const chain = editor.chain().focus()
              if (colorSheet === 'text') {
                if (color) chain.setColor(color).run()
                else chain.unsetColor().run()
              } else if (color) {
                chain.setHighlight({ color }).run()
              } else {
                chain.unsetHighlight().run()
              }
              setDirty(true)
            }}
          />
          <div className="section-title">Personalizado</div>
          <input
            className="input"
            type="color"
            onChange={(e) => {
              if (!editor) return
              const chain = editor.chain().focus()
              if (colorSheet === 'text') chain.setColor(e.target.value).run()
              else chain.setHighlight({ color: e.target.value }).run()
              setDirty(true)
            }}
          />
        </Sheet>
      )}
    </div>
  )
}
