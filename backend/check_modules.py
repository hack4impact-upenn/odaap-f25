#!/usr/bin/env python
"""
Script to check current modules in the database.
Run this from the backend directory: python check_modules.py
"""
import os
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from core.models import Course, Module, Question

def check_modules():
    print("=" * 60)
    print("Checking Modules in Database")
    print("=" * 60)
    
    # Get all courses
    courses = Course.objects.all()
    
    if not courses.exists():
        print("\n❌ No courses found in the database.")
        return
    
    total_modules = 0
    
    for course in courses:
        print(f"\n📚 Course: {course.course_name} (ID: {course.id})")
        
        # Get all modules for this course, ordered by module_order
        modules = Module.objects.filter(course=course).order_by('module_order')
        module_count = modules.count()
        total_modules += module_count
        
        if module_count == 0:
            print("   ⚠️  No modules found for this course")
        else:
            print(f"   📦 Total modules: {module_count}")
            print("\n   Modules:")
            for module in modules:
                questions_count = Question.objects.filter(module=module).count()
                status = "✅ Posted" if module.is_posted else "⏸️  Unposted"
                print(f"      {module.module_order}. {module.module_name}")
                print(f"         Status: {status}")
                print(f"         Questions: {questions_count}")
                print(f"         Order: {module.module_order}")
                if module.due_date:
                    print(f"         Due Date: {module.due_date.strftime('%Y-%m-%d')}")
                print()
    
    print("=" * 60)
    print(f"📊 Summary: {total_modules} total module(s) across {courses.count()} course(s)")
    print("=" * 60)
    
    if total_modules > 3:
        print(f"\n⚠️  Warning: You have {total_modules} modules. The cleanup script keeps only the first 3 per course.")
        print("   Run 'python clear_modules.py' to clean up.")
    elif total_modules == 0:
        print("\n💡 No modules found. Run 'python create_test_data.py' to create test data.")
    else:
        print("\n✅ Module count looks good!")

if __name__ == '__main__':
    check_modules()
