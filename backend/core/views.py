import random
import string
import uuid
import boto3
from botocore.exceptions import ClientError
from rest_framework import viewsets, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.parsers import MultiPartParser, FormParser
from django.conf import settings as django_settings
from django.core.files.storage import default_storage
from django.core.files.base import ContentFile
from django.shortcuts import get_object_or_404
from django.http import Http404
from django.db.models import Q
from django.contrib.auth import get_user_model
from rest_framework_simplejwt.tokens import RefreshToken


def generate_enrollment_code(length=5):
    """Generate a unique random uppercase enrollment code."""
    while True:
        code = ''.join(random.choices(string.ascii_uppercase, k=length))
        if not Course.objects.filter(student_enrollment_code=code).exists():
            return code
from .models import (
    Course, CourseToStudents, CourseToTeachers, Module, Question, QuestionType,
    Submission, UserQuestionGrade, QuestionToCorrectAnswers, User, Announcement, Resource
)
from .serializers import (
    CourseSerializer, ModuleSerializer, QuestionSerializer, 
    SubmissionSerializer, UserSerializer, AnnouncementSerializer, ResourceSerializer
)

User = get_user_model()

# ============================================================================
# AUTHENTICATION VIEWS
# ============================================================================

@api_view(['POST'])
@permission_classes([AllowAny])
def register(request):
    """
    POST /api/register/
    Register a new user
    For students, enrollment_code is required to automatically enroll in a course
    """
    email = request.data.get('email')
    password = request.data.get('password')
    first_name = request.data.get('first_name')
    last_name = request.data.get('last_name')
    enrollment_code = request.data.get('enrollment_code', '').strip()
    
    if not all([email, password, first_name, last_name]):
        return Response(
            {'error': 'All fields are required'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    if not enrollment_code:
        return Response(
            {'error': 'Enrollment code is required'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    try:
        course = Course.objects.get(student_enrollment_code=enrollment_code)
    except Course.DoesNotExist:
        return Response(
            {'error': 'Invalid enrollment code. Please check with your teacher.'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    if User.objects.filter(email=email).exists():
        return Response(
            {'error': 'User with this email already exists'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    user = User.objects.create_user(
        username=email,
        email=email,
        password=password,
        first_name=first_name,
        last_name=last_name,
        isStudent=True
    )
    
    CourseToStudents.objects.get_or_create(
        course=course,
        user=user
    )
    
    # Generate tokens
    refresh = RefreshToken.for_user(user)
    
    return Response({
        'access': str(refresh.access_token),
        'refresh': str(refresh),
        'user': {
            'id': user.id,
            'email': user.email,
            'first_name': user.first_name,
            'last_name': user.last_name,
            'isStudent': user.isStudent,
        }
    }, status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def invite_teacher(request):
    """
    POST /api/invite-teacher/
    Allows an existing teacher to create a new teacher account
    and optionally add them to courses.
    """
    if request.user.isStudent:
        return Response(
            {'error': 'Only teachers can invite other teachers'},
            status=status.HTTP_403_FORBIDDEN
        )

    email = request.data.get('email')
    password = request.data.get('password')
    first_name = request.data.get('first_name')
    last_name = request.data.get('last_name')
    course_ids = request.data.get('course_ids', [])

    if not all([email, password, first_name, last_name]):
        return Response(
            {'error': 'Email, password, first name, and last name are all required'},
            status=status.HTTP_400_BAD_REQUEST
        )

    if User.objects.filter(email=email).exists():
        return Response(
            {'error': 'A user with this email already exists'},
            status=status.HTTP_400_BAD_REQUEST
        )

    new_teacher = User.objects.create_user(
        username=email,
        email=email,
        password=password,
        first_name=first_name,
        last_name=last_name,
        isStudent=False
    )

    added_courses = []
    for course_id in course_ids:
        try:
            course = Course.objects.get(id=course_id)
            is_requester_teacher = CourseToTeachers.objects.filter(
                course=course, user=request.user
            ).exists()
            if is_requester_teacher:
                CourseToTeachers.objects.get_or_create(course=course, user=new_teacher)
                added_courses.append(course.course_name)
        except Course.DoesNotExist:
            continue

    return Response({
        'message': 'Teacher account created successfully',
        'user': {
            'id': new_teacher.id,
            'email': new_teacher.email,
            'first_name': new_teacher.first_name,
            'last_name': new_teacher.last_name,
            'isStudent': new_teacher.isStudent,
        },
        'added_to_courses': added_courses
    }, status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def change_password(request):
    """
    POST /api/change-password/
    Authenticated user changes their own password.
    """
    current_password = request.data.get('current_password')
    new_password = request.data.get('new_password')

    if not current_password or not new_password:
        return Response(
            {'error': 'Current password and new password are required'},
            status=status.HTTP_400_BAD_REQUEST
        )

    if not request.user.check_password(current_password):
        return Response(
            {'error': 'Current password is incorrect'},
            status=status.HTTP_400_BAD_REQUEST
        )

    if len(new_password) < 6:
        return Response(
            {'error': 'New password must be at least 6 characters'},
            status=status.HTTP_400_BAD_REQUEST
        )

    request.user.set_password(new_password)
    request.user.save()

    return Response({'message': 'Password changed successfully'}, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def reset_user_password(request):
    """
    POST /api/reset-user-password/
    Teacher resets a student's or another teacher's password, or their own.
    For others, the target must share a course with the requesting teacher.
    """
    if request.user.isStudent:
        return Response(
            {'error': 'Only teachers can reset passwords'},
            status=status.HTTP_403_FORBIDDEN
        )

    user_id = request.data.get('user_id')
    new_password = request.data.get('new_password')

    if not user_id or not new_password:
        return Response(
            {'error': 'user_id and new_password are required'},
            status=status.HTTP_400_BAD_REQUEST
        )

    try:
        target_user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return Response(
            {'error': 'User not found'},
            status=status.HTTP_404_NOT_FOUND
        )

    # Teachers may always set a new password for themselves (no shared-course check).
    if target_user.id != request.user.id:
        teacher_courses = Course.objects.filter(coursetoteachers__user=request.user)
        shares_course = (
            CourseToStudents.objects.filter(course__in=teacher_courses, user=target_user).exists() or
            CourseToTeachers.objects.filter(course__in=teacher_courses, user=target_user).exists()
        )

        if not shares_course:
            return Response(
                {'error': 'You can only reset passwords for users in your courses'},
                status=status.HTTP_403_FORBIDDEN
            )

    if len(new_password) < 6:
        return Response(
            {'error': 'New password must be at least 6 characters'},
            status=status.HTTP_400_BAD_REQUEST
        )

    target_user.set_password(new_password)
    target_user.save()

    return Response({
        'message': f'Password reset successfully for {target_user.get_full_name()}'
    }, status=status.HTTP_200_OK)


# ============================================================================
# COURSE VIEWSET
# ============================================================================

class CourseViewSet(viewsets.ModelViewSet):
    serializer_class = CourseSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """Get courses the user is enrolled in"""
        user = self.request.user
        if user.isStudent:
            return Course.objects.filter(coursetostudents__user=user).distinct()
        else:
            return Course.objects.filter(coursetoteachers__user=user).distinct()
    
    def create(self, request, *args, **kwargs):
        """
        Create a new course and automatically enroll the creator as a teacher.
        Optionally copy modules and questions from a source course.
        """
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        course = serializer.save()
        
        if not course.student_enrollment_code:
            course.student_enrollment_code = generate_enrollment_code()
            course.save(update_fields=['student_enrollment_code'])
        
        # Automatically enroll the creator as a teacher
        if not request.user.isStudent:
            CourseToTeachers.objects.get_or_create(
                course=course,
                user=request.user
            )
        
        # If source_course_id is provided, copy modules and questions
        source_course_id = request.data.get('source_course_id')
        if source_course_id:
            try:
                source_course = Course.objects.get(id=source_course_id)
                # Verify user has access to source course
                if not request.user.isStudent:
                    has_access = CourseToTeachers.objects.filter(
                        course=source_course, user=request.user
                    ).exists()
                    if has_access:
                        self._copy_course_content(source_course, course)
            except Course.DoesNotExist:
                pass  # Silently ignore if source course doesn't exist
        
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)
    
    def _copy_course_content(self, source_course, target_course):
        """
        Copy all modules, questions, and resources from source_course to target_course.
        Removes due dates and sets is_posted to False.
        """
        source_modules = Module.objects.filter(course=source_course).order_by('module_order')
        
        for source_module in source_modules:
            new_module = Module.objects.create(
                course=target_course,
                module_name=source_module.module_name,
                module_description=source_module.module_description,
                youtube_link=source_module.youtube_link,
                module_order=source_module.module_order,
                score_total=source_module.score_total,
                is_posted=False,
                due_date=None
            )
            
            source_questions = Question.objects.filter(module=source_module).order_by('question_order')
            
            for source_question in source_questions:
                new_question = Question.objects.create(
                    module=new_module,
                    question_type=source_question.question_type,
                    question_text=source_question.question_text,
                    mcq_options=source_question.mcq_options,
                    question_order=source_question.question_order,
                    score_total=source_question.score_total
                )
                
                source_correct_answers = QuestionToCorrectAnswers.objects.filter(question=source_question)
                for source_answer in source_correct_answers:
                    QuestionToCorrectAnswers.objects.create(
                        question=new_question,
                        correct_answer=source_answer.correct_answer
                    )

        source_resources = Resource.objects.filter(course=source_course).order_by('order')
        for source_resource in source_resources:
            Resource.objects.create(
                course=target_course,
                title=source_resource.title,
                description=source_resource.description,
                links=source_resource.links,
                order=source_resource.order
            )
    
    @action(detail=False, methods=['get'], url_path='userid=(?P<user_id>[^/.]+)')
    def get_all_enrolled_courses(self, request, user_id=None):
        """
        GET /api/courses/userid={id}
        Returns all courses associated with the provided user_id
        """
        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response(
                {"error": "User not found"},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Get courses from CourseToStudents and CourseToTeachers
        student_courses = Course.objects.filter(coursetostudents__user=user).distinct()
        teacher_courses = Course.objects.filter(coursetoteachers__user=user).distinct()
        all_courses = (student_courses | teacher_courses).distinct()
        
        serializer = self.get_serializer(all_courses, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)
    
    @action(detail=True, methods=['post'], url_path='users')
    def add_user_to_course(self, request, pk=None):
        """
        POST /api/courses/{course_id}/users
        user_id provided in request body. Adds user as student or teacher.
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
                course=course, user=user
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
                course=course, user=user
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
        user_id provided in request body. Removes user from course.
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
    
    @action(detail=True, methods=['put', 'patch'], url_path='zoom')
    def edit_course_zoom_link(self, request, pk=None):
        """
        PUT /api/courses/{course_id}/zoom
        Updates the zoom_link for a course
        Only teachers of the course can update the zoom link
        """
        try:
            # Get the course object
            try:
                course = self.get_object()
            except Http404:
                return Response(
                    {"error": "Course not found"},
                    status=status.HTTP_404_NOT_FOUND
                )
            except Exception as e:
                return Response(
                    {"error": f"Error retrieving course: {str(e)}"},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )
            
            user = request.user
            
            # Check if user is a teacher
            if user.isStudent:
                return Response(
                    {"error": "Only teachers can update zoom links"},
                    status=status.HTTP_403_FORBIDDEN
                )
            
            # Verify user is a teacher of this course
            is_teacher = CourseToTeachers.objects.filter(course=course, user=user).exists()
            if not is_teacher:
                return Response(
                    {"error": "You are not a teacher of this course"},
                    status=status.HTTP_403_FORBIDDEN
                )
            
            zoom_link = request.data.get('zoom_link') or request.data.get('zoomLink')
            
            if zoom_link is None:
                return Response(
                    {"error": "zoom_link is required in request body"},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            try:
                course.zoom_link = zoom_link
                course.save(update_fields=['zoom_link'])
            except Exception as e:
                return Response(
                    {"error": f"Error saving zoom link: {str(e)}"},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )
            
            # Return updated course data
            try:
                serializer = self.get_serializer(course)
                return Response(serializer.data, status=status.HTTP_200_OK)
            except Exception as e:
                return Response(
                    {"error": f"Error serializing course: {str(e)}"},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )
            
        except Exception as e:
            import traceback
            error_trace = traceback.format_exc()
            # Log the error for debugging
            print(f"Error in edit_course_zoom_link: {error_trace}")
            return Response(
                {
                    "error": str(e),
                    "detail": "Failed to update zoom link",
                    "type": type(e).__name__
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=True, methods=['put', 'patch'], url_path='ceu-links')
    def update_ceu_links(self, request, pk=None):
        """
        PUT /api/courses/{course_id}/ceu-links
        Updates the CEU links for a course
        Only teachers of the course can update the CEU links
        """
        try:
            course = self.get_object()
            user = request.user
            
            # Check if user is a teacher
            if user.isStudent:
                return Response(
                    {"error": "Only teachers can update CEU links"},
                    status=status.HTTP_403_FORBIDDEN
                )
            
            # Verify user is a teacher of this course
            is_teacher = CourseToTeachers.objects.filter(course=course, user=user).exists()
            if not is_teacher:
                return Response(
                    {"error": "You are not a teacher of this course"},
                    status=status.HTTP_403_FORBIDDEN
                )
            
            # Get CEU links from request data
            ceu_credit_application_link = request.data.get('ceu_credit_application_link', '')
            ceu_act48_application_link = request.data.get('ceu_act48_application_link', '')
            ceu_program_evaluation_link = request.data.get('ceu_program_evaluation_link', '')
            
            # Update the CEU links
            course.ceu_credit_application_link = ceu_credit_application_link or None
            course.ceu_act48_application_link = ceu_act48_application_link or None
            course.ceu_program_evaluation_link = ceu_program_evaluation_link or None
            course.save(update_fields=['ceu_credit_application_link', 'ceu_act48_application_link', 'ceu_program_evaluation_link'])
            
            # Return updated course data
            serializer = self.get_serializer(course)
            return Response(serializer.data, status=status.HTTP_200_OK)
            
        except Exception as e:
            import traceback
            error_trace = traceback.format_exc()
            print(f"Error in update_ceu_links: {error_trace}")
            return Response(
                {
                    "error": str(e),
                    "detail": "Failed to update CEU links",
                    "type": type(e).__name__
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=True, methods=['get'], url_path='modules')
    def get_course_modules(self, request, pk=None):
        """
        GET /api/courses/{course_id}/modules/
        Get all modules for a specific course
        """
        course = self.get_object()
        modules = Module.objects.filter(course=course).order_by('module_order')
        serializer = ModuleSerializer(modules, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['get'], url_path='students')
    def get_course_students(self, request, pk=None):
        """
        GET /api/courses/{course_id}/students/
        Get all students enrolled in a course
        """
        course = self.get_object()
        # Verify user is a teacher for this course
        user = request.user
        if not CourseToTeachers.objects.filter(course=course, user=user).exists():
            return Response(
                {"error": "You don't have access to this course"},
                status=status.HTTP_403_FORBIDDEN
            )
        
        students = User.objects.filter(
            coursetostudents__course=course
        ).distinct()
        
        serializer = UserSerializer(students, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['get'], url_path='teachers')
    def get_course_teachers(self, request, pk=None):
        """
        GET /api/courses/{course_id}/teachers/
        Get all teachers for a course
        """
        course = self.get_object()
        teachers = User.objects.filter(
            coursetoteachers__course=course
        ).distinct()
        
        serializer = UserSerializer(teachers, many=True)
        return Response(serializer.data)

    def destroy(self, request, *args, **kwargs):
        course = self.get_object()
        user = request.user

        if user.isStudent:
            return Response(
                {"error": "Only teachers can delete courses"},
                status=status.HTTP_403_FORBIDDEN
            )

        if not CourseToTeachers.objects.filter(course=course, user=user).exists():
            return Response(
                {"error": "You are not a teacher for this course"},
                status=status.HTTP_403_FORBIDDEN
            )

        course.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

# ============================================================================
# MODULE VIEWSET
# ============================================================================

class ModuleViewSet(viewsets.ModelViewSet):
    serializer_class = ModuleSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """Get modules filtered by course_id from query parameter"""
        queryset = Module.objects.all()
        course_id = self.request.query_params.get('course_id', None)
        
        if course_id:
            user = self.request.user
            if user.isStudent:
                user_courses = Course.objects.filter(coursetostudents__user=user)
            else:
                user_courses = Course.objects.filter(coursetoteachers__user=user)
            
            if user_courses.filter(id=course_id).exists():
                queryset = queryset.filter(course_id=course_id)
            else:
                return Module.objects.none()
        else:
            user = self.request.user
            if user.isStudent:
                user_courses = Course.objects.filter(coursetostudents__user=user)
            else:
                user_courses = Course.objects.filter(coursetoteachers__user=user)
            queryset = queryset.filter(course__in=user_courses)
        
        return queryset.order_by('module_order')
    
    def retrieve(self, request, *args, **kwargs):
        """
        GET /api/modules/{module_id}/
        Retrieve a specific module
        """
        try:
            module = self.get_object()
        except Http404:
            return Response(
                {"error": "Module not found or you don't have access to it"},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Additional access check for students
        user = request.user
        if user.isStudent:
            has_access = CourseToStudents.objects.filter(
                course=module.course, user=user
            ).exists()
            if not has_access:
                return Response(
                    {"error": "You don't have access to this module"},
                    status=status.HTTP_403_FORBIDDEN
                )
        else:
            has_access = CourseToTeachers.objects.filter(
                course=module.course, user=user
            ).exists()
            if not has_access:
                return Response(
                    {"error": "You don't have access to this module"},
                    status=status.HTTP_403_FORBIDDEN
                )
        
        serializer = self.get_serializer(module)
        return Response(serializer.data)
    
    @action(detail=True, methods=['get'], url_path='questions')
    def get_all_questions(self, request, pk=None):
        """
        GET /api/modules/{module_id}/questions
        Get all questions for a specific module
        """
        module = self.get_object()
        
        # Verify user has access to this module's course
        user = self.request.user
        if user.isStudent:
            has_access = CourseToStudents.objects.filter(
                course=module.course, user=user
            ).exists()
            if not has_access:
                return Response(
                    {"error": "You don't have access to this module"},
                    status=status.HTTP_403_FORBIDDEN
                )
            
            # Check if module is accessible (all previous modules completed)
            if not self._is_module_accessible(module, user):
                return Response(
                    {"error": "You must complete all previous modules before accessing this one"},
                    status=status.HTTP_403_FORBIDDEN
                )
        else:
            has_access = CourseToTeachers.objects.filter(
                course=module.course, user=user
            ).exists()
            if not has_access:
                return Response(
                    {"error": "You don't have access to this module"},
                    status=status.HTTP_403_FORBIDDEN
                )
        
        questions = Question.objects.filter(module=module).order_by('question_order')
        serializer = QuestionSerializer(questions, many=True)
        return Response(serializer.data)

    def _multiple_choice_post_validation_errors(self, module):
        """Return human-readable errors if any MC question cannot be graded when posted."""
        errors = []
        for q in Question.objects.filter(module=module).order_by('question_order'):
            if q.question_type != QuestionType.MULTIPLE_CHOICE:
                continue
            opts = [str(o).strip() for o in (q.mcq_options or []) if str(o).strip()]
            if not opts:
                errors.append(
                    f"Multiple choice question #{q.question_order} has no answer choices."
                )
                continue
            correct = list(
                QuestionToCorrectAnswers.objects.filter(question=q).values_list(
                    "correct_answer", flat=True
                )
            )
            correct_clean = [str(c).strip() for c in correct if str(c).strip()]
            if not correct_clean:
                errors.append(
                    f"Multiple choice question #{q.question_order} needs a correct answer selected."
                )
                continue
            if not any(ca in opts for ca in correct_clean):
                errors.append(
                    f"Multiple choice question #{q.question_order}: correct answer must match one of the options."
                )
        return errors
    
    def _is_module_accessible(self, module, user):
        """
        Check if a module is accessible to a student.
        A module is accessible if:
        1. It is posted
        2. All previous modules (with lower module_order) are completed
        """
        if not module.is_posted:
            return False
        
        # Get all modules in the same course with lower order
        previous_modules = Module.objects.filter(
            course=module.course,
            module_order__lt=module.module_order,
            is_posted=True
        ).order_by('module_order')
        
        # Check if all previous modules are completed
        for prev_module in previous_modules:
            if not self._is_module_completed(prev_module, user):
                return False
        
        return True
    
    def _is_module_completed(self, module, user):
        """
        Check if a student has completed a module.
        A module is completed if all questions have submissions.
        """
        # Get all questions in the module
        questions = Question.objects.filter(module=module)
        if not questions.exists():
            return False  # No questions means not completed
        
        # Check if all questions have submissions
        for question in questions:
            submission_exists = Submission.objects.filter(
                question=question,
                user=user
            ).exists()
            if not submission_exists:
                return False
        
        return True
    
    @action(detail=True, methods=['get'], url_path='is-accessible')
    def check_module_accessibility(self, request, pk=None):
        """
        GET /api/modules/{module_id}/is-accessible
        Check if a module is accessible to the current user
        """
        module = self.get_object()
        user = request.user
        
        if user.isStudent:
            is_accessible = self._is_module_accessible(module, user)
            is_completed = self._is_module_completed(module, user)
            
            return Response({
                'is_accessible': is_accessible,
                'is_completed': is_completed,
                'is_posted': module.is_posted
            })
        else:
            # Teachers can always access modules
            return Response({
                'is_accessible': True,
                'is_completed': False,
                'is_posted': module.is_posted
            })
    
    @action(detail=True, methods=['post'], url_path='question')
    def create_question_in_module(self, request, pk=None):
        """
        POST /api/modules/{module_id}/question
        Create a new question in a module
        """
        try:
            module = self.get_object()
            
            # Check if module is posted (only teachers can create questions)
            if request.user.isStudent:
                return Response(
                    {"error": "Only teachers can create questions"},
                    status=status.HTTP_403_FORBIDDEN
                )
            
            # Create question
            question_data = request.data.copy() if hasattr(request.data, 'copy') else dict(request.data)
            question_data['module'] = module.id
            
            # Handle correct_answers if provided
            correct_answers = question_data.pop('correct_answers', [])
            if not isinstance(correct_answers, list):
                correct_answers = []
            
            serializer = QuestionSerializer(data=question_data)
            serializer.is_valid(raise_exception=True)
            question = serializer.save()
            
            # Create correct answer entries
            for answer in correct_answers:
                if answer:  # Only create if answer is not empty
                    QuestionToCorrectAnswers.objects.create(
                        question=question,
                        correct_answer=answer
                    )
            
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        except Exception as e:
            import traceback
            error_trace = traceback.format_exc()
            print(f"Error in create_question_in_module: {error_trace}")
            return Response(
                {
                    "error": str(e),
                    "detail": "Failed to create question",
                    "type": type(e).__name__
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    def update(self, request, *args, **kwargs):
        """
        PUT /api/modules/{module_id}/
        Update a module. Validates that modules can only be posted if all previous modules are posted.
        """
        partial = kwargs.pop('partial', False)
        module = self.get_object()
        
        # Check if trying to post the module (set is_posted to True)
        is_posted_in_request = request.data.get('is_posted', None)
        current_is_posted = module.is_posted
        
        # If trying to post a module (changing from False to True)
        if is_posted_in_request is True and not current_is_posted:
            # Check if all previous modules (with lower module_order) are posted
            previous_modules = Module.objects.filter(
                course=module.course,
                module_order__lt=module.module_order
            ).order_by('module_order')
            
            unposted_previous = [m for m in previous_modules if not m.is_posted]
            if unposted_previous:
                unposted_names = [m.module_name for m in unposted_previous]
                return Response(
                    {
                        "error": "Cannot post this module until all previous modules are posted.",
                        "unposted_modules": unposted_names,
                        "detail": f"You must post the following modules first: {', '.join(unposted_names)}"
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )

            mcq_errors = self._multiple_choice_post_validation_errors(module)
            if mcq_errors:
                return Response(
                    {
                        "error": "Cannot post until every multiple choice question has a correct answer selected.",
                        "detail": mcq_errors,
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

        # Remove module_order from request - it's automatically managed and shouldn't be changed
        request_data = request.data.copy() if hasattr(request.data, 'copy') else dict(request.data)
        request_data.pop('module_order', None)
        
        # Proceed with normal update - use partial=True to allow updating individual fields
        serializer = self.get_serializer(module, data=request_data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        
        return Response(serializer.data)

    def destroy(self, request, *args, **kwargs):
        if request.user.isStudent:
            return Response(
                {"error": "Only teachers can delete modules"},
                status=status.HTTP_403_FORBIDDEN,
            )
        module = self.get_object()
        if not CourseToTeachers.objects.filter(course=module.course, user=request.user).exists():
            return Response(
                {"error": "You don't have permission to delete this module"},
                status=status.HTTP_403_FORBIDDEN,
            )
        if module.is_posted:
            return Response(
                {
                    "error": "Posted modules cannot be deleted.",
                    "detail": "This keeps student submissions and grades intact.",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        return super().destroy(request, *args, **kwargs)

# ============================================================================
# QUESTION VIEWSET
# ============================================================================

class QuestionViewSet(viewsets.ModelViewSet):
    serializer_class = QuestionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """Get questions filtered by module_id"""
        queryset = Question.objects.all()
        module_id = self.request.query_params.get('module_id', None)
        
        if module_id:
            queryset = queryset.filter(module_id=module_id)
            # Verify user has access
            try:
                module = Module.objects.get(id=module_id)
                user = self.request.user
                if user.isStudent:
                    has_access = CourseToStudents.objects.filter(
                        course=module.course, user=user
                    ).exists()
                else:
                    has_access = CourseToTeachers.objects.filter(
                        course=module.course, user=user
                    ).exists()
                if not has_access:
                    return Question.objects.none()
            except Module.DoesNotExist:
                return Question.objects.none()
        
        return queryset.order_by('question_order')
    
    @action(detail=False, methods=['get'], url_path='questionid=(?P<question_id>[^/.]+)')
    def get_question(self, request, question_id=None):
        """
        GET /api/questions/questionid={id}
        Get a specific question by ID
        """
        module_id = request.query_params.get('module_id')
        
        if not module_id:
            return Response(
                {"error": "module_id is required as query parameter"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            module = Module.objects.get(id=module_id)
        except Module.DoesNotExist:
            return Response(
                {"error": "Module not found"},
                status=status.HTTP_404_NOT_FOUND
            )
        
        try:
            question = Question.objects.get(id=question_id, module=module)
        except Question.DoesNotExist:
            return Response(
                {"error": "Question not found in this module"},
                status=status.HTTP_404_NOT_FOUND
            )
        
        serializer = self.get_serializer(question)
        return Response(serializer.data)

    def create(self, request, *args, **kwargs):
        """
        POST /api/questions/
        Create a new question (alternative endpoint)
        """
        module_id = request.data.get('module_id')
        
        if not module_id:
            return Response(
                {"error": "module_id is required"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            module = Module.objects.get(id=module_id)
        except Module.DoesNotExist:
            return Response(
                {"error": "Module not found"},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Check if user is teacher
        if request.user.isStudent:
            return Response(
                {"error": "Only teachers can create questions"},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Create question
        question_data = request.data.copy()
        question_data['module'] = module_id
        
        # Handle correct_answers if provided
        correct_answers = question_data.pop('correct_answers', [])
        
        serializer = self.get_serializer(data=question_data)
        serializer.is_valid(raise_exception=True)
        question = serializer.save()
        
        # Create correct answer entries
        for answer in correct_answers:
            QuestionToCorrectAnswers.objects.create(
                question=question,
                correct_answer=answer
            )
        
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    
    def update(self, request, *args, **kwargs):
        """
        PUT /api/questions/{question_id}/
        Update a question
        """
        partial = kwargs.pop('partial', False)
        question = self.get_object()
        
        # Check if module is posted - prevent editing if posted
        if question.module.is_posted:
            return Response(
                {"error": "Cannot update question in a posted module"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Handle correct_answers if provided (make a copy to avoid mutating request.data)
        request_data = request.data.copy() if hasattr(request.data, 'copy') else dict(request.data)
        correct_answers = request_data.pop('correct_answers', None)
        
        # Remove module_id and module from request - question's module shouldn't change (now read-only)
        request_data.pop('module_id', None)
        request_data.pop('module', None)
        
        # Use partial=True to allow updating without requiring all fields
        serializer = self.get_serializer(question, data=request_data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        
        # Update correct answers if provided
        if correct_answers is not None:
            QuestionToCorrectAnswers.objects.filter(question=question).delete()
            if correct_answers:  # Only create if list is not empty
                for answer in correct_answers:
                    if answer:  # Only create if answer is not empty
                        QuestionToCorrectAnswers.objects.create(
                            question=question,
                            correct_answer=answer
                        )
        
        return Response(serializer.data)

    def destroy(self, request, *args, **kwargs):
        """
        DELETE /api/questions/{question_id}/
        Delete a question (only if module is not posted)
        """
        question = self.get_object()
        
        if question.module.is_posted:
            return Response(
                {"error": "Cannot delete question in a posted module"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        return super().destroy(request, *args, **kwargs)

# ============================================================================
# SUBMISSION VIEWSET
# ============================================================================

def _autograde_multiple_choice_submission(submission):
    """
    For multiple-choice questions, score submission against QuestionToCorrectAnswers.
    Full question score if the selected option text matches a correct answer; otherwise 0.
    Does nothing if the question is not MCQ or has no correct answers on file.
    """
    question = submission.question
    if question.question_type != 'multiple_choice':
        return
    correct_answers = list(
        QuestionToCorrectAnswers.objects.filter(question=question).values_list('correct_answer', flat=True)
    )
    if not correct_answers:
        return
    response = (submission.submission_response or '').strip()
    is_correct = any(response == (ca or '').strip() for ca in correct_answers)
    total = 1.0
    score = 1.0 if is_correct else 0.0

    from django.utils import timezone as django_timezone
    is_overdue = False
    module = submission.module
    if module and module.due_date:
        is_overdue = submission.time_submitted > module.due_date

    UserQuestionGrade.objects.update_or_create(
        question=question,
        user=submission.user,
        defaults={
            'score': score,
            'total': total,
            'is_overdue': is_overdue,
        },
    )


class SubmissionViewSet(viewsets.ModelViewSet):
    serializer_class = SubmissionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """Get submissions for the current user or all student submissions if teacher"""
        user = self.request.user
        module_id_param = self.request.query_params.get('module_id', None)

        if user.isStudent:
            # Students only see their own submissions
            queryset = Submission.objects.filter(user=user)
            if module_id_param:
                try:
                    mid = int(module_id_param)
                    module = Module.objects.get(id=mid)
                except (ValueError, TypeError, Module.DoesNotExist):
                    queryset = queryset.none()
                else:
                    if CourseToStudents.objects.filter(course=module.course, user=user).exists():
                        queryset = queryset.filter(module_id=mid)
                    else:
                        queryset = queryset.none()
        else:
            # Teachers see all submissions from students in courses they teach
            teacher_courses = Course.objects.filter(coursetoteachers__user=user)
            
            # If filtering by module_id, verify the teacher has access to that module's course
            if module_id_param:
                try:
                    module = Module.objects.get(id=module_id_param)
                    # Verify teacher has access to this module's course
                    if teacher_courses.filter(id=module.course.id).exists():
                        queryset = Submission.objects.filter(
                            module_id=module_id_param,
                            user__isStudent=True
                        )
                    else:
                        # Teacher doesn't have access to this module's course
                        queryset = Submission.objects.none()
                except Module.DoesNotExist:
                    queryset = Submission.objects.none()
            else:
                # No module filter - get all submissions from teacher's courses
                queryset = Submission.objects.filter(
                    module__course__in=teacher_courses,
                    user__isStudent=True
                ).distinct()
        
        # Filter by question_id if provided
        question_id = self.request.query_params.get('question_id', None)
        if question_id:
            queryset = queryset.filter(question_id=question_id)
        
        return queryset.order_by('-time_submitted')
    
    def create(self, request, *args, **kwargs):
        """
        POST /api/questions/ or POST /api/submissions/
        Submit an answer to a question
        """
        question_id = request.data.get('question_id')
        module_id = request.data.get('module_id')
        user_id = request.user.id
        
        if not question_id:
            return Response(
                {"error": "question_id is required"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            question = Question.objects.get(id=question_id)
        except Question.DoesNotExist:
            return Response(
                {"error": "Question not found"},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Always use the question's module to ensure consistency
        # The module_id from request is optional and used for validation only
        module = question.module
        module_id = module.id
        
        # If module_id is provided in request, validate it matches the question's module
        request_module_id = request.data.get('module_id')
        if request_module_id:
            try:
                request_module_id = int(request_module_id)
                if request_module_id != module_id:
                    # Log warning but use question's module
                    import logging
                    logger = logging.getLogger(__name__)
                    logger.warning(f"Module ID mismatch: request has {request_module_id} but question belongs to module {module_id}")
            except (ValueError, TypeError):
                # Invalid module_id in request, use question's module
                pass
        
        # Ensure module_id is valid (should always be valid from question.module)
        if not module_id:
            return Response(
                {"error": "Question does not have an associated module"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Create submission - always use the question's module
        # Pass the module ID (Django REST Framework will handle the ForeignKey)
        submission_data = {
            'user': user_id,
            'module': module_id,  # Pass the module ID (DRF will convert to module object)
            'question': question_id,
            'submission_type': request.data.get('submission_type', question.question_type),
            'submission_response': request.data.get('response', '')
        }
        
        try:
            serializer = self.get_serializer(data=submission_data)
            serializer.is_valid(raise_exception=True)
            submission = serializer.save()
            _autograde_multiple_choice_submission(submission)
            out = self.get_serializer(submission)
            return Response(out.data, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response(
                {"error": str(e), "details": serializer.errors if 'serializer' in locals() else None},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    def update(self, request, *args, **kwargs):
        """
        PUT /api/submissions/{submission_id}/
        Update a submission
        """
        partial = kwargs.pop('partial', False)
        submission = self.get_object()
        
        # Map 'response' to 'submission_response' for consistency with create
        request_data = request.data.copy() if hasattr(request.data, 'copy') else dict(request.data)
        if 'response' in request_data and 'submission_response' not in request_data:
            request_data['submission_response'] = request_data.pop('response')
        
        # Remove read-only fields that might be sent from frontend
        request_data.pop('question_id', None)
        request_data.pop('module_id', None)
        request_data.pop('user_id', None)
        request_data.pop('id', None)
        
        serializer = self.get_serializer(submission, data=request_data, partial=partial)
        serializer.is_valid(raise_exception=True)
        submission = serializer.save()
        _autograde_multiple_choice_submission(submission)
        return Response(self.get_serializer(submission).data)

    @action(detail=False, methods=['post'], url_path='questions/(?P<question_id>[^/.]+)/submit')
    def submit_to_question(self, request, question_id=None):
        """
        POST /api/submissions/questions/{question_id}/submit
        Submit an answer to a specific question
        """
        request.data['question_id'] = question_id
        return self.create(request)
    
    @action(detail=False, methods=['get'], url_path='users/(?P<user_id>[^/.]+)/questions/(?P<question_id>[^/.]+)')
    def get_user_question_submission(self, request, user_id=None, question_id=None):
        """
        GET /api/submissions/users/{user_id}/questions/{question_id}
        Get submission for a specific user and question
        """
        try:
            submission = Submission.objects.get(
                user_id=user_id,
                question_id=question_id
            )
            serializer = self.get_serializer(submission)
            return Response(serializer.data)
        except Submission.DoesNotExist:
            return Response(
                {"error": "Submission not found"},
                status=status.HTTP_404_NOT_FOUND
            )
    
    @action(detail=True, methods=['post'], url_path='grade')
    def grade_submission(self, request, pk=None):
        """
        POST /api/submissions/{submission_id}/grade
        Grade a submission with optional teacher comment
        """
        submission = self.get_object()
        score = request.data.get('score')
        total = 1.0  # All questions are worth 1 point
        is_overdue = request.data.get('is_overdue', False)
        teacher_comment = request.data.get('teacher_comment', '')
        
        if score is None:
            return Response(
                {"error": "score is required"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            score = float(score)
        except (ValueError, TypeError):
            return Response(
                {"error": "Score must be a valid number"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if score > total:
            return Response(
                {"error": "Score cannot be greater than total"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Create or update grade
        grade, created = UserQuestionGrade.objects.update_or_create(
            question=submission.question,
            user=submission.user,
            defaults={
                'score': score,
                'total': total,
                'is_overdue': is_overdue,
                'teacher_comment': teacher_comment or None
            }
        )
        
        return Response({
            "message": "Grade saved successfully",
            "grade": {
                "score": grade.score,
                "total": grade.total,
                "is_overdue": grade.is_overdue,
                "teacher_comment": grade.teacher_comment
            }
        }, status=status.HTTP_200_OK)

# ============================================================================
# ANNOUNCEMENT VIEWSET
# ============================================================================

class AnnouncementViewSet(viewsets.ModelViewSet):
    serializer_class = AnnouncementSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """Get announcements for courses the user is enrolled in"""
        user = self.request.user
        
        # Filter by course_id if provided
        course_id = self.request.query_params.get('course_id', None)
        
        if user.isStudent:
            # Students see posted announcements for their courses
            if course_id:
                # Check if student is enrolled in this course
                is_enrolled = CourseToStudents.objects.filter(
                    course_id=course_id, user=user
                ).exists()
                if is_enrolled:
                    return Announcement.objects.filter(
                        course_id=course_id, is_posted=True
                    )
                return Announcement.objects.none()
            else:
                # Get all courses student is enrolled in
                student_courses = Course.objects.filter(coursetostudents__user=user).distinct()
                return Announcement.objects.filter(course__in=student_courses, is_posted=True)
        else:
            # Teachers see all announcements for their courses
            if course_id:
                # Check if teacher teaches this course
                is_teacher = CourseToTeachers.objects.filter(
                    course_id=course_id, user=user
                ).exists()
                if is_teacher:
                    return Announcement.objects.filter(course_id=course_id)
                return Announcement.objects.none()
            else:
                # Get all courses teacher teaches
                teacher_courses = Course.objects.filter(coursetoteachers__user=user).distinct()
                return Announcement.objects.filter(course__in=teacher_courses)

    def perform_create(self, serializer):
        """Set the creator when creating an announcement"""
        serializer.save(created_by=self.request.user)

# ============================================================================
# RESOURCE VIEWSET
# ============================================================================

MAX_RESOURCE_PDF_BYTES = 15 * 1024 * 1024  # 15 MB


class ResourceViewSet(viewsets.ModelViewSet):
    serializer_class = ResourceSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        course_id = self.request.query_params.get('course_id', None)

        if user.isStudent:
            user_courses = Course.objects.filter(coursetostudents__user=user)
        else:
            user_courses = Course.objects.filter(coursetoteachers__user=user)

        queryset = Resource.objects.filter(course__in=user_courses)
        if course_id:
            queryset = queryset.filter(course_id=course_id)

        return queryset.order_by('order', 'created_at')

    @action(
        detail=False,
        methods=['post'],
        url_path='upload-pdf',
        parser_classes=[MultiPartParser, FormParser],
    )
    def upload_pdf(self, request):
        """Upload a PDF for a course resource (stored in default file storage, e.g. S3)."""
        if request.user.isStudent:
            return Response(
                {"error": "Only teachers can upload resource files"},
                status=status.HTTP_403_FORBIDDEN,
            )
        course_id = request.data.get('course_id')
        if not course_id:
            return Response(
                {"error": "course_id is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        course = get_object_or_404(Course, pk=course_id)
        if not CourseToTeachers.objects.filter(course=course, user=request.user).exists():
            return Response(
                {"error": "You are not a teacher of this course"},
                status=status.HTTP_403_FORBIDDEN,
            )
        upload = request.FILES.get('file')
        if not upload:
            return Response(
                {"error": "No file provided"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if upload.size > MAX_RESOURCE_PDF_BYTES:
            return Response(
                {"error": "PDF must be 15 MB or smaller"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        head = upload.read(5)
        upload.seek(0)
        if not head.startswith(b'%PDF'):
            return Response(
                {"error": "Only PDF files are allowed"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        storage_name = f"resource_pdfs/{uuid.uuid4().hex}.pdf"
        file_body = upload.read()
        original_name = (upload.name or "document.pdf").replace('"', "").replace("\r", "").replace("\n", "")
        if not original_name.lower().endswith(".pdf"):
            original_name = f"{original_name}.pdf"
        disp_name = original_name[:180]

        use_s3 = bool(getattr(django_settings, "USE_S3_STORAGE", False))
        bucket = getattr(django_settings, "AWS_STORAGE_BUCKET_NAME", None)
        region = getattr(django_settings, "AWS_S3_REGION_NAME", "us-east-1")
        key_id = getattr(django_settings, "AWS_ACCESS_KEY_ID", None)
        secret = getattr(django_settings, "AWS_SECRET_ACCESS_KEY", None)

        def absolute_file_url(url: str) -> str:
            if not url or url.startswith("http://") or url.startswith("https://"):
                return url
            return request.build_absolute_uri(url)

        # Upload with Content-Disposition: attachment so browsers download instead of inline-viewing
        if use_s3:
            try:
                s3 = boto3.client(
                    "s3",
                    aws_access_key_id=key_id,
                    aws_secret_access_key=secret,
                    region_name=region,
                )
                s3.put_object(
                    Bucket=bucket,
                    Key=storage_name,
                    Body=file_body,
                    ContentType="application/pdf",
                    ContentDisposition=f'attachment; filename="{disp_name}"',
                )
                file_url = absolute_file_url(default_storage.url(storage_name))
            except ClientError as e:
                err = (e.response or {}).get("Error", {}) or {}
                msg = err.get("Message") or str(e)
                return Response(
                    {"error": f"Could not upload to storage ({msg}). Check AWS credentials and bucket."},
                    status=status.HTTP_502_BAD_GATEWAY,
                )
        else:
            path = default_storage.save(storage_name, ContentFile(file_body))
            file_url = absolute_file_url(default_storage.url(path))

        return Response(
            {
                "url": file_url,
                "filename": upload.name or "document.pdf",
            },
            status=status.HTTP_201_CREATED,
        )

    def create(self, request, *args, **kwargs):
        if request.user.isStudent:
            return Response(
                {"error": "Only teachers can create resources"},
                status=status.HTTP_403_FORBIDDEN
            )
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        if request.user.isStudent:
            return Response(
                {"error": "Only teachers can update resources"},
                status=status.HTTP_403_FORBIDDEN
            )
        kwargs['partial'] = True
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        if request.user.isStudent:
            return Response(
                {"error": "Only teachers can delete resources"},
                status=status.HTTP_403_FORBIDDEN
            )
        return super().destroy(request, *args, **kwargs)
