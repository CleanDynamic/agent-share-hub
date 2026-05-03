// Shared types for the content-detail data layer.
import type { ContentItemResult } from "@/lib/results/types";

export type AnchorType = "post" | "stage" | "block" | "slide" | "solution";

export interface AuthorInfo {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  derived_bio: string | null;
  is_trusted_solver?: boolean;
}

export interface ViewerState {
  hasLiked: boolean;
  hasBookmarked: boolean;
  hasReposted: boolean;
  isFollowing: boolean;
  readingProgressPct: number;
}

export interface RelatedPost {
  id: string;
  title: string;
  slug: string | null;
  post_type: string;
  cover_image_url: string | null;
}

export interface PostForViewer {
  post: any;
  author: AuthorInfo;
  bountySolvers: AuthorInfo[];
  relatedPosts: RelatedPost[];
  viewer: ViewerState;
  solutions?: any[];
  discussionRoots?: any[];
  provenance?: any[];
}

export interface CommentReactionSummary {
  reaction: string;
  count: number;
  reactedByViewer: boolean;
}

export interface ThreadedComment {
  id: string;
  anchor_type: AnchorType;
  anchor_id: string;
  parent_comment_id: string | null;
  author: AuthorInfo | null;
  body: any;
  bodyText: string;
  createdAt: string;
  isEdited: boolean;
  reactions: CommentReactionSummary[];
  replies: ThreadedComment[];
  isUnread: boolean;
}

export type ExportFormat =
  | "markdown"
  | "pdf"
  | "plain"
  | "ai-pdf"
  | "json"
  | "copy-json";

export interface CanonicalProseBlock {
  type: string;
  text?: string;
  data?: any;
}

export interface CanonicalBlock {
  id: string;
  type: string;
  position: number;
  text?: string | null;
  formatting?: any;
  image_url?: string | null;
  file_url?: string | null;
  file_name?: string | null;
  use_instructions?: string | null;
  sub_blocks?: any;
  raw?: any;
}

export interface CanonicalStage {
  id: string;
  name: string;
  missingDescription?: string | null;
  blocks: CanonicalBlock[];
  connections: any[];
}

export interface CanonicalPostPayload {
  meta: Record<string, any>;
  content: {
    prose: CanonicalProseBlock[];
    stages: CanonicalStage[];
    results: ContentItemResult[];
    references: any[];
  };
  bountyMeta?: Record<string, any>;
  acceptedSolutions?: any[];
  authorAttribution: {
    name: string;
    handle: string;
    derivedBio: string | null;
    profileUrl: string;
  };
}
