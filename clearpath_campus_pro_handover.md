# ClearPath Campus Pro (E-Clearance) — Technical Handover Document

Welcome to the **ClearPath Campus Pro (E-Clearance)** project. This document serves as a complete technical handover, designed specifically for a senior engineer to take over active development immediately with zero prior knowledge of the codebase.

---

# PROJECT OVERVIEW

* **Project Name:** ClearPath Campus Pro (E-Clearance)
* **Purpose:** A modern, secure, and fully automated web application designed to eliminate paper-based clearance workflows at the university level. It allows graduating students, or students transferring/clearing for specific reasons, to run and track their clearance requests digitally across all relevant departments, while allowing academic and administrative staff to review and approve requests with automated eligibility check support.
* **Main Users:**
  1. **Students:** Graduating or active students who submit clearance requests, view outstanding departmental obligations (fines, unreturned books, fees), view remarks, and print their authenticated clearance certificates.
  2. **Departmental Officers:** Staff representatives from six key departments:
     * **Finance:** Tracks tuition, laboratory fees, and outstanding dues.
     * **Library:** Monitors library loans, return statuses, and late return fines.
     * **ICT:** Manages loaned campus hardware assets and damage liabilities.
     * **Hostel:** Oversees accommodation sign-offs, keys, and damage fees.
     * **Registrar:** Reviews academic standing, CGPA compliance, and administrative files manually.
     * **Sports:** Governs physical recreation equipment loans and replacement liabilities.
  3. **Administrators (Master Admin):** System overseers who manage user creation/deletion (students, officers, administrators), audit system activities in real-time, and monitor clearance performance metrics through the analytics dashboard.
* **Business Workflow:**
  * When a clearance request is initiated, it is dynamically routed based on the chosen **Request Type**. Instead of visiting physical offices, the system automatically checks student status against active digital logs and assigns required department reviews:
    * **Library Clearance Type:** Routes only to the `Library` department.
    * **Finance Clearance Type:** Routes only to the `Finance` department.
    * **ICT Clearance Type:** Routes only to the `ICT` department.
    * **Hostel Clearance Type:** Routes only to the `Hostel` department.
    * **General Clearance Type:** Routes to `Finance`, `Library`, and `Registrar`.
    * **Graduation Clearance Type:** Routes to all six departments (`Finance`, `Library`, `ICT`, `Registrar`, `Hostel`, `Sports`).
* **Clearance Workflow:**
  ```mermaid
  graph TD
      Student[Student submits Request] --> Seed[Trigger: seed_dept_reviews seeds pending reviews]
      Seed --> Evals[System runs Pre-eligibility Evaluations]
      Evals --> Reviews[Department Officers review obligations]
      Reviews -- Approve/Reject with Remarks --> Trigger[Trigger: recompute_overall_status computes status]
      Trigger --> StatusCheck{All reviews approved?}
      StatusCheck -- Yes --> Approved[Overall Status: APPROVED -> QR Certificate issued]
      StatusCheck -- No: Any Rejected --> Rejected[Overall Status: REJECTED -> Action Required]
      StatusCheck -- In Progress --> Pending[Overall Status: PENDING]
  ```

---

# CURRENT STATUS

* **What is fully working:**
  * **Authentication & Authorization:** Role-based access controls fully configured. Secure login redirects students to the Student dashboard, staff to the Department portal, and administrative roles to the Admin dashboard.
  * **Student Portal:** Students can submit dynamic clearance requests, view outstanding obligations line-by-line, and retrieve printable, verified clearance certificates.
  * **Department Review Portal:** Queue search, status filtering, details modal showing system recommendations based on student obligation records, and Approve/Reject controls with mandatory feedback remarks.
  * **Admin Panel:** Real-time metrics overview, user management interface, real-time activity feed logs, and interactive analytics charts (performance stacks and distributions).
  * **Automated Eligibility Engine:** Calculates real-time obligations, fine amounts, and asset liability costs for students across Library loans, outstanding fee balances, hostel room bookings, ICT hardware, and Sports loans.
  * **Public Verification View:** Allows employers or institutions to verify certificate authenticity instantly via URL or QR scan.
* **What is partially working:**
  * **Registrar Review:** Academic records manual inspection by the Registrar office is a placeholder flow requiring manual staff validation.
* **What is broken:**
  * No known broken features. All routes, components, server functions, and queries operate efficiently.
