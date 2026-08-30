# M3 — Verification Architecture & Threat Model

**Status: DESIGN FOR REVIEW. Nothing in this document is implemented.**

The question this system answers is not "did the candidate submit these
numbers?" It is:

> How confident can Zero Phase be that **this specific candidate** performed
> **this specific complete assessment**, at **this time**, according to the
> **required protocol**, without manipulating the evidence?

Every design choice below is downstream of that sentence, and of the core
principle: rankings are only as valuable as the trust candidates place in the
verification behind them.

One honesty note up front, repeated where it matters: **verification cannot be
perfect.** The system is designed to make cheating expensive, detectable and
auditable — and to grade its own confidence honestly through tiers — not to
pretend fraud is impossible.

---

## 1. Threat model

Threats are grouped by what the architecture does about them: **PREVENT**
(structurally impossible or near-impossible), **DETECT** (caught by review or
automated checks), **DISCOURAGE** (raised cost, imperfect detection).
Severity reflects damage to leaderboard credibility × ease of execution.

### 1.1 Evidence-substitution attacks

| Threat | Severity | Response |
|---|---|---|
| Uploading prerecorded footage | HIGH | **PREVENT.** Server-issued session challenge must appear at the start of every clip (§4). Footage recorded before the challenge existed cannot contain it. In-app capture (§5) blocks camera-roll uploads entirely for the Zero Verified tier. |
| Editing / splicing video | HIGH | **PREVENT (mostly) + DETECT.** In-app capture produces one continuous clip per event; its SHA-256 hash is committed to the server at capture time (§6.4), before any editing window exists. A swapped file fails the hash check. Splicing *during* capture (rooted device, virtual camera) is not preventable client-side — reviewers watch for discontinuities, and automated discontinuity detection is a designed-for upgrade (§17). |
| Pausing recording mid-event | HIGH | **DETECT.** Clip duration must match the server-clocked event window (§6.2). A 2-minute push-up event whose clip is 1:40 is flagged automatically. |
| Reusing evidence across attempts | MEDIUM | **PREVENT.** Content hash is unique-indexed across all evidence; the embedded challenge belongs to exactly one session. |
| Reusing evidence across accounts | MEDIUM | **PREVENT.** Same hash index is global, not per-account. |
| Manipulating timestamps | MEDIUM | **PREVENT.** Every timestamp that matters is stamped by the server on receipt. Client timestamps are stored as claims, never trusted. |

### 1.2 Identity attacks

| Threat | Severity | Response |
|---|---|---|
| Another person performs an event | HIGH | **DETECT (moderate confidence).** Session opens with an identity clip — the candidate's face, reading the challenge aloud (§4.3). Reviewers compare the person in each event clip to the identity clip. Not biometric-grade in V1; honest limitation. Face-continuity automation is a designed-for upgrade. |
| Multiple accounts | MEDIUM | **DISCOURAGE + DETECT.** One candidate profile per auth user (already enforced); evidence-hash reuse across accounts is blocked; device metadata recorded per session supports later abuse investigation. Determined multi-accounting is not fully preventable — say so. |
| Collusion with reviewers/proctors | MEDIUM | **DISCOURAGE + DETECT.** Reviewers cannot review their own or self-selected attempts (assignment is server-side), every review action lands in an append-only audit log (§9), the model supports N independent reviews per event (§15), and proctor attestations are auditable records, never a `verified=true` bit (§13). |

### 1.3 Protocol attacks

