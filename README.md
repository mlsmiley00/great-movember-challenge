# The Great Movember Challenge 2026

A private, English/Spanish wellness club for friends and family, November 1–30, 2026. Next.js App Router + TypeScript + Supabase Auth/PostgreSQL/private Storage. Designed for Vercel and Supabase free tiers. No paid service has been activated.

## What is implemented

- Verified-email, email-bound single-use invitations; database signup hook rejects uninvited accounts when enabled.
- Member-only pages and database policies, scoped to each competition. No service-role key in the application.
- Multiple measurable fitness/personal goals with weekday schedules, UTC daily logs, private screenshots (JPG/PNG/WebP, up to 3 MB), and honor reports.
- Individual/team leaderboards, progress statistics, streaks, and earned milestones.
- Family teams, activity feed, cheers, comments, announcements, and three configurable prizes.
- Self-service display name updates under My profile, accessible from the avatar on any screen.
- Admin invitations/revocation, member suspension/restoration, goal corrections, evidence review, prizes, and announcements.
- Responsive barbershop styling, English/Spanish interface, installable web manifest. Deliberately no service worker or offline caching of private information.
- Password recovery, security headers, no-store responses, checked upload signatures, and database integration tests.

## Launch: free account configuration

You need a GitHub account, a free Supabase project, and a Vercel account eligible for its free plan. Review each provider's current limits/terms; do not enable a paid upgrade. Some usage, email delivery, and team/commercial features may require a different plan. This repository does not provision or buy services.

### 1. Create Supabase

Create a project at Supabase and keep its database password in your password manager. In Authentication settings, use email/password sign-in with **Confirm email enabled**. Require at least 12-character passwords, retain rate limits, and enable CAPTCHA before distributing invitations if spam is a concern. Disable unused sign-in providers, anonymous sign-ins, and email changes that bypass verification.

In the SQL Editor, run these files in order:

1. `supabase/migrations/202610310001_initial.sql`
2. `supabase/migrations/202610310002_invitation_auth_hook.sql`
3. `supabase/migrations/202610310003_allow_team_changes.sql`
4. `supabase/migrations/202610310004_member_display_names.sql`

Alternatively use the Supabase CLI's normal linked-project migration workflow. These migrations target a new project and are applied once. They do not add sample participants. They create the competition, three TBA prizes, the private screenshot bucket, policies, and RPCs.

Do **not enable the signup hook yet**: first bootstrap the one initial administrator as described below. Keep the deployment unshared until the hook is enabled.

### 2. Run locally or deploy to Vercel

Use Node.js 22 or 24. For local development:

```sh
npm ci
cp .env.example .env.local
# Fill the three values in .env.local using your project settings.
npm run dev
```

| Variable                               | Value                                                                                                   |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | Your project's HTTPS API URL                                                                            |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Its publishable key (legacy anon key is also supported); never a secret/service-role key                |
| `NEXT_PUBLIC_SITE_URL`                 | Exact application origin, without trailing slash; local development defaults to `http://localhost:3000` |

The URL and publishable key are intended for clients; authorization is enforced by Auth and RLS. Never commit database passwords, service-role keys, or real `.env` files. In a managed cloud environment, allow the exact `<project-ref>.supabase.co` hostname in network settings when configuring these variables.

For hosting, import this GitHub repository into Vercel, select Next.js and Node 22 or 24, and set those three variables for Production. Set the site URL to your stable production domain. Redeploy after changing `NEXT_PUBLIC_*` values (Next.js embeds them at build time). Vercel uses `npm run build` and the lockfile. Screenshots are limited to 3 MB to stay below its function request limits.

In Supabase Authentication URL Configuration set:

- Site URL: your exact production origin.
- Redirect URLs: `https://YOUR-DOMAIN/auth/callback` and, for local work only, `http://localhost:3000/auth/callback`.
- Avoid broad wildcard preview redirects for production accounts.

### 3. Bootstrap the host (once)

Before enabling the signup hook, visit the app's registration form and create **your own real email account**. For this one setup registration, enter a temporary code of at least 32 characters (for example `initial-host-setup-before-enabling-hook`). This grants no membership or admin access. Follow the verification email in the **same browser** used to register. You will reach the invitation gate until bootstrapped.

Run `scripts/bootstrap-admin.sql` in the SQL Editor after replacing `:'admin_email'` with your quoted verified email, e.g. `'you@example.com'`. Or use `psql` with the documented `-v admin_email=...` flag. The script requires an already verified account, creates/promotes only that account, and seeds its goal:

**Walk at least 10,000 steps every day, November 1–30, 2026.**

It is safe to rerun and will not duplicate that goal. Return to the homepage and sign in. The bootstrap display name defaults to “Challenge Host”; change it under **My profile** in the app.

Now in **Authentication → Hooks → Before User Created**, select `public.before_user_created` and enable it. This is essential for invitation-only _account creation_. The database already blocks all competition access without membership, even if someone creates an account while the hook is disabled. After enabling, test that an arbitrary email/code cannot register. Do not disable the hook to fix regular invitations.

### 4. Invite the family

