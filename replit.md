# AutoGlass Pro CRM

## Overview
AutoGlass Pro CRM is a professional customer relationship management application for auto glass businesses. It offers job management via a Kanban pipeline, payment tracking, and analytics dashboards. The application streamlines the workflow from initial quote to job completion and payment, aiming to enhance efficiency and customer management for auto glass professionals.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter
- **State Management**: TanStack React Query
- **UI Components**: shadcn/ui (built on Radix UI)
- **Styling**: Tailwind CSS with theming (light/dark mode)
- **Build Tool**: Vite

### Backend
- **Framework**: Express.js 5 with TypeScript
- **API Design**: RESTful JSON API
- **Development**: Vite middleware for HMR
- **Production**: Static file serving

### Authentication & Authorization
- **Auth Provider**: Replit Auth (OIDC) and username/password authentication for staff accounts
- **User Roles**: Admin, CSR, Technician, Reports with role-based access control
- **Password Security**: bcrypt hashing with 10 rounds for staff passwords

### Staff Account Management (Admin Only)
- **Staff Accounts page** (`/staff`): Admin interface to create, edit, and disable staff accounts
- **Fields**: Username (min 3 chars), password (min 6 chars, bcrypt hashed), first/last name, email, role
- **Status**: Active/disabled toggle to control account access

### CSR Activity Tracking & Reporting (Admin Only)
- **Activity Logs table**: Tracks all user actions with timestamps
- **Tracked Actions**: login, logout, job_created, job_stage_changed, payment_recorded, email_sent, email_replied, sms_sent, calendar_event_created, contact_created
- **CSR Activity Report** (`/csr-activity`): Admin dashboard with:
  - Date range filtering (last 7 days default)
  - User summary cards: total actions, jobs created, stage changes, emails/SMS sent, login count
  - Detailed activity log table with action details and timestamps

### Technician Mobile Portal
A mobile-optimized interface for field technicians featuring:
- **Dashboard**: Job summaries.
- **Job Details**: Customer info, vehicle info, task checklist.
- **Job Completion**: Photo capture, signature, payment collection.
- **On My Way SMS**: When technician clicks "On My Way" task, an SMS is automatically sent to the customer with glass-type-specific preparation instructions:
  - **Windshield**: Park with front doors accessible, face street, remove stickers from dashboard
  - **Door Glass**: Park near outlet for vacuuming, be present with keys, warning about window elevator
  - **Back Glass**: Park facing house/building, clear trunk/bed area
  - All messages include payment reminder about cash/exact change
- **Design**: Blue header theme (#29ABE2), large touch-friendly buttons.

### Data Layer
- **ORM**: Drizzle ORM for PostgreSQL
- **Schema**: Defined in `shared/schema.ts` with Drizzle's PostgreSQL schema builder
- **Validation**: Zod schemas generated from Drizzle schemas
- **Current Storage**: In-memory Map-based storage, designed for PostgreSQL integration.

### Shared Code
The `shared/` directory contains common code including database schema definitions, TypeScript types, Zod validation schemas, pipeline stages (quote → scheduled → paid_completed → lost_opportunity), and payment statuses.

### Data Model
Supports multi-vehicle and multi-part jobs for fleet companies.
- **Job Structure**: Hierarchical (Job → vehicles[] → parts[]).
- **Pricing**: Detailed part pricing calculator with automatic labor pricing based on vehicle/part info, and special subcontractor pricing rules. Includes considerations for dealer exceptions and mobile fees.

### Profitability Cost Calculation
The Job Profitability report calculates costs using the following formula:
- **Part Price**: Cost of glass from distributor
- **Accessories**: Moldings, clips, etc.
- **Urethane**: Standard urethane cost
- **Calibration**: Fixed $100 cost per calibration (regardless of customer-charged price)
- **Subcontractor Urethane**: Additional $15 per part for subcontractor jobs (customerType === "subcontractor"), only for actual installations (serviceType === "replace") of windshield, back glass, and quarter glass parts (NOT calibration, repair, or other service types)
- **Sales Tax**: 8.25% on subtotal
- **Processing Fee**: 3.5% on subtotal (NOT applied to dealer jobs)

### Build Process
- **Development**: `npm run dev` (tsx with Vite HMR).
- **Production**: Custom build script using esbuild for server and Vite for client.

## External Dependencies

### Database
- **PostgreSQL**: Primary database.
- **Drizzle Kit**: Database migration tool.

### UI Component Libraries
- **Radix UI**: Accessible UI primitives.
- **shadcn/ui**: Pre-configured component library.
- **Lucide React**: Icons.
- **Recharts**: Charting library.
- **React Hook Form**: Form management with Zod validation.

### Email Integration
- **Gmail API**: For `windshieldrepairsa@gmail.com` via Replit's Google Mail connector for sending, fetching (INBOX and SENT), and replying to emails, linking emails to jobs.
- **Bluehost IMAP/SMTP**: For `info@windshieldrepairsa.com` to fetch, send, and reply to emails, with a separate "Info" tab in the Conversations page.

### SMS Integration
- **Twilio**: For SMS messaging, integrated for sending and managing conversation history, linking SMS to jobs.

### Contacts & Documents
- **Contacts page**: Directory of customers synced from jobs.
- **Documents tab**: Displays documents associated with a contact's jobs, including sent PDF receipts (stored as base64), available receipts, and completion photos/signatures from the technician portal.

### Calendar Integration
- **Google Calendar API**: Via Replit's Google Calendar connector for creating, updating, and deleting events. Auto-creates calendar events when job stage changes to "scheduled".

### Address Autocomplete & Mobile Fee Calculator
- **Google Places API**: For address autocomplete, place details, and calculating mobile fees based on distance from San Antonio downtown.