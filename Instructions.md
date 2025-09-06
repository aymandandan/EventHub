# A. Overview

**Project name:** EventHub
**Short description:** EventHub is a MERN (MongoDB, Express, React, Node) app for discovering, creating, and managing events with role-based access (organizer, attendee), RSVP, threaded comments, and basic notifications.
**Audience & primary user flows:**

- **Organizer:** create/edit/delete events, set privacy/capacity, view/manage RSVPs, moderate comments, receive notifications.
- **Attendee:** browse/search events, RSVP (attending/maybe/cancelled), comment/reply, manage profile, receive basic notifications.
  **Constraints and assumptions**
- **Tech:** MongoDB + Mongoose, Node.js + Express, React + Redux Toolkit, Material UI v5.
- **Auth:** Server-side JWT access token (short TTL) + refresh token (long TTL). Refresh token stored as httpOnly cookie; access token in memory (recommended). Alternative: both in httpOnly cookies with CSRF protection.
- **Notifications:** basic in-app (polling or websocket-lite via Socket.IO optional), no email by default (stub provided).
- **Images/files:** out of scope for MVP (assume URL string fields; future: S3/Cloudinary).
- **Timezones:** store ISO UTC timestamps; render local in frontend.

---

# B. Epics & User Stories

## Epic 1: Events

1. **Create Event**  
   **Role:** Organizer  
   **Goal:** Create a public or private event with capacity, time, and location.  
   **Acceptance Criteria:**

- Given valid fields, POST `/api/events` returns `201` with event object.
- Required fields validate; invalid fields return `400`.
- Organizer is set as current user; `isFull` computed correctly (false initially).  
   **Example UI State:** EventForm with validation errors inline (MUI TextField helperText).

2. **Edit Event**  
   **Role:** Organizer (owner)  
   **Goal:** Update event details before it starts.  
   **Acceptance Criteria:**

- PUT `/api/events/:id` by organizer updates fields and returns `200`.
- Non-owner or attendee receives `403`.
- Cannot reduce capacity below current `attending` count (`409`).  
   **UI:** Edit button visible only to owner.

3. **Delete Event**  
   **Role:** Organizer (owner)  
   **Goal:** Delete an upcoming event.  
   **Acceptance Criteria:**

- DELETE `/api/events/:id` by owner returns `204`.
- Cascade: RSVPs/comments remain but mark event reference as deleted/invalid (or soft delete). For MVP: hard delete, RSVPs/comments also removed.
- Non-owner receives `403`.

4. **Browse & Search**  
   **Role:** Attendee/Organizer  
   **Goal:** Discover events via feed with filters (date range, tags, privacy=public only for non-owner).  
   **Acceptance Criteria:**

- GET `/api/events` supports `q`, `tags`, `from`, `to`, `page`, `limit`, `sort`.
- Private events shown only to organizer/explicit invitees (future); MVP: private visible only to owner.
- Pagination metadata returned.

## Epic 2: Social/Interaction

1. **RSVP to Event**  
   **Role:** Attendee  
   **Goal:** RSVP status (attending/maybe/cancelled).  
   **Acceptance Criteria:**

- POST `/api/events/:id/rsvp` stores/updates RSVP; capacity checked; returns `200` with `status`.
- If event full and status=attending, return `409`.
- Organizer cannot RSVP (optional: allowed but ignored).

2. **View RSVPs**  
   **Role:** Organizer  
   **Goal:** See list of attendees and counts.  
   **Acceptance Criteria:**

- GET `/api/events/:id/rsvps` returns counts by status + list (paginated).
- Non-owner gets only aggregated counts for private events, full list for public (MVP: owner only list).

3. **Threaded Comments**  
   **Role:** Attendee/Organizer  
   **Goal:** Add comments and replies on event detail.  
   **Acceptance Criteria:**

- POST `/api/events/:id/comments` accepts `content` and optional `parentComment`.
- GET `/api/events/:id/comments` returns nested threads (depth 2+).
- DELETE `/api/comments/:id` by author or organizer moderator returns `204`.

4. **Basic Notifications**  
   **Role:** Attendee/Organizer  
   **Goal:** Receive in-app notifications for replies to your comment or organizer updates.  
   **Acceptance Criteria:**

- On comment reply or event update, create notification record for target users.
- GET `/api/notifications` returns unread + read, allows mark-as-read. (Optional routes included in spec; MVP can poll.)

## Epic 3: Auth & Permissions

1. **Register & Login**  
   **Role:** Visitor  
   **Goal:** Create account and authenticate.  
   **Acceptance Criteria:**

- Register with unique email; password hashed (bcrypt).
- Login returns access token (JWT) + sets refresh cookie.

