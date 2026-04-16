import { Extension } from '@tiptap/react';

/**
 * Adds the formatting keyboard shortcuts that StarterKit does not cover
 * out of the box:
 *   - Cmd/Ctrl + Shift + X → toggle strikethrough
 *   - Cmd/Ctrl + K        → prompt for a URL and apply the link mark
 *
 * StarterKit already provides:
 *   Cmd/Ctrl + B (bold), + I (italic), + U (underline), + E (code).
 */
export const FormattingShortcuts = Extension.create({
  name: 'formattingShortcuts',

  addKeyboardShortcuts() {
    return {
      'Mod-Shift-x': () => this.editor.commands.toggleStrike(),

      'Mod-k': () => {
        const previousUrl = this.editor.getAttributes('link').href as
          | string
          | undefined;

        const input = window.prompt('Enter URL', previousUrl ?? 'https://');

        // User pressed cancel – do nothing, but consume the shortcut so the
        // browser's default Cmd+K behaviour (focus URL bar) does not fire.
        if (input === null) {
          return true;
        }

        // Empty string → remove the existing link on the current selection.
        if (input.trim() === '') {
          return this.editor
            .chain()
            .focus()
            .extendMarkRange('link')
            .unsetLink()
            .run();
        }

        return this.editor
          .chain()
          .focus()
          .extendMarkRange('link')
          .setLink({ href: input.trim() })
          .run();
      },
    };
  },
});
