import { headers } from "next/headers";
import pool from "./db";
import { createNotification } from "./notifications";
import { isDesigner } from "./designers";
import { areMutualFriends } from "./friends";
import { upsertCalendarEvent, CalendarScopeError } from "./googleCalendar";

// Moments — private, occasion-scoped outfit-coordination plans (see
// 026_add_moments.sql + the Moments spec). All data logic lives here; the API
// routes under app/api/moments stay thin and translate MomentError into HTTP
// status codes. Notifications fire from inside this module, mirroring the way
// lib/friends.ts fires new_friend inline at the moment the relationship forms.

export type MomentRole = "creator" | "collaborator" | "invitee";
export type MomentStatus = "pending" | "accepted" | "declined";

// Thrown for caller-facing failures; the route maps `.status` to the response.
export class MomentError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "MomentError";
    this.status = status;
  }
}

export type MomentMember = {
  user_id: string;
  username: string | null;
  name: string;
  avatar: string | null;
  role: MomentRole;
  status: MomentStatus;
};

export type MomentFitInspo = {
  id: string;
  image_url: string;
  uploaded_by_id: string;
};

// A member's own outfit candidate for the moment — a feed_posts row carrying
// moment_id, deliberately kept out of the public feed.
export type MomentFit = {
  id: string;
  photo: string;
  author_id: string;
  author_name: string;
  author_username: string | null;
};

export type MomentWithMembers = {
  id: string;
  event_name: string;
  description: string | null;
  location: string | null;
  google_maps_link: string | null;
  vibe_words: string[];
  formality_level: number | null;
  event_date_time: string;
  event_end_time: string | null;
  expires_at: string;
  gcal_event_id: string | null;
  creator: { id: string; username: string | null; name: string; avatar: string | null };
  collaborators: MomentMember[];
  members: MomentMember[]; // every member incl. creator + collaborators + invitees
  fit_inspo: MomentFitInspo[];
  fits: MomentFit[]; // members' outfit candidates (moment-linked feed posts)
  user_role: MomentRole | null;
  user_status: MomentStatus | null;
};

export type CreateMomentInput = {
  event_name: string;
  description?: string | null;
  location?: string | null;
  google_maps_link?: string | null;
  vibe_words?: string[];
  formality_level?: number | null;
  event_date_time: string;
  event_end_time?: string | null;
  gcal_event_id?: string | null;
  invitee_user_ids?: string[];
  collaborator_user_ids?: string[];
};

export type UpdateMomentInput = {
  event_name?: string;
  description?: string | null;
  location?: string | null;
  google_maps_link?: string | null;
  vibe_words?: string[];
  formality_level?: number | null;
  event_date_time?: string;
  event_end_time?: string | null;
};

// ---- Permission helpers -------------------------------------------------

// Minimal query surface shared by the Pool and a transaction PoolClient, so
// createMoment can run its inserts + membership checks on one uncommitted
// client while everything else defaults to the pool.
type Executor = {
  query: (
    text: string,
    params?: unknown[]
  ) => Promise<{ rows: Record<string, unknown>[]; rowCount: number | null }>;
};

async function getRole(
  momentId: string,
  userId: string,
  db: Executor = pool
): Promise<MomentRole | null> {
  const { rows } = await db.query(
    `SELECT m.role
       FROM moment_members m
       JOIN moments mo ON mo.id = m.moment_id
      WHERE m.moment_id = $1 AND m.user_id = $2 AND mo.deleted_at IS NULL`,
    [momentId, userId]
  );
  return (rows[0]?.role as MomentRole) ?? null;
}

// Creator or collaborator — the two roles that can edit event details and add
// members (see the permission table in the spec).
async function requireEditor(
  momentId: string,
  userId: string,
  db: Executor = pool
): Promise<MomentRole> {
  const role = await getRole(momentId, userId, db);
  if (role !== "creator" && role !== "collaborator") {
    throw new MomentError("Not allowed to edit this moment", 403);
  }
  return role;
}

// ---- Reads --------------------------------------------------------------

