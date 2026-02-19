# AutoGlass Pro CRM

## Overview
AutoGlass Pro CRM is a professional customer relationship management application designed for auto glass businesses. Its primary purpose is to streamline operations from initial quoting to job completion and payment, enhancing efficiency and customer management. Key capabilities include a Kanban-based job management pipeline, comprehensive payment tracking, and analytics dashboards. The project aims to provide a robust solution for managing customer relationships and optimizing workflow within the auto glass industry.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Core Architecture
The system employs a client-server architecture. The frontend is built with React 18 and TypeScript, utilizing Wouter for routing, TanStack React Query for state management, and shadcn/ui (based on Radix UI) for UI components, styled with Tailwind CSS (supporting light/dark modes). The backend uses Express.js 5 with TypeScript, providing a RESTful JSON API. Drizzle ORM is used with PostgreSQL for data persistence, defining schemas in `shared/schema.ts` and validating data with Zod.

### Authentication & Authorization
Authentication is handled via Replit Auth (OIDC) and traditional username/password for staff, secured with bcrypt hashing. Role-based access control supports Admin, CSR, Technician, and Reports roles. Admins can manage staff accounts, including creation, editing, and disabling.

### Automated Follow-Up System
A 7-sequence automated follow-up system is triggered for new jobs in "quote" or "new_lead" stages. It schedules SMS and Email tasks with personalized templates at predefined intervals. Jobs can be set to `auto` mode for automatic sending or `manual` mode, which generates notifications for CSRs to review and send. The system auto-terminates and archives pending tasks when a job progresses to "scheduled" or "paid_completed." A background worker processes tasks and logs actions.

### AI Tools
A suite of AI-powered tools, accessible to Admin and CSR roles via OpenAI (through Replit AI Integrations), includes:
- **Chat & Compose**: Chat assistant, message composer, quote generator, follow-up suggester, insurance claim helper.
- **Communication Intelligence**: Smart reply suggestions, conversation summary, sentiment analysis, Spanish translation, call transcription.
- **Technician Tools (Vision AI)**: Damage assessment, installation guide lookup, safety checklist verification, photo analysis.
- **Business Intelligence**: Win/loss analysis, revenue forecasting, customer churn prediction, best time to contact, competitor price monitoring.
- **Operations**: Smart scheduling, parts prediction, job time estimation.
- **Sales & Marketing**: Upsell suggestions, review response generator.
- **Quality & Training**: Customer satisfaction prediction, CSR performance coaching.

### VIN Decoder & Parts Price Comparison
The VIN Decoder uses the NHTSA API (`server/vin-decoder.ts`) to decode 17-character VINs into Year/Make/Model/Body Style. The VIN input is prominently displayed at the top of each vehicle card with a labeled "Decode VIN" button. The Parts Price Comparison tool (`client/src/components/parts-price-comparison.tsx`) appears under each part that has a NAGS Glass Part Number. It provides:
- **Quick-launch buttons** for supplier websites (Mygrant, PGW, IGC, Pilkington)
- **Side-by-side price entry** fields for each supplier with dollar formatting
- **Price history tracking** stored in `parts_price_history` table, showing last known prices and full history
- **"Use this price"** button to auto-fill the part's cost and distributor from saved prices
- Distributor select options: Mygrant, PGW, IGC, Pilkington

### Warranty Jobs
Jobs can be flagged as warranty work via a toggle on the new job form. When enabled, a search popup lets users find the original job and auto-fill customer, vehicle, and scheduling info. All pricing is zeroed out for warranty jobs. The `isWarranty` flag and `warrantyOriginalJobId` link the warranty to the original job. "warranty" is a valid service type for parts.

### Technician Mobile Portal
A mobile-optimized interface for technicians to manage jobs in the field. Features include:
- **Dashboard & Job Details**: Access to customer and vehicle information.
- **Job Notes**: Displays install notes added by CSRs/admins so technicians can see important job context.
- **Persistent Checklists**: Task and parts checklists whose states are saved to the database.
- **Payment Recording**: Ability to record payments directly from the field.
- **Job Completion**: Photo capture, signature collection.
- **Automated SMS**: "On My Way" SMS with glass-type-specific preparation instructions sent to customers.
- **Supplies Checklist**: A persistent checklist for technician supplies.

### Lead Processing
The system automatically polls Bluehost emails for new leads, processes them, and sends automated confirmation emails and SMS. Duplicate leads are prevented, and a date cutoff ensures only recent leads are processed.

