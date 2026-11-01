export type AgentStepType =
  | 'navigating'
  | 'loaded'
  | 'ai_decision'
  | 'filling'
  | 'clicking'
  | 'scrolling'
  | 'screenshot'
  | 'captcha_detected'
  | 'captcha_solved'
  | 'reviewing'
  | 'completed'
  | 'error';

export type AgentStepStatus = 'running' | 'success' | 'failed' | 'waiting';

export interface AgentStep {
  id: number;
  taskId: string;
  timestamp: string;
  type: AgentStepType;
  status: AgentStepStatus;
  message: string;
  url?: string;
  screenshotUrl?: string;
  fieldName?: string;
  fieldValue?: string;
  trackingNumber?: string;
}

export interface CitizenProfile {
  fullName: string;
  mobile: string;
  email: string;
  dob?: string;
  aadhaar?: string;
  address?: string;
  state?: string;
  incomeAnnual?: string;
  familySize?: string;
  bankAccount?: string;
  guardianName?: string;
  bloodGroup?: string;
  [key: string]: unknown;
}

export interface AgentTaskDto {
  serviceType: string;
  citizenProfile: CitizenProfile;
}

export interface AgentTaskDoneEvent {
  taskId: string;
  trackingNumber: string | null;
  url?: string;
  error?: string;
}
