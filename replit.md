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

### Technician Mobile Portal
A mobile-optimized interface for technicians to manage jobs in the field. Features include:
- **Dashboard & Job Details**: Access to customer and vehicle information.
- **Persistent Checklists**: Task and parts checklists whose states are saved to the database.
- **Payment Recording**: Ability to record payments directly from the field.
- **Job Completion**: Photo capture, signature collection.
- **Automated SMS**: "On My Way" SMS with glass-type-specific preparation instructions sent to customers.
- **Supplies Checklist**: A persistent checklist for technician supplies.

### Lead Processing
The system automatically polls Bluehost emails for new leads, processes them, and sends automated confirmation emails and SMS. Duplicate leads are prevented, and a date cutoff ensures only recent leads are processed.

### Job Completion & Auto-Archiving
Jobs transitioning to "paid_completed" are timestamped. A background worker automatically archives jobs older than two weeks from the "paid_completed" stage, moving them to a separate, expandable "Archived Jobs" section. Archived jobs can be restored.

### AI Voice Receptionist
Integrates Twilio and OpenAI to provide an AI-powered receptionist for unanswered incoming calls. It handles multi-turn conversations, extracts lead data from transcripts, and allows for customization of prompts, greetings, and voice. An admin settings page enables configuration and testing, and a call log records all interactions.

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