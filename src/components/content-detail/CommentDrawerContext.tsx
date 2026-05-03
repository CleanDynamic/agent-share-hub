import * as React from "react";
import type { AnchorType, AnchorPreview } from "@/components/content-detail/PrimitiveCommentDrawer";

export interface OpenCommentArgs {
  anchorType: AnchorType;
  anchorId: string;
  preview: AnchorPreview;
}

interface CommentDrawerContextValue {
  open: (args: OpenCommentArgs) => void;
  close: () => void;
}

const CommentDrawerContext = React.createContext<CommentDrawerContextValue | null>(null);

export function CommentDrawerProvider({
  value,
  children,
}: {
  value: CommentDrawerContextValue;
  children: React.ReactNode;
}) {
  return (
    <CommentDrawerContext.Provider value={value}>{children}</CommentDrawerContext.Provider>
  );
}

export function useCommentDrawer(): CommentDrawerContextValue {
  const ctx = React.useContext(CommentDrawerContext);
  if (!ctx) {
    // No-op fallback so consumers outside the provider don't crash.
    return {
      open: () => {},
      close: () => {},
    };
  }
  return ctx;
}
