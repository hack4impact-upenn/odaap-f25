from django.shortcuts import render
from rest_framework import viewsets
<<<<<<< Updated upstream
from rest_framework.permissions import IsAuthenticated
from rest_framework.authentication import TokenAuthentication
from .models import Course
from .serializers import CourseSerializer


class CourseViewSet(viewsets.ModelViewSet):
    queryset = Course.objects.all()
    serializer_class = CourseSerializer
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]
=======
from rest_framework.decorators import action, api_view
from rest_framework.response import Response
from rest_framework import status
from django.shortcuts import get_object_or_404
from .models import Course, User, CourseToStudents, CourseToTeachers, Module
from .serializers import CourseSerializer, ModuleSerializer

# Example view (keep if you want)
@api_view(["GET"])
def hello(request):
    return Response({"message": "Hello World"})

# Course ViewSet using ModelViewSet
class CourseViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Course model.
    Automatically provides: list, create, retrieve, update, partial_update, destroy
    Plus custom actions below.
    """
    queryset = Course.objects.all()
    serializer_class = CourseSerializer

    @action(detail=False, methods=['get'], url_path='userid=(?P<user_id>[^/.]+)')
    def get_all_enrolled_courses(self, request, user_id=None):
        """
        GET /api/courses/userid={id}
        Query CourseToStudents and/or CourseToTeachers to find all courses 
        associated with the provided user_id.
        Returns an array of course objects.
        """
        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response(
                {"error": "User not found"},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Get courses from CourseToStudents table
        student_courses = Course.objects.filter(
            coursetostudents__user=user
        ).distinct()
        
        # Get courses from CourseToTeachers table
        teacher_courses = Course.objects.filter(
            coursetoteachers__user=user
        ).distinct()
        
        # Combine and get unique courses
        all_courses = (student_courses | teacher_courses).distinct()
        
        # Serialize and return
        serializer = self.get_serializer(all_courses, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)
    
    @action(detail=True, methods=['post'], url_path='users')
    def add_user_to_course(self, request, pk=None):
        """
        POST /api/courses/{course_id}/users
        user_id provided in the request body.
        Check if user is student/teacher and add to appropriate table.
        """
        course = self.get_object()
        user_id = request.data.get('user_id')
        
        if not user_id:
            return Response(
                {"error": "user_id is required"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response(
                {"error": "User not found"},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Check if user is student or teacher and add accordingly
        if user.isStudent:
            course_student, created = CourseToStudents.objects.get_or_create(
                course=course,
                user=user
            )
            if not created:
                return Response(
                    {"message": "User is already enrolled as a student"},
                    status=status.HTTP_400_BAD_REQUEST
                )
            return Response(
                {"message": "Student added to course successfully"},
                status=status.HTTP_200_OK
            )
        else:
            course_teacher, created = CourseToTeachers.objects.get_or_create(
                course=course,
                user=user
            )
            if not created:
                return Response(
                    {"message": "User is already enrolled as a teacher"},
                    status=status.HTTP_400_BAD_REQUEST
                )
            return Response(
                {"message": "Teacher added to course successfully"},
                status=status.HTTP_200_OK
            )
    
    @action(detail=True, methods=['delete'], url_path='users')
    def remove_user_from_course(self, request, pk=None):
        """
        DELETE /api/courses/{course_id}/users
        user_id provided in the request body.
        Check if user is student/teacher and remove from appropriate table.
        """
        course = self.get_object()
        user_id = request.data.get('user_id')
        
        if not user_id:
            return Response(
                {"error": "user_id is required"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response(
                {"error": "User not found"},
                status=status.HTTP_404_NOT_FOUND
            )
        
        removed = False
        
        if CourseToStudents.objects.filter(course=course, user=user).exists():
            CourseToStudents.objects.filter(course=course, user=user).delete()
            removed = True
        
        if CourseToTeachers.objects.filter(course=course, user=user).exists():
            CourseToTeachers.objects.filter(course=course, user=user).delete()
            removed = True
        
        if removed:
            return Response(
                {"message": "User removed from course successfully"},
                status=status.HTTP_200_OK
            )
        else:
            return Response(
                {"error": "User is not enrolled in this course"},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    @action(detail=True, methods=['put'], url_path='zoom')
    def edit_course_zoom_link(self, request, pk=None):
        """
        PUT /api/courses/{course_id}/zoom
        New zoom link provided in the request body.
        Replaces zoom_link with new link.
        """
        course = self.get_object()
        zoom_link = request.data.get('zoom_link')
        
        if zoom_link is None:
            return Response(
                {"error": "zoom_link is required"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        course.zoom_link = zoom_link
        course.save()
        
        serializer = self.get_serializer(course)
        return Response(serializer.data, status=status.HTTP_200_OK)


# Module ViewSet using ModelViewSet
class ModuleViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Module model.
    Automatically provides: list, create, retrieve, update, partial_update, destroy
    """
    queryset = Module.objects.all()
    serializer_class = ModuleSerializer
>>>>>>> Stashed changes
