# AutoGlass Pro CRM

## Overview

AutoGlass Pro CRM is a professional customer relationship management application designed specifically for auto glass businesses. It provides job management through a visual Kanban pipeline board, payment tracking, and dashboard analytics. The application enables auto glass professionals to manage their workflow from initial quote through job completion and payment.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight React router)
- **State Management**: TanStack React Query for server state management
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with CSS variables for theming (supports light/dark mode)
- **Build Tool**: Vite for development and production builds

The frontend follows a component-based architecture with:
- Page components in `client/src/pages/`
- Reusable UI components in `client/src/components/ui/`
- Custom hooks in `client/src/hooks/`
- API utilities in `client/src/lib/`

### Backend Architecture
- **Framework**: Express.js 5 with TypeScript
- **HTTP Server**: Node.js http module wrapping Express
- **API Design**: RESTful JSON API endpoints under `/api/`
- **Development**: Vite middleware integration for hot module replacement

Key server files:
- `server/index.ts` - Express app setup and middleware configuration
- `server/routes.ts` - API route definitions for job CRUD operations
- `server/storage.ts` - Data access layer with in-memory storage (interface ready for database)
- `server/gmail.ts` - Gmail API integration for sending emails, fetching inbox, and replying to threads
- `server/vite.ts` - Development server with Vite HMR integration
- `server/static.ts` - Production static file serving

### Data Layer
- **ORM**: Drizzle ORM configured for PostgreSQL
- **Schema**: Defined in `shared/schema.ts` using Drizzle's PostgreSQL schema builder
- **Validation**: Zod schemas generated from Drizzle schemas using drizzle-zod
- **Current Storage**: In-memory Map-based storage with sample data seeding
- **Database Ready**: PostgreSQL configuration in `drizzle.config.ts`, requires DATABASE_URL environment variable

### Shared Code
The `shared/` directory contains code used by both frontend and backend:
- `schema.ts` - Database schema definitions, TypeScript types, and Zod validation schemas
- Pipeline stages: quote → glass_ordered → glass_arrived → scheduled → in_progress → paid_completed
- Payment statuses: pending, partial, paid

### Data Model (Multi-Vehicle/Multi-Part Support)
The application supports fleet companies with multiple vehicles per job, each with multiple parts:

**Job Structure:**
- Job → vehicles[] → parts[] (hierarchical)
- Customer info at job level (contact for the service booking)
- Insurance info at job level (claim covers all vehicles)
- Payment history at job level
- Totals calculated from sum of all part totals

**Part Pricing Calculator (per part):**
- Parts Subtotal = (Part Price + Markup + Accessories + Urethane) × (1 + Tax%)
- Part Total = ceil((Parts Subtotal + Labor + Calibration + Mobile Fee) × 1.035)
- Job Total = Sum of all Part Totals across all vehicles

**Sample Data Examples:**
- Chen Auto Sales: Fleet job with 2 Ford F-150s (multiple vehicles)
- Emily Rodriguez: Single vehicle with windshield + door glass (multiple parts)

### Build Process
- **Development**: `npm run dev` runs tsx to execute TypeScript directly with Vite HMR
- **Production Build**: Custom build script (`script/build.ts`) using esbuild for server and Vite for client
- **Output**: Server bundles to `dist/index.cjs`, client builds to `dist/public/`

## External Dependencies

### Database
- **PostgreSQL**: Primary database (requires DATABASE_URL environment variable)
- **Drizzle Kit**: Database migration tool (`npm run db:push` for schema sync)
- **connect-pg-simple**: PostgreSQL session store (available but not currently used)

### UI Component Libraries
- **Radix UI**: Full suite of accessible, unstyled UI primitives
- **shadcn/ui**: Pre-configured component library using Radix primitives
- **Lucide React**: Icon library
- **Embla Carousel**: Carousel component
- **cmdk**: Command palette component
- **Vaul**: Drawer component
- **react-day-picker**: Date picker component
- **Recharts**: Charting library for dashboard analytics

### Form & Validation
- **React Hook Form**: Form state management
- **@hookform/resolvers**: Zod resolver for form validation
- **Zod**: Schema validation library

### Email Integration
- **Gmail API**: Connected via Replit's Google Mail connector (windshieldrepairsa@gmail.com)
- **googleapis**: Google API client library for sending emails
- Enables direct customer communication from job cards and job detail modal
- **Conversations page**: Unified inbox showing all email threads with reply functionality
- Automatically links emails to jobs when sender matches customer email

### SMS Integration
- **Twilio**: Connected for SMS messaging (requires TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER secrets)
- **server/twilio.ts**: Twilio API integration for sending SMS and fetching conversation history
- SMS tab in Conversations page shows all text message threads grouped by phone number
- Automatically links SMS conversations to jobs when phone number matches customer
- API endpoints: GET /api/sms/status, GET /api/sms/conversations, GET /api/sms/messages/:phoneNumber, POST /api/sms/send, POST /api/jobs/:id/sms

### Social Integration (Pending)
- Facebook/Instagram tabs are placeholders pending Meta Business API setup

### Additional Services (bundled but not actively used)
- **Stripe**: Payment processing (included in build allowlist)
- **OpenAI / Google Generative AI**: AI integrations (included in build allowlist)
- **Nodemailer**: Email sending (included in build allowlist)
- **Passport**: Authentication (included in build allowlist)