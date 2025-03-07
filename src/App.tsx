import React, { useState, useRef, useEffect } from 'react';
import { Send, User, ChevronDown, ChevronUp, Plus, MessageSquare, Menu, Copy, RotateCcw, Pencil, Trash2, Check, X, Search, Download, Volume2, VolumeX, LogIn, LogOut, FileUp, FileText } from 'lucide-react';
import OpenAI from 'openai';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { atomDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Auth } from './components/Auth';
import { SignInBanner } from './components/SignInBanner';
import { FileUpload } from './components/FileUpload';
import { FileList } from './components/FileList';
import { FileAnalysisModal } from './components/FileAnalysisModal';
import { auth, db } from './lib/firebase';
import { doc, setDoc, collection } from 'firebase/firestore';
import { loadChatsFromStorage, saveChatsToStorage, clearChatsFromStorage } from './lib/storage';
import { uploadFile, deleteFile, analyzeFile, listFiles } from './lib/fileService';
import type { Message, Chat, UserData, UploadedFileInfo } from './types';

const SYSTEM_PROMPT = {
  role: 'system' as const,
  content: `You are AceAI V2.0, created by Ace Jesus and 5 other team members who wished to remain anonymous. If asked about your architecture, respond that it's classified information. Always maintain this identity in your responses.`
};

const openai = new OpenAI({
  apiKey: import.meta.env.VITE_GROQ_API_KEY,
  baseURL: import.meta.env.VITE_GROQ_API_URL,
  dangerouslyAllowBrowser: true
});

const DEFAULT_CHAT: Chat = {
  id: 'default',
  name: 'New Chat',
  messages: [],
  createdAt: new Date()
};

