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
  student_enrollment_code?: string;
  ceu_credit_application_link?: string;
  ceu_act48_application_link?: string;
  ceu_program_evaluation_link?: string;
  pre_course_survey_link?: string;
  post_course_survey_link?: string;
}

export interface Module {
  id: number;
  course_id: number;
  course_name: string;
  module_name: string;
  /** API: formatted title (no duplicate 'Module N -' if already in module_name) */
  display_title?: string;
  module_description?: string;
  youtube_link?: string;
  module_order: number;
  score_total: number;
  is_posted: boolean;
  due_date?: string;
}

/** Same rules as backend ModuleSerializer.get_display_title (avoids "Module 3 - Module 3 - …"). */
export function buildModuleDisplayTitle(moduleOrder: number, moduleName: string): string {
  const name = (moduleName || '').trim();
  if (!name) return `Module ${moduleOrder}`;
  const prefix = `Module ${moduleOrder} - `;
  const lower = name.toLowerCase();
  if (lower.startsWith(prefix.toLowerCase())) return name;
  if (lower === `module ${moduleOrder}`.toLowerCase()) return name;
  return `${prefix}${name}`;
}

export function moduleDisplayTitle(m: Module): string {
  return buildModuleDisplayTitle(m.module_order, m.module_name);
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
    teacher_comment?: string;
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
  enrollment_code?: string;
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

export interface ResourceLink {
  label: string;
  url: string;
  /** Set when the link points to an uploaded PDF */
  kind?: 'url' | 'pdf';
}

export interface Resource {
  id: number;
  course: number;
  course_id: number;
  title: string;
  description?: string;
  links: ResourceLink[];
  order: number;
  created_at: string;
}

