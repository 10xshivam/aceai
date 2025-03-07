import { useState, useEffect } from 'react';
import { auth, db } from '../lib/firebase';
import {
  collection,
  query,
  getDocs,
  setDoc,
  doc,
  orderBy,
  serverTimestamp,
  writeBatch,
  where,
  onSnapshot
} from 'firebase/firestore';
import type { Chat } from '../types';

interface UseFirebaseChatsReturn {
  chats: Chat[];
  loading: boolean;
  error: string | null;
  saveChats: (chats: Chat[]) => Promise<void>;
  clearChats: () => Promise<void>;
}

export const useFirebaseChats = (userId?: string): UseFirebaseChatsReturn => {
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Set up real-time listener for chats when userId changes
  useEffect(() => {
    if (!userId) {
      setChats([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const chatsRef = collection(db, 'users', userId, 'chats');
    const q = query(
      chatsRef,
      where('deleted', '==', false),
      orderBy('createdAt', 'desc')
    );

    // Set up real-time listener
    const unsubscribe = onSnapshot(q, 
      (snapshot) => {
        try {
          const loadedChats = snapshot.docs.map(doc => ({
            id: doc.id,
            name: doc.data().name || 'New Chat',
            messages: doc.data().messages || [],
            createdAt: doc.data().createdAt?.toDate() || new Date()
          }));
          setChats(loadedChats);
          setLoading(false);
          setError(null);
        } catch (err) {
          console.error('Error processing chat data:', err);
          setError('Failed to process chat data. Please try again.');
          setLoading(false);
        }
      },
      (err) => {
        console.error('Error in chat listener:', err);
        setError('Failed to sync chats. Please check your connection.');
        setLoading(false);
      }
    );

    // Cleanup listener on unmount or when userId changes
    return () => unsubscribe();
  }, [userId]);

  // Save chats to Firebase with optimistic updates
  const saveChats = async (updatedChats: Chat[]) => {
    if (!userId) return;

    // Optimistically update local state
    setChats(updatedChats);

    try {
      const batch = writeBatch(db);

      updatedChats.forEach(chat => {
        if (!chat.id) return;

        const chatRef = doc(db, 'users', userId, 'chats', chat.id);
        batch.set(chatRef, {
          name: chat.name,
          messages: chat.messages,
          createdAt: serverTimestamp(),
          deleted: false
        }, { merge: true });
      });

      await batch.commit();
      setError(null);
    } catch (err) {
      console.error('Error saving chats:', err);
      setError('Failed to save chats. Please try again.');
      // Revert optimistic update on error
      setChats(chats);
      throw err;
    }
  };

  // Clear all chats
  const clearChats = async () => {
    if (!userId) return;

    try {
      const batch = writeBatch(db);
      const chatsRef = collection(db, 'users', userId, 'chats');
      const querySnapshot = await getDocs(chatsRef);

      querySnapshot.docs.forEach((doc) => {
        batch.set(doc.ref, { deleted: true }, { merge: true });
      });

      await batch.commit();
      setChats([]);
    } catch (err) {
      console.error('Error clearing chats:', err);
      setError('Failed to clear chats. Please try again.');
      throw err;
    }
  };

  return {
    chats,
    loading,
    error,
    saveChats,
    clearChats
  };
};