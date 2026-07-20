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

// The real notification toggles. "Whatever the chef recommends" is a
// master switch over all of them, not a stored value of its own.
export const NOTIFY_OPTIONS = [
  { value: "sync_gcal", label: "Sync my gcal" },
  { value: "friends_updates", label: "Give info on style and updates from my friends" },
  { value: "daily_digest", label: "Send me a daily digest (includes recs based on weather and events)" },
  { value: "weekly_style_analysis", label: "Weekly recap of what I wore, my outfit vibe, and my all-time style patterns" },
  { value: "weekly_feed_summary", label: "Weekly summary of activity on my feed posts" },
  { value: "ootd_reminder", label: "Remind me to post my outfit of the day (11am ET)" },
];
export const NOTIFY_KEYS = NOTIFY_OPTIONS.map((o) => o.value);

// Default local time for the daily digest, in "HH:mm" 24h format — editable in
// NotificationsModal, stored at notification_preferences.daily_digest_time.
export const DEFAULT_DAILY_DIGEST_TIME = "07:30";