async function loadMoments(
  viewerId: string,
  where: string,
  params: unknown[]
): Promise<MomentWithMembers[]> {
  const { rows: moments } = await pool.query(
    `SELECT mo.id, mo.event_name, mo.description, mo.location, mo.google_maps_link,
            mo.vibe_words, mo.formality_level, mo.event_date_time, mo.event_end_time,
            mo.expires_at, mo.gcal_event_id, mo.creator_id,
            cu.username AS creator_username,
            COALESCE(cu.display_name, cu.name) AS creator_name,
            cu.avatar AS creator_avatar
       FROM moments mo
       JOIN users cu ON cu.id = mo.creator_id
      WHERE mo.deleted_at IS NULL AND mo.expires_at > now() AND ${where}
      ORDER BY mo.event_date_time ASC`,
    params
  );
  if (moments.length === 0) return [];

  const ids = moments.map((m) => m.id);

  const { rows: members } = await pool.query(
    `SELECT mm.moment_id, mm.user_id, mm.role, mm.status,
            u.username, COALESCE(u.display_name, u.name) AS name, u.avatar
       FROM moment_members mm
       JOIN users u ON u.id = mm.user_id
      WHERE mm.moment_id = ANY($1::uuid[])
      ORDER BY name`,
    [ids]
  );

  const { rows: inspo } = await pool.query(
    `SELECT id, moment_id, image_url, uploaded_by_id
       FROM moment_fit_inspo
      WHERE moment_id = ANY($1::uuid[])
      ORDER BY created_at ASC`,
    [ids]
  );

  const { rows: fits } = await pool.query(
    `SELECT fp.id, fp.moment_id, fp.photo, fp.user_id AS author_id,
            COALESCE(u.display_name, u.name) AS author_name, u.username
       FROM feed_posts fp
       JOIN users u ON u.id = fp.user_id
      WHERE fp.moment_id = ANY($1::uuid[])
      ORDER BY fp.created_at ASC`,
    [ids]
  );

  return moments.map((mo) => {
    const mine = members.filter((m) => m.moment_id === mo.id);
    const viewer = mine.find((m) => m.user_id === viewerId);
    return {
      id: mo.id,
      event_name: mo.event_name,
      description: mo.description,
      location: mo.location,
      google_maps_link: mo.google_maps_link,
      vibe_words: mo.vibe_words ?? [],
      formality_level: mo.formality_level,
      event_date_time: iso(mo.event_date_time),
      event_end_time: mo.event_end_time ? iso(mo.event_end_time) : null,
      expires_at: iso(mo.expires_at),
      gcal_event_id: mo.gcal_event_id,
      creator: {
        id: mo.creator_id,
        username: mo.creator_username,
        name: mo.creator_name,
        avatar: mo.creator_avatar,
      },
      collaborators: mine
        .filter((m) => m.role === "collaborator")
        .map(toMember),
      members: mine.map(toMember),
      fit_inspo: inspo
        .filter((i) => i.moment_id === mo.id)
        .map((i) => ({
          id: i.id as string,
          image_url: i.image_url as string,
          uploaded_by_id: i.uploaded_by_id as string,
        })),
      fits: fits
        .filter((f) => f.moment_id === mo.id)
        .map((f) => ({
          id: f.id as string,
          photo: f.photo as string,
          author_id: f.author_id as string,
          author_name: f.author_name as string,
          author_username: (f.username as string) ?? null,
        })),
      user_role: viewer ? (viewer.role as MomentRole) : null,
      user_status: viewer ? (viewer.status as MomentStatus) : null,
    };
  });
}

function toMember(m: Record<string, unknown>): MomentMember {
  return {
    user_id: m.user_id as string,
    username: (m.username as string) ?? null,
    name: m.name as string,
    avatar: (m.avatar as string) ?? null,
    role: m.role as MomentRole,
    status: m.status as MomentStatus,
  };
}

function iso(v: unknown): string {
  return v instanceof Date ? v.toISOString() : String(v);
}

