export const STYLE_OPTIONS = [
  "Classic",
  "Minimalist",
  "Bohemian",
  "Preppy",
  "Streetwear",
  "Romantic",
  "Edgy",
  "Sporty",
  "Vintage",
  "Eclectic",
];

export const HELP_OPTIONS = [
  { value: "coordinate_closet", label: "Coordinating my closet" },
  { value: "plan_day", label: "Planning my day" },
  { value: "downsize_closet", label: "Downsizing my closet" },
  { value: "define_style", label: "Defining my personal style" },
];

// The real notification toggles, condensed into fewer checkboxes for the
// picker UI — each group flips several underlying preference keys at once.
// "Whatever the chef recommends" is a master switch over all of them, not a
// stored value of its own.
export const NOTIFY_GROUPS = [
  {
    id: "daily",
    label: "Daily nudges — morning outfit digest + 11am reminder to post",
    keys: ["daily_digest", "ootd_reminder"],
  },
  {
    id: "weekly",
    label: "Weekly recap — what I wore, my style patterns, and feed activity",
    keys: ["weekly_style_analysis", "weekly_feed_summary"],
  },
  {
    id: "sync",
    label: "Calendar sync + friend style updates",
    keys: ["sync_gcal", "friends_updates"],
  },
];
export const NOTIFY_KEYS = NOTIFY_GROUPS.flatMap((g) => g.keys);

// Default local time for the daily digest, in "HH:mm" 24h format — editable in
// NotificationsModal, stored at notification_preferences.daily_digest_time.
export const DEFAULT_DAILY_DIGEST_TIME = "07:30";
