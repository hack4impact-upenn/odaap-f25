# API Endpoints Documentation

## Base URL
All endpoints are prefixed with `/api/`

## Authentication
All endpoints require JWT authentication. Include token in header:
```
Authorization: Bearer <token>
```

---

## Course Endpoints

### Get All Enrolled Courses
**GET** `/api/courses/userid={user_id}`

Returns all courses associated with the provided user_id (as student or teacher).

**Response:** Array of course objects

---

### Get Course
**GET** `/api/courses/{course_id}/`

Returns a specific course by ID.

**Response:** Course object (200)  
**Errors:** 404 if course not found

---

### Create Course
**POST** `/api/courses/`

Creates a new course.

**Request Body:**
```json
{
  "course_name": "Course Name",
  "course_description": "Description",
  "zoom_link": "https://zoom.us/...",
  "score_total": 100
}
```

**Response:** Created course object (201)

---

### Add User to Course
**POST** `/api/courses/{course_id}/users`

Adds a user to the course as student or teacher (based on user's isStudent field).

**Request Body:**
```json
{
  "user_id": 1
}
```

**Response:** Success message (200)

---

### Remove User from Course
**DELETE** `/api/courses/{course_id}/users`

Removes a user from the course.

**Request Body:**
```json
{
  "user_id": 1
}
```

**Response:** Success message (200)

---

### Edit Course Zoom Link
**PUT** `/api/courses/{course_id}/zoom`

Updates the zoom_link for a course.

**Request Body:**
```json
{
  "zoom_link": "https://zoom.us/j/..."
}
```

**Response:** Updated course object (200)

---

### Get Course Modules
**GET** `/api/courses/{course_id}/modules/`

Returns all modules for a specific course, ordered by module_order.

**Response:** Array of module objects

---

## Module Endpoints

### Get All Modules
**GET** `/api/modules/`

Returns all modules. Can filter by `course_id` query parameter:
- `GET /api/modules/?course_id=1`

**Response:** Array of module objects

---

### Get Module
**GET** `/api/modules/{module_id}/`

Returns a specific module by ID.

**Response:** Module object (200)  
**Errors:** 404 if module not found

---

### Create Module
**POST** `/api/modules/`

Creates a new module.

**Request Body:**
```json
{
  "course": 1,
  "module_name": "Module Name",
  "module_description": "Description",
  "youtube_link": "https://youtube.com/watch?v=...",
  "module_order": 1,
  "score_total": 100,
  "is_posted": false
}
```

**Response:** Created module object (201)

---

### Update Module
**PUT/PATCH** `/api/modules/{module_id}/`

Updates a module.

**Response:** Updated module object (200)

---

### Delete Module
**DELETE** `/api/modules/{module_id}/`

Deletes a module.

**Response:** 204 No Content

---

### Get All Questions in Module
**GET** `/api/modules/{module_id}/questions`

Returns all questions for a specific module, ordered by question_order.

**Response:** Array of question objects

---

### Create Question in Module
**POST** `/api/modules/{module_id}/question`

Creates a new question in a module. (Teachers only)

**Request Body:**
```json
{
  "question_text": "What is...?",
  "question_type": "multiple_choice",
  "mcq_options": ["Option 1", "Option 2", "Option 3"],
  "correct_answers": ["Option 1"],
  "question_order": 1,
  "score_total": 10
}
```

**Response:** Created question object (201)

---

## Question Endpoints

### Get Question
**GET** `/api/questions/questionid={question_id}?module_id={module_id}`

Returns a specific question by ID. Requires module_id as query parameter.

**Response:** Question object (200)  
**Errors:** 404 if question or module not found

---

### Get All Questions
**GET** `/api/questions/`

Returns all questions. Can filter by `module_id` query parameter:
- `GET /api/questions/?module_id=1`

**Response:** Array of question objects

---

### Create Question
**POST** `/api/questions/`

Creates a new question. (Teachers only)

**Request Body:**
```json
{
  "module_id": 1,
  "question_text": "What is...?",
  "question_type": "written",
  "mcq_options": null,
  "correct_answers": ["Answer"],
  "question_order": 1,
  "score_total": 10
}
```

**Response:** Created question object (201)

---

### Update Question
**PUT/PATCH** `/api/questions/{question_id}/`

Updates a question. Only works if module is posted.

**Request Body:** Same as create

**Response:** Updated question object (200)  
**Errors:** 400 if module is not posted

---

### Delete Question
**DELETE** `/api/questions/{question_id}/`

Deletes a question. Only works if module is NOT posted.

**Response:** 204 No Content  
**Errors:** 400 if module is posted

---

## Submission Endpoints

### Submit Answer
**POST** `/api/submissions/`

Submits an answer to a question.

**Request Body:**
```json
{
  "question_id": 1,
  "module_id": 1,
  "submission_type": "written",
  "response": "My answer text"
}
```

**Response:** Created submission object (201)

---

### Submit Answer (Alternative)
**POST** `/api/submissions/questions/{question_id}/submit`

Alternative endpoint to submit an answer to a specific question.

**Request Body:**
```json
{
  "module_id": 1,
  "submission_type": "written",
  "response": "My answer text"
}
```

**Response:** Created submission object (201)

---

### Get Submission
**GET** `/api/submissions/users/{user_id}/questions/{question_id}`

Returns submission for a specific user and question.

**Response:** Submission object (200)  
**Errors:** 404 if submission not found

---

### Get All Submissions
**GET** `/api/submissions/`

Returns all submissions for the current user. Can filter by:
- `question_id`: `GET /api/submissions/?question_id=1`
- `module_id`: `GET /api/submissions/?module_id=1`

**Response:** Array of submission objects

---

### Grade Submission
**POST** `/api/submissions/{submission_id}/grade`

Grades a submission.

**Request Body:**
```json
{
  "score": 8,
  "total": 10,
  "is_overdue": false
}
```

**Response:** Grade information (200)  
**Errors:** 400 if score > total

---

## Question Types

Available question types (enum):
- `multiple_choice`
- `audio`
- `written`
- `video`

---

## Notes

1. **YouTube Links**: Modules now support `youtube_link` field for embedding videos at the top of modules.

2. **MCQ Options**: Questions can have `mcq_options` (array of strings) for multiple choice questions.

3. **Correct Answers**: Questions can have multiple correct answers stored in `QuestionToCorrectAnswers` table.

4. **Access Control**: 
   - Students can only view courses/modules they're enrolled in
   - Teachers can view courses they teach
   - Only teachers can create/edit/delete questions

5. **Module Posting**: 
   - Questions can only be edited if module is posted
   - Questions can only be deleted if module is NOT posted