2. **Role-based Access**  
   **Role:** Admin/Organizer/Attendee  
   **Goal:** Restrict sensitive operations.  
   **Acceptance Criteria:**

- Middleware checks JWT and roles.
- Only organizers can create events.
- Users can update only their profile; admin may change roles.

3. **Session Refresh & Logout**  
   **Role:** Authenticated user  
   **Goal:** Maintain session without re-login and secure logout.  
   **Acceptance Criteria:**

- Refresh endpoint issues new access token if refresh cookie valid.
- Logout revokes refresh token (DB blacklist/rotation) and clears cookie.

---

# C. Domain Model / Data Design

## ER diagram summary (text)

- **User (1.._) —(organizes)→ Event (0.._)** via `organizer` ref.
- **User (1.._) —(RSVP)→ Event (0.._)** via **RSVP** join with `status`.
- **User (1.._) —(writes)→ Comment (0.._) —(belongs to)→ Event (1)**; `parentComment` enables threads.
- **Event (1) —(has)→ Notification (0..\*)** and **User (1) —(receives)→ Notification (0..\*)** (optional for MVP).

## Mongoose Schemas

### User

```js
// models/User.js
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const userSchema = new mongoose.Schema(
	{
		email: {
			type: String,
			required: true,
			unique: true,
			lowercase: true,
			trim: true,
		},
		passwordHash: { type: String, required: true, select: false },
		name: { type: String, required: true, trim: true },
		avatarUrl: { type: String },
		roles: {
			type: [String],
			enum: ["attendee", "organizer", "admin"],
			default: ["attendee"],
			index: true,
		},
		bio: { type: String, maxlength: 280 },
		refreshTokenHash: { type: String, select: false }, // for rotation/revocation
	},
	{ timestamps: true }
);

userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ name: "text" });

userSchema.methods.verifyPassword = async function (password) {
	return bcrypt.compare(password, this.passwordHash);
};

userSchema.statics.hashPassword = async function (password) {
	const saltRounds = 12;
	return bcrypt.hash(password, saltRounds);
};

module.exports = mongoose.model("User", userSchema);
```

**Indexes rationale:**

- `email` unique for login lookups.
- `roles` indexed for admin dashboards.
- `name` text for simple search.

---

### Event

```js
// models/Event.js
const mongoose = require("mongoose");

const eventSchema = new mongoose.Schema(
	{
		title: { type: String, required: true, trim: true, index: true },
		description: { type: String, required: true },
		startAt: { type: Date, required: true, index: true },
		endAt: { type: Date, required: true },
		location: {
			name: { type: String, required: true },
			address: { type: String },
			geo: {
				type: { type: String, enum: ["Point"], default: "Point" },
				coordinates: { type: [Number], index: "2dsphere" },
			},
		},
		privacy: {
			type: String,
			enum: ["public", "private"],
			default: "public",
			index: true,
		},
		capacity: { type: Number, default: 0 }, // 0 = unlimited
		organizer: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
			required: true,
			index: true,
		},
		tags: { type: [String], index: true },
		isCancelled: { type: Boolean, default: false },
	},
	{ timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

eventSchema.virtual("attendeeCount", {
	ref: "RSVP",
	localField: "_id",
	foreignField: "event",
	count: true,
	match: { status: "attending" },
});

eventSchema.virtual("isFull").get(function () {
	if (!this.capacity || this.capacity <= 0) return false;
	// This field is computed at query time if attendeeCount populated; otherwise false.
	const count = this.attendeeCount || 0;
	return count >= this.capacity;
});

eventSchema.index({ title: "text", description: "text", tags: "text" });
eventSchema.index({ organizer: 1, startAt: -1 });

module.exports = mongoose.model("Event", eventSchema);
```

**Indexes rationale:**

- `startAt` for upcoming queries/sorts.
- `privacy` for public feeds.
- `organizer` for dashboards.
- Text index for basic search.
- `2dsphere` for future geo queries.

---

### RSVP

```js
// models/RSVP.js
const mongoose = require("mongoose");

const rsvpSchema = new mongoose.Schema(
	{
		user: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
			required: true,
			index: true,
		},
		event: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "Event",
			required: true,
			index: true,
		},
		status: {
			type: String,
			enum: ["attending", "maybe", "cancelled"],
			required: true,
		},
	},
	{ timestamps: { createdAt: true, updatedAt: false } }
);

rsvpSchema.index({ event: 1, user: 1 }, { unique: true }); // one RSVP per user per event
rsvpSchema.index({ event: 1, status: 1 }); // counts by status

module.exports = mongoose.model("RSVP", rsvpSchema);
```

**Indexes rationale:**

- Unique compound to prevent duplicates.
- `event+status` for fast counts.

---

### Comment