| Threat | Severity | Response |
|---|---|---|
| Events out of order | MEDIUM | **PREVENT.** The session state machine only opens event N+1 after event N closes (§3). Order is server-controlled. |
| Excessive rest between events | MEDIUM | **PREVENT (structure) + DETECT.** Transitions are server-clocked. A gap beyond the protocol tolerance is recorded on the timeline and flags the attempt — it cannot be edited out afterward, because the timeline lives on the server (§6). |
| Inflated rep counts / partial ROM / wrong standards | HIGH | **DETECT.** This is the core job of human review: reviewers count valid reps against the protocol standard and the accepted value can be adjusted below the claim (§9). The claim is preserved verbatim. |
| Incorrect timer start/stop | LOW | **PREVENT.** Timed windows are app-driven inside capture; the clip spans the window. |
| Candidate leaves frame / camera can't judge form | MEDIUM | **DETECT.** Per-event framing protocol (§7); reviewers reject events with unjudgeable evidence. Rejection means retest, not benefit of the doubt. |

### 1.4 Distance/measurement attacks

| Threat | Severity | Response |
|---|---|---|
| Running short / invalid course | HIGH | **DETECT.** Distance is computed server-side from the GPS trace, never taken from the claim (§8). Accepted time is read at the accepted distance. |
| GPS spoofing | MEDIUM | **DISCOURAGE + DETECT.** Plausibility checks (accuracy variance, teleportation, pace-vs-history, elevation sanity, clock-skew) plus video bookends tying the run to a real place and the challenge. Sophisticated spoofing beats V1 — honest limitation, mitigated later by device integrations and proctored tiers. |
| Pool shorter than claimed | HIGH (for swim) | **PARTIAL in V1.** The swim protocol (§8.3) requires the pool and lane markers on camera and the stated length on record, but V1 cannot *prove* pool length. The swim is verification's weakest event in V1 and the design says so; proctored/approved-pool tiers exist largely for this. |
| Incorrect lap counts / missed wall touches | HIGH (for swim) | **DETECT.** Fixed-camera protocol keeps walls visible; reviewers count laps and touches. |

### 1.5 Platform attacks

| Threat | Severity | Response |
|---|---|---|
| Manipulated client requests (`verified=true`, inflated official rating) | HIGH | **PREVENT.** Already structural since M2: no client UPDATE policy on attempts, INSERT limited to self-reported claims, official ratings and status transitions are service-role writes only. M3 extends the same posture to every verification table (§20). |
| Direct database/API manipulation | HIGH | **PREVENT.** RLS on every table; verdict fields have no client write path; Edge Functions validate challenges and transitions against server state, not request payloads. |

**Summary of honesty:** V1 *prevents* replayed footage, swapped files,
reordered events, silent extra rest, evidence reuse, and every
client-declares-truth attack. It *detects* bad reps, short distances, and
identity substitution with human eyes at moderate confidence. It *cannot*
defeat a sophisticated attacker with a rooted device, a virtual camera and a
body double — that is what the proctored and organization tiers are for, and
why confidence is graded rather than binary.

---

## 2. Verification state machine

Two machines, deliberately separate: the **session** (live, while performing)
and the **attempt** (the permanent competitive record, unchanged from M2).

### Session states

```
issued ──► active ──► submitted            (terminal for the session)
   │          │
   │          ├──► interrupted ──► abandoned
   └──────────┴──► expired
```

- `issued` — server created the session + challenge; nothing captured yet.
- `active` — identity clip received; events opening in order.
- `interrupted` — app death / crash mid-event beyond resume tolerance (§18).
- `submitted` — all uploads finalized; the attempt enters review.
- `expired` / `abandoned` — challenge TTL passed or candidate quit. Partial
  evidence is retained briefly for support, then deleted.

### Attempt states (M2 enum, now with real transitions)

```
                          ┌────────► zero_verified   (terminal*)
self_reported             │
     │              pending_review ─► rejected        (terminal*)
     └── (verified ──────►│
          session                └──► proctored / org (future path)
          submit)
```

- Every transition past `self_reported` is a **service-role write**. There is
  no client path, and the M2 RLS audit already proves the absence.
- `rejected` carries a machine-readable reason category; one category is
  `retest_required`, which the UI renders as "Retest required" — a rejection
  with a friendly path forward, not a separate state.
