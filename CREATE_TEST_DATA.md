# How to Create Test Data

There are two ways to create test data: via Django Admin (easier) or via API calls.

## Method 1: Using Django Admin (Recommended)

### Step 1: Create a Superuser

First, create an admin account to access the Django admin panel:

```bash
cd backend
source venv/bin/activate  # or activate your virtual environment
python manage.py createsuperuser
```

You'll be prompted to enter:
- Username (or email)
- Email address
- Password
- Confirm password

### Step 2: Access Django Admin

1. Make sure your Django server is running:
   ```bash
   python manage.py runserver
   ```

2. Open your browser and go to:
   ```
   http://127.0.0.1:8000/admin/
   ```

3. Log in with your superuser credentials

### Step 3: Create Test Data

#### Create a Course:
1. Click on **"Courses"** in the admin panel
2. Click **"Add Course"** (top right)
3. Fill in:
   - Course name: `Introduction to Computer Science`
   - Course description: `Learn the fundamentals of programming`
   - Zoom link: `https://zoom.us/j/123456789` (optional)
   - Score total: `100`
4. Click **"Save"**

#### Create a Module:
1. Click on **"Modules"** in the admin panel
2. Click **"Add Module"**
3. Fill in:
   - Course: Select the course you just created
   - Module name: `Module 1: Chapters 1 - 5`
   - Module description: `Introduction to programming basics`
   - YouTube link: (optional, e.g., `https://www.youtube.com/watch?v=dQw4w9WgXcQ`)
   - Module order: `1`
   - Score total: `25`
   - Is posted: ✅ (check this box to make it visible to students)
4. Click **"Save"**

#### Create Questions:
1. Click on **"Questions"** in the admin panel
2. Click **"Add Question"**
3. Fill in:
   - Module: Select the module you just created
   - Question text: `What was the main theme of this chapter? Do you agree?`
   - Question type: `written` (or `audio`, `multiple_choice`, `video`)
   - Question order: `1`
   - Score total: `10`
   - MCQ options: (leave empty for written/audio questions)
4. Click **"Save"**
5. Repeat to add more questions (order 2, 3, etc.)

#### Enroll a Student in a Course:
1. First, make sure you have a student user (register via the frontend or create in admin)
2. Click on **"Course to students"** in the admin panel
3. Click **"Add Course to students"**
4. Fill in:
   - Course: Select your course
   - User: Select the student user
5. Click **"Save"**

---

## Method 2: Using API Calls

### Step 1: Get Your Auth Token

First, log in to get your JWT token:

```bash
curl -X POST http://127.0.0.1:8000/api/token/ \
  -H "Content-Type: application/json" \
  -d '{"email":"your-admin@email.com","password":"your-password"}'
```

Copy the `access` token from the response.

### Step 2: Create a Course

```bash
curl -X POST http://127.0.0.1:8000/api/courses/ \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "course_name": "Introduction to Computer Science",
    "course_description": "Learn the fundamentals of programming",
    "zoom_link": "https://zoom.us/j/123456789",
    "score_total": 100
  }'
```

Note the `id` from the response (e.g., `1`).

### Step 3: Create a Module

```bash
curl -X POST http://127.0.0.1:8000/api/modules/ \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "course": 1,
    "module_name": "Module 1: Chapters 1 - 5",
    "module_description": "Introduction to programming basics",
    "youtube_link": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "module_order": 1,
    "score_total": 25,
    "is_posted": true
  }'
```

Note the `id` from the response (e.g., `1`).

### Step 4: Create Questions

```bash
curl -X POST http://127.0.0.1:8000/api/modules/1/question \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "question_text": "What was the main theme of this chapter? Do you agree?",
    "question_type": "written",
    "question_order": 1,
    "score_total": 10
  }'
```

Repeat for more questions (change `question_order` to 2, 3, etc.).

### Step 5: Enroll a Student

```bash
curl -X POST http://127.0.0.1:8000/api/courses/1/users \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "user_id": 1
  }'
```

Replace `1` with the actual user ID of the student.

---

## Quick Test Data Script

You can also create a Django management command to quickly populate test data. Would you like me to create that?

---

## Tips:

1. **Make sure modules are posted**: Check the "Is posted" checkbox when creating modules, otherwise students won't see them.

2. **Module order matters**: Use sequential numbers (1, 2, 3...) for module_order to control the display order.

3. **Question order matters**: Use sequential numbers for question_order within each module.

4. **Enroll users**: Students need to be enrolled in courses via `CourseToStudents` to see the modules.

5. **Teacher access**: Teachers need to be added via `CourseToTeachers` to manage courses.

