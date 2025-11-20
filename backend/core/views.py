from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404
from .models import Course, CourseToStudents, CourseToTeachers, Module
from .serializers import CourseSerializer, ModuleSerializer

# Course ViewSet using ModelViewSet
class CourseViewSet(viewsets.ModelViewSet):
    serializer_class = CourseSerializer
    permission_classes = [IsAuthenticated]

    # gets the courses the user is enrolled in
    def get_queryset(self):
        user = self.request.user
        
        # Check if user is a student (field is isStudent, not is_student)
        if user.isStudent:
            return Course.objects.filter(coursetostudents__user=user).distinct()
            
        else:  # teacher
            # Get courses where user is a teacher
            return Course.objects.filter(coursetoteachers__user=user).distinct()
    
    @action(detail=True, methods=['get'], url_path='modules')
    def get_course_modules(self, request, pk=None):
        """
        Get all modules for a specific course.
        Usage: GET /api/courses/{course_id}/modules/
        
        The course_id is automatically available as 'pk' parameter.
        """
        # Get course_id from URL parameter
        course_id = pk
        
        # see if course exists
        try:
            course = Course.objects.get(id=course_id)
        except Course.DoesNotExist:
            return Response(
                {"error": "Course not found"}, 
                status=404
            )
        
        # Verify user has access to this course
        user = self.request.user
        if user.isStudent:
            has_access = CourseToStudents.objects.filter(course=course, user=user).exists()
        else:
            has_access = CourseToTeachers.objects.filter(course=course, user=user).exists()
        
        if not has_access:
            return Response(
                {"error": "You don't have access to this course"}, 
                status=403
            )
        
        # Get modules for this course
        modules = Module.objects.filter(course=course).order_by('module_order')
        serializer = ModuleSerializer(modules, many=True)
        return Response(serializer.data)

class ModuleViewSet(viewsets.ModelViewSet):
    serializer_class = ModuleSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """
        Get modules filtered by course_id from query parameter.
        Usage: GET /api/modules/?course_id=1
        """
        queryset = Module.objects.all()
        
        # Get course_id from query parameters
        course_id = self.request.query_params.get('course_id', None)
        
        if course_id:
            # Verify user has access to this course
            user = self.request.user
            if user.isStudent:
                user_courses = Course.objects.filter(coursetostudents__user=user)
            else:
                user_courses = Course.objects.filter(coursetoteachers__user=user)
            
            # Check if the requested course_id is in user's courses
            if user_courses.filter(id=course_id).exists():
                queryset = queryset.filter(course_id=course_id)
            else:
                # User doesn't have access to this course, return empty queryset
                return Module.objects.none()
        else:
            # If no course_id provided, return all modules from user's courses
            user = self.request.user
            if user.isStudent:
                user_courses = Course.objects.filter(coursetostudents__user=user)
            else:
                user_courses = Course.objects.filter(coursetoteachers__user=user)
            
            queryset = queryset.filter(course__in=user_courses)
        
        return queryset
        


