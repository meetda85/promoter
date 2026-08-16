import { Extension, Mark, mergeAttributes } from '@tiptap/core'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    fontSize: {
      /** Tamaño relativo, en `em`, para que siga escalando con el prompter. */
      setFontSize: (size: string) => ReturnType
      unsetFontSize: () => ReturnType
    }
    note: {
      toggleNote: () => ReturnType
    }
  }
}

/** Tamaño de letra por selección, encima del tamaño global del prompter. */
export const FontSize = Extension.create({
  name: 'fontSize',

  addOptions() {
    return { types: ['textStyle'] }
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element: HTMLElement) => element.style.fontSize || null,
            renderHTML: (attributes: Record<string, unknown>) =>
              attributes.fontSize ? { style: `font-size: ${attributes.fontSize}` } : {},
          },
        },
      },
    ]
  },

  addCommands() {
    return {
      setFontSize:
        (size: string) =>
        ({ chain }) =>
          chain().setMark('textStyle', { fontSize: size }).run(),
      unsetFontSize:
        () =>
        ({ chain }) =>
          chain().setMark('textStyle', { fontSize: null }).removeEmptyTextStyle().run(),
    }
  },
})

/**
 * Nota de dirección: acotaciones que se ven al editar pero pueden ocultarse al
 * leer (y que nunca cuentan para la duración estimada).
 */
export const Note = Mark.create({
  name: 'note',

  parseHTML() {
    return [{ tag: 'span[data-note="true"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { 'data-note': 'true' }), 0]
  },

  addCommands() {
    return {
      toggleNote:
        () =>
        ({ commands }) =>
          commands.toggleMark(this.name),
    }
  },
})