// Moments the user created (Digest "Created by you").
export async function getCreatedMoments(userId: string): Promise<MomentWithMembers[]> {
  return loadMoments(userId, "mo.creator_id = $1", [userId]);
}

// Moments the user was invited to as invitee or collaborator (Digest "Invited
// to you"). Excludes ones they created. UI splits pending vs. accepted on
// user_status.
export async function getInvitedMoments(userId: string): Promise<MomentWithMembers[]> {
  return loadMoments(
    userId,
    `mo.creator_id <> $1 AND EXISTS (
        SELECT 1 FROM moment_members mm
         WHERE mm.moment_id = mo.id AND mm.user_id = $1
           AND mm.role IN ('invitee', 'collaborator')
           AND mm.status <> 'declined'
      )`,
    [userId]
  );
}

// Single moment the viewer participates in (or created) — used by routes after
// a mutation to return the fresh shape. Returns null if not visible to viewer.
export async function getMomentForViewer(
  momentId: string,
  viewerId: string
): Promise<MomentWithMembers | null> {
  const rows = await loadMoments(
    viewerId,
    `mo.id = $2 AND (mo.creator_id = $1 OR EXISTS (
        SELECT 1 FROM moment_members mm WHERE mm.moment_id = mo.id AND mm.user_id = $1
      ))`,
    [viewerId, momentId]
  );
  return rows[0] ?? null;
}

// ---- Writes -------------------------------------------------------------

export async function createMoment(
  creatorId: string,
  input: CreateMomentInput
): Promise<MomentWithMembers> {
  if (!input.event_name?.trim()) throw new MomentError("Event name is required");
  if (!input.event_date_time) throw new MomentError("Event date/time is required");

  // One transaction: the moment, its creator membership, and the invites all
  // commit together — so a rejected invite (e.g. a non-designer inviting a
  // non-mutual) rolls the whole thing back instead of orphaning a moment.
  const client = await pool.connect();
  let momentId: string;
  try {
    await client.query("BEGIN");

    const { rows } = await client.query(
      `INSERT INTO moments
          (creator_id, event_name, description, location, google_maps_link,
           vibe_words, formality_level, event_date_time, event_end_time, gcal_event_id, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
               COALESCE($9::timestamptz, $8::timestamptz + interval '3 hours') + interval '24 hours')
       RETURNING id`,
      [
        creatorId,
        input.event_name.trim(),
        input.description ?? null,
        input.location ?? null,
        input.google_maps_link ?? null,
        input.vibe_words ?? [],
        input.formality_level ?? null,
        input.event_date_time,
        input.event_end_time ?? null,
        input.gcal_event_id ?? null,
      ]
    );
    momentId = rows[0].id as string;

    // Creator is an accepted member from the start.
    await client.query(
      `INSERT INTO moment_members (moment_id, user_id, role, status, accepted_at)
       VALUES ($1, $2, 'creator', 'accepted', now())`,
      [momentId, creatorId]
    );

    await addMembers(
      creatorId,
      momentId,
      {
        invitee_user_ids: input.invitee_user_ids ?? [],
        collaborator_user_ids: input.collaborator_user_ids ?? [],
      },
      client
    );

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }

  const moment = await getMomentForViewer(momentId, creatorId);
  if (!moment) throw new MomentError("Failed to load created moment", 500);
  return moment;
}