### Job Completion & Auto-Archiving
Jobs transitioning to "paid_completed" are timestamped. A background worker automatically archives jobs older than two weeks from the "paid_completed" stage, moving them to a separate, expandable "Archived Jobs" section. Archived jobs can be restored.

### AI Voice Receptionist (ElevenLabs)
Incoming phone calls are handled by ElevenLabs Conversational AI (agent ID: `agent_5201khahhwpefx9vjweqgpacqbrj`), which replaced the previous Twilio + OpenAI implementation. The Twilio phone number is connected directly to the ElevenLabs agent. A webhook at `/api/elevenlabs-webhook` receives conversation data, extracts lead information via GPT-4o, and automatically creates new jobs in the CRM pipeline. Voice and prompt configuration is managed in the ElevenLabs dashboard.

The AI Receptionist toggle controls call routing: when enabled, the `/api/voice/incoming` handler returns TwiML that connects the call via WebSocket (`/media-stream`) to the ElevenLabs agent. When disabled, calls are forwarded to the configured number and automatically recorded by Twilio. The WebSocket bridge (`setupElevenLabsWebSocket` in `voice-receptionist.ts`) pipes Twilio media streams bidirectionally to the ElevenLabs Conversational AI WebSocket API.

### Universal Call Recording & Transcription
All incoming calls on Twilio numbers (210-866-8144, 210-940-8021) are tracked in the `ai_receptionist_calls` table with two call types:
- **AI calls** (`callType: "ai"`): Transcripts captured in real-time via the WebSocket bridge, then summarized and extracted by GPT-4o.
- **Forwarded calls** (`callType: "forwarded"`): Twilio records both sides of the call. When the recording completes, `/api/voice/recording-callback` downloads the audio, transcribes it with OpenAI Whisper, generates a GPT-4o summary, extracts client data, and optionally creates a lead.

The AI Receptionist page (`/ai-receptionist`) provides a unified call log with expandable detail cards featuring 4 tabs:
- **Overview**: Call summary, status, duration, call type, audio player (for recorded calls), and lead creation actions.
- **Transcription**: Chat-style transcript view.
- **Client Data**: AI-extracted customer info (name, phone, vehicle, service, address, insurance, urgency).
- **Phone Call**: Technical details (caller/called numbers, forwarded-to number, Call SID, ElevenLabs conversation ID, Recording SID).

### Notification Email Worker
A background worker (`server/notification-email-worker.ts`) sends email summaries of CRM activity to `wrsanotifications@gmail.com` via the Gmail API:
- **Every 20 minutes** (8 AM - 8 PM CT only): Sends a summary of missed calls, new leads, pending follow-ups, sent SMS, and sent emails.
- **Every 5 minutes after**: Sends follow-up reminders in the same email thread until the recipient replies.
- **Reply detection**: Checks the Gmail thread for non-SENT messages (i.e., replies from the recipient). Once detected, follow-ups stop until the next 20-minute cycle.
- **Business hours**: All emails are restricted to 8 AM - 8 PM Central Time. Outside this window, no emails are sent and follow-up timers are paused.
- Uses `Intl.DateTimeFormat` for timezone-safe hour detection. Uses `sendReply` helper from `gmail.ts` for threaded follow-ups.

### Data Model & Profitability Calculation
The data model supports multi-vehicle and multi-part jobs with hierarchical structures. A detailed profitability calculation accounts for part costs, accessories, urethane, calibration, subcontractor urethane, sales tax, and processing fees, with specific rules for dealer and subcontractor jobs.

## External Dependencies

### Database & ORM
- **PostgreSQL**: Primary database.
- **Drizzle Kit**: For database migrations.

### UI & Charting
- **Radix UI**: Accessible UI primitives.
- **shadcn/ui**: Pre-configured UI component library.
- **Lucide React**: Icon library.
- **Recharts**: Charting library.
- **React Hook Form**: Form management.

### Communication & Integration
- **Gmail API**: Via Replit's Google Mail connector for email sending, fetching, and replying for `windshieldrepairsa@gmail.com`.
- **Bluehost IMAP/SMTP**: For `info@windshieldrepairsa.com` email operations.
- **Twilio**: For SMS messaging and browser-based voice calling (call center functionality).
- **Google Calendar API**: Via Replit's Google Calendar connector for event management.
- **Google Places API**: For address autocomplete, place details, and mobile fee calculations.