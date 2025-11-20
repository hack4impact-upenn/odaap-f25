from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from .models import Course, User, CourseToStudents, CourseToTeachers, Module
from .serializers import CourseSerializer
from django.contrib.auth import get_user_model

User = get_user_model()

# Course ViewSet using ModelViewSet
class CourseViewSet(viewsets.ModelViewSet):
    serializer_class = CourseSerializer
    permission_classes = [IsAuthenticated]

    # gets the courses the user is enrolled in
    def get_queryset(self):
        if self.request.user.is_student:
            return CourseToStudents.objects.filter(students=self.request.user)
        else:  # teacher
            return CourseToTeachers.objects.filter(teachers=self.request.user)
        