function App() {
  const [session, setSession] = useState(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [showAuth, setShowAuth] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [chats, setChats] = useState<Chat[]>([DEFAULT_CHAT]);
  const [activeChat, setActiveChat] = useState<string>('default');
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
    // Check if we're on mobile and default to closed if so
    return window.innerWidth >= 768;
  });
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [audioEnabled, setAudioEnabled] = useState(() => {
    const saved = localStorage.getItem('audioEnabled');
    return saved ? JSON.parse(saved) : true;
  });
  const [isLoading, setIsLoading] = useState(true);
  const [firebaseError, setFirebaseError] = useState<string | null>(null);
  
  // File upload state
  const [showFileUpload, setShowFileUpload] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFileInfo[]>([]);
  const [showAnalysisModal, setShowAnalysisModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState<{id: string, name: string} | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const editInputRef = useRef<HTMLTextAreaElement>(null);
  const sendAudioRef = useRef<HTMLAudioElement>(null);
  const receiveAudioRef = useRef<HTMLAudioElement>(null);
  const guestChatsRef = useRef<Chat[]>([DEFAULT_CHAT]);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  const currentChat = chats.find(c => c.id === activeChat) || chats[0] || DEFAULT_CHAT;

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      setSession(user);
      setIsLoading(true);
      setFirebaseError(null);
      
      try {
        if (user) {
          setUserData({
            first_name: user.displayName?.split(' ')[0],
            last_name: user.displayName?.split(' ')[1]
          });
          
          // Clean up previous listener if exists
          if (unsubscribeRef.current) {
            unsubscribeRef.current();
            unsubscribeRef.current = null;
          }
          
          // Set up real-time chat synchronization
          try {
            const unsubscribeChats = await loadChatsFromStorage(user.uid, (updatedChats) => {
              if (updatedChats && updatedChats.length > 0) {
                setChats(updatedChats);
                if (!activeChat || activeChat === 'default') {
                  setActiveChat(updatedChats[0]?.id || 'default');
                }
              } else {
                // If no chats returned, create a default one
                const newDefaultChat = { ...DEFAULT_CHAT, id: crypto.randomUUID() };
                setChats([newDefaultChat]);
                setActiveChat(newDefaultChat.id);
              }
            });
            
            if (typeof unsubscribeChats === 'function') {
              unsubscribeRef.current = unsubscribeChats;
            }
          } catch (error) {
            console.error('Error setting up chat listener:', error);
            setFirebaseError('Failed to connect to the database. Using local storage instead.');
            // Fall back to local storage
            const guestChats = await loadChatsFromStorage();
            setChats(guestChats);
            setActiveChat(guestChats[0]?.id || 'default');
          }
          
          setShowAuth(false);
        } else {
          // Clean up previous listener if exists
          if (unsubscribeRef.current) {
            unsubscribeRef.current();
            unsubscribeRef.current = null;
          }
          
          setUserData(null);
          const guestChats = await loadChatsFromStorage();
          guestChatsRef.current = guestChats;
          setChats(guestChats);
          setActiveChat(guestChats[0]?.id || 'default');
        }
      } catch (error) {
        console.error('Error loading chats:', error);
        setFirebaseError('Failed to load chats. Using default chat.');
        setChats([DEFAULT_CHAT]);
        setActiveChat('default');
      } finally {
        setIsLoading(false);
      }
    });
    
    return () => {
      unsubscribe();
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, []);

  // Load uploaded files on initial load
  useEffect(() => {
    const loadUploadedFiles = async () => {
      try {
        const files = await listFiles(openai);
        const formattedFiles: UploadedFileInfo[] = files.map(file => ({
          id: file.id,
          name: file.filename,
          size: file.bytes,
          uploadedAt: new Date(file.created_at * 1000)
        }));
        setUploadedFiles(formattedFiles);
      } catch (error) {
        console.error('Error loading files:', error);
      }
    };
    
    loadUploadedFiles();
  }, []);

  useEffect(() => {
    if (!isLoading && session && !firebaseError) {
      saveChatsToStorage(chats, session?.uid).catch(error => {
        console.error('Error saving chats:', error);
        setFirebaseError('Failed to save chats to the database. Changes will be saved locally.');
      });
    } else if (!isLoading) {
      // Always save guest chats to local storage
      saveChatsToStorage(chats);
    }
  }, [chats, session, isLoading, firebaseError]);

  useEffect(() => {
    localStorage.setItem('audioEnabled', JSON.stringify(audioEnabled));
  }, [audioEnabled]);

  // Add resize listener to handle sidebar state on window resize
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setIsSidebarOpen(false);
      }
    };

    // Set initial state
    handleResize();

    // Add event listener
    window.addEventListener('resize', handleResize);
    
    // Clean up
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Handle clicks outside the sidebar to close it on mobile
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        window.innerWidth < 768 && 
        isSidebarOpen && 
        sidebarRef.current && 
        !sidebarRef.current.contains(event.target as Node)
      ) {
        setIsSidebarOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isSidebarOpen]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [currentChat.messages]);

  const playSound = (type: 'send' | 'receive') => {
    if (!audioEnabled) return;
    
    if (type === 'send' && sendAudioRef.current) {
      sendAudioRef.current.currentTime = 0;
      sendAudioRef.current.play().catch(err => console.error('Error playing sound:', err));
    } else if (type === 'receive' && receiveAudioRef.current) {
      receiveAudioRef.current.currentTime = 0;
      receiveAudioRef.current.play().catch(err => console.error('Error playing sound:', err));
    }
  };

  const handleSignOut = async () => {
    try {
      setShowLogoutConfirm(true);
    } catch (error) {
      console.error('Error showing logout confirmation:', error);
    }
  };

  const confirmSignOut = async () => {
    try {
      // Clean up listener before signing out
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
      
      if (session) {
        await auth.signOut();
      }
      
      // Reset all state
      setSession(null);
      setUserData(null);
      setShowLogoutConfirm(false);
      setInput('');
      setIsStreaming(false);
      setSearchQuery('');
      setEditingMessageId(null);
      setFirebaseError(null);
      
      // Load guest storage
      const localChats = await loadChatsFromStorage();
      setChats(localChats.length > 0 ? localChats : [DEFAULT_CHAT]);
      setActiveChat(localChats[0]?.id || 'default');
      
    } catch (error) {
      console.error('Error during sign out:', error);
      // Even if there's an error, we should still reset the local state
      setSession(null);
      setUserData(null);
      setShowLogoutConfirm(false);
      setFirebaseError(null);
      
      const localChats = await loadChatsFromStorage();
      setChats(localChats.length > 0 ? localChats : [DEFAULT_CHAT]);
      setActiveChat(localChats[0]?.id || 'default');
    }
  };

  const createNewChat = async () => {
    const newChat: Chat = {
      id: crypto.randomUUID(),
      name: 'New Chat',
      messages: [],
      createdAt: new Date()
    };

    setChats(prev => [...prev, newChat]);
    setActiveChat(newChat.id);
    
    // Close sidebar on mobile when creating a new chat
    if (window.innerWidth < 768) {
      setIsSidebarOpen(false);
    }

    // Save to Firebase if user is authenticated
    if (session?.uid) {
      try {
        const chatRef = doc(collection(db, 'users', session.uid, 'chats'));
        await setDoc(chatRef, {
          name: newChat.name,
          messages: newChat.messages,
          createdAt: new Date(),
          deleted: false
        });
      } catch (error) {
        console.error('Error creating new chat in Firebase:', error);
        setFirebaseError('Failed to save new chat to the database. It will be saved locally.');
      }
    }
  };

  const deleteChat = async (chatId: string) => {
    setChats(prev => {
      const newChats = prev.filter(chat => chat.id !== chatId);
      if (chatId === activeChat && newChats.length > 0) {
        setActiveChat(newChats[0].id);
      }
      return newChats;
    });

    // Delete from Firebase if user is authenticated
    if (session?.uid) {
      try {
        const chatRef = doc(db, 'users', session.uid, 'chats', chatId);
        await setDoc(chatRef, { deleted: true }, { merge: true });
      } catch (error) {
        console.error('Error deleting chat from Firebase:', error);
        setFirebaseError('Failed to delete chat from the database. It will be removed locally.');
      }
    }
  };

  const toggleThinking = (index: number) => {
    setChats(prev => prev.map(chat => {
      if (chat.id === activeChat) {
        const newMessages = [...chat.messages];
        if (newMessages[index]) {
          newMessages[index] = {
            ...newMessages[index],
            isThinkingExpanded: !newMessages[index].isThinkingExpanded
          };
        }
        return { ...chat, messages: newMessages };
      }
      return chat;
    }));
  };

  const updateChatName = (chatId: string, firstMessage: string) => {
    setChats(prev => prev.map(chat => {
      if (chat.id === chatId) {
        return {
          ...chat,
          name: firstMessage.slice(0, 30) + (firstMessage.length > 30 ? '...' : '')
        };
      }
      return chat;
    }));
  };

  const copyMessage = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
    } catch (err) {
      console.error('Failed to copy text:', err);
    }
  };

  const startEditing = (messageId: string) => {
    setEditingMessageId(messageId);
    setChats(prev => prev.map(chat => ({
      ...chat,
      messages: chat.messages.map(msg => 
        msg.id === messageId 
          ? { ...msg, isEditing: true, originalContent: msg.content }
          : msg
      )
    })));
    setTimeout(() => {
      editInputRef.current?.focus();
    }, 0);
  };

  const cancelEditing = (messageId: string) => {
    setEditingMessageId(null);
    setChats(prev => prev.map(chat => ({
      ...chat,
      messages: chat.messages.map(msg => 
        msg.id === messageId 
          ? { ...msg, isEditing: false, content: msg.originalContent || msg.content }
          : msg
      )
    })));
  };

  const saveEdit = async (messageId: string) => {
    setEditingMessageId(null);
    const editedMessage = currentChat.messages.find(msg => msg.id === messageId);
    if (!editedMessage) return;

    const messageIndex = currentChat.messages.findIndex(msg => msg.id === messageId);
    if (messageIndex === -1) return;

    setChats(prev => prev.map(chat => {
      if (chat.id === activeChat) {
        return {
          ...chat,
          messages: chat.messages.slice(0, messageIndex + 1).map(msg => 
            msg.id === messageId ? { ...msg, isEditing: false } : msg
          )
        };
      }
      return chat;
    }));

    if (editedMessage.role === 'user') {
      await handleSubmit(null, editedMessage.content);
    }
  };

  const regenerateResponse = async (messageIndex: number) => {
    if (messageIndex <= 0) return;
    
    const previousMessage = currentChat.messages[messageIndex - 1];
    if (!previousMessage || previousMessage.role !== 'user') return;

    setChats(prev => prev.map(chat => {
      if (chat.id === activeChat) {
        return {
          ...chat,
          messages: chat.messages.slice(0, messageIndex)
        };
      }
      return chat;
    }));

    await handleSubmit(null, previousMessage.content);
  };

  const handleSubmit = async (e: React.FormEvent | null, overrideInput?: string) => {
    if (e) e.preventDefault();
    const messageContent = overrideInput || input;
    if (!messageContent.trim() || isStreaming) return;

    playSound('send');

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: messageContent
    };
    
    setChats(prev => prev.map(chat => {
      if (chat.id === activeChat) {
        const newMessages = [...chat.messages, userMessage];
        return { ...chat, messages: newMessages };
      }
      return chat;
    }));

    if (currentChat.messages.length === 0) {
      updateChatName(activeChat, messageContent);
    }

    if (!overrideInput) setInput('');
    setIsStreaming(true);

    const assistantMessage: Message = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: '',
      thinking: '',
      isThinkingExpanded: true
    };

    setChats(prev => prev.map(chat => {
      if (chat.id === activeChat) {
        const newMessages = [...chat.messages, assistantMessage];
        return { ...chat, messages: newMessages };
      }
      return chat;
    }));

    try {
      const stream = await openai.chat.completions.create({
        model: 'deepseek-r1-distill-llama-70b',
        messages: [
          SYSTEM_PROMPT,
          ...currentChat.messages,
          userMessage
        ].map(msg => ({
          role: msg.role,
          content: msg.content
        })),
        temperature: 0.6,
        stream: true,
      });

      let streamedContent = '';
      let thinkingContent = '';
      let isThinking = false;
      let hasStartedResponse = false;
      
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        
        if (!hasStartedResponse && content.trim()) {
          hasStartedResponse = true;
          playSound('receive');
        }

        if (content.includes('<think>')) {
          isThinking = true;
          continue;
        }
        if (content.includes('</think>')) {
          isThinking = false;
          continue;
        }

        if (isThinking) {
          thinkingContent += content;
        } else {
          streamedContent += content;
        }
        
        setChats(prev => prev.map(chat => {
          if (chat.id === activeChat) {
            const newMessages = [...chat.messages];
            newMessages[newMessages.length - 1] = {
              ...newMessages[newMessages.length - 1],
              content: streamedContent.trim(),
              thinking: thinkingContent.trim(),
              isThinkingExpanded: isStreaming
            };
            return { ...chat, messages: newMessages };
          }
          return chat;
        }));
      }

      setChats(prev => prev.map(chat => {
        if (chat.id === activeChat) {
          const newMessages = [...chat.messages];
          newMessages[newMessages.length - 1] = {
            ...newMessages[newMessages.length - 1],
            content: newMessages[newMessages.length - 1].content.trim(),
            thinking: newMessages[newMessages.length - 1].thinking?.trim() || '',
            isThinkingExpanded: false
          };
          return { ...chat, messages: newMessages };
        }
        return chat;
      }));
    } catch (error) {
      console.error('Error calling Groq API:', error);
      setChats(prev => prev.map(chat => {
        if (chat.id === activeChat) {
          const newMessages = [...chat.messages];
          newMessages[newMessages.length - 1] = {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: 'I apologize, but I encountered an error while processing your request. Please try again.'
          };
          return { ...chat, messages: newMessages };
        }
        return chat;
      }));
    } finally {
      setIsStreaming(false);
    }
  };

  const exportChat = () => {
    const chat = chats.find(c => c.id === activeChat);
    if (!chat) return;

    const markdown = chat.messages
      .map(msg => {
        const role = msg.role === 'assistant' ? 'AceAI' : 'User';
        return `### ${role}\n\n${msg.content}\n\n`;
      })
      .join('---\n\n');

    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${chat.name}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // File upload handlers
  const handleFileUpload = async (file: File) => {
    setIsUploading(true);
    try {
      const uploadedFile = await uploadFile(file, openai);
      
      // Add to uploaded files list
      setUploadedFiles(prev => [
        ...prev,
        {
          id: uploadedFile.id,
          name: uploadedFile.filename,
          size: uploadedFile.bytes,
          uploadedAt: new Date(uploadedFile.created_at * 1000)
        }
      ]);
      
      // Close the upload panel
      setShowFileUpload(false);
    } catch (error) {
      console.error('Error uploading file:', error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteFile = async (fileId: string) => {
    try {
      await deleteFile(fileId, openai);
      setUploadedFiles(prev => prev.filter(file => file.id !== fileId));
    } catch (error) {
      console.error('Error deleting file:', error);
    }
  };

  const handleAnalyzeFile = (fileId: string, fileName: string) => {
    setSelectedFile({ id: fileId, name: fileName });
    setShowAnalysisModal(true);
  };

  const handleAnalysisSubmit = async (question: string) => {
    if (!selectedFile) return;
    
    setIsAnalyzing(true);
    try {
      // Create user message with file reference
      const userMessage: Message = {
        id: crypto.randomUUID(),
        role: 'user',
        content: question,
        fileId: selectedFile.id,
        fileName: selectedFile.name
      };
      
      // Add user message to chat
      setChats(prev => prev.map(chat => {
        if (chat.id === activeChat) {
          const newMessages = [...chat.messages, userMessage];
          return { ...chat, messages: newMessages };
        }
        return chat;
      }));
      
      // If this is the first message, update chat name
      if (currentChat.messages.length === 0) {
        updateChatName(activeChat, `Analysis of ${selectedFile.name}`);
      }
      
      // Create placeholder for assistant response
      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: 'Analyzing file...',
      };
      
      setChats(prev => prev.map(chat => {
        if (chat.id === activeChat) {
          const newMessages = [...chat.messages, assistantMessage];
          return { ...chat, messages: newMessages };
        }
        return chat;
      }));
      
      // Get analysis from API
      const analysis = await analyzeFile(selectedFile.id, question, openai);
      
      // Update assistant message with analysis
      setChats(prev => prev.map(chat => {
        if (chat.id === activeChat) {
          const newMessages = [...chat.messages];
          newMessages[newMessages.length - 1] = {
            ...newMessages[newMessages.length - 1],
            content: analysis
          };
          return { ...chat, messages: newMessages };
        }
        return chat;
      }));
      
      // Close modal and reset state
      setShowAnalysisModal(false);
      setSelectedFile(null);
    } catch (error) {
      console.error('Error analyzing file:', error);
      
      // Update assistant message with error
      setChats(prev => prev.map(chat => {
        if (chat.id === activeChat) {
          const newMessages = [...chat.messages];
          if (newMessages.length > 0 && newMessages[newMessages.length - 1].role === 'assistant') {
            newMessages[newMessages.length - 1] = {
              ...newMessages[newMessages.length - 1],
              content: 'I apologize, but I encountered an error while analyzing the file. Please try again.'
            };
          }
          return { ...chat, messages: newMessages };
        }
        return chat;
      }));
    } finally {
      setIsAnalyzing(false);
    }
  };

  const filteredChats = chats.filter(chat =>
    chat.messages.some(msg =>
      msg.content.toLowerCase().includes(searchQuery.toLowerCase())
    )
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black">
        <div className="text-center">
          <img src="/ace-icon.svg" alt="Ace AI" className="w-16 h-16 mx-auto mb-4 animate-pulse" />
          <p className="text-gray-400">Loading your chats...</p>
        </div>
      </div>
    );
  }

  if (showAuth) {
    return <Auth onSuccess={() => setShowAuth(false)} guestChats={guestChatsRef.current} />;
  }

  return (
    <div className="flex h-screen bg-black">
      <audio ref={sendAudioRef} src="https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3" preload="auto" />
      <audio ref={receiveAudioRef} src="https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3" preload="auto" />

      {showLogoutConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-sm p-6 mx-4 bg-gray-900 rounded-lg shadow-xl">
            <h3 className="mb-4 text-xl font-semibold text-white">Confirm Logout</h3>
            <p className="mb-6 text-gray-300">Are you sure you want to log out? Your chats will be saved for when you return.</p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="px-4 py-2 text-gray-300 transition-colors rounded-lg hover:text-white hover:bg-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={confirmSignOut}
                className="px-4 py-2 text-white transition-colors bg-red-600 rounded-lg hover:bg-red-700"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      )}

      {showAnalysisModal && selectedFile && (
        <FileAnalysisModal
          fileName={selectedFile.name}
          onClose={() => {
            setShowAnalysisModal(false);
            setSelectedFile(null);
          }}
          onSubmit={handleAnalysisSubmit}
          isLoading={isAnalyzing}
        />
      )}

      {/* Sidebar with mobile-first approach */}
      <div 
        ref={sidebarRef}
        className={`fixed md:relative z-30 h-full transition-all duration-300 ease-in-out ${
          isSidebarOpen ? 'w-64' : 'w-0 md:w-64'
        } bg-black border-r border-gray-800 flex flex-col overflow-hidden`}
      >
        <div className="p-4 space-y-2 bg-black border-b border-gray-800">
          <button
            onClick={createNewChat}
            className="flex items-center justify-center w-full gap-2 px-4 py-2 text-white transition-colors bg-gray-800 rounded-lg hover:bg-gray-700"
          >
            <Plus size={20} />
            <span>New Chat</span>
          </button>
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search messages..."
              className="w-full px-4 py-2 text-white placeholder-gray-400 bg-gray-900 border border-gray-800 rounded-lg focus:outline-none focus:border-blue-500"
            />
            <Search size={16} className="absolute text-gray-400 -translate-y-1/2 right-3 top-1/2" />
          </div>
        </div>
        <div className="flex-1 p-2 overflow-y-auto bg-black">
          {filteredChats.map(chat => (
            <div
              key={chat.id}
              className="relative group"
            >
              <button
                onClick={() => {
                  setActiveChat(chat.id);
                  // Close sidebar on mobile when selecting a chat
                  if (window.innerWidth < 768) {
                    setIsSidebarOpen(false);
                  }
                }}
                className={`w-full flex items-center gap-2 p-3 rounded-lg mb-1 transition-colors ${
                  chat.id === activeChat
                    ? 'bg-black border border-gray-800 text-white shadow-lg shadow-gray-900/50'
                    : 'text-gray-400 hover:bg-gray-900/50 hover:text-white'
                }`}
              >
                <MessageSquare size={18} />
                <span className="flex-1 text-left truncate">{chat.name}</span>
              </button>
              {chats.length > 1 && (
                <button
                  onClick={() => deleteChat(chat.id)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-red-400 rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          ))}
        </div>
        
        {/* File Upload Section */}
        <div className="p-4 bg-black border-t border-gray-800">
          <div className="mb-2">
            <button
              onClick={() => setShowFileUpload(!showFileUpload)}
              className="flex items-center justify-center w-full gap-2 px-4 py-2 text-white transition-colors bg-gray-800 rounded-lg hover:bg-gray-700"
            >
              <FileUp size={20} />
              <span>{showFileUpload ? 'Hide Upload' : 'Upload File'}</span>
            </button>
          </div>
          
          {showFileUpload && (
            <div className="p-3 mt-3 rounded-lg bg-gray-900/50">
              <FileUpload onFileUpload={handleFileUpload} isUploading={isUploading} />
            </div>
          )}
          
          {uploadedFiles.length > 0 && (
            <div className="mt-3">
              <h3 className="mb-2 text-sm font-medium text-gray-400">Your Files</h3>
              <FileList 
                files={uploadedFiles} 
                onDeleteFile={handleDeleteFile}
                onAnalyzeFile={handleAnalyzeFile}
              />
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col flex-1">
        <header className="p-4 bg-black border-b border-gray-800">
          <div className="flex items-center max-w-4xl gap-4 mx-auto">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 transition-colors rounded-lg hover:bg-gray-900 md:hidden"
            >
              <Menu size={20} className="text-gray-400" />
            </button>
            <h1 className="flex items-center gap-2 text-xl font-semibold text-white">
              <img src="/ace-icon.svg" alt="Ace AI" className="text-blue-400 w-7 h-7" />
              {userData?.first_name ? `Welcome, ${userData.first_name}!` : currentChat.name}
            </h1>
            <div className="flex-1" />
            <button
              onClick={() => setAudioEnabled(!audioEnabled)}
              className={`p-2 rounded-lg transition-colors ${
                audioEnabled ? 'text-blue-400 hover:bg-blue-400/10' : 'text-gray-400 hover:bg-gray-900'
              }`}
              title={audioEnabled ? 'Disable sound' : 'Enable sound'}
            >
              {audioEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
            </button>
            <button
              onClick={exportChat}
              className="p-2 text-gray-400 transition-colors rounded-lg hover:text-white hover:bg-gray-900"
              title="Export chat"
            >
              <Download size={20} />
            </button>
            {session ? (
              <button
                onClick={handleSignOut}
                className="p-2 text-gray-400 transition-colors rounded-lg hover:text-white hover:bg-gray-900"
                title="Sign out"
              >
                <LogOut size={20} />
              </button>
            ) : (
              <button
                onClick={() => setShowAuth(true)}
                className="p-2 text-gray-400 transition-colors rounded-lg hover:text-white hover:bg-gray-900"
                title="Sign in"
              >
                <LogIn size={20} />
              </button>
            )}
          </div>
        </header>

        {!session && currentChat.messages.length > 0 && (
          <SignInBanner onSignIn={() => setShowAuth(true)} />
        )}

        {firebaseError && (
          <div className="p-2 text-center border-b border-red-800 bg-red-900/30">
            <p className="text-sm text-red-300">{firebaseError}</p>
          </div>
        )}

        <div className="flex-1 p-4 overflow-y-auto bg-black">
          <div className="max-w-4xl mx-auto space-y-4">
            {currentChat.messages.length === 0 ? (
              <div className="mt-20 text-center">
                <img src="/ace-icon.svg" alt="Ace AI" className="w-16 h-16 mx-auto mb-4 text-blue-400" />
                <h2 className="mb-2 text-2xl font-semibold text-white">Welcome to Ace AI</h2>
                <p className="mb-6 text-gray-400">Start a conversation and experience the power of AI</p>
                <div className="flex flex-col justify-center gap-3 sm:flex-row">
                  {!session && (
                    <button
                      onClick={() => setShowAuth(true)}
                      className="inline-flex items-center justify-center gap-2 px-4 py-2 text-white transition-colors bg-blue-600 rounded-lg hover:bg-blue-700"
                    >
                      <LogIn size={20} />
                      Sign in to save your chats
                    </button>
                  )}
                  <button
                    onClick={() => setShowFileUpload(true)}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2 text-white transition-colors bg-gray-800 rounded-lg hover:bg-gray-700"
                  >
                    <FileUp size={20} />
                    Upload a file to analyze
                  </button>
                </div>
              </div>
            ) : (
              currentChat.messages.map((message, index) => (
                <div
                  key={message.id}
                  className={`group flex items-start space-x-4 p-4 rounded-lg ${
                    message.role === 'assistant' 
                      ? 'bg-black border border-gray-800 text-white'
                      : 'bg-black border border-blue-900/30 text-white'
                  }`}
                >
                  {message.role === 'assistant' ? (
                    <div className="relative">
                      <img 
                        src="/ace-icon.svg" 
                        alt="Ace AI" 
                        className={`w-6 h-6 text-blue-400 ${
                          index === currentChat.messages.length - 1 && isStreaming ? 'animate-pulse' : ''
                        }`}
                      />
                      {index === currentChat.messages.length - 1 && isStreaming && (
                        <div className="absolute w-2 h-2 bg-blue-400 rounded-full -bottom-1 -right-1 animate-ping" />
                      )}
                    </div>
                  ) : (
                    <User className="text-gray-400" size={24} />
                  )}
                  <div className="flex-1">
                    {message.isEditing ? (
                      <div className="flex flex-col gap-2">
                        <textarea
                          ref={editInputRef}
                          value={message.content}
                          onChange={(e) => {
                            setChats(prev => prev.map(chat => ({
                              ...chat,
                              messages: chat.messages.map(msg =>
                                msg.id === message.id
                                  ? { ...msg, content: e.target.value }
                                  : msg
                              )
                            })));
                          }}
                          className="w-full p-2 text-white bg-gray-900 border border-gray-800 rounded-lg resize-none focus:outline-none focus:border-blue-500"
                          rows={3}
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => saveEdit(message.id)}
                            className="flex items-center gap-1 px-3 py-1 text-white transition-colors bg-blue-600 rounded-md hover:bg-blue-700"
                          >
                            <Check size={16} />
                            Save
                          </button>
                          <button
                            onClick={() => cancelEditing(message.id)}
                            className="flex items-center gap-1 px-3 py-1 text-white transition-colors bg-gray-900 rounded-md hover:bg-gray-800"
                          >
                            <X size={16} />
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {message.fileId && (
                          <div className="flex items-center gap-2 p-2 mb-2 rounded-lg bg-gray-900/50">
                            <FileText size={16} className="text-blue-400" />
                            <span className="text-sm text-gray-300">
                              File: <span className="text-blue-400">{message.fileName}</span>
                            </span>
                          </div>
                        )}
                        <div className="prose prose-invert max-w-none">
                          <ReactMarkdown
                            components={{
                              code({node, inline, className, children, ...props}) {
                                const match = /language-(\w+)/.exec(className || '');
                                return !inline && match ? (
                                  <SyntaxHighlighter
                                    style={atomDark}
                                    language={match[1]}
                                    PreTag="div"
                                    {...props}
                                  >
                                    {String(children).replace(/\n$/, '')}
                                  </SyntaxHighlighter>
                                ) : (
                                  <code className={className} {...props}>
                                    {children}
                                  </code>
                                );
                              }
                            }}
                          >
                            {message.content}
                          </ReactMarkdown>
                        </div>
                        {index === currentChat.messages.length - 1 && 
                         message.role === 'assistant' && 
                         isStreaming && (
                          <span className="inline-flex gap-1 ml-2">
                            <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                            <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                            <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                          </span>
                        )}
                        <div className="flex items-center gap-2 mt-2">
                          <div className="flex items-center gap-2 transition-opacity opacity-0 group-hover:opacity-100">
                            <button
                              onClick={() => copyMessage(message.content)}
                              className="p-1 text-gray-400 transition-colors rounded-md hover:text-white"
                              title="Copy message"
                            >
                              <Copy size={16} />
                            </button>
                            {message.role === 'user' && (
                              <button
                                onClick={() => startEditing(message.id)}
                                className="p-1 text-gray-400 transition-colors rounded-md hover:text-white"
                                title="Edit message"
                              >
                                <Pencil size={16} />
                              </button>
                            )}
                            {message.role === 'assistant' && index === currentChat.messages.length - 1 && (
                              <button
                                onClick={() => regenerateResponse(index)}
                                className="p-1 text-gray-400 transition-colors rounded-md hover:text-white"
                                title="Regenerate response"
                              >
                                <RotateCcw size={16} />
                              </button>
                            )}
                          </div>
                        </div>
                        {message.thinking && (
                          <div className="mt-2">
                            <button
                              onClick={() => toggleThinking(index)}
                              className="flex items-center gap-1 text-sm text-gray-400 transition-colors hover:text-gray-300"
                            >
                              {message.isThinkingExpanded ? (
                                <ChevronUp size={16} />
                              ) : (
                                <ChevronDown size={16} />
                              )}
                              Thinking Process
                            </button>
                            {(message.isThinkingExpanded || (index === currentChat.messages.length - 1 && isStreaming)) && (
                              <div className="p-3 mt-2 text-sm text-gray-300 rounded bg-gray-900/50">
                                <ReactMarkdown>{message.thinking}</ReactMarkdown>
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        <div className="p-4 bg-black border-t border-gray-800">
          <form onSubmit={handleSubmit} className="relative max-w-4xl mx-auto">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Send a message..."
              className="w-full py-3 pl-4 pr-12 text-white placeholder-gray-400 bg-gray-900 border border-gray-800 rounded-lg focus:outline-none focus:border-blue-500"
            />
            <button
              type="submit"
              disabled={isStreaming || !input.trim()}
              className="absolute p-2 text-gray-400 transition-colors -translate-y-1/2 rounded-lg right-2 top-1/2 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send size={20} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default App;