```js
// models/Comment.js
const mongoose = require("mongoose");

const commentSchema = new mongoose.Schema(
	{
		event: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "Event",
			required: true,
			index: true,
		},
		user: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
			required: true,
			index: true,
		},
		parentComment: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "Comment",
			default: null,
			index: true,
		},
		content: { type: String, required: true, maxlength: 2000 },
		meta: {
			edited: { type: Boolean, default: false },
			likes: { type: Number, default: 0 },
		},
	},
	{ timestamps: true }
);

commentSchema.index({ event: 1, createdAt: -1 });
commentSchema.index({ parentComment: 1, createdAt: 1 });

module.exports = mongoose.model("Comment", commentSchema);
```

**Indexes rationale:**

- `event+createdAt` for thread retrieval and pagination.
- `parentComment+createdAt` for reply ordering.

---

# D. REST API Spec (OpenAPI-style)

**Base URL:** `/api`

## Auth

### POST `/api/auth/register`

- **Purpose:** Create user.
- **Auth:** None.
- **Headers:** `Content-Type: application/json`
- **Request:**

```json
{ "name": "Ada Lovelace", "email": "ada@example.com", "password": "S3cure!!" }
```

- **Response `201`:**

```json
{
	"user": {
		"_id": "u1",
		"name": "Ada Lovelace",
		"email": "ada@example.com",
		"roles": ["attendee"],
		"avatarUrl": null
	}
}
```

- **Errors:** `400` validation, `409` email exists.

### POST `/api/auth/login`

- **Purpose:** Authenticate and set refresh cookie.
- **Auth:** None.
- **Headers:** `Content-Type: application/json`
- **Request:**

```json
{ "email": "ada@example.com", "password": "S3cure!!" }
```

- **Response `200`:**

```json
{
	"accessToken": "<jwt>",
	"user": {
		"_id": "u1",
		"name": "Ada Lovelace",
		"email": "ada@example.com",
		"roles": ["attendee"]
	}
}
```

- **Set-Cookie:** `refreshToken=<token>; HttpOnly; Secure; SameSite=Lax; Path=/api/auth/refresh;`
- **Errors:** `401` invalid creds, `429` rate limit.

### POST `/api/auth/refresh`

- **Purpose:** Issue new access token using refresh cookie.
- **Auth:** Refresh cookie required.
- **Headers:** `Cookie: refreshToken=<token>`
- **Response `200`:**

```json
{ "accessToken": "<new-jwt>" }
```

- **Errors:** `401` missing/invalid, `403` revoked.

### POST `/api/auth/logout`

- **Purpose:** Revoke refresh token and clear cookie.
- **Auth:** Access token required (optional but recommended).
- **Response `204`**
- **Errors:** `401` if token invalid.

---

## Users

### GET `/api/users/:id`

- **Purpose:** Get public profile.
- **Auth:** Optional (private fields hidden).
- **Response `200`:**

```json
{
	"_id": "u1",
	"name": "Ada Lovelace",
	"email": "ada@example.com",
	"roles": ["attendee"],
	"avatarUrl": null,
	"bio": ""
}
```

- **Errors:** `404`.

### PUT `/api/users/:id`

- **Purpose:** Update own profile; admins may change roles.
- **Auth:** Access token; role checks.
- **Headers:** `Content-Type: application/json`
- **Request (self-update):**

```json
{
	"name": "Ada L.",
	"avatarUrl": "https://cdn/ada.png",
	"bio": "I love meetups."
}
```

- **Request (admin role change):**

```json
{ "roles": ["attendee", "organizer"] }
```

- **Response `200`:** updated user.
- **Errors:** `403` forbidden, `400` invalid roles.

---

## Events

### GET `/api/events`

- **Purpose:** List events with filters.
- **Auth:** Optional; private events filtered unless owner/admin.
- **Query:** `q, tags, from, to, page=1, limit=20, sort=startAt:asc|desc`
- **Response `200`:**

```json
{
	"data": [
		{
			"_id": "e1",
			"title": "React Meetup",
			"privacy": "public",
			"startAt": "2025-01-01T18:00:00Z",
			"attendeeCount": 10,
			"isFull": false
		}
	],
	"meta": { "page": 1, "limit": 20, "total": 53 }
}
```

### GET `/api/events/:id`

- **Purpose:** Event detail.
- **Auth:** Required for private events (owner).
- **Response `200`:** event object + computed fields.
- **Errors:** `404`, `403` private.

### POST `/api/events`

- **Purpose:** Create event (organizer only).
- **Auth:** `organizer` or `admin`.
- **Headers:** `Content-Type: application/json`
- **Request:**

