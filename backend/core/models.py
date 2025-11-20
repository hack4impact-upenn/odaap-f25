from django.db import models
from django.contrib.auth.models import AbstractUser
from django.conf import settings
import enum
# Create your models here.

class QuestionType(models.TextChoices):
    MULTIPLE_CHOICE = "multiple_choice"
    AUDIO = "audio"
    WRITTEN = "written"
    VIDEO = "video"

# MAIN TABLES 
class User(AbstractUser):
    isStudent = models.BooleanField(default=True)

    def __str__(self):
        return self.get_full_name()


class Course(models.Model):
    zoom_link = models.TextField(null=True, blank=True)
    course_name = models.TextField()
    course_description = models.TextField(null=True, blank=True)
    score_total = models.IntegerField(default=0)

    def __str__(self):
        return self.course_name
        

class Module(models.Model):
    course = models.ForeignKey(Course, on_delete=models.CASCADE)
    module_name = models.TextField()
    module_description = models.TextField(null=True, blank=True)

    module_order = models.IntegerField() # order it should be in the course   
    score_total = models.IntegerField(default=0)
    is_posted = models.BooleanField(default=False)

    def __str__(self):
        return self.module_name

class Question(models.Model):
    module = models.ForeignKey(Module, on_delete=models.CASCADE)
    question_type = models.CharField(max_length=20, choices=QuestionType.choices)

    question_text = models.TextField() 
    question_order = models.IntegerField() # order it should be in the module
    score_total = models.IntegerField(default=0)

    def __str__(self):
        return self.question_text

class Submission(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    module = models.ForeignKey(Module, on_delete=models.CASCADE)
    question = models.ForeignKey(Question, on_delete=models.CASCADE)
    submission_type = models.CharField(max_length=20, choices=QuestionType.choices)
    submission_response = models.TextField()
    time_submitted = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.submission_response


# RELATIONSHIP TABLES 

class UserModuleGrade(models.Model):
    module = models.ForeignKey(Module, on_delete=models.CASCADE)
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    score = models.IntegerField(null=True, blank=True)
    total = models.IntegerField(null=True, blank=True)

    def __str__(self):
        return self.module.module_name

class UserCourseGrade(models.Model):
    course = models.ForeignKey(Course, on_delete=models.CASCADE)
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    score = models.IntegerField(null=True, blank=True)
    total = models.IntegerField(null=True, blank=True)

    def __str__(self):
        return self.course.course_name


class UserQuestionGrade(models.Model):
    question = models.ForeignKey(Question, on_delete=models.CASCADE)
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    score = models.IntegerField(null=True, blank=True)
    total = models.IntegerField(null=True, blank=True)
    is_overdue = models.BooleanField(default=False)

    def __str__(self):
        return self.question.question_text

class CourseToStudents(models.Model):
    course = models.ForeignKey(Course, on_delete=models.CASCADE)
    user = models.ForeignKey(User, on_delete=models.CASCADE)

    def __str__(self):
        return self.course.course_name

class CourseToTeachers(models.Model):
    course = models.ForeignKey(Course, on_delete=models.CASCADE)
    user = models.ForeignKey(User, on_delete=models.CASCADE)

    def __str__(self):
        return self.course.course_name

class CourseToModules(models.Model):
    course = models.ForeignKey(Course, on_delete=models.CASCADE)
    module = models.ForeignKey(Module, on_delete=models.CASCADE)

    def __str__(self):
        return self.course.course_name

class ModuleToQuestions(models.Model):
    module = models.ForeignKey(Module, on_delete=models.CASCADE)
    question = models.ForeignKey(Question, on_delete=models.CASCADE)

    def __str__(self):
        return self.module.module_name

class QuestionToCorrectAnswers(models.Model):
    question = models.ForeignKey(Question, on_delete=models.CASCADE)
    correct_answer = models.TextField()

    def __str__(self):
        return self.question.question_text