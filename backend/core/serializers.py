import boto3
from urllib.parse import urlparse

from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import get_user_model
from django.conf import settings
from .models import Course, User, Module, Question, Submission, UserModuleGrade, UserCourseGrade, UserQuestionGrade, CourseToStudents, CourseToTeachers, CourseToModules, ModuleToQuestions, QuestionToCorrectAnswers, Announcement, Resource

User = get_user_model()

# ============================================================================
# AUTHENTICATION SERIALIZERS
# ============================================================================

class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Custom JWT serializer that accepts email instead of username"""
    username_field = 'email'
    
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        return token
    
    def validate(self, attrs):
        # Get email from request
        email = attrs.get('email') or attrs.get('username')
        password = attrs.get('password')
        
        if not email or not password:
            raise serializers.ValidationError('Email and password are required.')
        
        # Try to find user by email
        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            raise serializers.ValidationError('password and username incorrect')
        
        # Check password
        if not user.check_password(password):
            raise serializers.ValidationError('password and username incorrect')
        
        if not user.is_active:
            raise serializers.ValidationError('User account is disabled.')
        
        # Generate tokens
        refresh = self.get_token(user)
        
        data = {
            'refresh': str(refresh),
            'access': str(refresh.access_token),
            'user': {
                'id': user.id,
                'email': user.email,
                'first_name': user.first_name,
                'last_name': user.last_name,
                'isStudent': user.isStudent,
            }
        }
        
        return data

# ============================================================================
# MAIN SERIALIZERS
# ============================================================================

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'email', 'first_name', 'last_name', 'isStudent']

class CourseSerializer(serializers.ModelSerializer):
    
    class Meta:
        model = Course
        fields = [
            'id',
            'course_name',
            'course_description',
            'zoom_link',
            'score_total',
            'student_enrollment_code',
            'ceu_credit_application_link',
            'ceu_act48_application_link',
            'ceu_program_evaluation_link'
        ]
       

class ModuleSerializer(serializers.ModelSerializer):
    course_id = serializers.IntegerField(source='course.id', read_only=True)
    course_name = serializers.CharField(source='course.course_name', read_only=True)
    course = serializers.PrimaryKeyRelatedField(queryset=Course.objects.all(), write_only=True, required=False)
    display_title = serializers.SerializerMethodField()

    class Meta:
        model = Module
        fields = [
            'id',
            'course',
            'course_id',
            'course_name',
            'module_name',
            'module_description',
            'youtube_link',
            'module_order',
            'display_title',
            'score_total',
            'is_posted',
            'due_date'
        ]

    def get_display_title(self, obj):
        """Single line for UI. Does not prefix again if module_name already starts with 'Module {order} -'."""
        order = obj.module_order
        name = (obj.module_name or "").strip()
        if not name:
            return f"Module {order}"
        prefix = f"Module {order} - "
        lower = name.lower()
        if lower.startswith(prefix.lower()):
            return name
        if lower == f"module {order}".lower():
            return name
        return f"{prefix}{name}"

class QuestionSerializer(serializers.ModelSerializer):
    module_id = serializers.IntegerField(source='module.id', read_only=True)
    correct_answers = serializers.SerializerMethodField()
    
    class Meta:
        model = Question
        fields = [
            'id',
            'module',
            'module_id',
            'question_text',
            'question_type',
            'mcq_options',
            'question_order',
            'score_total',
            'correct_answers'
        ]
        read_only_fields = ['module_id']  # module_id is read-only, but module can be set during creation
    
    def get_correct_answers(self, obj):
        """Get all correct answers for this question"""
        return list(QuestionToCorrectAnswers.objects.filter(question=obj).values_list('correct_answer', flat=True))

class SubmissionSerializer(serializers.ModelSerializer):
    user_id = serializers.IntegerField(source='user.id', read_only=True)
    user_name = serializers.CharField(source='user.get_full_name', read_only=True)
    module_id = serializers.IntegerField(source='module.id', read_only=True)
    question_id = serializers.IntegerField(source='question.id', read_only=True)
    question_text = serializers.CharField(source='question.question_text', read_only=True)
    grade = serializers.SerializerMethodField()
    
    class Meta:
        model = Submission
        fields = [
            'id',
            'user',
            'user_id',
            'user_name',
            'module',
            'module_id',
            'question',
            'question_id',
            'question_text',
            'submission_type',
            'submission_response',
            'time_submitted',
            'grade'
        ]
        read_only_fields = ['time_submitted', 'user_id', 'module_id', 'question_id', 'user_name', 'question_text', 'grade']
    
    def get_grade(self, obj):
        """Get grade for this submission if it exists"""
        try:
            grade = UserQuestionGrade.objects.get(question=obj.question, user=obj.user)
            return {
                'score': grade.score,
                'total': grade.total,
                'is_overdue': grade.is_overdue,
                'teacher_comment': grade.teacher_comment
            }
        except UserQuestionGrade.DoesNotExist:
            return None

class AnnouncementSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True)
    course_id = serializers.IntegerField(source='course.id', read_only=True)
    
    class Meta:
        model = Announcement
        fields = [
            'id',
            'course',
            'course_id',
            'title',
            'content',
            'created_by',
            'created_by_name',
            'created_at',
            'is_posted'
        ]
        read_only_fields = ['created_by', 'created_at']

class UserModuleGradeSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserModuleGrade
        fields = [
            'id',
            'module',
            'user',
            'score',
            'total'
        ]

class UserCourseGradeSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserCourseGrade
        fields = [
            'id',
            'course',
            'user',
            'score',
            'total'
        ]

class UserQuestionGradeSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserQuestionGrade
        fields = [
            'id',
            'question',
            'user',
            'score',
            'total',
            'teacher_comment'
        ]

class CourseToStudentsSerializer(serializers.ModelSerializer):
    class Meta:
        model = CourseToStudents
        fields = [
            'id',
            'course',
            'user'
        ]

class CourseToTeachersSerializer(serializers.ModelSerializer):
    class Meta:
        model = CourseToTeachers
        fields = [
            'id',
            'course',
            'user'
        ]

class CourseToModulesSerializer(serializers.ModelSerializer):
    class Meta:
        model = CourseToModules
        fields = [
            'id',
            'course',
            'module'
        ]

class ModuleToQuestionsSerializer(serializers.ModelSerializer):
    class Meta:
        model = ModuleToQuestions
        fields = [
            'id',
            'module',
            'question'
        ]

class QuestionToCorrectAnswersSerializer(serializers.ModelSerializer):
    class Meta:
        model = QuestionToCorrectAnswers
        fields = [
            'id',
            'question',
            'correct_answer'
        ]


def presign_resource_pdf_url(url: str) -> str:
    """
    For private S3 buckets: return a time-limited presigned GET URL for uploaded
    resource PDFs (keys under resource_pdfs/). Other URLs are unchanged.
    """
    if not url or not isinstance(url, str):
        return url
    bucket = getattr(settings, "AWS_STORAGE_BUCKET_NAME", None) or ""
    key_id = getattr(settings, "AWS_ACCESS_KEY_ID", None)
    secret = getattr(settings, "AWS_SECRET_ACCESS_KEY", None)
    region = getattr(settings, "AWS_S3_REGION_NAME", "us-east-1")
    if not bucket or not key_id or not secret:
        return url
    try:
        parsed = urlparse(url.strip())
        key = parsed.path.lstrip("/")
        if not key.startswith("resource_pdfs/"):
            return url
        s3 = boto3.client(
            "s3",
            aws_access_key_id=key_id,
            aws_secret_access_key=secret,
            region_name=region,
        )
        return s3.generate_presigned_url(
            "get_object",
            Params={"Bucket": bucket, "Key": key},
            ExpiresIn=3600,
        )
    except Exception:
        return url


class ResourceSerializer(serializers.ModelSerializer):
    course_id = serializers.IntegerField(source='course.id', read_only=True)

    class Meta:
        model = Resource
        fields = [
            'id',
            'course',
            'course_id',
            'title',
            'description',
            'links',
            'order',
            'created_at'
        ]
        read_only_fields = ['created_at']

    def to_representation(self, instance):
        data = super().to_representation(instance)
        links = data.get("links")
        if isinstance(links, list):
            data["links"] = [self._presign_link_item(link) for link in links]
        return data

    @staticmethod
    def _presign_link_item(link):
        if not isinstance(link, dict):
            return link
        out = dict(link)
        url = out.get("url") or ""
        kind = out.get("kind")
        if kind == "pdf" or "/resource_pdfs/" in url:
            out["url"] = presign_resource_pdf_url(url)
        return out
        