- \*Terminal for the candidate. An admin can reopen with an audited action
  (e.g., fraud discovered post-verification revokes `zero_verified`); every
  reopen is a new audit row, never a silent edit.

### Event-level review states (within pending_review)

```
claimed ──► accepted | adjusted(value, reason) | rejected(reason)
```

### The verdict rule

`zero_verified` **iff**: every event in the protocol is accepted or adjusted,
AND the identity clip passes, AND the session timeline has no unexplained
gaps. **Any** rejected event rejects the assessment — four of five passing is
not a smaller success, because the protocol is the unit of competition. The
official rating is then computed server-side from **accepted** values under
the attempt's stamped scoring-config version.

---

## 3. Candidate verified-assessment flow

```
TAKE VERIFIED IFT
   │
   ▼
PREFLIGHT ──────────── camera permission, GPS permission (run), storage
   │                   headroom, battery warning, per-event protocol brief,
   │                   evidence disclosure (§16): what is recorded, why, who
   │                   reviews it, how long it is kept. Explicit consent.
   ▼
SESSION ISSUED ─────── server generates session + challenge K7F-29Q,
   │                   TTL sized to the protocol (e.g. 4 hours)
   ▼
IDENTITY CLIP ───────── candidate's face, reading the challenge aloud (~10s)
   ▼
EVENT 1 … N, in protocol order, each:
   │   instruction screen (framing diagram, rep standard, challenge overlay)
   │   ► in-app capture (video; GPS trace for the run)
   │   ► candidate confirms claimed value
   │   ► hash committed immediately; body uploads in background
   │   ► server closes the event window
   ▼
CONTROLLED TRANSITION ─ server-clocked rest timer between events; overage
   │                    is recorded on the timeline, visibly to the candidate
   ▼
REVIEW & SUBMIT ─────── summary of claims; SUBMIT finalizes uploads
   ▼
PENDING REVIEW ──────── "Under review — typically within N days"
   ▼
VERDICT ─────────────── ZERO VERIFIED (official rating appears)
                        or REJECTED with reasons (retest path shown)
```

Design intent: the session **is** the provenance. A candidate cannot
reproduce this artifact set after the fact, because the challenge, the
ordering, the transition clocks and the hash commitments all live server-side
and only exist during a live session.

**Platform note (important for our workflow):** in-app video capture and
foreground GPS work inside Expo Go, so V1 remains testable on the physical
iPhone without a Mac. The run protocol therefore keeps the app foregrounded
(§8.2); background-tracking support is explicitly postponed until an EAS dev
build/TestFlight is in play. Practice flows are untouched.

---

## 4. Session & challenge design

- **Server-generated** by an Edge Function using the service role; never
  client-generated, never guessable (crypto-random, ~7 chars from an
  unambiguous base32 alphabet, e.g. `K7F-29Q`).
- **Bound** to one candidate, one session, one attempt, one protocol version.
- **Single-use and expiring.** TTL covers one assessment (default 4h,
  per-definition). Expiry kills the session; a new attempt needs a new code.
- **Incorporated into evidence** twice:
  1. The identity clip: candidate reads the code aloud on camera.
  2. Every event clip: the app renders a capture overlay burned into the
     recording — `K7F-29Q · E3/5 · ZERO PHASE` — so each clip is
     independently bound to the session **and its position in it**.
- **Event-specific component: recommended.** The `E3/5` ordinal costs
  nothing and defeats the remaining replay window (reusing clip 2 from
  earlier *today* as clip 4). Full per-event sub-codes add friction without
  adding much over the ordinal + server timeline; not recommended for V1.
- **Validation is server-side state**, not string comparison against client
  payloads: the server knows what it issued, to whom, when, and whether the
  session window is open.

---

## 5. In-app capture — the tier-defining requirement

**Recommendation: YES.** Zero Verified means *evidence captured through the
Zero Phase app during a live session*. Camera-roll uploads are not eligible
for Zero Verified, full stop.