// Add invitees/collaborators. Invite-status rule:
//   - mutual friend of actor           → accepted
//   - non-mutual + actor is designer   → pending
//   - non-mutual + actor is regular    → rejected (400)
// Only the creator may add collaborators; collaborators may add invitees.
export async function addMembers(
  actorId: string,
  momentId: string,
  input: { invitee_user_ids?: string[]; collaborator_user_ids?: string[] },
  db: Executor = pool
): Promise<void> {
  const actorRole = await requireEditor(momentId, actorId, db);

  const collaboratorIds = dedupe(input.collaborator_user_ids ?? []);
  const inviteeIds = dedupe(input.invitee_user_ids ?? []).filter(
    (id) => !collaboratorIds.includes(id)
  );

  if (collaboratorIds.length > 0 && actorRole !== "creator") {
    throw new MomentError("Only the creator can add collaborators", 403);
  }

  const designer = await isDesigner(actorId);

  const targets: Array<{ userId: string; role: MomentRole }> = [
    ...collaboratorIds.map((userId) => ({ userId, role: "collaborator" as const })),
    ...inviteeIds.map((userId) => ({ userId, role: "invitee" as const })),
  ].filter((t) => t.userId !== actorId); // can't invite yourself

  // Resolve every target's status up front and reject the whole request if any
  // are ineligible — so no partial inserts or notifications happen before the
  // rejection (and, inside createMoment's transaction, nothing to roll back).
  const resolved: Array<{ userId: string; role: MomentRole; status: MomentStatus }> = [];
  for (const t of targets) {
    const mutual = await areMutualFriends(actorId, t.userId);
    if (mutual) {
      resolved.push({ ...t, status: "accepted" });
    } else if (designer) {
      resolved.push({ ...t, status: "pending" });
    } else {
      throw new MomentError("You can only invite mutual friends to a moment", 400);
    }
  }

  for (const t of resolved) {
    const acceptedAt = t.status === "accepted" ? new Date() : null;
    const { rows } = await db.query(
      `INSERT INTO moment_members (moment_id, user_id, role, status, accepted_at)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (moment_id, user_id) DO NOTHING
       RETURNING user_id`,
      [momentId, t.userId, t.role, t.status, acceptedAt]
    );
    if (rows.length === 0) continue; // already a member — no re-invite, no re-notify

    await notifyInvited(t.userId, momentId, t.role, actorId).catch((err) =>
      console.error("moment invite notification failed:", err)
    );
  }
}

// The invited user accepts or declines their own invite. On accept, notify the
// creator (moment_accepted).
export async function respondToInvite(
  userId: string,
  momentId: string,
  status: "accepted" | "declined"
): Promise<MomentWithMembers> {
  // Only stamp accepted_at when accepting; preserve it otherwise (COALESCE keeps
  // the existing value when the new one is null). Passing it as its own param
  // avoids reusing $3 both as the column value and in a comparison, which
  // confuses Postgres's parameter-type inference.
  const acceptedAt = status === "accepted" ? new Date() : null;
  const { rows } = await pool.query<{ role: MomentRole }>(
    `UPDATE moment_members
        SET status = $3,
            accepted_at = COALESCE($4::timestamptz, accepted_at)
      WHERE moment_id = $1 AND user_id = $2 AND role <> 'creator'
      RETURNING role`,
    [momentId, userId, status, acceptedAt]
  );
  if (rows.length === 0) throw new MomentError("No invite to respond to", 404);

  if (status === "accepted") {
    await notifyAccepted(momentId, userId).catch((err) =>
      console.error("moment accept notification failed:", err)
    );
  }

  const moment = await getMomentForViewer(momentId, userId);
  if (!moment) throw new MomentError("Failed to load moment", 500);
  return moment;
}

