import React, { useState } from 'react';
import { X, Send, Loader2 } from 'lucide-react';

interface FileAnalysisModalProps {
  fileName: string;
  onClose: () => void;
  onSubmit: (question: string) => Promise<void>;
  isLoading: boolean;
}

export function FileAnalysisModal({ 
  fileName, 
  onClose, 
  onSubmit,
  isLoading 
}: FileAnalysisModalProps) {
  const [question, setQuestion] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (question.trim() && !isLoading) {
      await onSubmit(question);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 rounded-lg shadow-xl max-w-lg w-full mx-auto">
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <h3 className="text-lg font-medium text-white">Analyze File</h3>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-white rounded-full"
          >
            <X size={20} />
          </button>
        </div>
        
        <div className="p-4">
          <p className="text-gray-300 mb-2">
            What would you like to know about <span className="font-medium text-blue-400">{fileName}</span>?
          </p>
          
          <form onSubmit={handleSubmit}>
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask a question about this file..."
              className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 resize-none"
              rows={4}
              disabled={isLoading}
            />
            
            <div className="flex justify-end mt-4 space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-300 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!question.trim() || isLoading}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    <span>Analyzing...</span>
                  </>
                ) : (
                  <>
                    <Send size={18} />
                    <span>Submit</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}