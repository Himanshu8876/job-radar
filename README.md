# Job Radar

Job Radar is a full-stack job discovery and application tracking platform. It collects jobs from supported applicant-tracking systems, compares them with a user's profile, and presents the best matches in a focused dashboard.

## What It Does

- User signup and JWT-based login
- Profile, preferred locations, preferred roles, and skill management
- PDF resume upload to Cloudinary
- Resume data extraction with Google Gemini
- Job collection from Greenhouse, Lever, and Ashby
- Search and filtering by title, company, location, workplace, employment type, country, and experience
- Match scoring based on skills, experience, location, and role relevance
- Application tracking with statuses such as `SAVED`, `APPLIED`, `INTERVIEW`, `REJECTED`, and `OFFER`
- Daily job collection, match generation, and email notifications

## Project Structure

```text
jobs/
├── backend/       Express + TypeScript API, collectors, matching, scheduler
├── frontend/      React + Vite application
└── backend/
    └── job_radar_backup.dump   PostgreSQL backup, if database restoration is needed
```

The main frontend pages are Dashboard, Jobs, Job Details, Matches, Applications, Profile, Login, and Signup.

## Technology

- **Frontend:** React 19, TypeScript, Vite, React Router, Axios, Tailwind CSS, Lucide React
- **Backend:** Node.js, Express 5, TypeScript, PostgreSQL, `pg`
- **Integrations:** Cloudinary, Google Gemini, Resend
- **Job sources:** Greenhouse, Lever, Ashby
- **Authentication:** bcrypt password hashing and JSON Web Tokens

## Prerequisites

- Node.js 18 or newer
- npm
- PostgreSQL database
- Cloudinary account for resume storage
- Google Gemini API key for resume extraction
- Resend API key for email notifications

## Configuration

Create `backend/.env`:

```env
PORT=8000
DATABASE_URL=postgresql://user:password@host:5432/database
JWT_SECRET=replace-with-a-long-random-secret
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
GEMINI_API_KEY=your-gemini-api-key
RESEND_API_KEY=your-resend-api-key
```

Create `frontend/.env`:

```env
VITE_API_URL=http://localhost:8000
```

Never commit either `.env` file or real credentials. Restore the PostgreSQL schema/data from `backend/job_radar_backup.dump` only when required by the environment.

## Run Locally

Install dependencies and start the API:

```bash
cd backend
npm install
npm run dev
```

In a second terminal, start the frontend:

```bash
cd frontend
npm install
npm run dev
```

Open the Vite URL shown in the terminal, usually `http://localhost:5173`.

Production builds:

```bash
cd backend && npm run build && npm start
cd frontend && npm run build && npm run preview
```

## Application Flow

1. A user signs up or logs in. The API returns a JWT, which the frontend stores locally and sends as a Bearer token.
2. The user completes their profile, selects skills and preferences, and can upload a PDF resume.
3. The backend uploads the PDF to Cloudinary. Gemini can extract structured skills and experience from the stored resume.
4. Collectors read active companies from PostgreSQL and fetch jobs from each company's configured ATS. Jobs are normalized and inserted or updated in the database; closed jobs are marked accordingly.
5. Matching compares the user's profile with each job. Required skills carry the most weight, with additional scoring for nice-to-have skills, experience, location, and role fit.
6. The dashboard and Matches page display results. Users can save a job, open the original application link, or create/update an application record.
7. The scheduler runs the collection and notification flow every day at `09:00` server time. New matches can be sent through Resend email.

## API Overview

All protected endpoints expect `Authorization: Bearer <token>`.

| Area | Main endpoints |
| --- | --- |
| Auth | `POST /auth/signup`, `POST /auth/login`, `GET /auth/me` |
| Jobs | `GET /jobs`, `GET /jobs/:id`, `GET /jobs/matches/:userId` |
| Profiles | `GET /profiles/:id`, `POST /profiles`, `PUT /profiles/:id` |
| Skills | `GET /skills`, `POST /profiles/:id/skills`, `DELETE /profiles/:id/skills/:skillId` |
| Resumes | `POST /resumes/resume`, `GET /resumes/extract` |
| Applications | `GET /applications`, `POST /applications`, `PUT /applications/:id`, `DELETE /applications/:id` |
| Collection | `POST /collect`, `POST /collect/:companyId`, `POST /daily-run` |
| Health | `GET /`, `GET /db-test` |

Job search supports query parameters including `search`, `location`, `company`, `workplace`, `employmentType`, `experienceMax`, `country`, `scope`, `page`, `limit`, and `sort`.

## Useful Commands

| Directory | Command | Purpose |
| --- | --- | --- |
| `backend` | `npm run dev` | Start the API with reload support |
| `backend` | `npm run build` | Compile TypeScript to `dist` |
| `backend` | `npm start` | Run the compiled API |
| `frontend` | `npm run dev` | Start the Vite development server |
| `frontend` | `npm run build` | Type-check and build the frontend |
| `frontend` | `npm run lint` | Run ESLint |

## Operational Notes

- Resume uploads accept PDF files up to 5 MB.
- The frontend API URL is controlled by `VITE_API_URL`.
- The backend enables CORS and JSON request parsing.
- Database access uses the `DATABASE_URL` connection string and SSL configuration.
- Company collection runs in batches of up to 10 companies and skips unsupported ATS types.
- Keep API keys server-side; only `VITE_*` values belong in the frontend environment.