import OpenAI from 'openai';

export interface UploadedFile {
  id: string;
  filename: string;
  bytes: number;
  purpose: string;
  created_at: number;
}

export async function uploadFile(
  file: File,
  openai: OpenAI
): Promise<UploadedFile> {
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('purpose', 'batch');

    const response = await fetch(`${openai.baseURL}/files`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openai.apiKey}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || 'Failed to upload file');
    }

    return await response.json();
  } catch (error) {
    console.error('Error uploading file:', error);
    throw error;
  }
}

export async function listFiles(openai: OpenAI): Promise<UploadedFile[]> {
  try {
    const response = await fetch(`${openai.baseURL}/files`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${openai.apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || 'Failed to list files');
    }

    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error('Error listing files:', error);
    throw error;
  }
}

export async function deleteFile(fileId: string, openai: OpenAI): Promise<void> {
  try {
    const response = await fetch(`${openai.baseURL}/files/${fileId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${openai.apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || 'Failed to delete file');
    }
  } catch (error) {
    console.error('Error deleting file:', error);
    throw error;
  }
}

export async function analyzeFile(
  fileId: string,
  question: string,
  openai: OpenAI
): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      model: 'deepseek-r1-distill-llama-70b',
      messages: [
        {
          role: 'system',
          content: `You are AceAI V2.0, an AI assistant that specializes in analyzing files. 
          The user has uploaded a file with ID ${fileId}. 
          Analyze the file content and answer the user's question about it.`
        },
        {
          role: 'user',
          content: `I've uploaded a file and would like you to analyze it. Here's my question: ${question}`
        }
      ],
      temperature: 0.6,
    });

    return response.choices[0]?.message?.content || 'No analysis available';
  } catch (error) {
    console.error('Error analyzing file:', error);
    throw error;
  }
}