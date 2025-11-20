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
            # Get courses where user is a student
            # Django creates reverse relationship: CourseToStudents has ForeignKey to Course,
            # so we can query Course.objects.filter(coursetostudents__user=user)
            # This is equivalent to: get all Courses that have a CourseToStudents entry with this user
            return Course.objects.filter(coursetostudents__user=user).distinct()
            
            # Alternative approach (less efficient, but shows the relationship):
            # course_students = CourseToStudents.objects.filter(user=user)
            # course_ids = [cs.course_id for cs in course_students]
            # return Course.objects.filter(id__in=course_ids)
        else:  # teacher
            # Get courses where user is a teacher
            # Same concept: query Course backwards through CourseToTeachers relationship
            return Course.objects.filter(coursetoteachers__user=user).distinct()
    
    @action(detail=True, methods=['get'], url_path='modules')
    def get_course_modules(self, request, pk=None):
        """
        Get all modules for a specific course.
        Usage: GET /api/courses/{course_id}/modules/
        """
        course = self.get_object()  # Gets the course by pk
        modules = Module.objects.filter(course=course)
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
        


