#!/usr/bin/env python
"""
Script to unpost all modules (set is_posted to False).
Run this from the backend directory: python unpost_all_modules.py
"""
import os
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from core.models import Course, Module

def unpost_all_modules():
    print("=" * 60)
    print("Unposting All Modules")
    print("=" * 60)
    
    # Get all courses
    courses = Course.objects.all()
    
    if not courses.exists():
        print("\n❌ No courses found in the database.")
        return
    
    total_unposted = 0
    
    for course in courses:
        print(f"\n📚 Course: {course.course_name}")
        
        # Get all modules for this course
        modules = Module.objects.filter(course=course)
        
        for module in modules:
            if module.is_posted:
                module.is_posted = False
                module.save()
                print(f"   ✅ Unposted: {module.module_name}")
                total_unposted += 1
            else:
                print(f"   ⏸️  Already unposted: {module.module_name}")
    
    print("\n" + "=" * 60)
    print(f"✅ Unposted {total_unposted} module(s).")
    print("=" * 60)
    print("\n📝 All modules are now unposted. You can post them sequentially starting with Module 1.")

if __name__ == '__main__':
    unpost_all_modules()

