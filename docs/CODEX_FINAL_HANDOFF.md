# Codex Final Handoff

## Current state

- Repository: `amanienoch/clearpath-campus-pro`, branch `main`.
- Baseline commit before this handoff: `ce66e0a` (`security: protect privileged clearance operations`).
- This handoff and its targeted dependency updates are included in the final submission commit on `main`.
- `.env` is ignored and no longer tracked at the current commit. The local file remains on disk; do not print or share its contents.
- No migration, deployment, account change, credential rotation, or Git-history rewrite was performed.

## Architecture and entry points

- React + TanStack Start, with file-based routes under `src/routes/`; `src/routes/__root.tsx` provides the root layout.
- Routes include login (`src/routes/index.tsx`), student (`src/routes/student.tsx`), department, Registrar, admin, and public certificate verification (`src/routes/verify.tsx`).
- Shared application state and Supabase-backed workflows are in `src/lib/store.ts`; eligibility rules are in `src/lib/eligibility.ts`.
- Browser Supabase access is in `src/integrations/supabase/client.ts`. Server-only privileged access is in `src/integrations/supabase/client.server.ts`.
- Server request and function middleware are registered in `src/start.ts`; Supabase bearer-token attachment is in `src/integrations/supabase/auth-attacher.ts`.
- Server functions include `src/lib/server-auth.ts`, `src/lib/admin.functions.ts`, `src/lib/verify.functions.ts`, `src/lib/demo.functions.ts`, and `src/lib/seed.functions.ts`.
- Supabase schema/policy migrations are in `supabase/migrations/`.

## Work completed

- Server-side Supabase `auth.getUser(accessToken)` validation and trusted `user_roles` / `profiles` authorization checks protect Registrar obligations and admin-only operations.
- Demo generation and seed functions require an admin. No application call sites for those functions were found.
- Admin user-management functions independently authenticate and verify the admin role.
- TanStack CSRF request middleware is configured for server-function requests in `src/start.ts`.
- The prior service-role key fallback was removed from source; the key is not exposed as a `VITE_` variable. The production client JavaScript bundle was scanned: 25 JS files, no match for the local service-role key or `SUPABASE_SERVICE_ROLE_KEY` variable name.
- `supabase/migrations/20261029120000_protect_profile_department.sql` restricts self-updates so the profile department must remain equal to `current_department(auth.uid())`.
- The current final pass updated Vite to `7.3.7` and compatible transitive versions of Browserslist, js-yaml, nanoid, PostCSS, source-map-js, and baseline-browser-mapping. This was a targeted audit response; changes remain local and uncommitted.
- Existing UI work includes reduced-motion CSS, keyboard focus-visible styles, responsive login, and restrained navigation/button transitions.

## Validation results from this final pass

| Check | Result |
|---|---|
| `npm run build` | Passed with Vite `7.3.7`. |
| `npx tsc --noEmit` | Passed. |
| `npx eslint src/lib/server-auth.ts src/start.ts` | Passed. |
| `git diff --check` | Passed. |
| `npm audit --omit=dev` | Exit 1: 2 advisories remain — 1 high and 1 low; 0 critical. |
| Client-bundle secret scan | Passed: neither the local service-role key nor its environment-variable name was found in 25 built client JS assets. |
| Browser smoke checks | Login rendered at 1440px and 390px with no horizontal overflow; keyboard Tab produced a visible input focus ring; reduced-motion preference was detected and the entrance animation was disabled; anonymous `/student` navigation returned to sign-in; invalid public certificate ID displayed “Not Verified.” |

Audit details:

- **High — `zod`**: the project directly depends on Zod 3 (`3.25.76`); the audit's fix is Zod 4 (`4.6.7`), a major-version change. Do not upgrade automatically. Review Zod usage and compatibility, then migrate and test deliberately.
- **Low — `esbuild`**: the affected `0.27.7` dependency is associated with an arbitrary-file-read advisory when running the development server on Windows. The current dev server was bound to loopback only. Assess the dependency chain and update to a compatible patched version; do not expose an affected dev server to untrusted networks.
- Six high and one moderate findings present before the targeted updates were cleared. Re-run the audit before submission because the registry advisory database changes over time.

## Security and test limitations

- The auth-helper allow/deny and seven eligibility-fixture tests were reported as passing in the previous sprint, but were not rerun in this final pass. There is no configured project test script or VS Code test controller.
- The CSRF middleware uses the installed TanStack Start API, the local app started without the earlier missing-middleware warning, and build/type checks pass. A deliberately cross-site request rejection was not tested.
- Real database-backed student sign-in, request submission, department review, Registrar final approval, certificate issuance, notifications, analytics, and activity history remain untested. The local Supabase endpoint is unavailable; no production data was used.
- The profile-department migration has not been applied to any database. Verify it against a disposable or authorized staging database before production use.
- Browser route checks used dummy Supabase credentials; expected requests to the local Supabase endpoint failed because no local Supabase service was running. These checks do not prove authenticated workflows.

## Required manual actions

1. **Rotate the exposed Supabase service-role credential.** In the Supabase Dashboard, first confirm the correct project from the deployed `SUPABASE_URL`, then use that project's API/key settings to rotate or revoke the exposed service-role credential. If the exposed key is a legacy JWT-signed key, follow Supabase's coordinated JWT-secret rotation procedure; do not assume replacing a value in source invalidates the old key.
2. **Update secrets safely.** Replace `SUPABASE_SERVICE_ROLE_KEY` in the ignored local `.env` and the hosting provider's server-side environment configuration. Keep it server-only (never `VITE_`-prefixed), limit it to the correct environment, and do not paste it into chat or source control. Confirm `SUPABASE_URL` targets the same approved project.
3. **Redeploy only after configuration is verified.** Deploy through the existing release process after the replacement credential is configured and the old credential is revoked. Confirm server functions and logs without exposing key material.
4. **Remediate Git history.** The repository is pushed to GitHub and prior commits contain versions of `.env`; deleting the file in `ce66e0a` does not erase those versions or revoke the key. After rotation, coordinate with collaborators and follow the repository's approved secret-removal/history-rewrite process for all affected branches/tags. Do not force-push without explicit authorization and coordination.
5. **Verify and apply the migration.** Confirm the target project's migration state, inspect the existing profile policies and `current_department` function, then apply `20261029120000_protect_profile_department.sql` through the established migration workflow in staging first. Test that users can still update permitted profile fields but cannot change their own department; test authorized admin workflows too. Apply to production only after review and explicit authorization.

## Prioritized next steps for Codex

1. Keep the current worktree intact. Do not reset, clean, broadly reformat, commit, push, deploy, rotate live credentials, or rewrite history without explicit authorization.
2. Review the uncommitted `package.json` / `package-lock.json` patch and this handoff; rerun build, TypeScript, focused lint, and `npm audit --omit=dev`. Keep or revise only targeted dependency changes.
3. After the owner rotates/revokes the exposed credential, coordinate Git-history cleanup and ensure the replacement server secret is configured in the correct local/deployed environments.
4. In authorized staging, verify CSRF cross-site rejection and role allow/deny paths, apply and test the profile-department migration, and exercise the real clearance-to-certificate workflows with test accounts.
5. Assess the Zod 3 high advisory and Windows esbuild low advisory; do not perform a broad or breaking upgrade without compatibility checks.
6. Record final staging results and production go/no-go. A passing local build alone is not evidence that production credentials, database policies, or end-to-end workflows are ready.
