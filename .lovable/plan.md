

# Fix: Restore missing exports in `content-types.ts`

## Problem
The file `src/lib/content-types.ts` was recently refactored to a new post-type/block-type system, but it removed several exports that **27 files** still depend on. This causes 45+ build errors, breaking both the preview and publishing.

## Missing exports
- `TYPE_COLORS` — a `Record<string, string>` mapping old content types to Tailwind badge classes
- `displayContentType(type: string): string` — returns a human-friendly label for a content type
- `ORDERED_CONTENT_TYPES` — array of content type strings in display order
- `SLUG_TO_TYPE` — maps URL slugs to content type names
- `BLUEPRINT_CONTENT_TYPES` — subset of content types for blueprints
- `BOUNTY_CONTENT_TYPES` — subset of content types for bounties
- `TOPICS` — array of topic strings

## Plan

**Single file change: `src/lib/content-types.ts`**

Add the following legacy exports back to the bottom of the file, after the existing code. Values are reconstructed from usage patterns across the codebase:

1. **`ORDERED_CONTENT_TYPES`** — array of all original content type strings (Prompt File, Agent Blueprint, AI Agent Install Guide, Model Config Guide, Integration Guide, Workflow Template, Evaluation Framework, Agent Stack, Failure Library, Blog)
2. **`BLUEPRINT_CONTENT_TYPES`** — the non-bounty subset
3. **`BOUNTY_CONTENT_TYPES`** — bounty-specific types (Open Question, Challenge)
4. **`TYPE_COLORS`** — Tailwind class strings for each content type badge
5. **`displayContentType(type)`** — maps internal type names to shorter display labels
6. **`SLUG_TO_TYPE`** — URL slug to content type mapping
7. **`TOPICS`** — array of topic tags

These are purely additive — the new post-type system stays untouched.

## Technical details

All changes are in one file. No database or backend changes needed. This will immediately fix the 45 build errors and restore the preview and publishing.

