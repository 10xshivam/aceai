import React from 'react';
import { FileText, Trash2, Search } from 'lucide-react';
import { UploadedFileInfo } from '../types';

interface FileListProps {
  files: UploadedFileInfo[];
  onDeleteFile: (fileId: string) => Promise<void>;
  onAnalyzeFile: (fileId: string, fileName: string) => void;
}

export function FileList({ files, onDeleteFile, onAnalyzeFile }: FileListProps) {
  if (files.length === 0) {
    return (
      <div className="text-center py-4">
        <p className="text-gray-400 text-sm">No files uploaded yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {files.map((file) => (
        <div 
          key={file.id} 
          className="bg-gray-900 rounded-lg p-3 flex items-center justify-between group"
        >
          <div className="flex items-center space-x-3">
            <FileText className="text-blue-400" size={20} />
            <div>
              <p className="text-sm text-white truncate max-w-[200px]">{file.name}</p>
              <p className="text-xs text-gray-400">
                {new Date(file.uploadedAt).toLocaleDateString()} • 
                {(file.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
          </div>
          <div className="flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => onAnalyzeFile(file.id, file.name)}
              className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-md transition-colors"
              title="Analyze file"
            >
              <Search size={16} />
            </button>
            <button
              onClick={() => onDeleteFile(file.id)}
              className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-gray-800 rounded-md transition-colors"
              title="Delete file"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}