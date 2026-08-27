# ConnectFlow - LinkedIn Automation Tool

A full-stack automated LinkedIn lead generation and connection system. Features a React dashboard, Express REST API with PostgreSQL, and a headless Playwright worker that scrapes search results, queues leads, and intelligently sends connection requests while avoiding bot detection.

## 🎯 What It Does

1. **Campaign Creation** - Paste a job description; AI extracts target company & role
2. **Automated Scraping** - Worker searches LinkedIn for matching profiles and queues leads
3. **Smart Connection** - Worker visits profiles, detects "Connect"/"Follow"/"Message" buttons, sends requests
4. **Auto-Session Recovery** - When `li_at` cookie expires, worker auto-logs in using credentials
5. **Dashboard** - Real-time campaign tracking with leads found & connections sent

## 🏗 Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Frontend   │────▶│  Backend    │────▶│  Database   │
│  (React)    │     │  (Express)  │     │  (Postgres) │
└─────────────┘     └──────┬──────┘     └─────────────┘
                           │
                    ┌──────▼──────┐
                    │   Worker    │
                    │ (Playwright)│
                    └─────────────┘
```

- **Frontend** (`/frontend`) - React + Vite + Tailwind, polls API every 10s
- **Backend** (`/backend`) - Express.js REST API, Gemini AI for JD parsing
- **Worker** (`/worker`) - Playwright automation (scraper + connector loops)
- **Database** (`/database/init.sql`) - Users, Campaigns, Leads tables

## ✨ Features

| Feature | Description |
|---------|-------------|
| **AI Job Parsing** | Gemini extracts company & role from job descriptions |
| **Resilient Scraping** | Tag-based selectors bypass LinkedIn's obfuscated CSS classes |
| **Smart Button Detection** | Handles Connect, Follow, Message, and "More" dropdown actions |
| **Already-Connected Check** | Detects "Message" button to skip connected profiles |
| **Auto-Login Recovery** | Spawns visible browser for CAPTCHA solving when cookie expires |
| **Rate Limiting** | Configurable daily action limits (default 80/day) |
| **Stealth Mode** | puppeteer-extra-plugin-stealth to avoid bot detection |
| **Graceful Shutdown** | SIGINT/SIGTERM handlers wait for in-flight operations |

## 📋 Prerequisites

- Node.js 18+
- PostgreSQL database (Neon, Supabase, or self-hosted)
- Google Gemini API key (free tier available)
- **Dedicated LinkedIn account** ⚠️ *Automation violates LinkedIn ToS - use a secondary/burner account*

## 🚀 Quick Start

### 1. Database Setup

```bash
# Run the schema against your PostgreSQL instance
psql $DATABASE_URL -f database/init.sql
```

### 2. Backend

```bash
cd backend
cp .env.example .env
# Edit .env with your DATABASE_URL and GEMINI_API_KEY
npm install
npm start  # Runs on http://localhost:3000
```

### 3. Frontend

```bash
cd frontend
cp .env.example .env
# Edit .env if backend runs on different host/port
npm install
npm run dev  # Runs on http://localhost:5173
```

### 4. Worker

```bash
cd worker
cp .env.example .env
# Edit .env with DATABASE_URL and LinkedIn credentials
npm install
node index.js  # Runs continuously in background
```

## ⚙️ Configuration

### Backend (`.env`)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | 3000 | API server port |
| `DATABASE_URL` | **Yes** | - | PostgreSQL connection string |
| `GEMINI_API_KEY` | **Yes** | - | Google AI Studio API key |

### Worker (`.env`)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | **Yes** | - | PostgreSQL connection string |
| `LINKEDIN_EMAIL` | **Yes** | - | LinkedIn login for auto-recovery |
| `LINKEDIN_PASSWORD` | **Yes** | - | LinkedIn password |
| `HEADLESS` | No | `true` | Set `false` for visual debugging |
| `SCRAPER_INTERVAL` | No | 30000 | Scraper loop interval (ms) |
| `CONNECTOR_MIN_INTERVAL` | No | 20000 | Min connector interval (ms) |
| `CONNECTOR_MAX_INTERVAL` | No | 40000 | Max connector interval (ms) |

### Frontend (`.env`)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `VITE_API_URL` | No | `http://localhost:3000/api/campaigns` | Backend campaigns endpoint |

## 🗄 Database Schema

```sql
Users
├── id, name, li_at_cookie, linkedin_email, linkedin_password
├── cookie_status (valid/invalid)
├── daily_actions_count, last_action_date

Campaigns
├── id, user_id, job_description_text
├── extracted_company, extracted_role
├── status (pending/searching/completed/failed)

Leads
├── id, campaign_id, linkedin_url, name, job_title
├── status (pending/connected/failed)
└── UNIQUE(campaign_id, linkedin_url)
```

## 🔄 Worker Loops

### Scraper Loop (every 30s by default)
1. Finds campaigns with `status = 'pending'` and valid cookie
2. Updates campaign → `searching`
3. Searches LinkedIn with extracted keywords
4. Scrolls & scrapes profile URLs/names from results
5. Inserts leads with `status = 'pending'`
6. Updates campaign → `completed` or `failed`

### Connector Loop (random 20-40s)
1. Resets daily counters at midnight
2. Finds leads with `status = 'pending'` under daily limit
3. Visits profile, checks for:
   - **Message button** → already connected → mark `connected`
   - **Following button** → already following → mark `connected`
   - **Connect button** → click → send request → mark `connected`
   - **Follow button** (fallback) → click → mark `connected`
   - **More dropdown** → searches for Connect/Follow inside
4. Increments user's `daily_actions_count`

## 🛡 Security & Compliance

> ⚠️ **IMPORTANT**: This tool is for **educational purposes only**.
> - Automating LinkedIn violates their **Terms of Service**
> - Risk of **permanent account ban** - use a burner account
> - Respect rate limits (configured: 80 actions/day/user)
> - No data is stored beyond what's needed for automation
> - Credentials only used for session recovery, never logged

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| `0 profiles found` | Check `worker/debug_0_profiles.png` & `.html` - LinkedIn may have changed layout |
| Cookie invalid errors | Ensure `LINKEDIN_EMAIL/PASSWORD` are correct in worker `.env` |
| Campaigns stuck in `searching` | Check worker logs - may be rate limited or CAPTCHA |
| Frontend can't connect | Verify `VITE_API_URL` matches backend host:port |
| Database connection fails | Ensure `DATABASE_URL` includes `?sslmode=require` for Neon |

## 📁 Project Structure

```
linkedin/
├── backend/
│   ├── routes/
│   │   ├── campaigns.js   # Campaign CRUD + AI parsing
│   │   └── users.js       # User management + cookie updates
│   ├── server.js          # Express entry point
│   ├── db.js              # pg Pool
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── App.jsx        # Main dashboard
│   │   └── main.jsx       # React entry
│   └── .env.example
├── worker/
│   ├── index.js           # Worker orchestrator (loops + shutdown)
│   ├── scraper.js         # LinkedIn search scraping
│   ├── connector.js       # Profile visit + connect logic
│   ├── auth.js            # Auto-login with CAPTCHA support
│   ├── db.js              # pg Pool
│   └── .env.example
├── database/
│   └── init.sql           # Schema + triggers
└── README.md
```

## 🧪 Testing with Seed Data

```bash
cd backend
node seed.js        # Creates test user, campaign, leads
node seed_profiles.js
node seed_real.js
```

## 📝 License

MIT - Educational use only. See [Security & Compliance](#-security--compliance).

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request# LinkedinConnectionBuilder