```json
{
	"title": "React Meetup",
	"description": "Talks + networking",
	"startAt": "2025-01-01T18:00:00Z",
	"endAt": "2025-01-01T20:00:00Z",
	"location": { "name": "Tech Hub", "address": "123 Main St" },
	"privacy": "public",
	"capacity": 100,
	"tags": ["react", "javascript"]
}
```

- **Response `201`:** created event.
- **Errors:** `400` validation, `403` forbidden.

### PUT `/api/events/:id`

- **Purpose:** Update event (owner).
- **Auth:** Organizer owner or admin.
- **Response `200`:** updated event.
- **Errors:** `403` not owner, `409` capacity<attending.

### DELETE `/api/events/:id`

- **Purpose:** Delete event (owner/admin).
- **Auth:** Organizer owner or admin.
- **Response `204`**
- **Errors:** `403`, `404`.

---

## RSVP

### POST `/api/events/:id/rsvp`

- **Purpose:** Create/update RSVP for current user.
- **Auth:** Any authenticated user.
- **Headers:** `Content-Type: application/json`
- **Request:**

```json
{ "status": "attending" }
```

- **Response `200`:**

```json
{ "eventId": "e1", "userId": "u1", "status": "attending" }
```

- **Errors:** `409` event full, `400` invalid status, `403` private event not owned.

### DELETE `/api/events/:id/rsvp`

- **Purpose:** Remove user's RSVP.
- **Auth:** Authenticated.
- **Response `204`**
- **Errors:** `404` not found.

### GET `/api/events/:id/rsvps`

- **Purpose:** List RSVPs (owner) + counts.
- **Auth:** Organizer owner/admin for list; others get summary.
- **Response `200`:**

```json
{
	"counts": { "attending": 42, "maybe": 5, "cancelled": 3 },
	"data": [
		{
			"user": { "_id": "u2", "name": "Grace" },
			"status": "attending",
			"createdAt": "..."
		}
	]
}
```

---

## Comments

### POST `/api/events/:id/comments`

- **Purpose:** Add comment or reply.
- **Auth:** Authenticated.
- **Headers:** `Content-Type: application/json`
- **Request:**

```json
{ "content": "Looking forward!", "parentComment": null }
```

- **Response `201`:** comment object.
- **Errors:** `400` empty content, `403` private event.

### GET `/api/events/:id/comments`

- **Purpose:** Fetch comments (paginated, threaded).
- **Auth:** Optional; private event requires owner.
- **Query:** `page=1&limit=20`
- **Response `200`:**

```json
{
	"data": [
		{
			"_id": "c1",
			"content": "Hello",
			"user": { "_id": "u1", "name": "Ada" },
			"children": [
				{
					"_id": "c2",
					"content": "Reply",
					"user": { "_id": "u2", "name": "Grace" }
				}
			]
		}
	],
	"meta": { "page": 1, "limit": 20, "total": 13 }
}
```

### DELETE `/api/comments/:id`

- **Purpose:** Delete own comment or moderator (organizer/admin).
- **Auth:** Authenticated + role/ownership.
- **Response `204`**
- **Errors:** `403`, `404`.

---

### Common HTTP status codes & errors

- `400` ValidationError `{ "error":"VALIDATION_ERROR", "details": {...} }`
- `401` Unauthorized `{ "error":"UNAUTHORIZED" }`
- `403` Forbidden `{ "error":"FORBIDDEN" }`
- `404` NotFound `{ "error":"NOT_FOUND" }`
- `409` Conflict `{ "error":"CONFLICT", "message":"Event is full" }`
- `429` TooManyRequests

---

### Example `curl` commands

```bash
# 1) Login
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"ada@example.com","password":"S3cure!!"}' -i

# 2) Create event (requires Authorization header; insert token)
curl -X POST http://localhost:4000/api/events \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"title":"React Meetup","description":"Talks + networking","startAt":"2025-01-01T18:00:00Z","endAt":"2025-01-01T20:00:00Z","location":{"name":"Tech Hub"},"privacy":"public","capacity":100,"tags":["react","javascript"]}'

# 3) RSVP to event
curl -X POST http://localhost:4000/api/events/e1/rsvp \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"status":"attending"}'
```

---

# E. Auth & RBAC Implementation Notes

**JWT + Refresh flow (recommended)**

1. User logs in → server verifies creds → returns **access JWT** (e.g., 15m) in JSON and sets **refresh token** (e.g., 7–30d) in **httpOnly, Secure, SameSite=Lax** cookie (scoped to `/api/auth/refresh`).
2. Client keeps access token in memory (Redux state) and attaches in `Authorization: Bearer`.
3. On 401/expired access, client calls `/api/auth/refresh` (cookie sent automatically) to obtain new access token.
4. Logout → server wipes stored refresh token hash and clears cookie.
   **Token storage strategy**

