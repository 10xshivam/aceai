import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, X, FileText, Loader2 } from 'lucide-react';

interface FileUploadProps {
  onFileUpload: (file: File) => Promise<void>;
  isUploading: boolean;
}

export function FileUpload({ onFileUpload, isUploading }: FileUploadProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setSelectedFile(acceptedFiles[0]);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'text/plain': ['.txt'],
      'application/json': ['.json'],
      'text/csv': ['.csv'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx']
    },
    maxFiles: 1,
    maxSize: 100 * 1024 * 1024, // 100MB max size
    disabled: isUploading
  });

  const handleUpload = async () => {
    if (selectedFile && !isUploading) {
      await onFileUpload(selectedFile);
      setSelectedFile(null);
    }
  };

  const clearSelectedFile = () => {
    setSelectedFile(null);
  };

  return (
    <div className="w-full">
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
          isDragActive
            ? 'border-blue-500 bg-blue-50/5'
            : 'border-gray-700 hover:border-blue-500 hover:bg-gray-900/30'
        } ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <input {...getInputProps()} />
        <Upload className="mx-auto h-10 w-10 text-gray-400 mb-2" />
        <p className="text-sm text-gray-300">
          {isDragActive
            ? 'Drop the file here...'
            : 'Drag & drop a file here, or click to select'}
        </p>
        <p className="text-xs text-gray-500 mt-1">
          Supported formats: PDF, TXT, JSON, CSV, DOCX, XLSX (Max 100MB)
        </p>
      </div>

      {selectedFile && (
        <div className="mt-4 p-3 bg-gray-900 rounded-lg flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <FileText className="text-blue-400" size={20} />
            <div className="overflow-hidden">
              <p className="text-sm text-white truncate">{selectedFile.name}</p>
              <p className="text-xs text-gray-400">
                {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
          </div>
          <div className="flex space-x-2">
            {isUploading ? (
              <Loader2 className="animate-spin text-blue-400" size={20} />
            ) : (
              <>
                <button
                  onClick={clearSelectedFile}
                  className="p-1 text-gray-400 hover:text-white rounded-full"
                >
                  <X size={18} />
                </button>
                <button
                  onClick={handleUpload}
                  className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-md"
                >
                  Upload
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}