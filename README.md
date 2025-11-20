# My App

> **Note:** Only use npm for package handling in this repo (DO NOT USE YARN).

## Table of Contents

- [Global Setup](#global-setup) - **Do this FIRST before team members start local setup**
- [Prerequisites](#prerequisites)
- [Local Setup](#local-setup)
  - [Database Setup with Docker](#database-setup-with-docker)
  - [Backend Setup](#backend-setup)
  - [Frontend Setup](#frontend-setup)
- [AWS Configuration](#aws-configuration)
- [Heroku Deployment](#heroku-deployment)
- [Other Tips](#other-tips)

---

## Global Setup

> **IMPORTANT: This must be done by ONE person BEFORE any team members start their local setup.**

> **If you are just setting up your local machine as a team member, skip to [Local Setup](#local-setup).**

Replace `myapp` with your actual app name in the following files:

### 1. `docker-compose.yml`

Update the following lines:

```yaml
# Line 7: Change container_name
container_name: <appname>_postgres

# Line 12: Change POSTGRES_DB
POSTGRES_DB: <appname>_db
```

**Example:** If your app name is `myproject`, change:
- `myapp_postgres` → `myproject_postgres`
- `myapp_db` → `myproject_db`

### 2. `.env` file (or `.env.example` if it exists)

If you have a `.env.example` file in the `backend` directory, update the `DATABASE_URL`:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/<appname>_db
```

**Example:** If your app name is `myproject`, change:
- `myapp_db` → `myproject_db`

Make sure the database name matches what you set in `docker-compose.yml`.

### 3. Commit these changes

After making these changes, commit and push them to the repository so all team members use the same app name.

---

## Prerequisites

- **Node.js** (for frontend development)
  - Version: **Node.js 20.19.0 or higher**, or **Node.js 22.12.0 or higher**
  - Required by Vite and React dependencies (specified in `package.json` `engines` field)
  - Check your version: `node --version`
  - If using `nvm`, run `nvm use` in the `frontend` directory (uses `.nvmrc` file)
  - Download from [nodejs.org](https://nodejs.org/) if needed

- **Docker Desktop** (for local PostgreSQL database)
  - Download from [docker.com](https://www.docker.com/products/docker-desktop)
  - Ensure Docker is running before starting the database

---

## Local Setup

### Database Setup with Docker

This project uses **PostgreSQL only** (no SQLite fallback). We use Docker to run PostgreSQL locally, so you don't need to install PostgreSQL on your machine.

### 1. Start PostgreSQL with Docker

From the project root directory, start the PostgreSQL container:

```bash
docker-compose up -d
```

This will:
- Download the PostgreSQL 15 image (if not already downloaded)
- Start a PostgreSQL container named `<appname>_postgres`
- Create a database named `<appname>_db`
- Expose PostgreSQL on port `5432`

**Default credentials:**
- Username: `postgres`
- Password: `postgres`
- Database: `<appname>_db`
- Port: `5432`


### 2. Verify Database is Running

Check that the container is running:

```bash
docker-compose ps
```

You should see the `postgres` service running. You can also check the logs:

```bash
docker-compose logs postgres
```

### 3. Configure DATABASE_URL

If you have a `.env.example` file, copy it to `.env`:

```bash
cp backend/.env.example backend/.env
```

The `.env` file should contain:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/<appname>_db
```

> **Next Step:** After configuring the database, proceed to [Backend Setup](#backend-setup) to set up your backend environment and run migrations.

### Docker Commands Reference

```bash
# Start the database
docker-compose up -d

# Stop the database
docker-compose down

# Stop and remove volumes (deletes all data)
docker-compose down -v

# View database logs
docker-compose logs -f postgres

# Check database status
docker-compose ps

# Access PostgreSQL CLI
docker-compose exec postgres psql -U postgres -d <appname>_db
```

### Heroku PostgreSQL

When deploying to Heroku, the `DATABASE_URL` is automatically set by Heroku. See the [Heroku Deployment](#heroku-deployment) section below.

### Backend Setup

### 1. Create and Activate Virtual Environment

First, `cd` into the `backend` directory and create a virtual environment:

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
```

### 2. Install Dependencies

Install the required packages:

```bash
pip install -r requirements.txt
```

### 3. Configure VS Code

Create a `.vscode` directory in the outermost directory (where `backend` and `frontend` directories are located).

Create a `settings.json` file with the following contents:

```json
{
  "python.defaultInterpreterPath": "backend/venv/bin/python3",
  "python.analysis.extraPaths": ["backend"]
}
```

Then:
1. Open VS Code search (`CMD+Shift+P` / `Ctrl+Shift+P`)
2. Type "python interpreter" and press Enter
3. Select "Use Python from python.defaultInterpreterPath setting"
4. If it's not there, search "Developer: reload window" and refresh a couple of times
5. Once you've selected the Python interpreter, refresh again until the import errors go away

### 4. Configure Environment Variables

Create a `.env` file in the `/backend` directory using `.env.example` as a template:

```bash
cp .env.example .env
```

The `.env` file should already contain the correct `DATABASE_URL` for Docker. No changes needed unless you want to customize the database credentials.

> **Note:** Make sure you've completed the [Database Setup with Docker](#database-setup-with-docker) section before proceeding with migrations.

### 5. Run Database Migrations

After setting up your `.env` file and starting the Docker database, create and run the initial migrations:

```bash
cd backend
source venv/bin/activate  # if not already activated
python manage.py makemigrations core
python manage.py migrate
```

This will create the necessary database tables for your Django application.

### Frontend Setup

### 1. Verify Node.js Version

Before installing dependencies, ensure you have the correct Node.js version:

```bash
node --version
```

You need **Node.js 20.19.0+** or **22.12.0+**. 

If using `nvm` (Node Version Manager), you can automatically use the correct version:
```bash
cd frontend
nvm use
```

The required version is specified in `package.json` (`engines` field) and `.nvmrc`. If you see warnings about unsupported engine versions, update Node.js.

### 2. Install Dependencies

`cd` into the `frontend` directory and install dependencies:

```bash
cd frontend
npm ci
```

> **Important:** Use `npm ci` (NOT `npm install`). If you are modifying `package-lock.json`, you are doing it wrong.

### 3. Run the Application

To run both the frontend and backend in a local development environment:

```bash
cd frontend
npm run start:full
```

To just run the backend:

```bash
npm run dev
```

A full list of commands can be found in `package.json` under the `"scripts"` section.

---

## AWS Configuration

This project supports AWS S3 for file storage and AWS SES (Simple Email Service) for sending emails. Both services use the same AWS credentials.

### Shared AWS Credentials

1. **Create IAM User with S3 and SES Permissions**:
   - Go to [IAM Console](https://console.aws.amazon.com/iam/)
   - Create a new user with programmatic access
   - Attach policies for both `AmazonS3FullAccess` and `AmazonSESFullAccess` (or create custom policies with minimal permissions)
   - Save the Access Key ID and Secret Access Key

2. **Configure Shared Credentials in `.env`**:
   ```env
   AWS_ACCESS_KEY_ID=your-access-key-id
   AWS_SECRET_ACCESS_KEY=your-secret-access-key
   ```

### AWS S3 Setup (Optional - for file storage)

1. **Create an S3 Bucket**:
   - Go to [AWS S3 Console](https://console.aws.amazon.com/s3/)
   - Create a new bucket
   - Note the bucket name and region

2. **Configure in `.env`**:
   ```env
   AWS_STORAGE_BUCKET_NAME=your-bucket-name
   AWS_S3_REGION_NAME=us-east-1
   ```

### AWS SES Setup (Optional - for sending emails)

1. **Verify Your Email Domain or Email Address**:
   - Go to [AWS SES Console](https://console.aws.amazon.com/ses/)
   - If you're in the SES sandbox, verify your email address
   - For production, verify your domain to send from any email address on that domain

2. **Request Production Access** (if needed):
   - In SES sandbox, you can only send to verified email addresses
   - Request production access to send to any email address

3. **Configure in `.env`**:
   ```env
   AWS_SES_REGION_NAME=us-east-1
   AWS_SES_REGION_ENDPOINT=email.us-east-1.amazonaws.com
   SES_FROM_EMAIL=hi@example.com
   ```

   > **Note:** 
   - SES uses the same `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` as S3
   - `SES_FROM_EMAIL` must be a verified email address or domain in AWS SES
   - If AWS credentials or `SES_FROM_EMAIL` are not provided, the application will use the console email backend (emails printed to console) for development

4. **Test Email Sending**:
   ```python
   from django.core.mail import send_mail
   
   send_mail(
       'Subject',
       'Message body',
       'from@example.com',
       ['to@example.com'],
       fail_silently=False,
   )
   ```

---

## Heroku Deployment

### Prerequisites

1. Install the [Heroku CLI](https://devcenter.heroku.com/articles/heroku-cli)
2. Create a Heroku account at [heroku.com](https://www.heroku.com)
3. Login to Heroku:
   ```bash
   heroku login
   ```

### Initial Setup

1. **Create a Heroku App**:
   ```bash
   heroku create your-app-name
   ```

2. **Add PostgreSQL Add-on**:
   ```bash
   heroku addons:create heroku-postgresql:mini
   ```
   
   > The `mini` plan is free for development. For production, consider upgrading to a paid plan.

   This automatically sets the `DATABASE_URL` environment variable.

3. **Set Environment Variables**:
   ```bash
   heroku config:set SECRET_KEY=your-secret-key-here
   heroku config:set ENVIRONMENT=production
   heroku config:set ALLOWED_HOSTS=your-app-name.herokuapp.com
   ```

   Set any other environment variables from your `.env` file as needed:
   ```bash
   # AWS Credentials (shared for S3 and SES)
   heroku config:set AWS_ACCESS_KEY_ID=your-key
   heroku config:set AWS_SECRET_ACCESS_KEY=your-secret
   
   # AWS S3 (for file storage)
   heroku config:set AWS_STORAGE_BUCKET_NAME=your-bucket
   heroku config:set AWS_S3_REGION_NAME=us-east-1
   
   # AWS SES (for sending emails)
   heroku config:set AWS_SES_REGION_NAME=us-east-1
   heroku config:set AWS_SES_REGION_ENDPOINT=email.us-east-1.amazonaws.com
   heroku config:set SES_FROM_EMAIL=hi@yourdomain.com
   ```

4. **Deploy Backend**:
   ```bash
   cd backend
   git subtree push --prefix backend heroku main
   ```
   
   Or if using a separate Heroku git remote:
   ```bash
   git remote add heroku https://git.heroku.com/your-app-name.git
   git subtree push --prefix backend heroku main
   ```

5. **Run Migrations**:
   ```bash
   heroku run python manage.py migrate
   ```

6. **Create Superuser** (optional):
   ```bash
   heroku run python manage.py createsuperuser
   ```

### Frontend Deployment

For the frontend, you can:

1. **Deploy to Heroku** (with a buildpack):
   ```bash
   heroku create your-frontend-app-name
   heroku buildpacks:set heroku/nodejs
   cd frontend
   git subtree push --prefix frontend heroku main
   ```

2. **Or deploy to Vercel/Netlify**:
   - Connect your GitHub repository
   - Set the build directory to `frontend`
   - Configure build command: `npm ci && npm run build`
   - Set publish directory to `frontend/dist`

### Useful Heroku Commands

```bash
# View logs
heroku logs --tail

# Open app in browser
heroku open

# Run Django shell
heroku run python manage.py shell

# Check database connection
heroku pg:info

# View all config vars
heroku config

# Restart dynos
heroku restart
```

---

## Other Tips

### Making Routes

1. Build routes in `core/views.py`
2. Add them to `config/urls.py`

Example:

```python
# core/views.py
from django.http import JsonResponse

def my_view(request):
    return JsonResponse({"message": "Hello, World!"})
```

```python
# config/urls.py
from django.urls import path
from core.views import my_view

urlpatterns = [
    path('api/my-endpoint/', my_view, name='my_view'),
]
```

---

## Troubleshooting

### Database Connection Issues

- **Docker not running**: Ensure Docker Desktop is running before starting the database
- **Container not started**: Run `docker-compose up -d` from the project root
- **Port conflict**: If port 5432 is already in use, stop other PostgreSQL instances or change the port in `docker-compose.yml`
- **Verify DATABASE_URL**: Check that `DATABASE_URL` in `.env` matches your database name (e.g., `postgresql://postgres:postgres@localhost:5432/<appname>_db`)
- **Check container status**: Run `docker-compose ps` to see if the container is running
- **View logs**: Run `docker-compose logs postgres` to see database logs

### Import Errors in VS Code

- Reload the window: `CMD+Shift+P` → "Developer: Reload Window"
- Verify Python interpreter is set correctly
- Check that `python.analysis.extraPaths` includes `"backend"` in `.vscode/settings.json`

### Node.js Version Issues

- **"Unsupported engine" warnings**: Update Node.js to version 20.19.0+ or 22.12.0+
  - Check current version: `node --version`
  - Download the latest LTS version from [nodejs.org](https://nodejs.org/)
  - If using `nvm`, run: `nvm install 20.19.0` or `nvm install 22.12.0`
  - After updating, delete `node_modules` and `package-lock.json`, then run `npm ci` again

---

## License

[Add your license here]
