#!/usr/bin/env python
"""Check student1 enrollment and module completion status"""
import os
import sys
import django

# Setup Django
sys.path.insert(0, os.path.dirname(__file__))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from core.models import User, Course, CourseToStudents, Module, Question, Submission

# Find student1
student1 = User.objects.filter(email='student1@odaap.com').first()
if student1:
    print(f'Student1: {student1.email} (ID: {student1.id})')
    print(f'Is Student: {student1.isStudent}')
    
    # Get enrolled courses
    enrolled_courses = Course.objects.filter(coursetostudents__user=student1)
    print(f'\nEnrolled in {enrolled_courses.count()} course(s):')
    for course in enrolled_courses:
        print(f'  - Course ID {course.id}: {course.course_name}')
        
        # Get modules for this course
        modules = Module.objects.filter(course=course).order_by('module_order')
        print(f'  Modules in this course ({modules.count()}):')
        for module in modules:
            questions = Question.objects.filter(module=module)
            submissions = Submission.objects.filter(user=student1, module=module)
            question_ids = set(questions.values_list('id', flat=True))
            submission_question_ids = set(submissions.values_list('question_id', flat=True))
            all_questions_submitted = question_ids.issubset(submission_question_ids) if question_ids else False
            
            print(f'    Module {module.module_order}: {module.module_name}')
            print(f'      Posted: {module.is_posted}')
            print(f'      Questions: {questions.count()}')
            print(f'      Submissions: {submissions.count()}')
            print(f'      All questions submitted: {all_questions_submitted}')
            if questions.count() > 0 and not all_questions_submitted:
                missing = question_ids - submission_question_ids
                print(f'      Missing submissions for question IDs: {missing}')
            print()
else:
    print('Student1 not found')
