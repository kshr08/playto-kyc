# Playto KYC Portal

A full-stack KYC (Know Your Customer) verification system for Indian creators and agencies collecting international payments. Built with Django REST Framework + React + Tailwind CSS.

---

## Live Demo

> Deploy URL:
Vercel: https://playto-kyc-theta.vercel.app/
Render: https://playto-kyc-backend-cfsd.onrender.com

**Test credentials (pre-seeded):**

| Role | Username | Password |
|------|----------|----------|
| Reviewer | `reviewer` | `reviewer123` |
| Merchant | `merchant1` | `password123` |
| Merchant | `merchant2` | `password123` |
| Merchant | `merchant3` | `password123` |

---

## Tech Stack

| Layer | Choice |
|-------|--------|
| Backend | Django 4.2, Django REST Framework |
| Auth | Token authentication (DRF) |
| Database | PostgreSQL |
| File uploads | Django file storage + python-magic (MIME sniffing) |
| Frontend | React 19, Vite 8, Tailwind CSS 3 |

---

## Local Setup

### Prerequisites

- Python 3.11+
- Node.js 20+
- PostgreSQL 14+ running locally

---

### 1. Clone the repo

```bash
git clone <your-repo-url>
cd playto-kyc
```

---

### 2. Backend

#### Create and activate a virtual environment

Make sure you are inside the `backend` folder first, then create the venv:

```bash
cd backend
python -m venv venv
```

Now activate it:

```bash
# macOS / Linux:
source venv/bin/activate

# Windows (Command Prompt):
venv\Scripts\activate

# Windows (PowerShell):
venv\Scripts\Activate.ps1
```

You should see `(venv)` appear at the start of your terminal line. That means it's active. All pip installs from here will go into this isolated environment and won't affect the rest of your system.

#### Install dependencies

With the venv active, install everything from requirements:

```bash
pip install -r requirements.txt
```

#### Install libmagic (needed by python-magic for MIME sniffing)

```bash
# macOS:
brew install libmagic

# Ubuntu / Debian:
sudo apt-get install libmagic1

# Windows: python-magic-bin covers this, add it to requirements if needed
pip install python-magic-bin
```

#### Create the PostgreSQL database

```sql
CREATE DATABASE playto_kyc;
CREATE USER postgres WITH PASSWORD 'yourpassword';
GRANT ALL PRIVILEGES ON DATABASE playto_kyc TO postgres;
```

#### Configure environment variables

Create `backend/.env`:

```env
DB_NAME=playto_kyc
DB_USER=postgres
DB_PASSWORD=yourpassword
DB_HOST=localhost
DB_PORT=5432
```

#### Run migrations and seed demo data

```bash
python manage.py migrate
python manage.py seed_demo
```

The seed script creates:
- 1 reviewer account (`reviewer / reviewer123`)
- 3 merchant accounts (`merchant1`, `merchant2`, `merchant3` — all `password123`)
- Submissions in `submitted`, `under_review`, and `approved` states

#### Start the backend

```bash
python manage.py runserver
```

API will be available at `http://localhost:8000/api/v1/`

---

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend will be available at `http://localhost:5173`

---

### 4. Running Tests

```bash
cd backend
python manage.py test kyc
```

This runs all tests in `kyc/tests.py`, including illegal state transition tests, role-based access control, and cross-merchant isolation.

---

## Seed Script Details

```bash
python manage.py seed_demo
```

Creates the following accounts and submissions (skips if already exist):

| Username | Role | Submission State |
|----------|------|-----------------|
| reviewer | reviewer | — |
| merchant1 | merchant | draft |
| merchant2 | merchant | under_review |
| merchant3 | merchant | approved |

---

## Project Structure

```
playto-kyc/
├── backend/
│   ├── kyc/
│   │   ├── models.py         # KYCState machine, KYCSubmission, KYCDocument
│   │   ├── views.py          # All API endpoints
│   │   ├── serializers.py    # DRF serializers + file upload validation
│   │   ├── permissions.py    # IsMerchant, IsReviewer, IsSubmissionOwner
│   │   ├── notifications.py  # Notification event logging
│   │   ├── urls.py
│   │   ├── admin.py
│   │   └── tests.py          # State machine + auth tests
│   ├── kyc_service/
│   │   ├── settings.py
│   │   └── urls.py
│   ├── manage.py
│   └── requirements.txt
├── frontend/
│   └── src/
│       ├── App.jsx
│       ├── pages/
│       │   ├── AuthPage.jsx
│       │   ├── MerchantDashboard.jsx
│       │   └── ReviewerDashboard.jsx
│       ├── components/
│       │   ├── KYCForm.jsx
│       │   └── UI.jsx
│       ├── hooks/useAuth.jsx
│       └── utils/api.js
├── EXPLAINER.md
└── README.md
```

---

## API Reference

### Auth

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/auth/register/` | Register (merchant or reviewer) |
| POST | `/api/v1/auth/login/` | Login, returns token |
| GET | `/api/v1/auth/me/` | Get current user |

### Merchant

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/submissions/` | List own submissions |
| POST | `/api/v1/submissions/` | Create draft |
| GET | `/api/v1/submissions/:id/` | Get submission detail |
| PATCH | `/api/v1/submissions/:id/` | Save draft progress |
| POST | `/api/v1/submissions/:id/submit/` | Submit for review |
| POST | `/api/v1/submissions/:id/documents/` | Upload document |
| DELETE | `/api/v1/submissions/:id/documents/:doc_id/` | Delete document |

### Reviewer

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/reviewer/queue/` | View queue (filterable by state) |
| GET | `/api/v1/reviewer/submissions/:id/` | View full submission detail |
| POST | `/api/v1/reviewer/submissions/:id/transition/` | Change submission state |
| GET | `/api/v1/reviewer/dashboard/` | SLA metrics and queue stats |

### Notifications

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/notifications/` | List notification events |

---

## Key Design Decisions

**State machine as a single source of truth.** All valid transitions are declared in `KYCState.TRANSITIONS`. No state can be changed without going through `transition_to()`, which calls `validate_transition()`. Illegal attempts raise `ValueError` and return `400`.

**File uploads are triple-validated.** Size is checked first (fast fail). Then file extension. Then actual MIME type via `python-magic` reading the binary header — a renamed `.exe` still fails.

**Merchants are isolated at the query level.** Every merchant query uses `merchant=request.user` as a filter, not a post-fetch check. Guessing another merchant's submission ID returns `404`, not `403` — no information leakage.

**SLA is computed, never stored.** `is_at_risk` is a `@property` on `KYCSubmission`. It checks elapsed time dynamically so it is always fresh and can never become stale.