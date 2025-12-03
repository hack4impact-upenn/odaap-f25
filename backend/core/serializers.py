
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import get_user_model
from .models import Course, User, Module, Question, Submission, UserModuleGrade, UserCourseGrade, UserQuestionGrade, CourseToStudents, CourseToTeachers, CourseToModules, ModuleToQuestions, QuestionToCorrectAnswers

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
            raise serializers.ValidationError('No active account found with the given credentials.')
        
        # Check password
        if not user.check_password(password):
            raise serializers.ValidationError('No active account found with the given credentials.')
        
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
            'score_total'
        ]
       

class ModuleSerializer(serializers.ModelSerializer):
    course_id = serializers.IntegerField(source='course.id', read_only=True)
    course_name = serializers.CharField(source='course.course_name', read_only=True)
    course = serializers.PrimaryKeyRelatedField(queryset=Course.objects.all(), write_only=True, required=False)
    
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
            'score_total',
            'is_posted',
            'due_date'
        ]

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
        read_only_fields = ['module_id']
    
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
                'is_overdue': grade.is_overdue
            }
        except UserQuestionGrade.DoesNotExist:
            return None

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
            'total'
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
        