export async function updateMoment(
  userId: string,
  momentId: string,
  patch: UpdateMomentInput
): Promise<MomentWithMembers> {
  await requireEditor(momentId, userId);

  const sets: string[] = [];
  const vals: unknown[] = [];
  // Returns the SQL placeholder ($N) for a freshly-bound value.
  const bind = (val: unknown): string => {
    vals.push(val);
    return `$${vals.length}`;
  };

  if (patch.event_name !== undefined) sets.push(`event_name = ${bind(patch.event_name.trim())}`);
  if (patch.description !== undefined) sets.push(`description = ${bind(patch.description)}`);
  if (patch.location !== undefined) sets.push(`location = ${bind(patch.location)}`);
  if (patch.google_maps_link !== undefined)
    sets.push(`google_maps_link = ${bind(patch.google_maps_link)}`);
  if (patch.vibe_words !== undefined) sets.push(`vibe_words = ${bind(patch.vibe_words)}`);
  if (patch.formality_level !== undefined)
    sets.push(`formality_level = ${bind(patch.formality_level)}`);

  // Bind the time fields once and reuse their placeholders both for the column
  // assignment and for the expires_at recomputation below.
  const startExpr =
    patch.event_date_time !== undefined ? `${bind(patch.event_date_time)}::timestamptz` : "event_date_time";
  const endExpr =
    patch.event_end_time !== undefined ? `${bind(patch.event_end_time)}::timestamptz` : "event_end_time";

  if (patch.event_date_time !== undefined) sets.push(`event_date_time = ${startExpr}`);
  if (patch.event_end_time !== undefined) sets.push(`event_end_time = ${endExpr}`);

  // Recompute expires_at whenever either time changed: (end or start+3h) + 24h.
  if (patch.event_date_time !== undefined || patch.event_end_time !== undefined) {
    sets.push(
      `expires_at = COALESCE(${endExpr}, ${startExpr} + interval '3 hours') + interval '24 hours'`
    );
  }

  if (sets.length > 0) {
    vals.push(momentId);
    await pool.query(
      `UPDATE moments SET ${sets.join(", ")} WHERE id = $${vals.length} AND deleted_at IS NULL`,
      vals
    );
  }

  const moment = await getMomentForViewer(momentId, userId);
  if (!moment) throw new MomentError("Failed to load moment", 500);
  return moment;
}

export async function deleteMoment(userId: string, momentId: string): Promise<void> {
  const role = await getRole(momentId, userId);
  if (role !== "creator") {
    throw new MomentError("Only the creator can delete this moment", 403);
  }
  await pool.query(
    `UPDATE moments SET deleted_at = now() WHERE id = $1 AND deleted_at IS NULL`,
    [momentId]
  );
}

// ---- Fit inspo + outfit candidates (Phase 2) ----------------------------

// Any accepted participant (creator, collaborator, or an invitee who accepted)
// may attach inspo/fits. A pending or declined invitee cannot.
async function assertAcceptedMember(momentId: string, userId: string): Promise<void> {
  const { rows } = await pool.query(
    `SELECT 1
       FROM moment_members mm
       JOIN moments mo ON mo.id = mm.moment_id
      WHERE mm.moment_id = $1 AND mm.user_id = $2
        AND mm.status = 'accepted' AND mo.deleted_at IS NULL`,
    [momentId, userId]
  );
  if (rows.length === 0) {
    throw new MomentError("You're not a participant in this moment", 403);
  }
}

// Pin a reference image to the moment's moodboard.
export async function addFitInspo(
  userId: string,
  momentId: string,
  imageUrl: string
): Promise<MomentFitInspo> {
  await assertAcceptedMember(momentId, userId);
  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO moment_fit_inspo (moment_id, image_url, uploaded_by_id)
     VALUES ($1, $2, $3) RETURNING id`,
    [momentId, imageUrl, userId]
  );
  return { id: rows[0].id, image_url: imageUrl, uploaded_by_id: userId };
}

// Remove a reference image — only the uploader or the moment's creator.
export async function deleteFitInspo(userId: string, inspoId: string): Promise<void> {
  const { rows } = await pool.query<{ user_id: string }>(
    `DELETE FROM moment_fit_inspo mfi
      USING moments mo
      WHERE mfi.id = $1 AND mo.id = mfi.moment_id
        AND (mfi.uploaded_by_id = $2 OR mo.creator_id = $2)
      RETURNING mfi.uploaded_by_id AS user_id`,
    [inspoId, userId]
  );
  if (rows.length === 0) {
    throw new MomentError("Can't remove this image", 403);
  }
}

// Add the caller's own outfit candidate: a feed post tagged with moment_id, so
// it shows inside the moment but never in the public feed. Visibility is set to
// 'private' — the moment_id filter is what actually gates it, and 'private'
// keeps it out of any author-scoped feed query as a belt-and-braces default.
export async function addFit(
  userId: string,
  momentId: string,
  photo: string,
  caption?: string | null
): Promise<MomentFit> {
  await assertAcceptedMember(momentId, userId);
  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO feed_posts (user_id, photo, caption, visibility, moment_id)
     VALUES ($1, $2, $3, 'private', $4) RETURNING id`,
    [userId, photo, caption?.trim() || null, momentId]
  );
  const { rows: who } = await pool.query<{ name: string; username: string | null }>(
    "SELECT COALESCE(display_name, name) AS name, username FROM users WHERE id = $1",
    [userId]
  );
  return {
    id: rows[0].id,
    photo,
    author_id: userId,
    author_name: who[0]?.name ?? "You",
    author_username: who[0]?.username ?? null,
  };
}