From Administration create an invitation for an exact email address, copy the code (shown for five minutes), and send it privately along with the app URL. Codes expire after seven days, are single use, and only their hashes are stored in the database. Invitation sending is manual; the app does not send invitation emails itself.

Participants register using that email/code, verify the Supabase email, and sign in. The callback tries to redeem the invitation automatically. If verification happens in another browser or the code exchange expires, sign in after confirming email and enter the code on the invitation gate. A registered account without active membership cannot see club information. Suspended members cannot re-invite themselves.

**Email delivery:** Supabase's default email service is restricted and is often limited to project-team addresses. Before inviting external friends/family, configure a supported SMTP provider in Supabase and test confirmation and recovery emails to a real external address. Choose a free allowance if available; do not activate a paid service without approval. No SMTP credentials belong in this app or chat. Failed delivery is a launch blocker even if local code/tests pass.

## Rules and scoring

Schedules and score cutoffs use UTC. The progress form defaults to today's calendar date in the member's device timezone and submits that timezone for server validation. Logs must fall on a goal's scheduled weekday within November, never a future date in the submitted timezone. Earlier scheduled competition days can be logged to catch up, including days before the goal was created. Missing scheduled days are zero. Reporting closes at **December 3, 2026 00:00 UTC**, allowing 48 hours after November ends. Amounts can be zero and exceed the target, but over-target amounts give no extra points.

For each goal, across scheduled days from November 1 through today (capped at November 30):

```
goal = 100 × (0.70 × average(min(amount / target, 1))
            + 0.30 × fraction of scheduled days meeting target)
individual = weighted average(goal scores), fitness weight 2, personal weight 1
team = average(all active team members' individual scores, including zeros)
```

Pending screenshots and honor reports count provisionally; rejected reports count zero. Admin-reviewed entries lock owner edits; an admin can reopen one using “Honor”. Saving an existing unreviewed goal/day replaces its amount, notes, and screenshot (omitting a screenshot switches to honor). Duplicate dates never add points. Daily caps favor consistency over one large effort. Goals represent per-scheduled-day targets, rather than cumulative month-long targets.

Goal details lock when created. New goals are allowed through November 30, but their full scheduled November history counts, including missed days before joining. Maximum ten goals/member. Admin corrections recalculate historical scores; announce corrections to members. The scoring formula is fixed in the migration, not editable via arbitrary admin input.

Members can create, join, leave, or change family teams through November 30 (UTC), including after logging progress. Progress entries and individual scores are preserved; team averages immediately reflect current membership. After the competition ends, team changes close to preserve final standings. A team is visible/joinable by all authorized club members; it is not a separate private subgroup. Suspended members are removed from rankings and team averages. Equal rounded scores share rank; final prize ties need an administrator decision. The three prizes initially say “To Be Announced.”

Streaks count consecutive UTC days with at least one non-rejected goal meeting its target; multiple goals on the same day count once. Today's streak can include yesterday until today is completed. Off-schedule days break a streak; this is distinct from schedule-normalized consistency. Badges: first successful day, current seven-day streak, 15 distinct successful days, 30 successful November days. Current streak badges are not permanent historical awards.

## Privacy model

- Every competition table has RLS. Anonymous users have no table access. Authenticated nonmembers have no competition data access. All privileged writes are scoped RPCs that check verified active membership/admin role.
- Emails exist in Auth/invitations, not in member-readable profiles. Members can see names, goals, schedules, progress amounts/notes, rankings, comments, and reactions. This is disclosed at registration; do not place sensitive health details in notes.
- Evidence paths are stored separately from member-readable progress. Private storage permits owner/admin reads. The application streams evidence through an authenticated, no-store endpoint; signed URLs expire in 60 seconds and remain server-side. Like any downloaded image, a member/admin can save a copy; do not upload sensitive personal information.
- Suspension revokes database and screenshot access. Already downloaded files cannot be recalled; previously issued storage capabilities can remain valid for up to 60 seconds.
- Private pages never use shared caching or offline service-worker caches. HTTPS is required in production. React escapes submitted text; no HTML rendering of comments.
- Competitions have distinct IDs and memberships, with invoker-security score views. A future public-registration season must create separate membership rules and a new competition; never relax the existing season's policies or globally auto-enroll users into historical seasons.
- No analytics, service-role client, public progress API, or development sample data is included. Administrators have privileged access by design. Keep admin access limited.

Screenshot replacement can leave an unreferenced private object behind (a failed upload/log attempts cleanup). Periodically inspect Storage and delete objects with no matching `public.evidence.path` through the Storage API/dashboard, never by editing storage metadata directly. Add a retention/deletion policy appropriate to your family before expanding beyond this private event. The MVP has no automated backups, retention job, notification delivery, advanced moderation, or self-service account deletion; handle requests through the host/Supabase dashboard, including removal of stored evidence. Free-tier project pause/storage/email limits still apply.

## Tests

```sh
npm run typecheck
npm test                  # scoring unit tests; database tests explicitly skip without TEST_DATABASE_URL
npm run build
npx playwright install chromium
npm run test:browser      # run against a build WITHOUT configured Supabase variables
```