* **What was recently fixed:**
  * **Sports Loans Addition:** Integrated sports database tables, RLS authorization scripts, and real-time subscription channels.
  * **RLS Leaks Prevention:** Cleaned up previous permissive select rules, ensuring only the owner student, department officers, or administrators can select data records.

---

# TECH STACK

* **Frontend Framework:** React 19, TypeScript, Vite.
* **Backend Framework / SSR:** TanStack Start (runs server functions using Nitro Server Engine).
* **Database:** Supabase (PostgreSQL).
* **Authentication:** Supabase Auth (JSON Web Tokens).
* **State Management:** Custom synchronized store synced with Supabase Realtime using `useSyncExternalStore` (`src/lib/store.ts`).
* **UI Libraries:**
  * **Styling:** Tailwind CSS v4.
  * **Icons:** Lucide React.
  * **Charts:** Recharts.
  * **Toasts:** Sonner.
* **Routing:** `@tanstack/react-router`.

---

# REPOSITORY STRUCTURE

* `create-admin.mjs`: Script to seed critical admin and staff accounts into Auth & Profiles schemas.
* `supabase/migrations/`: Structured SQL schemas establishing tables, triggers, and Row-Level Security:
  * `20260529001221_...sql`: Standard base tables.
  * `20260601064621_...sql`: Request Types and Obligation Tables.
  * `20260601200000_...sql`: Secure RLS policies and Sports loans table.
* `src/components/AppShell.tsx`: The primary app skeleton enforcing authentication guards, themes, and layouts.
* `src/lib/store.ts`: Synchronizes client states with Supabase databases in real-time.
* `src/lib/eligibility.ts`: Rules engine verifying obligation records.
* `src/lib/admin.functions.ts`: Server functions utilizing service-role credentials to configure users.
* `src/routes/`: Main pages (`index.tsx`, `student.tsx`, `department.tsx`, `admin.tsx`, `verify.tsx`).

---

# DATABASE

* **Supabase Project ID:** `docukpjoyvjcgzyiikio`
* **Supabase URL:** `https://docukpjoyvjcgzyiikio.supabase.co`
* **Existing Tables:**
  1. `profiles`: Ties extra attributes (matric no, faculty, department assignment) to the auth record.
  2. `user_roles`: Manages role assignments (`student`, `department`, `admin`).
  3. `clearance_requests`: Keeps track of overall statuses, student details, and reason for clearance.
  4. `dept_reviews`: Tracks specific departmental decisions (status, remarks, reviewer name, timestamp).
  5. `activity_logs`: Simple audit trail monitoring signs-ins, approvals, and user updates.
  6. `library_loans`: Database of library obligations (returned status, fine amount, due date).
  7. `fee_balances`: Database of unpaid student fees.
  8. `ict_assets`: Tracks unreturned campus hardware assigned to students.
  9. `hostel_assignments`: Records room check-out statuses and damage liabilities.
  10. `sports_loans`: Stores physical recreation equipment loans, due statuses, and liabilities.
* **Row-Level Security (RLS) Status:**
  * Enabled across all tables. Restricts data access strictly to the owner student, departmental staff, or administrators via SQL policy bindings.
* **Database Triggers:**
  * `trg_cr_seed_reviews`: Triggers after request creation to insert required reviews matching the Request Type.
  * `trg_dept_reviews_recompute`: Auto-recalculates overall status of a request whenever departmental reviews update.

---

# FEATURES IMPLEMENTED

## Student Portal
* **Submission Form:** Choice between 6 types of clearances.
* **Pre-submission Eligibility Check:** Proactively evaluates student database metrics and returns early alerts if the student has obligations, before they submit the request.
* **Eligibility Breakdown Dashboard:** Interactive cards displaying unreturned items, damage fees, or pending manual reviews.
* **Printable Certificates:** Auto-generates a certificate if the clearance request overall status is approved.
* **Live QR Generator:** Renders a secure verification QR code pointing directly to the verification page.

## Department Portal
* **Real-time Queue:** Live list of student requests that route to the officer's specific department.
* **Advanced Filters:** Search bar with status pills (Pending, Approved, Rejected) to parse student matric codes or names.
* **System Recommendation Engine:** Displays standard checklists of unreturned assets, fee amounts, and advises the officer to Approve or Reject accordingly.
* **Audit Submission Panel:** Submit review status with detailed feedback/remarks.

