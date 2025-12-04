// Type definitions for the application

export interface User {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  isStudent: boolean;
}

export interface Course {
  id: number;
  course_name: string;
  course_description: string;
  zoom_link?: string;
  score_total: number;
}

export interface Module {
  id: number;
  course_id: number;
  course_name: string;
  module_name: string;
  module_description?: string;
  youtube_link?: string;
  module_order: number;
  score_total: number;
  is_posted: boolean;
  due_date?: string;
}

export interface Question {
  id: number;
  module_id: number;
  question_text: string;
  question_type: 'multiple_choice' | 'audio' | 'written' | 'video';
  mcq_options?: string[];
  correct_answers?: string[];
  question_order: number;
  score_total: number;
}

export interface Submission {
  id: number;
  user_id: number;
  user_name: string;
  module_id: number;
  question_id: number;
  question_text: string;
  submission_type: 'multiple_choice' | 'audio' | 'written' | 'video';
  submission_response: string;
  time_submitted: string;
  grade?: {
    score: number;
    total: number;
    is_overdue: boolean;
  };
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  first_name: string;
  last_name: string;
  email: string;
  password: string;
  isStudent: boolean;
}

export interface AuthResponse {
  access: string;
  refresh: string;
  user: User;
}

export interface Announcement {
  id: number;
  course: number;
  course_id: number;
  title: string;
  content: string;
  created_by: number;
  created_by_name: string;
  created_at: string;
  is_posted: boolean;
}

