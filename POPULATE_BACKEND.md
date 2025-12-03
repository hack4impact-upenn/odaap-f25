# How to Populate the Backend with Test Data

## Quick Start

1. **Make sure your virtual environment is activated:**
   ```bash
   cd backend
   source venv/bin/activate
   ```

2. **Make sure PostgreSQL is running:**
   ```bash
   docker-compose up -d
   ```

3. **Run the test data script:**
   ```bash
   python create_test_data.py
   ```

## What Gets Created

The script will create:

### Users
- **1 Teacher:**
  - Email: `teacher@odaap.com`
  - Password: `password123`
  - Name: Valencia Teacher

- **3 Students:**
  - `student1@odaap.com` / `password123` (John Doe)
  - `student2@odaap.com` / `password123` (Student One)
  - `student3@odaap.com` / `password123` (Late Doe)

### Course
- **Course:** "Fall 25"
- **Description:** Introduction to Computer Science
- **Zoom Link:** https://zoom.us/j/123456789

### Modules
- **Module 1:** Posted, 5 questions, due in 7 days
- **Module 2:** Posted, 4 questions (including MCQ), due in 14 days
- **Module 3:** Not Posted, due in 21 days
- **Module 4:** Not Posted, due in 28 days

### Questions
- Module 1: 5 written questions
- Module 2: 4 questions (written, MCQ, written, video)
  - Includes a multiple choice question with 4 options

## Login and Test

1. **Start the backend:**
   ```bash
   cd backend
   source venv/bin/activate
   python manage.py runserver
   ```

2. **Start the frontend:**
   ```bash
   cd frontend
   npm run dev
   ```

3. **Login as Teacher:**
   - Go to http://localhost:5173/login
   - Email: `teacher@odaap.com`
   - Password: `password123`
   - You'll see the teacher dashboard with modules, students, etc.

4. **Login as Student:**
   - Go to http://localhost:5173/login
   - Email: `student1@odaap.com`
   - Password: `password123`
   - You'll see the student dashboard with modules and assignments

## Editing Features

### Teachers Can:
- ✅ Edit module information (title, description, due date)
- ✅ Create and edit questions
- ✅ Add/remove MCQ options
- ✅ Set correct answers for MCQ questions
- ✅ Post/unpost modules
- ✅ View student progress and grades
- ✅ Update Zoom links in settings

### Students Can:
- ✅ View posted modules and assignments
- ✅ Submit answers to questions
- ✅ Edit/update their submissions (before grading)
- ✅ View their grades after submission
- ✅ See correct answers for MCQ questions in review mode

## Notes

- The script is idempotent - you can run it multiple times safely
- Existing data won't be duplicated
- All students are automatically enrolled in the course
- The teacher is automatically assigned to the course

