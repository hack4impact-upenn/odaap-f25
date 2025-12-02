#!/usr/bin/env python
"""
Quick script to create test data for development.
Run this from the backend directory: python create_test_data.py
"""
import os
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from core.models import Course, Module, Question, User, CourseToStudents

def create_test_data():
    print("Creating test data...")
    
    # Get or create course
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
    
    # Get or create module
    module, created = Module.objects.get_or_create(
        module_name="Module 1: Chapters 1 - 5",
        course=course,
        defaults={
            'module_description': 'Introduction to programming basics',
            'module_order': 1,
            'score_total': 25,
            'is_posted': True
        }
    )
    if created:
        print(f"✓ Created module: {module.module_name}")
    else:
        print(f"✓ Using existing module: {module.module_name}")
        # Make sure it's posted
        if not module.is_posted:
            module.is_posted = True
            module.save()
            print(f"  → Set module as posted")
    
    # Create questions
    questions_data = [
        {
            'question_text': 'What was the main theme of this chapter? Do you agree?',
            'question_type': 'written',
            'question_order': 1,
            'score_total': 10
        },
        {
            'question_text': 'What was the main theme of this chapter? Do you agree?',
            'question_type': 'written',
            'question_order': 2,
            'score_total': 10
        },
        {
            'question_text': 'What was the main theme of this chapter? Do you agree?',
            'question_type': 'written',
            'question_order': 3,
            'score_total': 10
        },
    ]
    
    for q_data in questions_data:
        question, created = Question.objects.get_or_create(
            module=module,
            question_order=q_data['question_order'],
            defaults=q_data
        )
        if created:
            print(f"✓ Created question {q_data['question_order']}")
        else:
            print(f"✓ Question {q_data['question_order']} already exists")
    
    # Enroll all students in the course
    students = User.objects.filter(isStudent=True)
    enrolled_count = 0
    for student in students:
        enrollment, created = CourseToStudents.objects.get_or_create(
            course=course,
            user=student
        )
        if created:
            enrolled_count += 1
            print(f"✓ Enrolled student: {student.get_full_name()} ({student.email})")
    
    if enrolled_count == 0:
        print("ℹ No new students enrolled (they may already be enrolled)")
    else:
        print(f"✓ Enrolled {enrolled_count} student(s)")
    
    print("\n✅ Test data setup complete!")
    print(f"\nCourse ID: {course.id}")
    print(f"Module ID: {module.id}")
    print(f"Module is posted: {module.is_posted}")
    print(f"\nStudents enrolled: {CourseToStudents.objects.filter(course=course).count()}")

if __name__ == '__main__':
    create_test_data()

