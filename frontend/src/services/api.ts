import axios from 'axios';
import type { 
  Course, Module, Question, Submission,
  LoginCredentials, RegisterData, AuthResponse 
} from '../types';

const API_BASE_URL = 'http://localhost:8000/api';

// Create axios instance with default config
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests if available
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle token refresh on 401
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        const refreshToken = localStorage.getItem('refresh_token');
        if (refreshToken) {
          const response = await axios.post(`${API_BASE_URL}/token/refresh/`, {
            refresh: refreshToken,
          });
          
          const { access } = response.data;
          localStorage.setItem('access_token', access);
          originalRequest.headers.Authorization = `Bearer ${access}`;
          
          return api(originalRequest);
        }
      } catch (refreshError) {
        // Refresh failed, redirect to login
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }
    
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  login: async (credentials: LoginCredentials): Promise<AuthResponse> => {
    const response = await api.post('/token/', {
      email: credentials.email,
      password: credentials.password,
    });
    return response.data;
  },

  register: async (data: RegisterData): Promise<AuthResponse> => {
    const response = await api.post('/register/', data);
    return response.data;
  },

  refreshToken: async (refresh: string): Promise<{ access: string }> => {
    const response = await api.post('/token/refresh/', { refresh });
    return response.data;
  },
};

// Course API
export const courseAPI = {
  getAll: async (): Promise<Course[]> => {
    const response = await api.get('/courses/');
    return response.data;
  },

  getById: async (id: number): Promise<Course> => {
    const response = await api.get(`/courses/${id}/`);
    return response.data;
  },

  getEnrolledCourses: async (userId: number): Promise<Course[]> => {
    const response = await api.get(`/courses/userid=${userId}`);
    return response.data;
  },

  create: async (course: Partial<Course>): Promise<Course> => {
    const response = await api.post('/courses/', course);
    return response.data;
  },

  update: async (id: number, course: Partial<Course>): Promise<Course> => {
    const response = await api.put(`/courses/${id}/`, course);
    return response.data;
  },

  addUser: async (courseId: number, userId: number): Promise<void> => {
    await api.post(`/courses/${courseId}/users`, { user_id: userId });
  },

  removeUser: async (courseId: number, userId: number): Promise<void> => {
    await api.delete(`/courses/${courseId}/users`, { data: { user_id: userId } });
  },

  updateZoomLink: async (courseId: number, zoomLink: string): Promise<Course> => {
    const response = await api.put(`/courses/${courseId}/zoom`, { zoom_link: zoomLink });
    return response.data;
  },

  getModules: async (courseId: number): Promise<Module[]> => {
    const response = await api.get(`/courses/${courseId}/modules/`);
    return response.data;
  },
};

// Module API
export const moduleAPI = {
  getAll: async (courseId?: number): Promise<Module[]> => {
    const url = courseId ? `/modules/?course_id=${courseId}` : '/modules/';
    const response = await api.get(url);
    return response.data;
  },

  getById: async (id: number): Promise<Module> => {
    const response = await api.get(`/modules/${id}/`);
    return response.data;
  },

  create: async (module: Partial<Module>): Promise<Module> => {
    const response = await api.post('/modules/', module);
    return response.data;
  },

  update: async (id: number, module: Partial<Module>): Promise<Module> => {
    const response = await api.put(`/modules/${id}/`, module);
    return response.data;
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/modules/${id}/`);
  },

  getQuestions: async (moduleId: number): Promise<Question[]> => {
    const response = await api.get(`/modules/${moduleId}/questions`);
    return response.data;
  },

  createQuestion: async (moduleId: number, question: Partial<Question>): Promise<Question> => {
    const response = await api.post(`/modules/${moduleId}/question`, question);
    return response.data;
  },
};

// Question API
export const questionAPI = {
  getAll: async (moduleId?: number): Promise<Question[]> => {
    const url = moduleId ? `/questions/?module_id=${moduleId}` : '/questions/';
    const response = await api.get(url);
    return response.data;
  },

  getById: async (questionId: number, moduleId: number): Promise<Question> => {
    const response = await api.get(`/questions/questionid=${questionId}?module_id=${moduleId}`);
    return response.data;
  },

  create: async (question: Partial<Question>): Promise<Question> => {
    const response = await api.post('/questions/', question);
    return response.data;
  },

  update: async (id: number, question: Partial<Question>): Promise<Question> => {
    const response = await api.put(`/questions/${id}/`, question);
    return response.data;
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/questions/${id}/`);
  },
};

// Submission API
export const submissionAPI = {
  getAll: async (questionId?: number, moduleId?: number): Promise<Submission[]> => {
    let url = '/submissions/';
    const params = new URLSearchParams();
    if (questionId) params.append('question_id', questionId.toString());
    if (moduleId) params.append('module_id', moduleId.toString());
    if (params.toString()) url += `?${params.toString()}`;
    
    const response = await api.get(url);
    return response.data;
  },

  getByUserAndQuestion: async (userId: number, questionId: number): Promise<Submission> => {
    const response = await api.get(`/submissions/users/${userId}/questions/${questionId}`);
    return response.data;
  },

  submit: async (submission: {
    question_id: number;
    module_id: number;
    submission_type: string;
    response: string;
  }): Promise<Submission> => {
    const response = await api.post('/submissions/', submission);
    return response.data;
  },

  submitToQuestion: async (questionId: number, submission: {
    module_id: number;
    submission_type: string;
    response: string;
  }): Promise<Submission> => {
    const response = await api.post(`/submissions/questions/${questionId}/submit`, submission);
    return response.data;
  },

  update: async (id: number, submission: {
    question_id: number;
    module_id: number;
    submission_type: string;
    response: string;
  }): Promise<Submission> => {
    const response = await api.put(`/submissions/${id}/`, submission);
    return response.data;
  },

  grade: async (submissionId: number, grade: {
    score: number;
    total: number;
    is_overdue: boolean;
  }): Promise<void> => {
    await api.post(`/submissions/${submissionId}/grade`, grade);
  },
};

export default api;

