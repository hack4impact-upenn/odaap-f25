from rest_framework import viewsets, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from django.shortcuts import get_object_or_404
from django.http import Http404
from django.db.models import Q
from django.contrib.auth import get_user_model
from rest_framework_simplejwt.tokens import RefreshToken
from .models import (
    Course, CourseToStudents, CourseToTeachers, Module, Question, 
    Submission, UserQuestionGrade, QuestionToCorrectAnswers, User, Announcement
)
from .serializers import (
    CourseSerializer, ModuleSerializer, QuestionSerializer, 
    SubmissionSerializer, UserSerializer, AnnouncementSerializer
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
    """
    email = request.data.get('email')
    password = request.data.get('password')
    first_name = request.data.get('first_name')
    last_name = request.data.get('last_name')
    isStudent = request.data.get('isStudent', True)
    
    if not all([email, password, first_name, last_name]):
        return Response(
            {'error': 'All fields are required'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    if User.objects.filter(email=email).exists():
        return Response(
            {'error': 'User with this email already exists'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Create user
    user = User.objects.create_user(
        username=email,  # Use email as username
        email=email,
        password=password,
        first_name=first_name,
        last_name=last_name,
        isStudent=isStudent
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
            
            # Get zoom_link from request data
            # Handle both 'zoom_link' and 'zoomLink' (camelCase)
            zoom_link = request.data.get('zoom_link') or request.data.get('zoomLink')
            
            # Allow empty string but not None
            if zoom_link is None:
                return Response(
                    {"error": "zoom_link is required in request body"},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Update the zoom link
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
        
        # Allow editing questions (teachers can always update)
        # Note: In production, you might want to restrict editing posted modules
        
        # Handle correct_answers if provided (make a copy to avoid mutating request.data)
        request_data = request.data.copy() if hasattr(request.data, 'copy') else dict(request.data)
        correct_answers = request_data.pop('correct_answers', None)
        
        serializer = self.get_serializer(question, data=request_data, partial=partial)
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

class SubmissionViewSet(viewsets.ModelViewSet):
    serializer_class = SubmissionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """Get submissions for the current user"""
        user = self.request.user
        queryset = Submission.objects.filter(user=user)
        
        # Filter by question_id if provided
        question_id = self.request.query_params.get('question_id', None)
        if question_id:
            queryset = queryset.filter(question_id=question_id)
        
        # Filter by module_id if provided
        module_id = self.request.query_params.get('module_id', None)
        if module_id:
            queryset = queryset.filter(module_id=module_id)
        
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
            return Response(serializer.data, status=status.HTTP_201_CREATED)
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
        serializer.save()
        
        return Response(serializer.data)

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
        Grade a submission
        """
        submission = self.get_object()
        score = request.data.get('score')
        total = request.data.get('total', submission.question.score_total)
        is_overdue = request.data.get('is_overdue', False)
        
        if score is None:
            return Response(
                {"error": "score is required"},
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
                'is_overdue': is_overdue
            }
        )
        
        return Response({
            "message": "Grade saved successfully",
            "grade": {
                "score": grade.score,
                "total": grade.total,
                "is_overdue": grade.is_overdue
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
