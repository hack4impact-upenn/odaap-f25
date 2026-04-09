# Generated manually

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0005_course_ceu_act48_application_link_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='course',
            name='student_enrollment_code',
            field=models.CharField(blank=True, max_length=20, null=True, unique=True),
        ),
    ]
