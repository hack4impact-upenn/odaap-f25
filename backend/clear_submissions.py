#!/usr/bin/env python
"""
Script to clear all student submissions/responses from the database.
Run this from the backend directory: python clear_submissions.py
"""
import os
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from core.models import Submission, UserQuestionGrade, UserModuleGrade, UserCourseGrade

def clear_submissions():
    print("=" * 60)
    print("Clearing Student Submissions and Grades")
    print("=" * 60)
    
    # Count before deletion
    submission_count = Submission.objects.count()
    question_grade_count = UserQuestionGrade.objects.count()
    module_grade_count = UserModuleGrade.objects.count()
    course_grade_count = UserCourseGrade.objects.count()
    
    print(f"\n📊 Current counts:")
    print(f"   Submissions: {submission_count}")
    print(f"   Question Grades: {question_grade_count}")
    print(f"   Module Grades: {module_grade_count}")
    print(f"   Course Grades: {course_grade_count}")
    
    if submission_count == 0 and question_grade_count == 0:
        print("\n✅ No submissions or grades to delete.")
        return
    
    # Delete all submissions
    print(f"\n🗑️  Deleting {submission_count} submission(s)...")
    Submission.objects.all().delete()
    
    # Delete all question grades
    print(f"🗑️  Deleting {question_grade_count} question grade(s)...")
    UserQuestionGrade.objects.all().delete()
    
    # Delete all module grades
    print(f"🗑️  Deleting {module_grade_count} module grade(s)...")
    UserModuleGrade.objects.all().delete()
    
    # Delete all course grades
    print(f"🗑️  Deleting {course_grade_count} course grade(s)...")
    UserCourseGrade.objects.all().delete()
    
    print("\n" + "=" * 60)
    print("✅ All student submissions and grades have been cleared!")
    print("=" * 60)
    print("\n📝 Students can now start fresh with their submissions.")

if __name__ == '__main__':
    confirm = input("This will delete ALL student submissions and grades. Continue? (yes/no): ")
    if confirm.lower() == 'yes':
        clear_submissions()
    else:
        print("Operation cancelled.")