## Admin Portal
* **Interactive Statistics:** Live numerical displays representing overall request metrics.
* **System Analytics:** Integrated charts displaying monthly volumes, department performance stack bars, and status distributions.
* **User Manager:** Comprehensive CRUD interface to manage student accounts, assign departmental staff, or configure administrators.
* **System Audit Feed:** Live tracking stream monitoring actor logins and clearance evaluations.

## Verification System
* **Public Search View:** Independent view to check Clearance IDs manually.
* **Automatic QR Sync:** Scanning the certificate QR instantly renders student verification cards.
* **Real-time status card:** Dynamic coloring (Green for Certified, Yellow for In Progress, Red for Invalid).

## Live Support System
* Supported natively via real-time reactivity. Any review status update or chat remark made by an officer immediately shows on the student's open dashboard without requiring page reloads.

## Notifications
* Feedback alerts are implemented via `Sonner` toasts. Real-time changes trigger immediate browser alerts to inform the user of updates.

## Analytics
* Admin-facing **Recharts** configurations rendering monthly clearance velocity, departmental approval quotients, and aggregate status volumes.

---

# UI/UX

* **Layout:** Double-column navigation architecture with sidebar switches. Responsive design collapsing down to drawer drawers on tablet or mobile viewports.
* **Aesthetics:** Elegant custom dark/light modes using backdrop filters, custom card groupings, elegant drop shadows (`shadow-elegant`), and glowing neon accent marks.
* **Animations:** Responsive elements utilizing micro-animations on hover, incremental counter updates, and layout entrance animations.

---

# RECENT CHANGES

* **Sports Loans Addition:** Added `sports_loans` table and updated triggers to support structural recreation clearances.
* **Security RLS overhaul:** Replaced leaky global RLS policies with strict, identity-matching select rules to ensure compliance.
* **TanStack Start migration:** Upgraded core framework to TanStack Start leveraging highly reliable serverless functions for database access.

---

# AUTHENTICATION FLOW

```
1. Login Panel (index.tsx) -> Input credentials
2. authStore.login() -> Invokes supabase.auth.signInWithPassword()
3. hydrateAuthUser() -> Fetches profile info + roles from Supabase database
4. authStore -> Updates listeners and stores active User object in Memory
5. AppShell.tsx -> Route listener recognizes valid User and redirects:
   - role === "student"     -> Redirects /student
   - role === "department"  -> Redirects /department
   - role === "admin"       -> Redirects /admin
```

---

# DATA FLOW

```
1. Supabase Postgres Tables (PostgreSQL)
2. Database Triggers (recompute_overall_status / seed_dept_reviews)
3. Central Client Store (src/lib/store.ts) -> Auto-fetches via loadAll()
4. Realtime Pub/Sub Channel ("eclearance-all") -> Hooks to tables and calls loadAll() on write events
5. React useStore hook -> Components listen to store slices and redraw UI automatically
```

---

# STATE MANAGEMENT

* **Store Architecture:** Implements a performant, lightweight external state store using standard React `useSyncExternalStore`.
* **Realtime Subscriptions:** Subscribes to Supabase changes on 9 tables using a single database channel `eclearance-all`.
* **Auth Subscriptions:** Listens to auth changes via `supabase.auth.onAuthStateChange`.
* **Data Loading:** Employs concurrent queries inside `loadAll()` using `Promise.all` for minimal load times.

---

# ROUTES

* `/` (Index): Secure portal login page and hero presentation panel.
* `/student`: Student dashboard, pre-submission checks, and printable certificate issuing page.
* `/department`: Department review queue, obligations analyzer, and remarks submission panel.
* `/admin`: Overview metrics, Recharts analytics, user configuration grid, and activity audit feed.
* `/verify`: Public verification search view. Supports ID routing search parameters (e.g. `verify?id=ECL-2026-1002`).

---

# IMPORTANT FILES (Top 20 Ranked)

