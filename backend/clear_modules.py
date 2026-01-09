#!/usr/bin/env python
"""
Script to clear modules and keep only the first 3 modules per course.
Run this from the backend directory: python clear_modules.py
"""
import os
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from core.models import Course, Module, Question, Submission, UserModuleGrade, UserQuestionGrade

def clear_modules():
    print("=" * 60)
    print("Clearing modules - keeping only first 3 per course")
    print("=" * 60)
    
    # Get all courses
    courses = Course.objects.all()
    
    if not courses.exists():
        print("No courses found.")
        return
    
    total_deleted = 0
    
    for course in courses:
        print(f"\nProcessing course: {course.course_name}")
        
        # Get all modules for this course, ordered by module_order
        modules = Module.objects.filter(course=course).order_by('module_order')
        
        if modules.count() <= 3:
            print(f"  Course already has {modules.count()} modules (≤3), skipping...")
            continue
        
        # Keep first 3 modules
        modules_to_keep = modules[:3]
        modules_to_delete = modules[3:]
        
        print(f"  Keeping {len(modules_to_keep)} modules:")
        for module in modules_to_keep:
            print(f"    - {module.module_name} (Order: {module.module_order})")
        
        print(f"  Deleting {len(modules_to_delete)} modules:")
        for module in modules_to_delete:
            print(f"    - {module.module_name} (Order: {module.module_order})")
            
            # Delete related data
            # Questions will be deleted via CASCADE
            # Submissions will be deleted via CASCADE
            # Grades will be deleted via CASCADE
            
            module.delete()
            total_deleted += 1
        
        # Set all remaining modules to unposted
        for module in modules_to_keep:
            if module.is_posted:
                module.is_posted = False
                module.save()
                print(f"  Set {module.module_name} to unposted")
    
    print("\n" + "=" * 60)
    print(f"✅ Cleanup complete! Deleted {total_deleted} modules.")
    print("=" * 60)
    print("\n📝 All remaining modules are now unposted.")
    print("   You can post them sequentially starting with Module 1.")

if __name__ == '__main__':
    confirm = input("This will delete all modules except the first 3 per course and set all to unposted. Continue? (yes/no): ")
    if confirm.lower() == 'yes':
        clear_modules()
    else:
        print("Operation cancelled.")
