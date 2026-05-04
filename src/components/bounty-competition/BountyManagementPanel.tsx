import React, { useEffect, useState } from "react";
import {
  X,
  LayoutDashboard,
  Send,
  Settings,
  ChevronDown,
  Check,
  Eye,
  MoreHorizontal,
  MessageSquare,
  Clock,
  UserPlus,
  FileText,
  CheckCircle,
  Pause,
  Play,
  AlertTriangle,
  Sparkles,
  Lock,
} from "lucide-react";

export type ManageSubmission = {
  id: string;
  slotId: string;
  slotName: string;
  slotType: string;
  solverId: string;
  solverHandle: string;
  solverAvatar: string;
  title: string;
  voteCount: number;
  iWouldImplementCount: number;
  status: "submitted" | "accepted" | "withdrawn" | "rejected";
};

export type ManagePromisingSubmission = {
  id: string;
  title: string;
  solverId: string;
  solverHandle: string;
  solverAvatar: string;
  voteCount: number;
};

export type ManageTopCommenter = {
  userId: string;
  handle: string;
  avatar: string;
  commentCount: number;
};

export type ManageActivityEvent = {
  id: string;
  type: "submission" | "acceptance" | "comment" | "status_change";
  text: string;
  timestamp: string;
};

export type ManageSlotGroup = {
  slotId: string;
  slotName: string;
  slotType: string;
  submissions: ManageSubmission[];
};

export type ManageAnalytics = {
  totalSubmissions: number;
  acceptanceRate: number;
  avgQuality: number;
  discussionEngagement: number;
  weekDeltaSubmissions: number;
  acceptedCount: number;
  totalForRate: number;
  solutionsAveraged: number;
  activeParticipants: number;
};

export type ManageBounty = {
  id: string;
  title: string;
  reward: number;
  deadline: string;
  acceptanceCriteria: string;
  isPaused: boolean;
  status: "open" | "solved" | "closed";
};

interface BountyManagementPanelProps {
  isOpen: boolean;
  onClose: () => void;
  isAuthor: boolean;
  bounty: ManageBounty;
  analytics: ManageAnalytics;
  promisingSubmissions: ManagePromisingSubmission[];
  topCommenters: ManageTopCommenter[];
  activityTimeline: ManageActivityEvent[];
  submissions: ManageSlotGroup[];
  onAcceptSolution: (solutionId: string) => void;
  onRejectSolution: (solutionId: string) => void;
  onShortlistSolution: (solutionId: string) => void;
  onPreviewSolution?: (solutionId: string) => void;
  onMessageUser: (userId: string) => void;
  onExtendDeadline: (days: number) => void;
  onUpdateAcceptanceCriteria: (text: string) => void;
  onPauseSubmissions: () => void;
  onResumeSubmissions: () => void;
  onCloseBounty: () => void;
  onPromoteToBlueprint: () => void;
}

type TabId = "overview" | "submissions" | "settings";

const tabs: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "submissions", label: "Submissions", icon: Send },
  { id: "settings", label: "Settings", icon: Settings },
];

