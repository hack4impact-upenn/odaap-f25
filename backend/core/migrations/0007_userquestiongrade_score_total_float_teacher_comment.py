# Generated manually

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0006_course_student_enrollment_code'),
    ]

    operations = [
        migrations.AlterField(
            model_name='userquestiongrade',
            name='score',
            field=models.FloatField(blank=True, null=True),
        ),
        migrations.AlterField(
            model_name='userquestiongrade',
            name='total',
            field=models.FloatField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='userquestiongrade',
            name='teacher_comment',
            field=models.TextField(blank=True, null=True),
        ),
    ]
