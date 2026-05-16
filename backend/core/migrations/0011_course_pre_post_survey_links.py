from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0010_remove_course_meeting_schedule'),
    ]

    operations = [
        migrations.AddField(
            model_name='course',
            name='pre_course_survey_link',
            field=models.TextField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='course',
            name='post_course_survey_link',
            field=models.TextField(blank=True, null=True),
        ),
    ]
