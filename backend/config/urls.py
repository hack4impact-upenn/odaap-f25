"""
URL configuration for config project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from core.serializers import CustomTokenObtainPairSerializer

# views
from core.views import (
    CourseViewSet, ModuleViewSet, QuestionViewSet, SubmissionViewSet, 
    AnnouncementViewSet, register
)

# Create router and register viewsets
router = DefaultRouter()
router.register(r'courses', CourseViewSet, basename='course')
router.register(r'modules', ModuleViewSet, basename='module')
router.register(r'questions', QuestionViewSet, basename='question')
router.register(r'submissions', SubmissionViewSet, basename='submission')
router.register(r'announcements', AnnouncementViewSet, basename='announcement')

# Custom token view that uses email
class EmailTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer

urlpatterns = [
    path('admin/', admin.site.urls),
    path("api/token/", EmailTokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("api/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("api/register/", register, name="register"),
    # Include router URLs (provides all ViewSet endpoints)
    path('api/', include(router.urls)),
]
