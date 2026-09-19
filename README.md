# Marian TBI Project Monitoring & Incubation System (PMIS)

A comprehensive Project Monitoring and Incubation System for the **Marian Technology Business Incubator (TBI)**. This platform manages the full lifecycle of startup incubation — from application and onboarding through milestones, mentorship, assessments, and graduation — with role-based access control for TBI staff, incubatees, and administrators.

---

## Description

The Marian TBI PMIS is a web-based management platform designed to streamline operations for technology business incubators. It provides distinct interfaces for three primary user roles:

- **TBI Staff & Management** (magenta accent) — Full administrative oversight, program management, user administration, reporting, and system configuration
- **Incubatees / Startup Founders** (teal accent) — Dashboard for tracking milestones, submitting assessments, accessing mentorship, managing documents, and communicating with TBI staff
- **System Administrators** — Complete system control including role management, audit logs, and infrastructure settings

The system features a **role-based visual accent system** that automatically applies TBI magenta (#B8216A) for staff/management and incubator teal (#03888F) for incubatees, providing immediate visual context across the entire application.

---

## Features

### Core Functionality
- **Multi-role Dashboards** — Tailored views for TBI Staff, Incubatees, and Admins
- **Application & Onboarding** — Startup application workflows with document upload and approval tracking
- **Milestone Management** — Create, track, and validate startup milestones with evidence submission
- **Mentorship Program** — Match mentors with incubatees, schedule sessions, track progress
- **Assessments & Evaluations** — Periodic startup assessments with scoring and feedback
- **Incubation Status Tracking** — Real-time incubation phase monitoring (Pre-incubation, Incubation, Graduation)
- **Document Management** — Secure file upload, versioning, and access-controlled document library
- **Group/Team Management** — Organize incubatees into cohorts with dedicated views
- **Activity & Progress Reporting** — Comprehensive reporting with export capabilities

### Communication & Collaboration
- **Real-time Chat** — Direct messaging between staff, mentors, and incubatees
- **Announcements & Notifications** — System-wide and targeted notifications with in-app bell
- **Requests & Approvals** — Structured workflow for resource requests, budget approvals, and administrative actions

### Administration
- **Role-Based Access Control (RBAC)** — Granular permissions via role definitions and route guards
- **User Management** — Account creation, approval workflows, profile management
- **System Configuration** — Dynamic settings via Firebase Remote Config
- **Audit & Activity Logs** — Comprehensive tracking of system actions

### Technical Features
- **Role-based Visual Theming** — CSS custom properties cascade TBI magenta / incubatee teal accents
- **Responsive Design** — Mobile-first, works on desktop, tablet, and mobile
- **Offline-capable** — Service worker caching for critical assets
- **Real-time Updates** — Firebase Firestore listeners for live data synchronization
- **Secure File Storage** — Firebase Storage with signed URLs and access rules

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend Framework** | React 18 + Vite 6 |
| **Routing** | React Router v6 |
| **Styling** | Tailwind CSS 3 + CSS Custom Properties |
| **State Management** | React Context + Hooks |
| **Backend / BaaS** | Firebase (Auth, Firestore, Storage, Functions, Hosting) |
| **Real-time** | Firestore Real-time Listeners |
| **Authentication** | Firebase Auth (Email/Password, Google OAuth) |
| **Deployment** | Firebase Hosting / Vercel |
| **Code Quality** | ESLint (Airbnb base), Prettier |
| **Package Manager** | npm |

---

## Project Structure

```
src/
├── components/
│   ├── assessments/      # Assessment forms, panels, history
│   ├── auth/             # Login, password reset, protected routes
│   ├── documents/        # Document upload, viewer, management
│   ├── edit-profile/     # Profile editing for each role
│   ├── groups/           # Cohort/team management
│   ├── incubation/       # Incubation status panels
│   ├── layout/           # AppShell, Sidebar, Header, Footer
│   ├── mentorship/       # Mentor matching, session scheduling
│   ├── milestones/       # Milestone CRUD, evidence, validation
│   ├── modals/           # Reusable modal components
│   ├── notifications/    # Notification bell, history page
│   ├── reports/          # Reporting dashboards, exports
│   ├── semi-pages/       # Role-specific group views
│   └── ui/               # Base UI components (Button, Input, Modal, etc.)
├── config/
│   └── marian-config.js  # App-wide constants, role definitions
├── context/              # React Context providers (Auth, Theme, etc.)
├── hooks/                # Custom React hooks
├── lib/
│   ├── firebase.js       # Firebase initialization
│   ├── permissions.js    # RBAC helpers, getRoleFamily()
│   └── utils.js          # Shared utilities
├── pages/
│   ├── activities/       # Activity feed, detail views
│   ├── admin/            # Admin dashboard, user mgmt, system settings
│   ├── announcements/    # Announcement CRUD
│   ├── applications/     # Application workflows
│   ├── employee/         # TBI staff pages
│   ├── incubatee/        # Incubatee dashboard & pages
│   └── programs/         # Program management
├── routes/
│   └── routes.jsx        # Route definitions with guards
├── index.css             # Global styles, CSS custom properties, accent system
├── main.jsx              # App entry point
└── App.jsx               # Root component
```

---

## Getting Started

### Prerequisites
- Node.js 18+ (recommended: 20.x LTS)
- npm 9+
- Firebase project with Auth, Firestore, Storage enabled
- (Optional) Google Cloud project for OAuth

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/mariantbi-monitoring.git
cd mariantbi-monitoring

# Install dependencies
npm install

# Copy environment template and configure
cp .env.example .env.local
# Edit .env.local with your Firebase config values
```

### Environment Variables

Create a `.env.local` file with:

```env
# Firebase Configuration
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_MEASUREMENT_ID=G-XXXXXXXXXX

# Optional: Analytics
VITE_GA_MEASUREMENT_ID=G-XXXXXXXXXX
```

### Development

```bash
# Start dev server (usually port 5173)
npm run dev

# Run linting
npm run lint

# Build for production
npm run build

# Preview production build
npm run preview
```

### Firebase Setup

1. **Authentication** — Enable Email/Password and Google providers
2. **Firestore** — Create database in production mode; deploy `firestore.rules` and `firestore.indexes.json`
3. **Storage** — Enable Storage; deploy `storage.rules`
4. **Functions** (optional) — Deploy Cloud Functions from `/functions` if present
5. **Hosting** — `firebase deploy --only hosting` or connect to Vercel

---

## Role-Based Accent System

The application uses a **CSS custom property** system for role-based theming:

```css
/* Default (fallback) */
:root {
  --accent: #058890;        /* Legacy teal */
  --accent-rgb: 5, 136, 144;
  --accent-light: #08b3bd;
  --accent-muted: rgba(5, 136, 144, 0.12);
}

/* TBI Staff & Management — Magenta */
[data-tbi-family="tbi"] {
  --accent: #b8216a;
  --accent-rgb: 184, 33, 106;
  --accent-light: #e04890;
  --accent-muted: rgba(184, 33, 106, 0.12);
}

/* Incubatees / Startup Users — Teal */
[data-tbi-family="incubatee"] {
  --accent: #03888f;
  --accent-rgb: 3, 136, 143;
  --accent-light: #05b3bc;
  --accent-muted: rgba(3, 136, 143, 0.12);
}
```

The `data-tbi-family` attribute is set on the root element in `AppShell.jsx` via the `getRoleFamily(role)` helper in `src/lib/permissions.js`. All accent-aware components use Tailwind classes like `bg-accent`, `text-accent`, `border-accent` (mapped to `var(--accent)` in `tailwind.config.js`).

**To add accent support to a new component:**
```jsx
// Use Tailwind utility classes (recommended)
<div className="bg-accent text-white border-accent ring-accent" />

// Or use CSS custom properties directly
<div style={{ backgroundColor: 'var(--accent)' }} />
```

---

## Role Definitions & Permissions

| Role | Family | Description |
|------|--------|-------------|
| `sysadmin` | TBI | Full system access, user/role management |
| `admin` | TBI | Administrative oversight, program management |
| `portfolio_manager` | TBI | Portfolio-level oversight |
| `incubation_manager` | TBI | Incubation program management |
| `program_coordinator` | TBI | Program coordination |
| `mentor` | TBI | Mentor-specific access |
| `staff` | TBI | General TBI staff access |
| `incubatee` | Incubatee | Startup founder/team member |
| `startup_member` | Incubatee | Additional team members |

Permission checks use helpers in `src/lib/permissions.js`:
- `hasPermission(userRole, permission)` — Check specific permission
- `isStaffAppRole(role)` — True for TBI staff roles
- `isIncubateeRole(role)` — True for incubatee roles
- `getRoleFamily(role)` — Returns `"tbi"` or `"incubatee"` for theming

---

## Deployment

### Firebase Hosting
```bash
npm run build
firebase deploy --only hosting
```

### Vercel
1. Connect repository to Vercel
2. Configure environment variables in Vercel dashboard
3. Deploy — Vercel auto-detects Vite + React

### Docker (Optional)
```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Make changes with clear commits
4. Run `npm run lint` and `npm run build` — both must pass
5. Submit a Pull Request with description of changes

### Code Style
- Follow existing patterns in the codebase
- Use functional components + hooks
- Colocate related files (component + styles + tests)
- Prefer Tailwind utilities over custom CSS
- Keep components focused and reusable

---

## Security

- **Never commit secrets** — Use environment variables
- **Firestore Rules** — Enforce role-based access at database level
- **Storage Rules** — Validate file types, sizes, and ownership
- **Authentication** — All routes protected via `ProtectedRoute` with role guards
- **Input Validation** — Client-side validation + server-side Firestore rules

---

## Support & Documentation

- **Architecture Decisions** — See `/docs/adr/` for ADRs
- **API Reference** — Firestore schema in `/docs/schema.md`
- **Component Library** — Storybook (if configured): `npm run storybook`
- **Firebase Console** — Project dashboard for monitoring

---

## License

Proprietary — Marian Technology Business Incubator. All rights reserved.

---

## Acknowledgments

- Built for the **Marian Technology Business Incubator** community
- Inspired by modern incubator management practices
- Thanks to all TBI staff and incubatees who provided feedback