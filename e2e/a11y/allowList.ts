// G25: the axe findings the guard lets through. Each entry needs a reason and, where a third party must fix it, a link to
// the issue. D5: it starts empty.

export interface Allowed {
  /** The axe rule id. */
  rule: string;
  /** The matrix page's name it applies to; every page when omitted. */
  page?: string;
  /** A substring of the node's CSS target. */
  target?: string;
  reason: string;
  link?: string;
}

export const ALLOW_LIST: readonly Allowed[] = [];
