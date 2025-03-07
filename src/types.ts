export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  thinking?: string;
  isThinkingExpanded?: boolean;
  isEditing?: boolean;
  originalContent?: string;
  fileId?: string;
  fileName?: string;
}

export interface Chat {
  id: string;
  name: string;
  messages: Message[];
  createdAt: Date;
}

export interface UserData {
  first_name?: string;
  last_name?: string;
}

export interface UploadedFileInfo {
  id: string;
  name: string;
  size: number;
  uploadedAt: Date;
}