1. `src/lib/store.ts`: Core client store managing active memory hydration and real-time pub/sub sync.
2. `src/lib/eligibility.ts`: Engine determining student clearance eligibility by auditing obligation tables.
3. `src/routes/student.tsx`: Renders the student portal, eligibility breakdown, and certificates.
4. `src/routes/department.tsx`: Houses the departmental officer reviews grid and evaluation recommendation interface.
5. `src/routes/admin.tsx`: Holds admin dashboards, charting configurations, and activity lists.
6. `src/components/AppShell.tsx`: The primary app skeleton enforcing authentication guards, themes, and layouts.
7. `supabase/migrations/20260529001221_...sql`: Standardizes base schemas, triggers, and enums.
8. `supabase/migrations/20260601064621_...sql`: Introduces dynamic request routing configurations and obligation models.
9. `supabase/migrations/20260601200000_...sql`: Introduces secure RLS policies and Sports loans table.
10. `src/lib/admin.functions.ts`: Houses secure serverless CRUD handlers for user accounts.
11. `create-admin.mjs`: High-level script for administrators to seed users.
12. `src/routes/verify.tsx`: The public portal for clearance certificates verification.
13. `src/lib/seed.functions.ts`: Generates sample students, clearance requests, and reviews.
14. `src/lib/types.ts`: Holds global TypeScript declarations, request categories, and status maps.
15. `src/routes/__root.tsx`: Configures standard layout headers, styling bindings, and error boundary components.
16. `src/styles.css`: Establishes theme variables and glassmorphism styling presets.
17. `vite.config.ts`: Defines bundler routines, path mappings, and Tailwind integration.
18. `package.json`: Outlines active project dependencies.
19. `src/components/AnimatedCounter.tsx`: Component animating metrics values.
20. `src/components/QrCode.tsx`: Renders high-quality certificate QR codes.

---

# KNOWN RISKS

* **Trigger Dependencies:** The `recompute_overall_status` trigger computes the request status based on reviews. Any migration modifying the reviews schema could break overall calculations if not thoroughly tested.
* **Realtime Pub/Sub Latency:** A very large volume of database edits will trigger multiple rapid fetch calls on `loadAll()`. As the student database expands, consider transitioning to pagination-based selective subscription updates rather than general fetching.

---

# NEXT PRIORITY TASKS

1. **Academic Record Integration:** Develop a formal database table for Registrar obligations.
2. **Online Obligation Payments:** Add an online payment gateway integration (e.g. Paystack or Flutterwave) to allow students to clear outstanding fines directly from the portal.
3. **Automated Notification Emails:** Trigger transactional emails to students whenever their clearance status changes.
4. **Certificate PDF Exporter:** Implement a server-side PDF generator to allow students to download official PDFs instead of using the browser print view.
5. **Bulk User CSV Imports:** Create a bulk import tool for administrators to add student cohorts using CSV spreadsheets.
6. **Detailed Activity Filtering:** Expand administrative activity filters to allow searching by actor, action, or date ranges.
7. **Officer Delegation Controls:** Enable admins to assign multiple officers to a single department.
8. **Clearance Request Archiving:** Add archiving features to clear old requests from active dashboard queues.
9. **Two-Factor Authentication (2FA):** Integrate multi-factor authentication for administrative and staff accounts.
10. **Custom Reminders Scheduler:** Develop an automated cron schedule to email students about outstanding obligations.
11. **Comprehensive Unit Testing:** Add unit testing suites for the core eligibility engine (`src/lib/eligibility.ts`).
12. **Review Edit Histories:** Implement detailed audit tracking to log officer remark edits.
13. **Advanced Performance Analytics:** Include metrics tracking average department processing times.
14. **Custom Routing Architectures:** Enable administrators to create custom, ad-hoc routing rules directly from the dashboard.
15. **Offline Support Buffers:** Enable service worker caching to allow students to view cached certificates offline.
16. **Session Expiry Alerts:** Prompt warnings before auth tokens expire.
17. **Optimistic Store Updates:** Implement optimistic UI updates to reduce visible latency during review submissions.
18. **Mobile QR Code Scanning:** Integrate standard camera-based scanning inside the `/verify` route using libraries like `html5-qrcode`.
19. **Strict Content Security Policies:** Implement rigorous CSP filters within Nitro routing engines to maximize security.
20. **Self-Service Password Reset Flows:** Build standard recovery modules for credentials resetting.

---

# FINAL ENGINEER NOTES

* **Running Locally:** Execute `npm run dev` to start the application. The system leverages Vite and boots on standard development ports.
* **Seeding Mockup Data:** Run `node create-admin.mjs` to configure standard developer accounts. You can also trigger the visual "Demo Seed" button on the portal login screen to insert sample clearance requests and reviews.
* **Server-side execution context:** Remember that `src/lib/admin.functions.ts` runs inside TanStack Start server functions using Nitro. Avoid running standard client code directly inside these functions.
* **Database Management:** Apply PostgreSQL schema updates via Supabase migration files rather than editing schemas manually in the Supabase UI, ensuring consistency across environments.

Good luck with development! This application features clean code and modern patterns, making it highly extensible. Feel free to reach out with any questions.