Why this is the right trade:

- The challenge overlay, hash-at-capture, event windows and continuity
  timeline are only trustworthy if the app controls the camera.
- "Upload whatever video you want" moves every threat in §1.1 from PREVENT
  to DETECT and multiplies review cost per assessment.

Trade-offs accepted, and edge cases to design around:

- **Single-device constraint.** The phone is the camera, so the phone cannot
  be in the candidate's hand. Protocols assume a propped/tripod phone
  (§7–§8). A second person may *operate* the propped phone but adds nothing
  they could fake.
- **Storage/battery.** Preflight checks headroom and warns; capture uses
  720p by default (§17) to bound file sizes.
- **Device quality variance.** Old devices produce worse footage; the
  protocol's framing checks matter more than resolution. Minimum: the
  reviewer must be able to judge — unjudgeable footage rejects the event.
- **Accessibility valve.** Candidates whose devices genuinely cannot run
  capture can still log practice attempts; verification is a premium claim,
  not a gate on using the product.
- **Rooted devices / virtual cameras** can still lie to the app. This is the
  residual risk in-app capture does not close (§1.5); it is why tiers exist.

---

## 6. Continuity — proving one performance, not five clips

**Not one enormous video.** Per-event clips plus a server-owned session
timeline, stitched by four mechanisms:

1. **Server-clocked event windows.** The server records when each event
   opens and closes (on receipt of app signals, stamped with server time).
   Clip duration must match its window within tolerance.
2. **Server-clocked transitions.** Rest between events runs on the server's
   clock. The protocol's allowed rest (from the versioned definition) is the
   budget; overage is recorded, visible, and flags review. A secret
   30-minute rest is structurally impossible to hide because the gap exists
   in data the client cannot edit.
3. **Hash commitment at capture.** The app computes each clip's SHA-256 the
   moment recording stops and sends the hash immediately (bytes upload
   later, resumable). Swapping the file after the fact fails the check; the
   tiny hash survives bad networks that would delay a video upload.
4. **Challenge + ordinal overlay** (§4) binds every clip to this session and
   this position, so clips cannot be dropped, reordered, or borrowed.