// ---- Google Calendar write-back (Phase 3) -------------------------------

// Absolute URL back to the moment, built from the incoming request host so the
// link in the calendar event works on whatever origin serves the app (mirrors
// inviteUrlFor in lib/friends.ts).
function absoluteMomentUrl(momentId: string): string {
  const h = headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  return `${proto}://${host}/stylist?moment=${momentId}`;
}

// Push a moment to the creator/collaborator's Google Calendar (create or update
// the linked event), or unlink it (`write=false`) without deleting from GCal.
// One-directional — Pocket never reads calendar edits back.
export async function syncMomentToGcal(
  userId: string,
  momentId: string,
  write: boolean
): Promise<MomentWithMembers> {
  await requireEditor(momentId, userId);

  if (!write) {
    // Unlink only — leave the event in the user's calendar (their choice to remove).
    await pool.query(
      "UPDATE moments SET gcal_event_id = NULL, gcal_written_at = NULL WHERE id = $1",
      [momentId]
    );
    const m = await getMomentForViewer(momentId, userId);
    if (!m) throw new MomentError("Failed to load moment", 500);
    return m;
  }

  const { rows } = await pool.query<{
    event_name: string;
    location: string | null;
    google_maps_link: string | null;
    vibe_words: string[];
    formality_level: number | null;
    event_date_time: Date;
    event_end_time: Date | null;
    gcal_event_id: string | null;
  }>(
    `SELECT event_name, location, google_maps_link, vibe_words, formality_level,
            event_date_time, event_end_time, gcal_event_id
       FROM moments WHERE id = $1 AND deleted_at IS NULL`,
    [momentId]
  );
  const mo = rows[0];
  if (!mo) throw new MomentError("Moment not found", 404);

  const { rows: attendees } = await pool.query<{ label: string }>(
    `SELECT COALESCE('@' || u.username, u.display_name, u.name) AS label
       FROM moment_members mm
       JOIN users u ON u.id = mm.user_id
      WHERE mm.moment_id = $1 AND mm.role <> 'creator' AND mm.status <> 'declined'
      ORDER BY label`,
    [momentId]
  );

  const start = new Date(mo.event_date_time);
  const end = mo.event_end_time
    ? new Date(mo.event_end_time)
    : new Date(start.getTime() + 3 * 60 * 60 * 1000);

  const description = [
    "📅 Planning your fit for this event in Pocket!",
    mo.vibe_words.length ? `Vibe: ${mo.vibe_words.join(", ")}` : null,
    mo.formality_level != null ? `Formality: ${mo.formality_level}/10` : null,
    attendees.length ? `Attendees: ${attendees.map((a) => a.label).join(", ")}` : null,
    `👗 Add your outfit: ${absoluteMomentUrl(momentId)}`,
  ]
    .filter(Boolean)
    .join("\n");

  let eventId: string | null;
  try {
    eventId = await upsertCalendarEvent(userId, {
      summary: mo.event_name,
      description,
      location: mo.location ?? mo.google_maps_link ?? undefined,
      startIso: start.toISOString(),
      endIso: end.toISOString(),
      existingEventId: mo.gcal_event_id,
    });
  } catch (err) {
    if (err instanceof CalendarScopeError) {
      throw new MomentError(err.message, 400);
    }
    throw err;
  }

  if (!eventId) {
    throw new MomentError("Connect your Google Calendar first", 400);
  }

  await pool.query(
    "UPDATE moments SET gcal_event_id = $2, gcal_written_at = now() WHERE id = $1",
    [momentId, eventId]
  );

  const m = await getMomentForViewer(momentId, userId);
  if (!m) throw new MomentError("Failed to load moment", 500);
  return m;
}

