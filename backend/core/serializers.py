
from rest_framework import serializers
from .models import Course, User, Module, Question, Submission, UserModuleGrade, UserCourseGrade, UserQuestionGrade, CourseToStudents, CourseToTeachers, CourseToModules, ModuleToQuestions, QuestionToCorrectAnswers

class CourseSerializer(serializers.ModelSerializer):
    
    class Meta:
        model = Course
        fields = [
            'id',
            'course_name',
            'course_descrp',
            'zoom_link',
            'score_total'
        ]
       

class ModuleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Module
        fields = [
            'id',
            'module_name',
            'module_descrp',
            'module_order',
            'score_total',
            'is_posted'
        ]

class QuestionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Question
        fields = [
            'id',
            'question_text',
            'question_order',
            'score_total'
        ]

class SubmissionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Submission
        fields = [
            'id',
            'submission_text',
            'submission_order',
            'score_total'
        ]

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
        