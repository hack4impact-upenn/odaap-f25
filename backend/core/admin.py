from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import (
    User, Course, Module, Question, Submission, Announcement,
    CourseToStudents, CourseToTeachers, CourseToModules,
    ModuleToQuestions, QuestionToCorrectAnswers,
    UserModuleGrade, UserCourseGrade, UserQuestionGrade
)

# Register your models here.

admin.site.register(User, UserAdmin)

@admin.register(Course)
class CourseAdmin(admin.ModelAdmin):
    list_display = ['id', 'course_name', 'course_description', 'score_total']
    search_fields = ['course_name', 'course_description']

@admin.register(Module)
class ModuleAdmin(admin.ModelAdmin):
    list_display = ['id', 'module_name', 'course', 'module_order', 'is_posted', 'due_date', 'score_total']
    list_filter = ['is_posted', 'course']
    search_fields = ['module_name', 'module_description']
    ordering = ['course', 'module_order']
    fields = ['course', 'module_name', 'module_description', 'youtube_link', 'module_order', 'score_total', 'is_posted', 'due_date']

@admin.register(Question)
class QuestionAdmin(admin.ModelAdmin):
    list_display = ['id', 'question_text', 'module', 'question_type', 'question_order', 'score_total']
    list_filter = ['question_type', 'module']
    search_fields = ['question_text']
    ordering = ['module', 'question_order']

@admin.register(Submission)
class SubmissionAdmin(admin.ModelAdmin):
    list_display = ['id', 'user', 'module', 'question', 'submission_type', 'time_submitted']
    list_filter = ['submission_type', 'time_submitted']
    search_fields = ['submission_response']
    readonly_fields = ['time_submitted']

@admin.register(CourseToStudents)
class CourseToStudentsAdmin(admin.ModelAdmin):
    list_display = ['id', 'course', 'user']
    list_filter = ['course']

@admin.register(CourseToTeachers)
class CourseToTeachersAdmin(admin.ModelAdmin):
    list_display = ['id', 'course', 'user']
    list_filter = ['course']

@admin.register(CourseToModules)
class CourseToModulesAdmin(admin.ModelAdmin):
    list_display = ['id', 'course', 'module']

@admin.register(ModuleToQuestions)
class ModuleToQuestionsAdmin(admin.ModelAdmin):
    list_display = ['id', 'module', 'question']

@admin.register(QuestionToCorrectAnswers)
class QuestionToCorrectAnswersAdmin(admin.ModelAdmin):
    list_display = ['id', 'question', 'correct_answer']

@admin.register(UserModuleGrade)
class UserModuleGradeAdmin(admin.ModelAdmin):
    list_display = ['id', 'user', 'module', 'score', 'total']

@admin.register(UserCourseGrade)
class UserCourseGradeAdmin(admin.ModelAdmin):
    list_display = ['id', 'user', 'course', 'score', 'total']

@admin.register(UserQuestionGrade)
class UserQuestionGradeAdmin(admin.ModelAdmin):
    list_display = ['id', 'user', 'question', 'score', 'total', 'is_overdue']

@admin.register(Announcement)
class AnnouncementAdmin(admin.ModelAdmin):
    list_display = ['id', 'title', 'course', 'created_by', 'created_at', 'is_posted']
    list_filter = ['is_posted', 'course', 'created_at']
    search_fields = ['title', 'content']
    ordering = ['-created_at']
    readonly_fields = ['created_at']