For PostgreSQL integration tests, run a disposable database, never your development/production Supabase database:

```sh
docker run --rm -d --name movember-test-db \
  -e POSTGRES_PASSWORD=movember_local_test_only -e POSTGRES_DB=movember_test \
  -p 127.0.0.1:54329:5432 postgres:17-alpine
TEST_DATABASE_URL=postgresql://postgres:movember_local_test_only@127.0.0.1:54329/movember_test npm test
docker stop movember-test-db
```

The test runner only accepts localhost/127.0.0.1 and a database named `movember_test`. It resets the public/auth/storage test schemas, stubs Supabase's Auth/Storage metadata, executes the actual migrations on PostgreSQL 17, and tests roles/RLS/RPCs. It does not simulate email delivery, GoTrue sessions, the hosted Storage service, or a live Vercel deployment. These need a final real-project acceptance test. For system Chromium use `CHROMIUM_PATH=/usr/bin/chromium npm run test:browser`. Browser tests verify EN/ES, responsive layout, anonymous redirects, headers, and honest missing-configuration behavior; they do not fake member authentication.

GitHub Actions runs the unit/database suites, typecheck, production build, and mobile/desktop browser checks.

## Final live acceptance check

Before inviting everyone, use two real member accounts plus the admin:

1. Verify both emails; test invite email mismatch, expiry/reuse, and a nonmember login.
2. Create goals and teams, then (on/after November 1 UTC) log a scheduled day, retry the same day, upload a screenshot, and test an honor report.
3. Confirm the owner/admin can open evidence while the other member and anonymous browser cannot, including a copied evidence URL.
4. Reject/reopen an entry; confirm rankings recalculate and members cannot edit reviewed entries.
5. Test comments, cheers, team averages, and EN/ES on a phone. Verify password recovery and session refresh.
6. Suspend a test member and verify access is revoked. Check all three prizes and publish the launch announcement.

The app is implemented and can build without credentials, but it is not a live competition until Supabase is configured, its signup hook and external email delivery are enabled, Vercel is deployed, and these live checks pass.

## Updating an existing deployment: flexible family teams

If you already ran the first two migrations, run **only the contents** of `supabase/migrations/202610310003_allow_team_changes.sql` in **Supabase → SQL Editor → New query → Run**. Do not paste the filename or rerun the initial migration. The new migration is safe to rerun and preserves all existing members, teams, and progress. Vercel deploys the updated team-page guidance from `main`; applying this SQL is what removes the database restriction.

## Updating an existing deployment: member display names

After applying the previous migrations, copy the **contents** of `supabase/migrations/202610310004_member_display_names.sql` into a new Supabase SQL Editor query and run it. It is safe to rerun and does not change existing names. Do not rerun the initial migration. The updated interface deploys from `main` through Vercel.

Each member can open **My profile** (or tap their avatar in the top bar), enter a 2–60 character name, and save. The name updates across the clubhouse greeting, rankings, progress feed, and comments, including past activity. Whitespace is normalized, and names do not have to be unique. Only the current member's name in this competition is updated; email, authentication, role, team, and progress cannot be changed through this function. Display names are public to other authorized club members, not to the internet.

## Browsing members’ goals

Open **My goals → Everyone’s goals** (Spanish: **Mis metas → Metas de todos**) to see active members grouped by display name, including their goals, targets, UTC weekday schedules, completion counts, and scores. Members without goals have an empty-state message. This view is read-only and uses the existing competition-scoped row-level security; screenshots and their storage paths are never queried or displayed. No migration is needed. **My goals** still contains the current member’s goals and creation form.

## Local progress dates and removing accidental goals

Apply only `supabase/migrations/202611060001_progress_dates_and_goal_removal.sql` after the existing core migrations. It is independent of the optional chat migration and requires no new credentials or Supabase configuration changes. The original five-argument `record_progress` API remains compatible and uses UTC; the new six-argument API validates the supplied IANA timezone and calculates its current date on the server. The browser sends its actual timezone and uses local-calendar date parts rather than slicing a UTC ISO timestamp. The form updates its date bounds on focus and every 30 seconds; manually selected past dates are preserved. Future local dates, off-schedule dates, dates outside the competition, and edits to reviewed entries are still rejected. The reporting deadline remains December 3 at 00:00 UTC (end of December 2 UTC).

On **My goals**, expand **Remove goal**, read the warning, check the confirmation box, and submit. Only a verified active member can remove a goal they own; administrators cannot use this member action to remove someone else's goal. Everyone's goals has no removal controls. Removal permanently deletes the goal and all linked progress, comments, reactions, and evidence metadata in one transaction; individual and team score views then recalculate. This also removes any reviewed progress associated with that goal. Screenshots are cleaned up afterward through the existing owner-only orphan-file policy; a cleanup failure displays a notice and leaves only private orphaned files for administrator cleanup. No individual progress-entry removal control is added.

Both logging and removal lock the goal row to serialize concurrent operations. Removal is a user-confirmed destructive action, not a change made automatically to any member's existing goals. No existing dates are rewritten, and no live data is modified by preparing this change.
