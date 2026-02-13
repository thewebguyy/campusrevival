# Campus Revival Movement (CRM)

A faith-based platform enabling Christians to "adopt" university campuses for prayer and revival. Users can discover universities on an interactive map, commit to praying for specific campuses, log journal entries, and share prayer requests.

## Architecture

```
CRM/
├── api/                  # Vercel Serverless Functions (Node.js)
│   ├── auth/             #   Authentication (login, register, refresh, me, verify-leader)
│   ├── adoptions/        #   Campus adoption endpoints
│   ├── dashboard/        #   User dashboard aggregation
│   ├── journal/          #   Prayer journal CRUD
│   ├── prayer-requests/  #   Prayer request CRUD
│   ├── public/           #   Unauthenticated endpoints (activity feed)
│   ├── schools/          #   School/university CRUD + search
│   └── health.js         #   Health check
├── frontend/             # Static HTML/CSS/JS (served by Vercel)
│   ├── utils/
│   │   ├── api.js        #   API client with auth, retry, error classification
│   │   └── ui.js         #   Header loading, toast notifications
│   ├── css/main.css      #   Styles
│   ├── header.html       #   Shared navigation header (loaded via fetch)
│   └── *.html            #   Page files
├── lib/                  # Shared backend utilities
│   ├── auth.js           #   JWT auth middleware (withAuth, adminOnly)
│   ├── cors.js           #   CORS + security headers + NoSQL sanitisation
│   ├── mongodb.js        #   MongoDB connection with pooling & retry
│   ├── rateLimit.js      #   In-memory rate limiter
│   └── validate.js       #   Input validation & error helpers
├── models/               # Mongoose schemas
│   ├── Adoption.js
│   ├── Journal.js
│   ├── PrayerRequest.js
│   ├── School.js
│   └── User.js
├── vercel.json           # Vercel deployment config (routes, headers, functions)
├── .env.example          # Environment variable template
└── package.json
```

## Getting Started

### Prerequisites

- **Node.js** 18+
- **MongoDB** (local or [Atlas](https://www.mongodb.com/atlas))
- **Vercel CLI** (`npm i -g vercel`)

### Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/thewebguyy/campusrevival.git
   cd campusrevival
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment variables:**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` and fill in:
   - `MONGODB_URI` — your MongoDB connection string
   - `JWT_SECRET` — a strong random string (64+ characters)
   - `CORS_ORIGIN` — your frontend domain(s)

   Generate a secure secret:
   ```bash
   node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
   ```

4. **Run locally:**
   ```bash
   npx vercel dev
   ```
   Open [http://localhost:3000](http://localhost:3000).

### Deploying to Vercel

1. Push to GitHub.
2. Import the repo in the [Vercel dashboard](https://vercel.com/new).
3. Add environment variables in **Settings → Environment Variables**:
   - `MONGODB_URI`
   - `JWT_SECRET`
   - `CORS_ORIGIN` (e.g. `https://your-domain.vercel.app`)
4. Deploy.

## API Documentation

All endpoints return a consistent envelope:

```json
{
  "success": true,
  "data": { ... }
}
```

On error:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message"
  }
}
```

### Authentication

| Method | Endpoint               | Auth | Description                  |
|--------|------------------------|------|------------------------------|
| POST   | `/api/auth/register`   | No   | Create account               |
| POST   | `/api/auth/login`      | No   | Log in, receive tokens       |
| POST   | `/api/auth/refresh`    | No   | Exchange refresh → access    |
| GET    | `/api/auth/me`         | Yes  | Get current user profile     |
| POST   | `/api/auth/verify-leader` | Yes | Verify campus leader status |

### Schools

| Method | Endpoint                        | Auth  | Description               |
|--------|---------------------------------|-------|---------------------------|
| GET    | `/api/schools`                  | No    | List schools (paginated)  |
| GET    | `/api/schools?search=oxford`    | No    | Search by name/city       |
| POST   | `/api/schools`                  | Admin | Create a school           |
| GET    | `/api/schools/:id`              | No    | Get school by ID          |
| GET    | `/api/schools/slug/:slug`       | No    | Get school by slug        |
| GET    | `/api/schools/:id/adopters`     | No    | List adopters             |
| GET    | `/api/schools/:id/impact`       | No    | Monthly impact report     |

### Adoptions

| Method | Endpoint          | Auth | Description            |
|--------|-------------------|------|------------------------|
| GET    | `/api/adoptions`  | Yes  | List my adoptions      |
| POST   | `/api/adoptions`  | Yes  | Adopt a school         |

### Journal

| Method | Endpoint            | Auth | Description          |
|--------|---------------------|------|----------------------|
| GET    | `/api/journal`      | Yes  | List my entries      |
| POST   | `/api/journal`      | Yes  | Create entry         |
| DELETE | `/api/journal/:id`  | Yes  | Delete entry         |

### Prayer Requests

| Method | Endpoint                       | Auth | Description                |
|--------|--------------------------------|------|----------------------------|
| POST   | `/api/prayer-requests`         | Yes  | Create prayer request      |
| GET    | `/api/prayer-requests/:schoolId` | No | List requests for school  |

### Miscellaneous

| Method | Endpoint           | Auth | Description        |
|--------|--------------------|------|--------------------|
| GET    | `/api/health`      | No   | Health check       |
| GET    | `/api/public/activity` | No | Recent activity feed |

## Security

- **JWT Tokens**: Short-lived access tokens (1 hour) + long-lived refresh tokens (7 days)
- **Rate Limiting**: Per-IP and per-user limits on sensitive endpoints
- **Input Sanitisation**: NoSQL injection prevention, HTML stripping
- **Security Headers**: CSP, X-Frame-Options, HSTS via `vercel.json`
- **CORS**: Whitelist-based origin policy (configure via `CORS_ORIGIN`)

## Environment Variables

| Variable             | Required | Default | Description                           |
|----------------------|----------|---------|---------------------------------------|
| `MONGODB_URI`        | Yes      | —       | MongoDB connection string             |
| `JWT_SECRET`         | Yes      | —       | JWT signing secret (64+ chars)        |
| `JWT_EXPIRE`         | No       | `1h`    | Access token lifetime                 |
| `JWT_REFRESH_SECRET` | No       | JWT_SECRET | Separate secret for refresh tokens |
| `CORS_ORIGIN`        | Yes*     | `*`     | Comma-separated allowed origins       |
| `NODE_ENV`           | No       | `development` | Environment mode                |
| `RATE_LIMIT_MAX`     | No       | `100`   | Max requests per 15 min per IP        |

\*Use `*` only during development.

## License

ISC
