# Backend Connection Guide

This guide explains how to set up and connect your backend to the frontend.

## Quick Start

### 1. Start the Database (PostgreSQL)

The backend uses PostgreSQL running in Docker. Start it first:

```bash
# From project root
docker-compose up -d
```

Verify it's running:
```bash
docker-compose ps
```

### 2. Configure Environment Variables

Your backend needs a `.env` file. I noticed you have a `,env` file (with a comma). You should rename it:

```bash
cd backend
mv ,env .env
```

Or create a new `.env` file with these contents:

```env
ENVIRONMENT=development
ALLOWED_HOSTS=localhost,127.0.0.1
SECRET_KEY=your-dev-secret-key
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/odaap_db

# AWS Configuration 
AWS_ACCESS_KEY_ID=your-access-key-id
AWS_SECRET_ACCESS_KEY=your-secret-access-key
AWS_STORAGE_BUCKET_NAME=dev-bucket-name
AWS_S3_REGION_NAME=us-east-1
AWS_SES_REGION_NAME=us-east-1
AWS_SES_REGION_ENDPOINT=email.us-east-1.amazonaws.com
SES_FROM_EMAIL=hi@example.com
```

**Important:** The `DATABASE_URL` must match your Docker database name (`odaap_db`).

### 3. Set Up Backend Environment

```bash
cd backend

# Activate virtual environment (if not already activated)
source venv/bin/activate

# Install dependencies (if not already installed)
pip install -r requirements.txt
```

### 4. Run Database Migrations

```bash
# Make sure you're in the backend directory
cd backend

# Activate the virtual environment (IMPORTANT!)
source venv/bin/activate

# Now run migrations
python manage.py makemigrations core
python manage.py migrate
```

**Note:** On macOS, if `python` doesn't work, you can use `python3` instead, or make sure the virtual environment is activated (which provides the `python` command).

### 5. Start the Backend Server

```bash
# From backend directory
cd backend

# Activate the virtual environment (IMPORTANT!)
source venv/bin/activate

# Start the server
python manage.py runserver
```

**Note:** You must activate the virtual environment first! After activation, you'll see `(venv)` in your terminal prompt.

The backend will start on **http://localhost:8000**

You should see:
```
Starting development server at http://127.0.0.1:8000/
```

### 6. Verify Backend is Running

Test the API:
```bash
# In a new terminal
curl http://localhost:8000/api/courses/
```

Or visit in browser: http://localhost:8000/api/courses/

## How Frontend Connects to Backend

### Connection Details

- **Backend URL:** `http://localhost:8000`
- **API Base URL:** `http://localhost:8000/api`
- **Frontend URL:** `http://localhost:5173` (Vite default)

### Frontend Configuration

The frontend is already configured to connect to the backend. See `frontend/src/services/api.ts`:

```typescript
const API_BASE_URL = 'http://localhost:8000/api';
```

### CORS Configuration

The backend is configured to accept requests from:
- `http://localhost:5173` (Vite)
- `http://localhost:3000` (React default)
- `http://127.0.0.1:5173`
- `http://127.0.0.1:3000`

This is set in `backend/config/settings.py`:

```python
CORS_ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:3000",
]
```

## Running Both Frontend and Backend

### Option 1: Run Separately (Recommended for Development)

**Terminal 1 - Backend:**
```bash
cd backend
source venv/bin/activate
python manage.py runserver
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

### Option 2: Run Together (Using npm script)

From the `frontend` directory:
```bash
npm run start:full
```

This runs both frontend and backend concurrently.

## API Endpoints

Your backend exposes these main endpoints:

- **Authentication:**
  - `POST /api/token/` - Login (get JWT tokens)
  - `POST /api/token/refresh/` - Refresh access token
  - `POST /api/register/` - Register new user

- **Resources:**
  - `/api/courses/` - Courses
  - `/api/modules/` - Modules
  - `/api/questions/` - Questions
  - `/api/submissions/` - Submissions
  - `/api/announcements/` - Announcements

See `backend/API_ENDPOINTS.md` for full API documentation.

## Troubleshooting

### Backend won't start

1. **"command not found: python" error:**
   ```bash
   # Make sure you activate the virtual environment first!
   cd backend
   source venv/bin/activate
   
   # You should see (venv) in your prompt
   # Then try again:
   python manage.py runserver

2. **Check database is running:**
   ```bash
   docker-compose ps
   ```

3. **Check .env file exists:**
   ```bash
   ls -la backend/.env
   ```

4. **Verify DATABASE_URL:**
   Make sure it matches your Docker database name (`odaap_db`)

4. **Check for port conflicts:**
   If port 8000 is in use, you can change it:
   ```bash
   python manage.py runserver 8001
   ```
   Then update `frontend/src/services/api.ts` to use port 8001.

### CORS errors in browser

- Make sure backend is running
- Check that frontend URL matches one in `CORS_ALLOWED_ORIGINS`
- Verify `CORS_ALLOW_CREDENTIALS = True` in settings.py

### Database connection errors

1. **Start Docker database:**
   ```bash
   docker-compose up -d
   ```

2. **Check DATABASE_URL in .env:**
   Should be: `postgresql://postgres:postgres@localhost:5432/odaap_db`

3. **Test database connection:**
   ```bash
   docker-compose exec postgres psql -U postgres -d odaap_db
   ```

### Frontend can't reach backend

1. **Check backend is running:**
   Visit http://localhost:8000/api/courses/ in browser

2. **Check API_BASE_URL:**
   In `frontend/src/services/api.ts`, verify:
   ```typescript
   const API_BASE_URL = 'http://localhost:8000/api';
   ```

3. **Check network tab:**
   Open browser DevTools → Network tab to see failed requests

## Next Steps

1. ✅ Start database: `docker-compose up -d`
2. ✅ Configure `.env` file
3. ✅ Run migrations: `python manage.py migrate`
4. ✅ Start backend: `python manage.py runserver`
5. ✅ Start frontend: `npm run dev` (in frontend directory)
6. ✅ Test connection by logging in or accessing API endpoints

## Authentication Flow

The frontend uses JWT (JSON Web Tokens) for authentication:

1. User logs in via `POST /api/token/` with email/password
2. Backend returns `access` and `refresh` tokens
3. Frontend stores tokens in `localStorage`
4. Frontend includes `Authorization: Bearer <token>` header in all API requests
5. On 401 errors, frontend automatically refreshes the token

This is all handled automatically by the `api.ts` service file.
