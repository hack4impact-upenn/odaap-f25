#!/usr/bin/env python
"""
Comprehensive script to create test data for development.
Run this from the backend directory: python create_test_data.py
"""
import os
import django
from datetime import datetime, timedelta
from django.utils import timezone

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from core.models import (
    Course, Module, Question, User, CourseToStudents, CourseToTeachers,
    QuestionToCorrectAnswers
)

def create_test_data():
    print("=" * 60)
    print("Creating comprehensive test data...")
    print("=" * 60)
    
    # Create or get users
    print("\n1. Creating users...")
    
    # Create a teacher
    teacher, created = User.objects.get_or_create(
        email='teacher@odaap.com',
        defaults={
            'username': 'teacher@odaap.com',
            'first_name': 'Valencia',
            'last_name': 'Teacher',
            'isStudent': False
        }
    )
    if created:
        teacher.set_password('password123')
        teacher.save()
        print(f"✓ Created teacher: {teacher.get_full_name()} ({teacher.email})")
    else:
        print(f"✓ Using existing teacher: {teacher.get_full_name()}")
    
    # Create students
    students_data = [
        {'email': 'student1@odaap.com', 'first_name': 'John', 'last_name': 'Doe'},
        {'email': 'student2@odaap.com', 'first_name': 'Student', 'last_name': 'One'},
        {'email': 'student3@odaap.com', 'first_name': 'Late', 'last_name': 'Doe'},
    ]
    
    created_students = []
    for student_data in students_data:
        student, created = User.objects.get_or_create(
            email=student_data['email'],
            defaults={
                'username': student_data['email'],
                'first_name': student_data['first_name'],
                'last_name': student_data['last_name'],
                'isStudent': True
            }
        )
        if created:
            student.set_password('password123')
            student.save()
            print(f"✓ Created student: {student.get_full_name()} ({student.email})")
        else:
            print(f"✓ Using existing student: {student.get_full_name()}")
        created_students.append(student)
    
    # Create course
    print("\n2. Creating course...")
    course, created = Course.objects.get_or_create(
        course_name="Fall 25",
        defaults={
            'course_description': 'Introduction to Computer Science',
            'zoom_link': 'https://zoom.us/j/123456789',
            'score_total': 100
        }
    )
    if created:
        print(f"✓ Created course: {course.course_name}")
    else:
        print(f"✓ Using existing course: {course.course_name}")
        # Update zoom link if needed
        if not course.zoom_link:
            course.zoom_link = 'https://zoom.us/j/123456789'
            course.save()
    
    # Enroll teacher
    teacher_enrollment, created = CourseToTeachers.objects.get_or_create(
        course=course,
        user=teacher
    )
    if created:
        print(f"✓ Enrolled teacher: {teacher.get_full_name()}")
    
    # Enroll students
    print("\n3. Enrolling students...")
    for student in created_students:
        enrollment, created = CourseToStudents.objects.get_or_create(
            course=course,
            user=student
        )
        if created:
            print(f"✓ Enrolled student: {student.get_full_name()}")
    
    # Create modules
    print("\n4. Creating modules...")
    modules_data = [
        {
            'module_name': 'Module 1: Chapters 1 - 5',
            'module_description': 'Description of the module',
            'module_order': 1,
            'score_total': 25,
            'is_posted': True,
            'due_date': timezone.now() + timedelta(days=7)
        },
        {
            'module_name': 'Module 2: Chapters 1 - 5',
            'module_description': 'Description of the module',
            'module_order': 2,
            'score_total': 25,
            'is_posted': True,
            'due_date': timezone.now() + timedelta(days=14)
        },
        {
            'module_name': 'Module 3: Chapters 1 - 5',
            'module_description': 'Description of the module',
            'module_order': 3,
            'score_total': 25,
            'is_posted': False,
            'due_date': timezone.now() + timedelta(days=21)
        },
        {
            'module_name': 'Module 4: Chapters 1 - 5',
            'module_description': 'Description of the module',
            'module_order': 4,
            'score_total': 25,
            'is_posted': False,
            'due_date': timezone.now() + timedelta(days=28)
        },
    ]
    
    created_modules = []
    for module_data in modules_data:
        due_date = module_data.pop('due_date')
        module, created = Module.objects.get_or_create(
            module_name=module_data['module_name'],
            course=course,
            defaults=module_data
        )
        if created:
            module.due_date = due_date
            module.save()
            print(f"✓ Created module: {module.module_name} (Posted: {module.is_posted})")
        else:
            # Update if needed
            if not module.due_date:
                module.due_date = due_date
                module.save()
            print(f"✓ Using existing module: {module.module_name}")
        created_modules.append(module)
    
    # Create questions for Module 2 (to show expanded questions)
    print("\n5. Creating questions...")
    module2 = created_modules[1]  # Module 2
    
    questions_data = [
        {
            'question_text': 'What does Dr. Perry mean by "Emotional Contagion"?',
            'question_type': 'written',
            'question_order': 1,
            'score_total': 10,
            'correct_answers': ['Emotional contagion is the phenomenon of having one person\'s emotions trigger similar emotions in other people.']
        },
        {
            'question_text': 'How do we marginalize others trauma?',
            'question_type': 'multiple_choice',
            'question_order': 2,
            'score_total': 10,
            'mcq_options': [
                'By ignoring their experiences',
                'By invalidating their feelings',
                'By comparing their trauma to others',
                'All of the above'
            ],
            'correct_answers': ['All of the above']
        },
        {
            'question_text': 'How do we marginalize others trauma?',
            'question_type': 'written',
            'question_order': 3,
            'score_total': 10,
            'correct_answers': []
        },
        {
            'question_text': 'How do we marginalize others trauma?',
            'question_type': 'video',
            'question_order': 4,
            'score_total': 10,
            'correct_answers': []
        },
    ]
    
    for q_data in questions_data:
        correct_answers = q_data.pop('correct_answers', [])
        mcq_options = q_data.pop('mcq_options', None)
        
        question, created = Question.objects.get_or_create(
            module=module2,
            question_order=q_data['question_order'],
            defaults=q_data
        )
        
        if created:
            # Set MCQ options if provided
            if mcq_options:
                question.mcq_options = mcq_options
                question.save()
            
            # Create correct answers
            for answer in correct_answers:
                QuestionToCorrectAnswers.objects.create(
                    question=question,
                    correct_answer=answer
                )
            print(f"✓ Created question {q_data['question_order']}: {q_data['question_type']}")
        else:
            print(f"✓ Question {q_data['question_order']} already exists")
    
    # Create questions for Module 1
    module1 = created_modules[0]
    for i in range(1, 6):
        question, created = Question.objects.get_or_create(
            module=module1,
            question_order=i,
            defaults={
                'question_text': f'Question {i} for Module 1',
                'question_type': 'written',
                'score_total': 5
            }
        )
        if created:
            print(f"✓ Created question {i} for Module 1")
    
    print("\n" + "=" * 60)
    print("✅ Test data setup complete!")
    print("=" * 60)
    print(f"\n📊 Summary:")
    print(f"   Course: {course.course_name} (ID: {course.id})")
    print(f"   Modules: {len(created_modules)}")
    print(f"   Teacher: {teacher.get_full_name()} ({teacher.email})")
    print(f"   Students: {len(created_students)}")
    print(f"\n🔑 Login Credentials:")
    print(f"   Teacher: teacher@odaap.com / password123")
    print(f"   Student 1: student1@odaap.com / password123")
    print(f"   Student 2: student2@odaap.com / password123")
    print(f"   Student 3: student3@odaap.com / password123")
    print(f"\n📝 Module Status:")
    for module in created_modules:
        questions_count = Question.objects.filter(module=module).count()
        print(f"   {module.module_name}: {'Posted' if module.is_posted else 'Not Posted'} ({questions_count} questions)")

if __name__ == '__main__':
    create_test_data()
