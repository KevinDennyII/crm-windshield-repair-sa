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
- Pipeline stages: quote → scheduled → paid_completed → lost_opportunity
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

**Automatic Labor Pricing (auto-calculated based on vehicle/part info):**
- **Dealer customers**: Always $90 labor (overrides all other rules)
- **Subcontractor customers**: Manual selection of $100, $110, or $125 labor rate (they provide their own parts)
- Parts costing $250+: Labor = 75% of part cost (highest priority rule for non-dealer/subcontractor)
- Windshield/Back Glass (2017+):
  - Sedan/Coupe/Hatchback/Convertible: $150
  - Mini SUV/Crossover: $165
  - SUV/Pickup/Van/Wagon: $175
  - Utility Vehicle: $225
  - Back Glass Powerslide: $185
  - 18 Wheeler: $250
- Windshield/Back Glass (2016 and under, except 18 wheelers/utility vehicles): $140
- Door Glass/Quarter Glass/Side Mirror:
  - All vehicles: $145
  - 18 wheelers: $150
- Windshield Repair: $50
- Labor recalculates when: job type, body style, year, part price, or customer type changes

**Subcontractor Pricing (special account type):**
- Subcontractors provide their own parts and accessories
- Part Total = Labor Rate + Mobile Fee + Additional Cost (no parts/markup/tax calculations)
- Labor rate dropdown: $100, $110, or $125 (manually selected)
- Mobile fee still applies based on address distance
- Additional Cost field available for manual cost entry
- Parts pricing fields (part price, markup, accessories, urethane, tax, calibration) are hidden for subcontractors

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

### Calendar Integration
- **Google Calendar API**: Connected via Replit's Google Calendar connector
- **server/calendar.ts**: Calendar API integration for creating/updating/deleting events
- Calendar page shows visual monthly view with all scheduled jobs
- Auto-creates Google Calendar event when job stage changes to "scheduled" (requires installDate + installTime)
- Event title format: `{JobNumber} {StartTime}-{EndTime} {Year} {Make} {Model}`
- Event description includes: lead source, customer info, VIN, service details, glass type, part#, cost, supplier, totals, payment notes, booked/installed by
- API endpoints: GET /api/calendar/status, GET /api/calendar/events, POST /api/jobs/:id/calendar, DELETE /api/jobs/:id/calendar

### Address Autocomplete & Mobile Fee Calculator
- **Google Places API**: Address autocomplete for customer address fields (requires GOOGLE_MAPS_API_KEY secret)
- **server/places.ts**: Places API integration for autocomplete, place details, and mobile fee calculation
- Auto-suggests addresses as user types in the Street Address field
- Auto-fills city, state, and zip code when an address is selected
- **Mobile Fee Zones** (distance from San Antonio downtown):
  - 0-10 miles (inside Loop 1604): $0
  - 10-15 miles: $10
  - 15-25 miles: $20
  - 25-35 miles: $25
  - 35-45 miles: $35
  - 45+ miles: $50
- API endpoints: GET /api/places/status, GET /api/places/autocomplete, GET /api/places/details

### Social Integration (Pending)
- Facebook/Instagram tabs are placeholders pending Meta Business API setup

### Additional Services (bundled but not actively used)
- **Stripe**: Payment processing (included in build allowlist)
- **OpenAI / Google Generative AI**: AI integrations (included in build allowlist)
- **Nodemailer**: Email sending (included in build allowlist)
- **Passport**: Authentication (included in build allowlist)

## Code Cleanup Script

A code analysis tool based on Clean Code principles and Josh Comeau's React/CSS best practices.

### Running the Cleanup Script

To run the cleanup analyzer, use one of these methods:

1. **Shell command**: `./scripts/run-cleanup.sh`
2. **Direct execution**: `npx tsx scripts/cleanup-analyzer.ts`

You can simply type "run cleanup script" or ask the AI assistant to run it for you.

### What It Checks

The analyzer scans all TypeScript/JavaScript files and reports:
- **File Size**: Files over 500 lines
- **Function Length**: Functions over 50 lines
- **Magic Numbers**: Unexplained numeric values
- **React Patterns**: Array index as keys, passing setState directly
- **DRY Violations**: Repeated className patterns
- **Debug Code**: console.log statements
- **Dead Code**: Commented-out code

### Reference Documents

- **Principles Guide**: `scripts/cleanup-principles.md`
- **React Notes**: https://separated-day-526.notion.site/The-Joy-Of-React-d234359051a44f2ca721bcb4c9ec5de5
- **CSS Notes**: https://separated-day-526.notion.site/ea79a7c11e9940f9bd572a40dd1f8957

## Security Scan Script

A security analyzer based on Steve Gibson's "Security Now" podcast (grc.com) and OWASP best practices.

### Running the Security Scan

To run the security analyzer, use one of these methods:

1. **Shell command**: `./scripts/run-security.sh`
2. **Direct execution**: `npx tsx scripts/security-analyzer.ts`

You can simply type "run security scan" or ask the AI assistant to run it for you.

### What It Checks

**Dependency Vulnerabilities:**
- npm audit for known CVEs
- Outdated security-critical packages
- Prototype pollution risks

**Code Security Issues:**
- Hardcoded secrets/API keys
- SQL injection vulnerabilities
- XSS (Cross-Site Scripting) risks
- Command injection
- Insecure randomness (Math.random for security)
- Eval usage
- Path traversal risks
- Weak crypto algorithms
- CORS misconfigurations

**Security Checklist:**
- Environment variable usage for secrets
- HTTPS for external APIs
- Authentication on API routes
- Security headers (helmet)

### Reference Documents

- **Principles Guide**: `scripts/security-principles.md`
- **Security Now**: https://twit.tv/shows/security-now
- **GRC.com**: https://www.grc.com/default.htm
- **OWASP Top 10**: https://owasp.org/www-project-top-ten/