- **Recommended:** access in memory + refresh httpOnly cookie → mitigates XSS stealing refresh token; access token still at risk if injected, but short TTL.
- **Alternative:** both tokens as httpOnly cookies with CSRF tokens (double-submit). Pros: no JS access; Cons: more CSRF complexity and cookie juggling.
- **Avoid:** localStorage for refresh token (XSS risk).
  **CSRF notes**
- For refresh route and any cookie-auth state-changing routes, set **SameSite=Lax/Strict** and use **CSRF token** header for POST/PUT/DELETE if not Bearer-only. For simplicity, Bearer access token protects most routes; the refresh route can implement a CSRF token returned at login.
  **Express middleware: auth + role check**

```js
// middleware/auth.js
const jwt = require("jsonwebtoken");
const User = require("../models/User");

exports.requireAuth =
	(opts = {}) =>
	async (req, res, next) => {
		const auth = req.headers.authorization || "";
		const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
		if (!token) return res.status(401).json({ error: "UNAUTHORIZED" });
		try {
			const payload = jwt.verify(token, process.env.JWT_SECRET);
			req.user = { _id: payload.sub, roles: payload.roles };
			next();
		} catch {
			return res.status(401).json({ error: "UNAUTHORIZED" });
		}
	};

exports.requireRoles =
	(...roles) =>
	(req, res, next) => {
		if (!req.user) return res.status(401).json({ error: "UNAUTHORIZED" });
		const ok = req.user.roles?.some((r) => roles.includes(r));
		if (!ok) return res.status(403).json({ error: "FORBIDDEN" });
		next();
	};

exports.requireOwnerOrRoles =
	(getOwnerId, ...roles) =>
	(req, res, next) => {
		const isRole = req.user?.roles?.some((r) => roles.includes(r));
		const isOwner = String(getOwnerId(req)) === String(req.user?._id);
		if (isRole || isOwner) return next();
		return res.status(403).json({ error: "FORBIDDEN" });
	};
```

---

# F. Frontend: UX, State & Components

## Main pages/screens

- **Home (Feed):** list of upcoming public events; filters (search, tags, date range), pagination.
- **Event Detail:** event info, RSVP button/status, attendee count, comments thread.
- **Create/Edit Event:** protected for organizers; form validation; preview.
- **Profile:** view/edit user info, role badges; user’s events & RSVPs.
- **Admin/Organizer Panel:** organizer’s events, RSVP lists, comment moderation.

## Components & responsibilities

- **EventCard:** title, time, location, tags, RSVP count, `Chip` for `public/private`.
- **EventForm:** controlled inputs (TextField, DateTimePicker), validation, submit/abort.
- **RSVPButton:** shows current status; dropdown to change; handles optimistic updates.
- **CommentsThread:** list + reply editor; paginated; nested rendering.
- **Navbar/SideFilters/PaginationBar/ProtectedRoute** wrappers.

## Redux organization (Redux Toolkit)

- **Slices:** `auth`, `events`, `rsvps`, `comments`, `users`, `notifications` (optional).
- **Actions/Thunks:**
  - `auth/login`, `auth/refresh`, `auth/logout`
  - `events/fetchList`, `events/fetchById`, `events/create`, `events/update`, `events/delete`
  - `rsvps/setStatus`, `rsvps/delete`, `rsvps/listForEvent`
  - `comments/listForEvent`, `comments/create`, `comments/delete`
- **Optimistic updates:**
  - RSVP status toggle: update local counts immediately; rollback on 409.
  - Comment create: prepend temp item; replace with server item on success.
- **Caching hints:**
  - Normalize by `id` with `createEntityAdapter`.
  - Cache event detail; invalidate on update/delete/RSVP success.
  - Pagination keys: `events:list:q|tags|from|to|page`.

### Example: events slice (simplified)