Deliberately postponed: cryptographic clip-chaining (each overlay embedding
the previous clip's hash). It hardens against a sophisticated
capture-layer attack but complicates recovery from mid-session failures; the
server timeline gives most of the value. Revisit with automated review.

---

## 7. Calisthenics protocol (pull-ups, push-ups, sit-ups)

**V1 assumes human review. No computer vision.** Evidence is captured so CV
could later assist (§15): continuous fixed-angle clips, full body always in
frame, stable timestamps.

- **Camera:** propped/tripod, landscape, stable. Whole body plus ground/bar
  contact visible for the entire event. Guidance targets: pull-ups — slight
  side-front angle showing full hang, chin and bar; push-ups and sit-ups —
  side view showing the full body line and ground contact.
- **Start ritual:** framing screen with a silhouette guide → challenge
  overlay begins recording → candidate assumes the start position visibly.
- **One continuous clip per event.** Timed events (2:00 push-ups/sit-ups)
  record the full window; the app timer is burned into the overlay so the
  reviewer sees clip time and event clock together.
- **Standards on screen before capture**, drawn from the versioned protocol
  definition (dead hang, chin over bar, rest positions) — the candidate
  cannot claim not to have seen the standard they're judged against.
- **Leaving frame, obstruction, unjudgeable lighting → event rejectable.**
  The instruction screens exist to make this rare, review makes it final.
- **Audio stays on.** Breathing/counting is corroborating evidence and
  costs nothing.
- **Reviewer counts valid reps**; invalid reps are excluded from the
  accepted value rather than failing the event outright (unless standards
  collapse entirely).

---

## 8. Run protocol (1.5-mile)

### Evidence captured

- **GPS trace**, 1 Hz: lat/lon, horizontal accuracy, speed, altitude, device
  timestamp — recorded in-app, foreground (screen on, keep-awake; armband or
  hand carry). App-state transitions are logged; backgrounding pauses count
  as trace gaps and flag review. (Background tracking arrives with a dev
  build later; the constraint is stated, not hidden.)
- **Video bookends**, ~15s each: before — challenge overlay, candidate,
  surroundings at the start point; after — candidate at the finish,
  breathing like someone who just ran. Bookends tie the trace to a real
  person and place.
- **No pause button.** A stationary gap is a gap; the reviewer judges it.

### Server-side acceptance

- **Distance is computed from the trace** (accuracy-weighted haversine
  over filtered samples) — never taken from the claim.
- **Accepted time = elapsed time at the accepted distance.** If the trace
  covers 1.52 mi in 8:57, the accepted 1.5-mile time is read at 1.5 mi.
  The claim is stored verbatim beside it.
- **Plausibility checks flag, not auto-reject:** implausible pace vs the
  candidate's history, teleport jumps, accuracy collapse, elevation
  nonsense, device-clock skew vs server clocks.
- **Treadmills are not Zero Verified-eligible in V1.** Distance is
  unverifiable; treadmill runs remain valid practice. Device integrations
  (§15) may open this later.

---

## 9. Swim protocol (500m) — the hardest event, multiple approaches

**V1 primary — fixed camera:** phone on tripod/stand, positioned high and
lateral enough to see the candidate's full lane including **both walls**
(or, where geometry forbids, one wall plus clear turn visibility). One
continuous clip: pre-swim pan of the pool and lane markings, candidate
states pool length aloud with the challenge overlay running, then the swim.
Reviewer counts laps and wall touches; time comes from the clip.

**V1 alternate — human camera operator:** a second person tracks the
candidate. Same requirements (walls, touches, continuity); operator identity
is not evidence, just labor.

**Future — wearable corroboration:** lap counts and stroke data from
watches as *supporting* evidence, never sole evidence.

**Future strong — approved pool / proctor:** the real answer to this
event's structural weakness (§13).

**Honest limitations, stated in-product:** V1 cannot prove pool length; it
records the stated length, the visible markings, and reviews consistency
(lap count × stated length vs elapsed time vs plausible pace). The swim is
the least-provable event in V1 and the verification badge does not pretend
otherwise internally — this is a primary driver of the proctored tier, and
GPS does not solve pools and is not pretended to.

---

## 10. Human review — workflow, console, permissions

### Reviewer console (internal web tool, V1-minimal)

Queue → attempt view containing:

- **CANDIDATE** — handle and identity clip only. No email, no legal name,
  no location beyond what evidence shows.
- **ASSESSMENT** — definition, protocol version, per-event standards text.
- **SESSION TIMELINE** — issued → identity → events with windows and
  transitions; gaps and tolerance overages pre-flagged.
- **PER EVENT** — claimed value, evidence player (speed controls,
  jump-to-event, a tally counter for reps), GPS map + computed distance for
  the run.

### Reviewer actions

| Action | Requires | Effect |
|---|---|---|
| ACCEPT | — | accepted value = claimed value |
| ADJUST | reason (code + text) | accepted value ≠ claim, both preserved |
| REJECT EVENT | reason (code + text) | assessment cannot verify |
| REJECT ASSESSMENT | reason | e.g. identity/continuity failure |
| FLAG | note | escalates to admin, no verdict |

The assessment verdict is **computed** from event verdicts by the §2 rule —
reviewers judge events; only admins can override the computed verdict, and
overrides are audited.

### Permission model

| Role | Can |
|---|---|
| `reviewer` | See assigned queue, review events, flag. Cannot review own attempts (server-assigned), cannot see candidate PII, cannot override verdicts. |
| `admin` | Everything reviewers can, plus assignment, verdict override (audited), revocation, retention actions. |

All writes go through role-checked Edge Functions using the service role;
the console never holds the service key. Every action appends to
`verification_actions` — an append-only audit log with actor, action,
payload and server time.

### Adjustment/rejection behavior (non-negotiables)

- Original claims (`attempt_event_results`) are **never modified**.
- Accepted values live in review rows; the official rating is computed from
  accepted values.
- The candidate sees both, with reasons: `CLAIMED 18 · ACCEPTED 17 —
  "rep 12 chin below bar"`. Nothing is rewritten as though they had
  originally submitted 17.
- V1 has no formal appeals; the remedy for a disputed rejection is a
  retest. Revisit when volume justifies it.

---

## 11. Evidence architecture & privacy

### Evidence records

```
evidence
  id                uuid
  attempt_id        → assessment_attempts
  session_id        → verification_sessions
  event_id          text | null        -- null = identity clip
  kind              video | gps_trace
  storage_path      text               -- private bucket, never public
  content_hash      text (sha-256)     -- globally unique-indexed
  hash_committed_at timestamptz        -- server receipt of the hash
  captured_at       timestamptz        -- client claim
  received_at       timestamptz        -- server receipt of the bytes
  duration_seconds  numeric | null
  byte_size         bigint
  mime_type         text
  capture_method    in_app | external  -- external exists for future tiers
  device_metadata   jsonb              -- model, OS, app version
  review_status     pending | reviewed | unusable
```

### Privacy model — PRIVATE BY DEFAULT

- Evidence lives in a **private storage bucket**; access is via short-lived
  signed URLs issued by an Edge Function to exactly two parties: the owner
  (viewing their own submissions) and the assigned reviewer.
- **No public API can reach evidence.** It is absent from every public view
  (the M1 `public_candidate_profiles` pattern extends: what other users see
  of verification is the badge and status, nothing else). Verification
  footage never appears on profiles, ever.
- **Consent screen before every session** states: what is recorded, why,
  who may review it (authorized Zero Phase reviewers), how it is used
  (verification only), and the retention rule.
- **Retention** (per the M1 owner decision): evidence kept while the
  performance is leaderboard-active; when superseded or expired, evidence
  becomes deletable while the verified result, hashes, timeline and review
  records are retained — the verdict outlives its footage.
- Account deletion removes evidence; what minimal audit residue (hashes,
  verdicts) survives is a **policy decision to make before launch**, flagged
  here rather than silently decided.

---

## 12. Database schema proposal (design, not a migration)

```sql
verification_sessions (
  id, athlete_id → athlete_profiles, attempt_id → assessment_attempts,
  definition_id, definition_version,
  challenge_code unique, challenge_expires_at,
  status ('issued','active','interrupted','submitted','expired','abandoned'),
  started_at, submitted_at, device_metadata jsonb, created_at
)
-- RLS: owner SELECT; INSERT only via Edge Function (service role);
-- no client UPDATE — state moves server-side.

session_timeline_entries (
  id, session_id, entry_type ('identity','event_open','event_close',
  'transition_start','transition_end','interruption'),
  event_id null, server_time, client_time null, metadata jsonb
)
-- Append-only, service-role writes; owner SELECT.

evidence ( …as §11… )
-- RLS: owner SELECT of metadata rows; INSERT via Edge Function during an
-- active owned session only; bytes in private bucket; no UPDATE/DELETE by
-- clients (retention actions are service-role).

verification_event_reviews (
  id, attempt_id, event_id null,        -- null = assessment-level verdict row
  reviewer_id → reviewers,
  verdict ('accepted','adjusted','rejected'),
  accepted_value numeric null,
  reason_code, reason_text,
  authoritative boolean,                -- V1: the single authoritative row;
  created_at                            -- future: N rows + consensus (§15)
)
-- No client access at all. Service-role only. Candidates see review
-- outcomes through a sanitized Edge Function response / derived columns.

verification_actions (
  id, attempt_id, actor_id, actor_role, action, payload jsonb, created_at
)  -- append-only audit; admin SELECT only.

reviewers ( user_id, role ('reviewer','admin'), active, created_at )

-- Reserved for §13 (not shipped in V1):
organizations ( id, name, status ('pending','approved','suspended'), … )
organization_members ( organization_id, user_id, role ('org_admin','proctor') )
attestations (
  id, attempt_id, proctor_user_id, organization_id null,
  statement jsonb,      -- protocol version, conditions, per-event results
  attested_at, status ('submitted','accepted','rejected')
)
```

Attempt columns already exist for all of this (M2 shipped the status enum,
method enum, lifecycle timestamps, and `official_rating` with no client
write path). M3 adds tables around attempts; it does not reshape them.

---

## 13. Trusted proctors & organizations (architecture only, V1 reserves it)

- An **organization** is approved by Zero Phase (status lifecycle, suspendable).
  A **proctor** is a member with the proctor role. No real organization is
  named or branded anywhere in product or code.
- A proctor administers an assessment and submits an **attestation**: a
  structured, signed-by-account statement binding proctor + organization +
  candidate + attempt + protocol version + per-event results + time.
- **An attestation is evidence, not a verdict.** Zero Phase policy decides
  what an accepted attestation from an org in good standing yields
  (`proctored` status, lighter evidence requirements). A proctor can never
  write `verified = true` — the same service-role gate that blocks
  candidates blocks proctors; their power is to *attest*, auditable and
  revocable, org-wide if trust collapses.
- Collusion resistance: attestations are per-attempt rows tied to real
  accounts; spot-check review of proctored attempts and org-level revocation
  are the levers.

## 14. Verification tiers

```
SELF REPORTED   → never leaderboard-eligible (permanent rule)
ZERO VERIFIED   → in-app captured, session-bound, human-reviewed
PROCTOR VERIFIED→ administered by an approved individual (attestation)
ORG VERIFIED    → administered through an approved organization
```

Tiers express **confidence in provenance, not athletic quality**. The
Performance Rating math is identical at every tier — an 826 is an 826. The
badge answers "how sure are we this happened"; the number answers "how good
was it". These dimensions never mix, including in ranking order (eligibility
is binary at zero-verified-and-above; policy for M4 selection stays as
designed in M2).

