# Generated manually

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0009_course_meeting_schedule'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='course',
            name='meeting_schedule',
        ),
    ]