```js
// src/store/eventsSlice.js
import {
	createSlice,
	createAsyncThunk,
	createEntityAdapter,
} from "@reduxjs/toolkit";
import api from "../utils/api";

const eventsAdapter = createEntityAdapter({
	selectId: (e) => e._id,
	sortComparer: (a, b) => new Date(a.startAt) - new Date(b.startAt),
});

export const fetchEvents = createAsyncThunk(
	"events/fetchEvents",
	async (params) => {
		const res = await api.get("/events", { params });
		return res.data; // { data, meta }
	}
);

export const fetchEventById = createAsyncThunk(
	"events/fetchEventById",
	async (id) => {
		const res = await api.get(`/events/${id}`);
		return res.data;
	}
);

export const createEvent = createAsyncThunk(
	"events/createEvent",
	async (payload) => {
		const res = await api.post("/events", payload);
		return res.data;
	}
);

const slice = createSlice({
	name: "events",
	initialState: eventsAdapter.getInitialState({
		meta: { page: 1, total: 0 },
		status: "idle",
		error: null,
	}),
	reducers: {
		upsertOne: eventsAdapter.upsertOne,
		removeOne: eventsAdapter.removeOne,
	},
	extraReducers: (builder) => {
		builder
			.addCase(fetchEvents.pending, (state) => {
				state.status = "loading";
			})
			.addCase(fetchEvents.fulfilled, (state, action) => {
				eventsAdapter.setAll(state, action.payload.data);
				state.meta = action.payload.meta;
				state.status = "succeeded";
			})
			.addCase(fetchEvents.rejected, (state, action) => {
				state.status = "failed";
				state.error = action.error.message;
			})
			.addCase(fetchEventById.fulfilled, (state, action) => {
				eventsAdapter.upsertOne(state, action.payload);
			})
			.addCase(createEvent.fulfilled, (state, action) => {
				eventsAdapter.addOne(state, action.payload);
			});
	},
});

export const eventsSelectors = eventsAdapter.getSelectors((s) => s.events);
export const { upsertOne, removeOne } = slice.actions;
export default slice.reducer;
```

### React component skeleton using MUI

```jsx
// src/components/EventCard.jsx
import React from "react";
import {
	Card,
	CardContent,
	CardActions,
	Typography,
	Chip,
	Button,
	Stack,
} from "@mui/material";
import EventAvailableIcon from "@mui/icons-material/EventAvailable";

export default function EventCard({ event, onOpen }) {
	const start = new Date(event.startAt).toLocaleString();
	return (
		<Card variant="outlined" sx={{ mb: 2 }}>
			<CardContent>
				<Stack direction="row" spacing={1} alignItems="center">
					<EventAvailableIcon color="primary" />
					<Typography variant="h6">{event.title}</Typography>
					<Chip
						size="small"
						label={event.privacy}
						color={event.privacy === "public" ? "success" : "warning"}
					/>
					{event.isFull && <Chip size="small" label="Full" color="error" />}
				</Stack>
				<Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
					{start} • {event.location?.name || "TBA"}
				</Typography>
				<Stack direction="row" spacing={1} sx={{ mt: 1 }}>
					{(event.tags || []).map((t) => (
						<Chip key={t} size="small" label={t} />
					))}
				</Stack>
			</CardContent>
			<CardActions>
				<Button onClick={() => onOpen(event._id)} size="small">
					View
				</Button>
			</CardActions>
		</Card>
	);
}
```

---

# G. Milestones & Deliverables (ordered)

## 1) Project setup & data modeling

**Tasks:**

- Initialize repo, ESLint/Prettier, EditorConfig.
- Setup Express app, connect Mongoose, health route.
- Implement `User`, `Event`, `RSVP`, `Comment` models + indexes.
- Seed script for sample users/events.
  **Acceptance Criteria:**
- `npm run dev` starts API; `/api/health` returns `{status:'ok'}`.
- Models validated with simple unit tests.
- Seed populates 2 organizers, 10 events, 30 RSVPs.
  **Example Test Cases:**
- Creating an `RSVP` with duplicate `(user,event)` fails with unique index error.
- Event virtual `isFull` false when capacity=0 or attendeeCount<capacity.

## 2) Auth & role system

**Tasks:**

- Register/login/logout/refresh endpoints.
- JWT signing, password hashing, refresh token rotation.
- Middleware: `requireAuth`, `requireRoles`, `requireOwnerOrRoles`.
- Rate limiter for auth routes.
  **Acceptance Criteria:**
- Login returns access token and sets refresh cookie.
- Refresh returns new token when access expired.
- Organizer-only route protected.
  **Tests:**
- Invalid login → `401`.
- Refresh with revoked token → `403`.
- Organizer-only endpoint → `403` for attendee.

## 3) Events CRUD (backend + basic API)

**Tasks:**

- Implement `/api/events` CRUD with validation.
- Public feed filters, pagination, sorting.
- Owner check on update/delete.
- Swagger/OpenAPI stub (optional).
  **Acceptance Criteria:**
- Creating event by organizer → `201`.
- Non-owner edit → `403`.
- GET list returns `meta` and respects filters.
  **Tests:**
- `capacity` cannot be set < current attendees → `409`.
- Private event not visible to non-owner.

## 4) RSVP & Comments (backend)

**Tasks:**

- RSVP endpoints with capacity enforcement.
- Comments endpoints with threading (parentComment).
- Aggregate counts endpoint for RSVPs.
  **Acceptance Criteria:**
- RSVP attending when full → `409`.
- Comments list returns nested structure.
  **Tests:**
