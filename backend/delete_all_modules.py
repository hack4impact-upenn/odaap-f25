#!/usr/bin/env python
"""
Script to delete ALL modules from the database.
Run this from the backend directory: python delete_all_modules.py
"""
import os
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from core.models import Course, Module

def delete_all_modules():
    print("=" * 60)
    print("Deleting ALL Modules from Database")
    print("=" * 60)
    
    # Get all courses
    courses = Course.objects.all()
    
    if not courses.exists():
        print("\n❌ No courses found in the database.")
        return
    
    total_deleted = 0
    
    for course in courses:
        print(f"\n📚 Course: {course.course_name}")
        
        # Get all modules for this course
        modules = Module.objects.filter(course=course)
        module_count = modules.count()
        
        if module_count == 0:
            print(f"   ⚠️  No modules found for this course")
            continue
        
        print(f"   📦 Found {module_count} module(s):")
        for module in modules:
            print(f"      - {module.module_name} (Order: {module.module_order})")
        
        # Delete all modules (related data will be deleted via CASCADE)
        deleted_count, _ = modules.delete()
        total_deleted += deleted_count
        print(f"   ✅ Deleted {deleted_count} module(s)")
    
    print("\n" + "=" * 60)
    print(f"✅ Deletion complete! Deleted {total_deleted} total module(s).")
    print("=" * 60)
    print("\n📝 All modules and their related data (questions, submissions, grades) have been deleted.")
    print("   You can now create new modules from scratch.")

if __name__ == '__main__':
    confirm = input("⚠️  WARNING: This will delete ALL modules from ALL courses. This cannot be undone!\nContinue? (yes/no): ")
    if confirm.lower() == 'yes':
        delete_all_modules()
    else:
        print("Operation cancelled.")
