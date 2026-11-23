/* Synth 09: the editor's one ladder of layers. A window opened over another, a menu opened inside one, and the notepad over
   any of them always land in the right order; each window's scrim is its layer less one. No imports, so any module (the
   menus' recipe, the brand pieces) can read it without a cycle. */

export const LAYER = {
  /** A tile's window, Colours, a reference group, Library, Classification, Mark still open. */
  window: 51,
  /** The prompt window, which a tile's window can open over. */
  promptWindow: 61,
  /** A confirmation or small window, over any window (Clear, Publish, Recently removed, Shortcuts, a keep-or-drop). */
  confirm: 71,
  /** Menus, pickers, popovers and the colour picker: over every window they can open from. */
  floating: 74,
  /** A menu opened from a floating surface (the colour picker's saved-colour menu). */
  floatingOver: 75,
  /** The notepad, over the window whose box it opened from. */
  notepad: 76,
  /** The one notice at the foot. */
  notice: 80,
} as const;