## 15. Future review models (designed-for, not built)

- **Community review:** `verification_event_reviews` already supports N
  rows per event. Future: server assigns K independent reviewers, blind to
  each other (enforced by not exposing sibling rows), consensus computes the
  accepted value, reviewer accuracy vs consensus builds reputation.
  Nothing in V1's single-authoritative-row flow blocks this.
- **Automated review:** evidence is captured CV-ready (continuous fixed
  clips, stable overlays, hashes). An automated reviewer is just another
  reviewer row (`reviewer_id` → a system account) whose verdicts coexist
  with human rows — assist first (pre-counting reps, flagging
  discontinuities), gate later if ever.

## 16. Failure & recovery experience

Principles: technical failure never becomes verification, and honest
candidates are never punished — the remedy is always a clean retest with
their practice data intact.

- **Local-first capture:** clips and traces persist on-device as captured;
  hashes commit immediately (tiny); bytes upload resumably with a submission
  window (e.g. 24h) — a dead spot at the track doesn't kill a session, and
  the challenge already binds delayed uploads.
- **App crash / relaunch:** the session resumes if the server-clocked event
  window allows; otherwise the session is `interrupted` and the candidate
  chooses: save as an aborted attempt (history, no rating) or discard.
- **Phone dies mid-assessment:** as above on next launch; partial evidence
  retained briefly for support, then deleted.