export function BountyManagementPanel(props: BountyManagementPanelProps) {
  const {
    isOpen,
    onClose,
    isAuthor,
    bounty,
    analytics,
    promisingSubmissions,
    topCommenters,
    activityTimeline,
    submissions,
    onAcceptSolution,
    onRejectSolution,
    onShortlistSolution,
    onPreviewSolution,
    onMessageUser,
    onExtendDeadline,
    onUpdateAcceptanceCriteria,
    onPauseSubmissions,
    onResumeSubmissions,
    onCloseBounty,
    onPromoteToBlueprint,
  } = props;

  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [showRejected, setShowRejected] = useState(false);
  const [showAllActivity, setShowAllActivity] = useState(false);
  const [acceptanceCriteria, setAcceptanceCriteria] = useState(
    bounty.acceptanceCriteria,
  );
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [openOverflow, setOpenOverflow] = useState<string | null>(null);
  const [extendDropdownOpen, setExtendDropdownOpen] = useState(false);

  // Debounced autosave for acceptance criteria
  useEffect(() => {
    if (acceptanceCriteria === bounty.acceptanceCriteria) return;
    const t = window.setTimeout(() => {
      onUpdateAcceptanceCriteria(acceptanceCriteria);
    }, 800);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [acceptanceCriteria]);

  if (!isOpen) return null;

  const unreviewed = promisingSubmissions.length;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm animate-in fade-in"
      />

      {/* Panel */}
      <aside
        className="fixed right-0 top-0 z-[81] h-full w-full max-w-[480px] flex flex-col animate-in slide-in-from-right duration-200"
        style={{
          backgroundColor: "rgba(15,15,20,0.96)",
          backdropFilter: "blur(24px)",
          borderLeft: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 h-14 shrink-0"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
        >
          <div className="flex items-center gap-2">
            <Settings size={14} style={{ color: "rgba(255,255,255,0.6)" }} />
            <span
              style={{
                fontFamily: "Inter, sans-serif",
                fontSize: "13px",
                fontWeight: 600,
                color: "rgba(255,255,255,0.92)",
              }}
            >
              Bounty management
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded hover:bg-white/10 transition-colors"
            aria-label="Close"
          >
            <X size={14} style={{ color: "rgba(255,255,255,0.6)" }} />
          </button>
        </div>

        {!isAuthor ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
            <Lock size={28} style={{ color: "rgba(255,255,255,0.4)" }} />
            <span
              style={{
                fontFamily: "Inter, sans-serif",
                fontSize: "14px",
                fontWeight: 600,
                color: "rgba(255,255,255,0.85)",
              }}
            >
              Access denied
            </span>
            <span
              style={{
                fontFamily: "Inter, sans-serif",
                fontSize: "12px",
                color: "rgba(255,255,255,0.55)",
              }}
            >
              Only the bounty author can manage this bounty.
            </span>
          </div>
        ) : (
          <>
            {/* Notification banner */}
            {unreviewed > 0 && (
              <div
                className="flex items-center justify-between px-5 py-2.5 shrink-0"
                style={{
                  backgroundColor: "rgba(245,158,11,0.10)",
                  borderBottom: "1px solid rgba(245,158,11,0.20)",
                }}
              >
                <span
                  style={{
                    fontFamily: "Inter, sans-serif",
                    fontSize: "11px",
                    fontWeight: 500,
                    color: "#F59E0B",
                  }}
                >
                  {unreviewed} submission{unreviewed > 1 ? "s" : ""} need your
                  review
                </span>
                <button
                  onClick={() => setActiveTab("submissions")}
                  className="transition-opacity hover:opacity-80"
                  style={{
                    fontFamily: "Inter, sans-serif",
                    fontSize: "11px",
                    fontWeight: 500,
                    color: "#F59E0B",
                    textDecoration: "underline",
                  }}
                >
                  Review now
                </button>
              </div>
            )}

            {/* Tab strip */}
            <div
              className="flex h-11 items-center gap-5 px-5 shrink-0"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
            >
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className="relative flex h-full items-center gap-1.5 transition-colors"
                    style={{
                      color: isActive
                        ? "rgba(255,255,255,0.92)"
                        : "rgba(255,255,255,0.50)",
                    }}
                  >
                    <Icon size={13} />
                    <span
                      style={{
                        fontFamily: "Inter, sans-serif",
                        fontSize: "12px",
                        fontWeight: isActive ? 600 : 500,
                      }}
                    >
                      {tab.label}
                    </span>
                    {isActive && (
                      <span
                        className="absolute bottom-0 left-0 right-0 h-[2px] rounded-t"
                        style={{ backgroundColor: "#3B82F6" }}
                      />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-y-auto px-5 py-5">
              {activeTab === "overview" && (
                <OverviewTab
                  analytics={analytics}
                  promisingSubmissions={promisingSubmissions}
                  topCommenters={topCommenters}
                  activityTimeline={activityTimeline}
                  showAllActivity={showAllActivity}
                  onShowMore={() => setShowAllActivity(true)}
                  onMessageUser={onMessageUser}
                  onPreviewSolution={onPreviewSolution}
                  totalEvents={activityTimeline.length}
                />
              )}

              {activeTab === "submissions" && (
                <SubmissionsTab
                  submissions={submissions}
                  showRejected={showRejected}
                  onToggleRejected={() => setShowRejected((v) => !v)}
                  onAcceptSolution={onAcceptSolution}
                  onRejectSolution={onRejectSolution}
                  onShortlistSolution={onShortlistSolution}
                  onPreviewSolution={onPreviewSolution}
                  onMessageUser={onMessageUser}
                  openOverflow={openOverflow}
                  setOpenOverflow={setOpenOverflow}
                />
              )}

              {activeTab === "settings" && (
                <SettingsTab
                  bounty={bounty}
                  acceptanceCriteria={acceptanceCriteria}
                  onAcceptanceCriteriaChange={setAcceptanceCriteria}
                  onExtendDeadline={onExtendDeadline}
                  onPauseSubmissions={onPauseSubmissions}
                  onResumeSubmissions={onResumeSubmissions}
                  onCloseBounty={onCloseBounty}
                  onPromoteToBlueprint={onPromoteToBlueprint}
                  showCloseConfirm={showCloseConfirm}
                  setShowCloseConfirm={setShowCloseConfirm}
                  extendDropdownOpen={extendDropdownOpen}
                  setExtendDropdownOpen={setExtendDropdownOpen}
                />
              )}
            </div>
          </>
        )}
      </aside>
    </>
  );
}

/* ---------------- Subcomponents ---------------- */

function StatCell({
  value,
  label,
  subline,
  showBar,
  barValue,
}: {
  value: string;
  label: string;
  subline: string;
  showBar?: boolean;
  barValue?: number;
}) {
  return (
    <div
      className="rounded-lg p-3 flex flex-col gap-1"
      style={{ backgroundColor: "rgba(255,255,255,0.04)" }}
    >
      <span
        style={{
          fontFamily: "Inter, sans-serif",
          fontSize: "20px",
          fontWeight: 700,
          color: "rgba(255,255,255,0.95)",
          lineHeight: 1.1,
        }}
      >
        {value}
      </span>
      {showBar && barValue !== undefined && (
        <div
          className="h-1 rounded-full overflow-hidden"
          style={{ backgroundColor: "rgba(255,255,255,0.08)" }}
        >
          <div
            className="h-full rounded-full"
            style={{
              width: `${Math.max(0, Math.min(100, barValue))}%`,
              backgroundColor: "#3B82F6",
            }}
          />
        </div>
      )}
      <span
        style={{
          fontFamily: "Inter, sans-serif",
          fontSize: "11px",
          fontWeight: 500,
          color: "rgba(255,255,255,0.7)",
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: "Inter, sans-serif",
          fontSize: "10px",
          fontWeight: 400,
          color: "rgba(255,255,255,0.45)",
        }}
      >
        {subline}
      </span>
    </div>
  );
}

function OverviewTab({
  analytics,
  promisingSubmissions,
  topCommenters,
  activityTimeline,
  showAllActivity,
  onShowMore,
  onMessageUser,
  onPreviewSolution,
  totalEvents,
}: {
  analytics: ManageAnalytics;
  promisingSubmissions: ManagePromisingSubmission[];
  topCommenters: ManageTopCommenter[];
  activityTimeline: ManageActivityEvent[];
  showAllActivity: boolean;
  onShowMore: () => void;
  onMessageUser: (userId: string) => void;
  onPreviewSolution?: (solutionId: string) => void;
  totalEvents: number;
}) {
  const weekDelta = analytics.weekDeltaSubmissions;
  const deltaText =
    weekDelta >= 0 ? `+${weekDelta} vs last 7 days` : `${weekDelta} vs last 7 days`;
  const visibleActivity = showAllActivity
    ? activityTimeline
    : activityTimeline.slice(0, 10);

  return (
    <div className="flex flex-col gap-6">
      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-2">
        <StatCell
          value={String(analytics.totalSubmissions)}
          label="Total submissions"
          subline={deltaText}
        />
        <StatCell
          value={`${Math.round(analytics.acceptanceRate * 100)}%`}
          label="Acceptance rate"
          subline={`${analytics.acceptedCount}/${analytics.totalForRate} accepted`}
          showBar
          barValue={analytics.acceptanceRate * 100}
        />
        <StatCell
          value={analytics.avgQuality.toFixed(1)}
          label="Avg quality"
          subline={`Across ${analytics.solutionsAveraged} solutions`}
        />
        <StatCell
          value={String(analytics.discussionEngagement)}
          label="Discussion"
          subline={`${analytics.activeParticipants} participants`}
        />
      </div>

      {/* Promising submissions */}
      <Section title="Promising submissions">
        {promisingSubmissions.length === 0 ? (
          <EmptyState text="No new submissions to review." />
        ) : (
          <div className="flex flex-col gap-2">
            {promisingSubmissions.map((sub) => (
              <div
                key={sub.id}
                className="flex items-center justify-between gap-3 rounded-lg p-2.5"
                style={{ backgroundColor: "rgba(255,255,255,0.04)" }}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Avatar src={sub.solverAvatar} alt={sub.solverHandle} />
                  <div className="flex flex-col min-w-0">
                    <span
                      className="truncate"
                      style={{
                        fontFamily: "Inter, sans-serif",
                        fontSize: "12px",
                        fontWeight: 500,
                        color: "rgba(255,255,255,0.9)",
                      }}
                    >
                      {sub.title}
                    </span>
                    <span
                      style={{
                        fontFamily: "Inter, sans-serif",
                        fontSize: "11px",
                        color: "rgba(255,255,255,0.5)",
                      }}
                    >
                      @{sub.solverHandle} · {sub.voteCount} votes
                    </span>
                  </div>
                </div>
                <GhostButton onClick={() => onPreviewSolution?.(sub.id)}>
                  Review
                </GhostButton>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Top commenters */}
      <Section title="Top commenters">
        {topCommenters.length === 0 ? (
          <EmptyState text="No discussion yet." />
        ) : (
          <div className="flex flex-col gap-2">
            {topCommenters.map((u) => (
              <div
                key={u.userId}
                className="flex items-center justify-between gap-3 rounded-lg p-2.5"
                style={{ backgroundColor: "rgba(255,255,255,0.04)" }}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Avatar src={u.avatar} alt={u.handle} />
                  <span
                    style={{
                      fontFamily: "Inter, sans-serif",
                      fontSize: "12px",
                      fontWeight: 500,
                      color: "rgba(255,255,255,0.9)",
                    }}
                  >
                    @{u.handle}
                  </span>
                  <span
                    style={{
                      fontFamily: "Inter, sans-serif",
                      fontSize: "11px",
                      color: "rgba(255,255,255,0.5)",
                    }}
                  >
                    {u.commentCount} comments
                  </span>
                </div>
                <GhostButton onClick={() => onMessageUser(u.userId)}>
                  Message
                </GhostButton>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Activity timeline */}
      <Section title="Activity">
        {activityTimeline.length === 0 ? (
          <EmptyState text="Nothing yet." />
        ) : (
          <div className="flex flex-col">
            {visibleActivity.map((event) => (
              <ActivityRow key={event.id} event={event} />
            ))}
            {!showAllActivity && totalEvents > 10 && (
              <button
                onClick={onShowMore}
                className="self-start mt-2 transition-opacity hover:opacity-80"
                style={{
                  fontFamily: "Inter, sans-serif",
                  fontSize: "11px",
                  fontWeight: 500,
                  color: "#3B82F6",
                }}
              >
                Show more
              </button>
            )}
          </div>
        )}
      </Section>
    </div>
  );
}

function ActivityRow({ event }: { event: ManageActivityEvent }) {
  const iconMap: Record<string, React.ElementType> = {
    submission: FileText,
    acceptance: CheckCircle,
    comment: MessageSquare,
    status_change: Clock,
  };
  const Icon = iconMap[event.type] || Clock;

  return (
    <div className="flex items-center gap-2.5 py-1.5">
      <Icon size={12} style={{ color: "rgba(255,255,255,0.45)" }} />
      <span
        className="flex-1 truncate"
        style={{
          fontFamily: "Inter, sans-serif",
          fontSize: "12px",
          color: "rgba(255,255,255,0.78)",
        }}
      >
        {event.text}
      </span>
      <span
        style={{
          fontFamily: "Inter, sans-serif",
          fontSize: "10px",
          color: "rgba(255,255,255,0.4)",
        }}
      >
        {event.timestamp}
      </span>
    </div>
  );
}

function SubmissionsTab({
  submissions,
  showRejected,
  onToggleRejected,
  onAcceptSolution,
  onRejectSolution,
  onShortlistSolution,
  onPreviewSolution,
  onMessageUser,
  openOverflow,
  setOpenOverflow,
}: {
  submissions: ManageSlotGroup[];
  showRejected: boolean;
  onToggleRejected: () => void;
  onAcceptSolution: (id: string) => void;
  onRejectSolution: (id: string) => void;
  onShortlistSolution: (id: string) => void;
  onPreviewSolution?: (id: string) => void;
  onMessageUser: (userId: string) => void;
  openOverflow: string | null;
  setOpenOverflow: (id: string | null) => void;
}) {
  return (
    <div className="flex flex-col gap-5">
      {/* Rejected filter */}
      <button
        onClick={onToggleRejected}
        className="flex items-center gap-2 self-start"
      >
        <span
          className="w-3.5 h-3.5 rounded border flex items-center justify-center"
          style={{
            borderColor: "rgba(255,255,255,0.25)",
            backgroundColor: showRejected ? "#3B82F6" : "transparent",
          }}
        >
          {showRejected && <Check size={10} className="text-white" />}
        </span>
        <span
          style={{
            fontFamily: "Inter, sans-serif",
            fontSize: "11px",
            color: "rgba(255,255,255,0.6)",
          }}
        >
          Show rejected
        </span>
      </button>

      {submissions.map((slot) => {
        const filtered = showRejected
          ? slot.submissions
          : slot.submissions.filter((s) => s.status !== "rejected");
        if (filtered.length === 0) return null;
        return (
          <div key={slot.slotId} className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <SlotTypeIcon type={slot.slotType} />
              <span
                style={{
                  fontFamily: "Inter, sans-serif",
                  fontSize: "12px",
                  fontWeight: 600,
                  color: "rgba(255,255,255,0.85)",
                }}
              >
                {slot.slotName}
              </span>
              <span
                style={{
                  fontFamily: "Inter, sans-serif",
                  fontSize: "11px",
                  color: "rgba(255,255,255,0.45)",
                }}
              >
                {filtered.length} submission{filtered.length !== 1 ? "s" : ""}
              </span>
            </div>

            {filtered.map((sub) => (
              <SubmissionRow
                key={sub.id}
                submission={sub}
                onAccept={() => onAcceptSolution(sub.id)}
                onReject={() => onRejectSolution(sub.id)}
                onShortlist={() => onShortlistSolution(sub.id)}
                onPreview={() => onPreviewSolution?.(sub.id)}
                onMessage={() => onMessageUser(sub.solverId)}
                isOverflowOpen={openOverflow === sub.id}
                onToggleOverflow={() =>
                  setOpenOverflow(openOverflow === sub.id ? null : sub.id)
                }
              />
            ))}
          </div>
        );
      })}

      {submissions.length === 0 && <EmptyState text="No submissions yet." />}
    </div>
  );
}

function SlotTypeIcon({ type }: { type: string }) {
  const iconMap: Record<string, React.ElementType> = {
    code: FileText,
    design: Sparkles,
    writing: MessageSquare,
  };
  const Icon = iconMap[type] || FileText;
  return <Icon size={12} style={{ color: "rgba(255,255,255,0.5)" }} />;
}

function SubmissionRow({
  submission,
  onAccept,
  onReject,
  onShortlist,
  onPreview,
  onMessage,
  isOverflowOpen,
  onToggleOverflow,
}: {
  submission: ManageSubmission;
  onAccept: () => void;
  onReject: () => void;
  onShortlist: () => void;
  onPreview: () => void;
  onMessage: () => void;
  isOverflowOpen: boolean;
  onToggleOverflow: () => void;
}) {
  const statusColors: Record<string, { bg: string; text: string }> = {
    submitted: { bg: "rgba(59,130,246,0.15)", text: "#3B82F6" },
    accepted: { bg: "rgba(34,197,94,0.15)", text: "#22C55E" },
    withdrawn: { bg: "rgba(156,163,175,0.15)", text: "#9CA3AF" },
    rejected: { bg: "rgba(239,68,68,0.15)", text: "#EF4444" },
  };
  const colors = statusColors[submission.status] || statusColors.submitted;

  return (
    <div
      className="flex items-center justify-between gap-3 rounded-lg p-2.5"
      style={{ backgroundColor: "rgba(255,255,255,0.04)" }}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <Avatar src={submission.solverAvatar} alt={submission.solverHandle} />
        <div className="flex flex-col min-w-0">
          <span
            className="truncate"
            style={{
              fontFamily: "Inter, sans-serif",
              fontSize: "12px",
              fontWeight: 500,
              color: "rgba(255,255,255,0.9)",
            }}
          >
            @{submission.solverHandle}
          </span>
          <div className="flex items-center gap-2">
            <span
              style={{
                fontFamily: "Inter, sans-serif",
                fontSize: "11px",
                color: "rgba(255,255,255,0.5)",
              }}
            >
              {submission.voteCount} votes
            </span>
            <span
              className="px-1.5 py-0.5 rounded"
              style={{
                backgroundColor: colors.bg,
                color: colors.text,
                fontFamily: "Inter, sans-serif",
                fontSize: "10px",
                fontWeight: 600,
                textTransform: "capitalize",
              }}
            >
              {submission.status}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        {submission.status === "submitted" && (
          <button
            onClick={onAccept}
            className="rounded px-2 py-1 transition-colors hover:opacity-90"
            style={{
              backgroundColor: "rgba(34,197,94,0.18)",
              fontFamily: "Inter, sans-serif",
              fontSize: "11px",
              fontWeight: 600,
              color: "#22C55E",
            }}
          >
            Accept
          </button>
        )}
        <button
          onClick={onPreview}
          className="p-1.5 rounded hover:bg-white/10 transition-colors"
          aria-label="Quick view"
        >
          <Eye size={13} style={{ color: "rgba(255,255,255,0.6)" }} />
        </button>
        <div className="relative">
          <button
            onClick={onToggleOverflow}
            className="p-1.5 rounded hover:bg-white/10 transition-colors"
            aria-label="More actions"
          >
            <MoreHorizontal
              size={13}
              style={{ color: "rgba(255,255,255,0.6)" }}
            />
          </button>
          {isOverflowOpen && (
            <div
              className="absolute right-0 top-full mt-1 z-10 min-w-[140px] rounded-lg overflow-hidden shadow-xl"
              style={{
                backgroundColor: "rgba(20,20,28,0.98)",
                border: "1px solid rgba(255,255,255,0.10)",
              }}
            >
              {submission.status === "submitted" && (
                <OverflowItem
                  icon={Check}
                  label="Shortlist"
                  onClick={() => {
                    onShortlist();
                    onToggleOverflow();
                  }}
                />
              )}
              <OverflowItem
                icon={MessageSquare}
                label="Message solver"
                onClick={() => {
                  onMessage();
                  onToggleOverflow();
                }}
              />
              <OverflowItem
                icon={UserPlus}
                label="Reject"
                destructive
                onClick={() => {
                  onReject();
                  onToggleOverflow();
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function OverflowItem({
  icon: Icon,
  label,
  onClick,
  destructive,
}: {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
  destructive?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 w-full px-3 py-2 transition-colors hover:bg-white/8"
    >
      <Icon
        size={12}
        style={{ color: destructive ? "#EF4444" : "rgba(255,255,255,0.7)" }}
      />
      <span
        style={{
          fontFamily: "Inter, sans-serif",
          fontSize: "12px",
          fontWeight: 500,
          color: destructive ? "#EF4444" : "rgba(255,255,255,0.85)",
        }}
      >
        {label}
      </span>
    </button>
  );
}

function SettingsTab({
  bounty,
  acceptanceCriteria,
  onAcceptanceCriteriaChange,
  onExtendDeadline,
  onPauseSubmissions,
  onResumeSubmissions,
  onCloseBounty,
  onPromoteToBlueprint,
  showCloseConfirm,
  setShowCloseConfirm,
  extendDropdownOpen,
  setExtendDropdownOpen,
}: {
  bounty: ManageBounty;
  acceptanceCriteria: string;
  onAcceptanceCriteriaChange: (text: string) => void;
  onExtendDeadline: (days: number) => void;
  onPauseSubmissions: () => void;
  onResumeSubmissions: () => void;
  onCloseBounty: () => void;
  onPromoteToBlueprint: () => void;
  showCloseConfirm: boolean;
  setShowCloseConfirm: (v: boolean) => void;
  extendDropdownOpen: boolean;
  setExtendDropdownOpen: (v: boolean) => void;
}) {
  const deadlineExtensions = [
    { label: "3 days", value: 3 },
    { label: "7 days", value: 7 },
    { label: "14 days", value: 14 },
  ];

  return (
    <div className="flex flex-col gap-5">
      <SettingsField label="Reward">
        <div
          className="flex items-center justify-between rounded-lg px-3 py-2"
          style={{ backgroundColor: "rgba(255,255,255,0.04)" }}
        >
          <span
            style={{
              fontFamily: "Inter, sans-serif",
              fontSize: "13px",
              fontWeight: 600,
              color: "rgba(255,255,255,0.92)",
            }}
          >
            ${bounty.reward.toLocaleString()}
          </span>
          <span
            style={{
              fontFamily: "Inter, sans-serif",
              fontSize: "10px",
              color: "rgba(255,255,255,0.4)",
            }}
          >
            Read-only
          </span>
        </div>
      </SettingsField>

      <SettingsField label="Extend deadline">
        <div className="relative">
          <button
            onClick={() => setExtendDropdownOpen(!extendDropdownOpen)}
            className="flex w-full items-center justify-between rounded-lg px-3 py-2 transition-colors hover:bg-white/10"
            style={{ backgroundColor: "rgba(255,255,255,0.06)" }}
          >
            <span
              style={{
                fontFamily: "Inter, sans-serif",
                fontSize: "12px",
                color: "rgba(255,255,255,0.8)",
              }}
            >
              Extend by...
            </span>
            <ChevronDown size={13} style={{ color: "rgba(255,255,255,0.5)" }} />
          </button>
          {extendDropdownOpen && (
            <div
              className="absolute left-0 right-0 top-full mt-1 z-10 rounded-lg overflow-hidden flex flex-col"
              style={{
                backgroundColor: "rgba(20,20,28,0.98)",
                border: "1px solid rgba(255,255,255,0.10)",
              }}
            >
              {deadlineExtensions.map((ext) => (
                <button
                  key={ext.value}
                  onClick={() => {
                    onExtendDeadline(ext.value);
                    setExtendDropdownOpen(false);
                  }}
                  className="px-3 py-2 text-left transition-colors hover:bg-white/10"
                  style={{
                    fontFamily: "Inter, sans-serif",
                    fontSize: "12px",
                    color: "rgba(255,255,255,0.8)",
                  }}
                >
                  {ext.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </SettingsField>

      <SettingsField label="Acceptance criteria">
        <textarea
          value={acceptanceCriteria}
          onChange={(e) => onAcceptanceCriteriaChange(e.target.value)}
          rows={4}
          className="w-full resize-none rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-white/20"
          style={{
            backgroundColor: "rgba(255,255,255,0.06)",
            fontFamily: "Inter, sans-serif",
            fontSize: "12px",
            color: "rgba(255,255,255,0.85)",
          }}
        />
      </SettingsField>

      <SettingsField label="Pause submissions">
        <div className="flex items-center justify-between">
          <span
            style={{
              fontFamily: "Inter, sans-serif",
              fontSize: "12px",
              color: "rgba(255,255,255,0.6)",
            }}
          >
            {bounty.isPaused
              ? "Submissions are paused"
              : "Accepting submissions"}
          </span>
          <button
            onClick={
              bounty.isPaused ? onResumeSubmissions : onPauseSubmissions
            }
            className="flex items-center gap-1.5 rounded px-2.5 py-1 transition-colors"
            style={{
              backgroundColor: bounty.isPaused
                ? "rgba(34,197,94,0.15)"
                : "rgba(245,158,11,0.15)",
            }}
          >
            {bounty.isPaused ? (
              <>
                <Play size={12} style={{ color: "#22C55E" }} />
                <span
                  style={{
                    fontFamily: "Inter, sans-serif",
                    fontSize: "11px",
                    fontWeight: 500,
                    color: "#22C55E",
                  }}
                >
                  Resume
                </span>
              </>
            ) : (
              <>
                <Pause size={12} style={{ color: "#F59E0B" }} />
                <span
                  style={{
                    fontFamily: "Inter, sans-serif",
                    fontSize: "11px",
                    fontWeight: 500,
                    color: "#F59E0B",
                  }}
                >
                  Pause
                </span>
              </>
            )}
          </button>
        </div>
      </SettingsField>

      <div
        style={{ height: "1px", backgroundColor: "rgba(255,255,255,0.08)" }}
      />

      {bounty.status === "solved" && (
        <button
          onClick={onPromoteToBlueprint}
          className="flex w-full items-center justify-center gap-2 rounded-lg py-2.5 transition-colors hover:opacity-90"
          style={{ backgroundColor: "rgba(34,197,94,0.15)" }}
        >
          <Sparkles size={14} style={{ color: "#22C55E" }} />
          <span
            style={{
              fontFamily: "Inter, sans-serif",
              fontSize: "12px",
              fontWeight: 500,
              color: "#22C55E",
            }}
          >
            Promote to blueprint
          </span>
        </button>
      )}

      {!showCloseConfirm ? (
        <button
          onClick={() => setShowCloseConfirm(true)}
          className="flex w-full items-center justify-center gap-2 rounded-lg py-2.5 transition-colors hover:opacity-90"
          style={{ backgroundColor: "rgba(239,68,68,0.12)" }}
        >
          <AlertTriangle size={14} style={{ color: "#EF4444" }} />
          <span
            style={{
              fontFamily: "Inter, sans-serif",
              fontSize: "12px",
              fontWeight: 500,
              color: "#EF4444",
            }}
          >
            Close bounty without solving
          </span>
        </button>
      ) : (
        <div
          className="flex flex-col gap-3 rounded-lg p-3"
          style={{
            backgroundColor: "rgba(239,68,68,0.08)",
            border: "1px solid rgba(239,68,68,0.20)",
          }}
        >
          <span
            style={{
              fontFamily: "Inter, sans-serif",
              fontSize: "12px",
              fontWeight: 500,
              color: "#EF4444",
            }}
          >
            Are you sure? This action cannot be undone.
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setShowCloseConfirm(false)}
              className="flex-1 rounded-lg py-2 transition-colors hover:bg-white/10"
              style={{
                backgroundColor: "rgba(255,255,255,0.06)",
                fontFamily: "Inter, sans-serif",
                fontSize: "11px",
                fontWeight: 500,
                color: "rgba(255,255,255,0.7)",
              }}
            >
              Cancel
            </button>
            <button
              onClick={onCloseBounty}
              className="flex-1 rounded-lg py-2 transition-colors hover:opacity-90"
              style={{
                backgroundColor: "#EF4444",
                fontFamily: "Inter, sans-serif",
                fontSize: "11px",
                fontWeight: 500,
                color: "white",
              }}
            >
              Close bounty
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function SettingsField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span
        style={{
          fontFamily: "Inter, sans-serif",
          fontSize: "11px",
          fontWeight: 600,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          color: "rgba(255,255,255,0.5)",
        }}
      >
        {label}
      </span>
      {children}
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span
        style={{
          fontFamily: "Inter, sans-serif",
          fontSize: "12px",
          fontWeight: 600,
          color: "rgba(255,255,255,0.85)",
        }}
      >
        {title}
      </span>
      {children}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div
      className="flex items-center justify-center rounded-lg py-6"
      style={{ backgroundColor: "rgba(255,255,255,0.02)" }}
    >
      <span
        style={{
          fontFamily: "Inter, sans-serif",
          fontSize: "12px",
          color: "rgba(255,255,255,0.4)",
        }}
      >
        {text}
      </span>
    </div>
  );
}

function GhostButton({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center rounded px-2 py-1 transition-colors hover:bg-white/10"
      style={{
        fontFamily: "Inter, sans-serif",
        fontSize: "11px",
        fontWeight: 500,
        color: "rgba(255,255,255,0.7)",
      }}
    >
      {children}
    </button>
  );
}

function Avatar({ src, alt }: { src: string; alt: string }) {
  const initial = (alt || "?").slice(0, 1).toUpperCase();
  return (
    <div
      className="w-7 h-7 rounded-full overflow-hidden flex items-center justify-center shrink-0"
      style={{ backgroundColor: "rgba(255,255,255,0.08)" }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} className="w-full h-full object-cover" />
      ) : (
        <span
          style={{
            fontFamily: "Inter, sans-serif",
            fontSize: "11px",
            fontWeight: 600,
            color: "rgba(255,255,255,0.7)",
          }}
        >
          {initial}
        </span>
      )}
    </div>
  );
}
