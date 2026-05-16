export interface Comment {
  id: string;
  text: string;
  authorDisplayName: string;
  authorHandle: string;
  authorAvatarUrl?: string;
  isPostAuthor: boolean;
  createdAt: string;
  updatedAt?: string;
  likeCount: number;
  hasLiked: boolean;
  replyCount: number;
  isDeleted: boolean;
}

export interface CommentNode {
  comment: Comment;
  replies: CommentNode[];
}

export interface ThreadedCommentProps {
  comment: Comment;
  replies: CommentNode[];
  level: number;
  collapsedRepliesCount?: number;
  isReplyComposerOpen: boolean;
  onReplyClick: (commentId: string) => void;
  onLikeClick: (commentId: string) => void;
  onMore: (commentId: string) => void;
  onReplyComposerSubmit: (parentId: string, text: string) => void;
  onReplyComposerCancel: (commentId: string) => void;
  onExpandRepliesClick: (commentId: string) => void;
  onContinuedThreadClick?: (commentId: string) => void;
  openComposerId: string | null;
  isNewReply?: boolean;
  highlightedCommentId?: string | null;
}