- **GPS degrades mid-run:** the trace gap is recorded; small gaps are
  reviewer judgment, large gaps reject the event with a "retest, and here's
  why" message.
- **Storage full / permission revoked mid-session:** preflight minimizes
  it; mid-session it interrupts cleanly rather than corrupting.
- **Emergency:** a prominent abort exists at every step, no questions asked,
  nothing submitted.

## 17. Storage & cost

Working assumptions (720p default, H.264/H.265, ~5–8 MB/min):

| Evidence | Duration | Size |
|---|---|---|
| Identity clip | ~15 s | ~2 MB |
| Pull-ups | ~2 min | ~12 MB |
| Push-ups, sit-ups | 2 min each | ~24 MB |
| Run bookends + trace | ~30 s + JSON | ~4 MB |
| Swim (continuous) | ~10–12 min | ~70 MB |
| **Per assessment** | | **~110 MB** (swim dominates) |

- **1,000 assessments ≈ 110 GB** stored ≈ **$2–3/month** at commodity
  object-storage rates; 10,000 ≈ 1.1 TB ≈ $25–30/month. Storage is not the
  constraint. Review egress (one viewing ≈ file size) roughly doubles the
  monthly cost per review pass — still small.
- **The real cost is review labor:** ~12–18 reviewer-minutes per assessment
  (2× playback, rep counting, map check) → 1,000 assessments ≈ **200–300
  reviewer-hours**. This is why the console optimizes reviewer speed first,
  and why community/automated review are the designed scale path.
