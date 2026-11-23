// A topic, in a message (UX-09 Q4).
//
// The same box as a build's card (BuildShareCard): one column, 260 wide at most, one link, here to the topic's page. It names the
// topic by its heading and its author, under the eyebrow Topic; a topic carries no cover, so there is no picture.

import { Link } from "react-router-dom";
import { topicHref } from "@/components/post/postCardModel";
import type { SharedTopic } from "@/lib/messaging/topics";
import { ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { feedback } from "@/lib/theme/motion";
import { r } from "@/lib/theme/radius";
import { SPACE } from "@/lib/theme/space";
import { t } from "@/lib/theme/tokens";
import { eyebrow } from "@/lib/theme/type";

export function TopicShareCard({ topic }: { topic: SharedTopic }) {
  const { state, handlers } = useInteractive<HTMLAnchorElement>();
  return (
    <Link
      to={topicHref(topic.id)}
      data-testid="message-topic"
      {...handlers}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: SPACE.xs,
        width: 260,
        maxWidth: "100%",
        padding: SPACE.sm,
        boxSizing: "border-box",
        borderRadius: r.panel,
        background: state.hovered ? t.control : t.module,
        color: t.text,
        textDecoration: "none",
        transition: feedback("background-color"),
        ...ring(state.focusVisible),
      }}
    >
      <span style={{ ...eyebrow, color: t.label }}>Topic</span>
      <span data-testid="message-topic-heading" style={{ fontSize: 15, lineHeight: "20px", fontWeight: 600, color: t.text, overflowWrap: "anywhere" }}>
        {topic.heading}
      </span>
      {topic.handle ? <span style={{ fontSize: 13, lineHeight: "16px", color: t.label }}>{`@${topic.handle}`}</span> : null}
    </Link>
  );
}

export default TopicShareCard;