// ---- Notifications ------------------------------------------------------

async function actorLabel(userId: string): Promise<string> {
  const { rows } = await pool.query<{ name: string; username: string | null }>(
    "SELECT COALESCE(display_name, name) AS name, username FROM users WHERE id = $1",
    [userId]
  );
  const a = rows[0];
  return a?.username ? `@${a.username}` : a?.name ?? "Someone";
}

async function momentName(momentId: string): Promise<string> {
  const { rows } = await pool.query<{ event_name: string }>(
    "SELECT event_name FROM moments WHERE id = $1",
    [momentId]
  );
  return rows[0]?.event_name ?? "a moment";
}

async function notifyInvited(
  recipientId: string,
  momentId: string,
  role: MomentRole,
  actorId: string
): Promise<void> {
  const [label, name] = await Promise.all([actorLabel(actorId), momentName(momentId)]);
  const link = momentLink(momentId);
  if (role === "collaborator") {
    await createNotification(
      recipientId,
      "moment_cohost",
      "You're a co-host",
      `${label} made you a co-host of ${name}.`,
      link
    );
  } else {
    await createNotification(
      recipientId,
      "moment_invite",
      "New moment",
      `${label} added you to ${name}.`,
      link
    );
  }
}

// Notifications deep-link to the specific moment on the Today screen so the UI
// can scroll to / highlight it — and so moment_expiring can dedupe per moment.
function momentLink(momentId: string): string {
  return `/stylist?moment=${momentId}`;
}

async function notifyAccepted(momentId: string, accepterId: string): Promise<void> {
  const { rows } = await pool.query<{ creator_id: string }>(
    "SELECT creator_id FROM moments WHERE id = $1",
    [momentId]
  );
  const creatorId = rows[0]?.creator_id;
  if (!creatorId || creatorId === accepterId) return;
  const [label, name] = await Promise.all([actorLabel(accepterId), momentName(momentId)]);
  await createNotification(
    creatorId,
    "moment_accepted",
    "Invite accepted",
    `${label} accepted your invite to ${name}.`,
    momentLink(momentId)
  );
}

function dedupe<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

// ---- Cron maintenance ---------------------------------------------------

// Run once per cron tick (app/api/cron/tick). Two jobs:
//   1. Notify accepted members ~48h before a moment expires (deduped per
//      moment via the notification link).
//   2. Soft-delete moments past their expiry so they drop out of every view.
// Returns counts for the tick response.
export async function runMomentMaintenance(): Promise<{
  expiringNotified: number;
  expired: number;
}> {
  const { rows: expiring } = await pool.query<{
    id: string;
    event_name: string;
    user_id: string;
  }>(
    `SELECT mo.id, mo.event_name, mm.user_id
       FROM moments mo
       JOIN moment_members mm ON mm.moment_id = mo.id
      WHERE mo.deleted_at IS NULL
        AND mm.status = 'accepted'
        AND mo.expires_at > now()
        AND mo.expires_at <= now() + interval '48 hours'
        AND NOT EXISTS (
          SELECT 1 FROM notifications n
           WHERE n.user_id = mm.user_id
             AND n.type = 'moment_expiring'
             AND n.link = '/stylist?moment=' || mo.id::text
        )`
  );

  for (const r of expiring) {
    await createNotification(
      r.user_id,
      "moment_expiring",
      "Moment expiring soon",
      `${r.event_name} expires in 2 days — add your fit.`,
      momentLink(r.id)
    ).catch((err) => console.error("moment_expiring notification failed:", err));
  }

  const { rowCount: expired } = await pool.query(
    `UPDATE moments SET deleted_at = now()
      WHERE deleted_at IS NULL AND expires_at <= now()`
  );

  return { expiringNotified: expiring.length, expired: expired ?? 0 };
}
