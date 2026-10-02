export * from "./types";
export { insertNotification } from "./insertNotification";
export { getNotifications } from "./getNotifications";
export { markNotificationRead, markAllNotificationsRead } from "./markRead";
export { createNotification } from "./createNotification";
export { getUnreadCount } from "./getUnreadCount";
export {
  subscribeToNewNotifications,
  useNewNotifications,
  useNotificationChannel,
  type NotificationChannelStatus,
} from "./realtime";
// UI-P35a: resolveNotificationCovers is imported from "./covers" directly, so
// the gallery's card query does not ride into every module that imports this.
export {
  buildIdOf,
  isBuildNotificationKind,
  notificationHref,
  notificationMessage,
  resolveNotificationBuilds,
  resolveNotificationTargets,
} from "./resolveTarget";
// RC-P19: notifyNewFollower, notifyBountySolutionSubmitted and
// notifyBountySolutionAccepted went — the database writes those events now.
export {
  notifyEngagement,
  notifyMentions,
  notifyNewMessageCoalesced,
  notifyReferencesReceived,
  notifyLevelEarned,
  recomputeUserLevel,
} from "./triggers";