- Deleting comment by non-owner → `403`.
- RSVP upsert updates status not duplicates.

## 5) Frontend core pages (React + Redux + MUI)

**Tasks:**

- Setup React app, Redux Toolkit store, RTK Query or axios helper.
- Implement Home feed, Event detail, Create/Edit, Profile, Organizer panel.
- Protected routes; login/register UI.
- MUI theme, responsive layout.
  **Acceptance Criteria:**
- Can login, browse events, RSVP, comment.
- Organizer can create/edit/delete events.
- E2E smoke tests (Playwright/Cypress) pass core flows.
  **Tests:**
- Optimistic RSVP updates then rollback on 409.
- Form validation messages render.

## 6) Polishing: validations, security hardening, deployment

**Tasks:**

- Input validation via `zod`/`joi` or express-validator.
- CORS config, helmet, rate limiting.
- Error handler and logging (morgan + pino).
- Deploy backend + frontend; environment variables documented.
  **Acceptance Criteria:**
- All routes validated and secured.
- Deployed URLs functional with health checks.
- Basic notification UI (badge + list) if included.
  **Tests:**
- XSS attempt in comment escaped on render.
- Rate limit triggers `429` on brute-force login.

---

# H. README (Vercel deployment)

## Run locally

```bash
# Backend
cp .env.example .env
npm install
npm run dev          # starts Express at http://localhost:4000

# Frontend (React + Vite or CRA)
cd web
cp .env.example .env
npm install
npm run dev          # starts dev server at http://localhost:5173
```

**Environment variables (.env.example):**

```bash
# Backend
PORT=4000
MONGO_URI=mongodb://localhost:27017/eventhub
JWT_SECRET=supersecret_access
REFRESH_TOKEN_SECRET=supersecret_refresh
ACCESS_TOKEN_TTL=15m
REFRESH_TOKEN_TTL=30d
CORS_ORIGIN=http://localhost:5173
LOG_LEVEL=info

# Frontend
VITE_API_URL=http://localhost:4000/api
```

## Deployment architecture on Vercel

- **Frontend on Vercel:** Build React app (Vite) as static assets; set `VITE_API_URL` to production AP
- **Backend options:** 1. **Vercel Serverless Functions (small apps):** - Pros: simple deploy, scale-to-zero, integrated logs. - Cons: cold starts, limited long-lived connections, Mongo connections must be pooled with global. - Use when traffic is low/moderate and APIs are stateless. 2. **Dedicated Node/Express host (Heroku/Render/Railway/Fly.io):** - Pros: stable connections, WebSocket support (for live notifications), more control. - Cons: separate deployment and billing. - **Recommended** for production with MongoDB Atlas.
  **Example `vercel.json` (frontend project root):**

```json
{
	"buildCommand": "npm run build",
	"outputDirectory": "dist",
	"rewrites": [
		{
			"source": "/api/(.*)",
			"destination": "https://api.yourdomain.com/api/$1"
		}
	],
	"headers": [
		{
			"source": "/(.*)",
			"headers": [{ "key": "X-Frame-Options", "value": "SAMEORIGIN" }]
		}
	]
}
```

**Build settings (frontend):**

- Framework preset: **Other** (Vite)
- Build command: `npm run build`
- Output directory: `dist`
- Environment variable: `VITE_API_URL=https://api.yourdomain.com/api`
  **Health check & logging:**
- Backend route `/api/health` returns `{ status: 'ok', uptime, version }`.
- Use pino for JSON logs; ship to Logtail/Datadog.
- Add uptime monitor (UptimeRobot) hitting `/api/health`.

---

# I. QA, Security & Scalability Checklist

## Tests to write

- **Unit:**
  - Password hashing/verification.
  - Event capacity conflict logic.
  - RSVP unique constraint handling.
  - Comment nesting serialization.
- **Integration (API):**
  - Auth flow: register → login → refresh → logout.
  - Organizer-only routes.
  - Events list filters/pagination.
  - RSVP status transitions and counts.
  - Comments CRUD + permissions.
- **E2E:**
  - User registers, logs in, RSVPs, comments.
  - Organizer creates/edits/deletes event.
  - Private event not visible to other users.

## Security checklist

- Rate limit: `/api/auth/*` (e.g., 5/min/IP) and general (100/min/IP).
- Input validation + sanitization on all routes.
- Password hashing: bcrypt with 12+ rounds.
- JWT audience/issuer checks; short-lived access tokens.
- Store refresh token hash server-side for rotation/revocation.
- CORS: allowlist origin, credentials only when needed.
- Helmet headers, disable `x-powered-by`.
- XSS: escape comment content on render; use MUI components; avoid dangerouslySetInnerHTML.
- CSRF: prefer Bearer for state changes; if cookie-based flows, use CSRF token.
- Secrets management: never commit `.env`.
- Authorization checks on every write route.

