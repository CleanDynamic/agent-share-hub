import { Extension } from '@tiptap/react';
import { ReactRenderer } from '@tiptap/react';
import tippy from 'tippy.js';
import { SlashCommandMenu, getSlashCommandItems } from './SlashCommandMenu';
import type { SlashCommandItem } from './SlashCommandMenu';
import Suggestion from '@tiptap/suggestion';

// We'll use a simple approach: detect "/" at the start of a line
// and show the command menu

export function createSlashCommandExtension(onAddStage: () => string | null) {
  return Extension.create({
    name: 'slashCommand',

    addProseMirrorPlugins() {
      const editor = this.editor;

      // Simple keydown listener for slash commands
      return [
        new (require('@tiptap/pm/state').Plugin)({
          key: new (require('@tiptap/pm/state').PluginKey)('slashCommand'),
          props: {
            handleKeyDown(view: any, event: KeyboardEvent) {
              // We handle slash command via the editor's onUpdate instead
              return false;
            },
          },
        }),
      ];
    },
  });
}
