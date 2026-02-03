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

### AI Tools (`/ai-tools`)
Comprehensive AI-powered tools accessible to Admin and CSR roles, powered by OpenAI via Replit AI Integrations (no API key required, billed to credits):

**Chat & Compose:**
- **Chat Assistant**: Interactive AI chatbot with CRM context awareness
- **Message Composer**: Generate professional email/SMS messages
- **Quote Generator**: Create quote descriptions from vehicle/glass details
- **Follow-up Suggester**: AI analyzes CRM data to identify leads needing attention
- **Insurance Claim Helper**: Generate claim descriptions for insurance purposes

**Communication Intelligence:**
- **Smart Reply Suggestions**: AI drafts quick responses for customer messages
- **Conversation Summary**: Auto-generate summaries of long email/SMS threads
- **Sentiment Analysis**: Detect frustrated customers to prioritize responses
- **Spanish Translation**: Auto-translate messages for Spanish-speaking customers
- **Call Transcription**: Phone call transcription (requires Twilio voice configuration)

**Technician Tools (Vision AI):**
- **Damage Assessment**: Upload photos, AI identifies crack type and recommends repair method
- **Installation Guide Lookup**: AI finds installation instructions for any vehicle/glass combo
- **Safety Checklist Verification**: AI reviews completion photos to ensure quality standards
- **Photo Analysis**: Analyze damage photos to suggest repair vs. replace

**Business Intelligence:**
- **Win/Loss Analysis**: Understand why quotes convert or get lost
- **Revenue Forecasting**: Predict weekly/monthly revenue based on pipeline
- **Customer Churn Prediction**: Identify customers unlikely to return
- **Best Time to Contact**: AI suggests when each customer is most likely to respond
- **Competitor Price Monitoring**: Track and analyze competitor pricing trends

**Operations:**
- **Smart Scheduling**: AI suggests optimal appointment times based on technician location and job complexity
- **Parts Prediction**: Predict which parts to stock based on historical job data
- **Job Time Estimation**: Estimate job duration based on vehicle type and glass

**Sales & Marketing:**
- **Upsell Suggestions**: Recommend related services (chip repair, calibration) based on job type
- **Review Response Generator**: Draft professional responses to Google/Yelp reviews

**Quality & Training:**
- **Customer Satisfaction Prediction**: Predict satisfaction before job is complete
- **CSR Performance Coaching**: AI suggests improvements based on activity patterns

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

### Lead Processing
- **Lead Polling**: Automatic polling of Bluehost emails for new leads (60-second interval)
- **Duplicate Prevention**: Processed lead email IDs are stored in the `processed_leads` database table to prevent duplicate emails/SMS across server restarts
- **Date Cutoff**: Only processes emails received after Jan 31, 2026 noon UTC to avoid re-sending to already-contacted customers
- **Auto-Response**: New leads automatically receive a confirmation email and SMS

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
- **Processing Fee**: 3.5% on revenue (job total), rounded UP to next dollar (NOT applied to dealer or subcontractor jobs)

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

### Twilio Voice (Browser-Based Calling)
- **Call Center**: Browser-based phone system allowing CSRs to answer incoming calls from anywhere
- **Phone Button**: Located in header, opens the Call Center panel
- **Incoming Call Handling**: When customers call the Twilio number, calls ring in all connected browser clients
- **Call Controls**: Answer, decline, mute, and hang up buttons
- **Caller Identification**: Automatically looks up caller in existing jobs/contacts
- **Call Logging**: All calls logged to `phone_calls` table with status, duration, and notes
- **Required Secrets** for voice calling:
  - `TWILIO_API_KEY_SID`: API Key SID from Twilio console
  - `TWILIO_API_KEY_SECRET`: API Key Secret from Twilio console
  - `TWILIO_TWIML_APP_SID`: TwiML App SID (create in Twilio console, set voice URL to `https://[your-domain]/api/voice/incoming`)
- **Webhook Configuration**: Point Twilio number's voice URL to `/api/voice/incoming` and status callback to `/api/voice/status-callback`

### Contacts & Documents
- **Contacts page**: Directory of customers synced from jobs.
- **Documents tab**: Displays documents associated with a contact's jobs, including sent PDF receipts (stored as base64), available receipts, and completion photos/signatures from the technician portal.

### Calendar Integration
- **Google Calendar API**: Via Replit's Google Calendar connector for creating, updating, and deleting events. Auto-creates calendar events when job stage changes to "scheduled".

### Address Autocomplete & Mobile Fee Calculator
- **Google Places API**: For address autocomplete, place details, and calculating mobile fees based on distance from San Antonio downtown.