- Levers, in order: swim clip is the storage lever (720p enforced, possible
  frame-rate reduction); retention expiry (evidence deleted when
  leaderboard-inactive, verdicts kept) is the long-term lever; per-event
  clips (already chosen) are the review-speed lever.
- Caps enforced at capture: max duration per event from the protocol
  definition, max resolution 1080p, hard per-file byte cap.

## 18. Security boundaries (consolidated)

| Party | May | May never |
|---|---|---|
| Candidate app | capture, hash, upload, claim values, read own status | write any verification status, rating, accepted value, or timeline entry |
| Reviewer console | submit event verdicts via role-checked functions | hold service keys, see candidate PII, review own attempts, edit claims |
| Proctor (future) | submit attestations | flip any status directly |
| Edge Functions (service role) | issue sessions/challenges, stamp timelines, accept hashes, compute official ratings, transition statuses, sign evidence URLs, write audit rows | trust any client-supplied timestamp, hash-check bypass, or verdict |
| Database | enforce all of the above via RLS + absent policies | — |

The M2 principle, extended verbatim: **the client submits claims and
evidence; the server determines truth.**

## 19. Ship in M3 V1 vs postpone

**Ship (V1):**
- Sessions + server challenges + identity clip
- In-app capture: calisthenics clips, run GPS + bookends, swim fixed-camera
- Hash-at-capture commitments; resumable uploads; private bucket
- Server-clocked timeline + transitions; per-event windows
- Pending review; internal console (queue, player, tally, accept/adjust/
  reject/flag with reasons); computed verdicts; audit log
- Server-computed official rating from accepted values; `zero_verified` /
  `rejected` end-to-end; candidate-facing claimed-vs-accepted transparency
- Consent + privacy surfaces; retention while leaderboard-active

**Postpone (architected for, deliberately not built):**
- Proctor/organization attestations (schema reserved, no UI)
- Community review (N-row model ready), reviewer reputation
- All automated/CV review; wearable and HealthKit corroboration
- Cryptographic clip-chaining; background-location run tracking (dev build)
- Treadmill eligibility; formal appeals; pool-length attestation
- Evidence-expiration automation (manual/admin in V1)

**Open questions for the owner before M3 implementation:**
1. Review SLA to promise candidates ("typically within N days") — N?
2. Reviewer staffing for V1 (owner-only at first?) — shapes console scope.
3. Account-deletion residue: do hashes/verdicts survive account deletion
   for anti-abuse, or is deletion total? (Legal/privacy call.)
4. Swim in V1: ship with stated limitations as designed, or hold the swim
   to proctored-only and launch Zero Verified with the other events?
   (Shipping it is the current design; holding it is defensible.)
