import { Extension } from '@tiptap/react';

// Simple slash command extension - just registers the extension name
// Actual slash command handling is done in ArticleEditor via onUpdate
export function createSlashCommandExtension() {
  return Extension.create({
    name: 'slashCommand',
  });
}