## Scalability notes

- **Indexes:** already defined; monitor with `explain()`.
- **Pagination:** always `limit` + `page`; cap `limit` (e.g., ≤ 100).
- **Query limits:** throttle heavy searches; enforce `from/to` date bounds.
- **Caching:** CDN for static; consider in-memory caching for hot GETs.
- **File storage:** external (S3/Cloudinary) when adding images.
- **Background jobs:** queue for notifications (BullMQ) if needed.
- **WebSockets:** if real-time needed, deploy on dedicated host.

---

# J. Extras (optional but helpful)

## Postman/HTTP collection (contents)

- **Folders:** Auth, Users, Events, RSVPs, Comments, Notifications.
- **Auth:** register, login, refresh, logout (with cookie persistence).
- **Events:** list (with params), get by id, create/update/delete.
- **RSVP:** set/delete/list.
- **Comments:** list/create/delete.
- Includes pre-request script to inject `Authorization: Bearer {{accessToken}}`.

## OpenAPI JSON stub (minimal)

```json
{
	"openapi": "3.0.0",
	"info": { "title": "EventHub API", "version": "0.1.0" },
	"servers": [{ "url": "/api" }],
	"paths": {
		"/auth/login": {
			"post": {
				"summary": "Login",
				"responses": { "200": { "description": "OK" } }
			}
		},
		"/events": {
			"get": {
				"summary": "List events",
				"parameters": [
					{ "name": "page", "in": "query", "schema": { "type": "integer" } }
				],
				"responses": { "200": { "description": "OK" } }
			},
			"post": {
				"summary": "Create event",
				"responses": {
					"201": { "description": "Created" },
					"403": { "description": "Forbidden" }
				}
			}
		},
		"/events/{id}": {
			"get": {
				"summary": "Event detail",
				"responses": {
					"200": { "description": "OK" },
					"404": { "description": "Not Found" }
				}
			}
		}
	}
}
```

## Suggested folder structure

```
eventhub/
  api/
    models/
        User.js
        Event.js
        RSVP.js
        Comment.js
    middleware/
        auth.js
    routes/
        auth.routes.js
        users.routes.js
        events.routes.js
        rsvp.routes.js
        comments.routes.js
    utils/
        errorHandler.js
        rateLimit.js
        logger.js
        validate.js
        tokens.js
    app.js
    server.js
    package.json
    .env.example
  web/
    src/
      components/
        EventCard.jsx
        EventForm.jsx
        RSVPButton.jsx
        CommentsThread.jsx
      pages/
        Home.jsx
        EventDetail.jsx
        EventEdit.jsx
        Profile.jsx
        OrganizerPanel.jsx
        Login.jsx
        Register.jsx
      store/
        index.js
        eventsSlice.js
        authSlice.js
        rsvpsSlice.js
        commentsSlice.js
      utils/
        api.js
        ProtectedRoute.jsx
      theme.js
    index.html
    vite.config.js
    package.json
    .env.example
```

## Minimal CI pipeline outline (GitHub Actions)

```yaml
name: ci
on: [push, pull_request]
jobs:
  build-and-test:
    runs-on: ubuntu-latest
    services:
      mongo:
        image: mongo:6
        ports: ["27017:27017"]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: "20" }
      - name: Backend deps
        run: |
          cd api
          npm ci
      - name: Lint backend
        run: cd api && npm run lint
      - name: Test backend
        env:
          MONGO_URI: mongodb://localhost:27017/eventhub_test
          JWT_SECRET: test
          REFRESH_TOKEN_SECRET: test_refresh
        run: cd api && npm test -- --runInBand
      - name: Frontend deps
        run: cd web && npm ci
      - name: Lint frontend
        run: cd web && npm run lint
      - name: Build frontend
        run: cd web && npm run build
```

---

## Assumptions (explicit)

- Organizers are self-assigned via admin or role upgrade; no multi-org tenancy in MVP.
- Private events: visible only to organizer/admin in MVP (no invite list).
- Notifications are simple in-app list (polling `/api/notifications` every 30–60s) if implemented.

---

## Next steps

1. Scaffold repositories (`api`, `web`) with configs and scripts.
2. Implement models and seed data (Milestone 1).
3. Build auth flow with JWT/refresh and middleware (Milestone 2).
4. Implement Events CRUD with filters and pagination (Milestone 3).
5. Add RSVP and Comments endpoints with tests (Milestone 4).
6. Wire up frontend pages with Redux slices and MUI components (Milestone 5).
7. Harden security, finalize validation, and deploy (Milestone 6).
8. Prepare Postman collection and OpenAPI for sharing.
