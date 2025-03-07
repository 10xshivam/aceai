import { auth, db } from './firebase';
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
  onSnapshot,
  getDoc,
  DocumentReference
} from 'firebase/firestore';
import type { Chat } from '../types';

const DEFAULT_CHAT: Chat = {
  id: 'default',
  name: 'New Chat',
  messages: [],
  createdAt: new Date()
};

// Helper function to safely access Firestore
const safeFirestoreOperation = async <T>(operation: () => Promise<T>, fallback: T): Promise<T> => {
  try {
    return await operation();
  } catch (error) {
    console.error('Firestore operation failed:', error);
    return fallback;
  }
};

export const loadChatsFromStorage = async (userId?: string, onUpdate?: (chats: Chat[]) => void): Promise<any> => {
  // For guest users or if there's an error, use local storage
  const loadFromLocalStorage = (): Chat[] => {
    try {
      const storedChats = localStorage.getItem('guest_chats');
      if (storedChats) {
        const parsedChats = JSON.parse(storedChats);
        return parsedChats.length > 0 ? parsedChats : [DEFAULT_CHAT];
      }
    } catch (error) {
      console.error('Error loading from local storage:', error);
    }
    return [DEFAULT_CHAT];
  };

  // If no user ID, just load from local storage
  if (!userId) {
    return loadFromLocalStorage();
  }

  try {
    console.log('Loading chats for user:', userId);
    
    // Ensure the user document exists
    try {
      const userDocRef = doc(db, 'users', userId);
      const userDoc = await getDoc(userDocRef);
      
      if (!userDoc.exists()) {
        await setDoc(userDocRef, { 
          lastActive: serverTimestamp(),
          createdAt: serverTimestamp()
        });
      } else {
        await setDoc(userDocRef, { 
          lastActive: serverTimestamp() 
        }, { merge: true });
      }
    } catch (error) {
      console.error('Error ensuring user document exists:', error);
      // Continue even if this fails
    }
    
    // Set up real-time listener if onUpdate is provided
    if (onUpdate) {
      try {
        const chatsRef = collection(db, 'users', userId, 'chats');
        const q = query(
          chatsRef,
          where('deleted', '!=', true),
          orderBy('deleted', 'asc'),
          orderBy('createdAt', 'desc')
        );
        
        const unsubscribe = onSnapshot(q, 
          (snapshot) => {
            const chats = snapshot.docs.map(doc => ({
              id: doc.id,
              name: doc.data().name || 'New Chat',
              messages: doc.data().messages || [],
              createdAt: doc.data().createdAt?.toDate() || new Date()
            }));
            
            if (chats.length > 0) {
              onUpdate(chats);
            } else {
              // Create a default chat if no chats exist
              createDefaultChat(userId).then(defaultChat => {
                onUpdate([defaultChat]);
              }).catch(error => {
                console.error('Error creating default chat:', error);
                onUpdate([{ ...DEFAULT_CHAT, id: crypto.randomUUID() }]);
              });
            }
          },
          (error) => {
            console.error('Error in chat listener:', error);
            // Fall back to local storage on error
            onUpdate(loadFromLocalStorage());
          }
        );
        
        return unsubscribe;
      } catch (error) {
        console.error('Error setting up chat listener:', error);
        // Fall back to local storage on error
        onUpdate(loadFromLocalStorage());
        return () => {}; // Return empty function as unsubscribe
      }
    }
    
    // If no onUpdate provided, load chats once
    try {
      const chatsRef = collection(db, 'users', userId, 'chats');
      const q = query(
        chatsRef,
        where('deleted', '!=', true),
        orderBy('deleted', 'asc'),
        orderBy('createdAt', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        // Create a default chat for new users
        const defaultChat = await createDefaultChat(userId);
        return [defaultChat];
      }
      
      const chats = querySnapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name || 'New Chat',
        messages: doc.data().messages || [],
        createdAt: doc.data().createdAt?.toDate() || new Date()
      }));
      
      return chats;
    } catch (error) {
      console.error('Error loading chats from Firestore:', error);
      return loadFromLocalStorage();
    }
  } catch (error) {
    console.error('Error loading chats:', error);
    return loadFromLocalStorage();
  }
};

// Helper function to create a default chat
const createDefaultChat = async (userId: string): Promise<Chat> => {
  const defaultChatId = crypto.randomUUID();
  const defaultChat = { ...DEFAULT_CHAT, id: defaultChatId };
  
  try {
    const newChatRef = doc(db, 'users', userId, 'chats', defaultChatId);
    await setDoc(newChatRef, {
      name: 'New Chat',
      messages: [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      deleted: false
    });
    return defaultChat;
  } catch (error) {
    console.error('Error creating default chat:', error);
    return defaultChat; // Return the chat object even if saving to Firebase failed
  }
};

export const saveChatsToStorage = async (chats: Chat[], userId?: string) => {
  // Always save to local storage as a backup
  try {
    localStorage.setItem('guest_chats', JSON.stringify(chats));
  } catch (error) {
    console.error('Error saving to local storage:', error);
  }
  
  // If no user ID, we're done
  if (!userId) {
    return;
  }
  
  try {
    console.log('Saving chats for user:', userId);
    
    // Ensure the user document exists
    try {
      const userDocRef = doc(db, 'users', userId);
      const userDoc = await getDoc(userDocRef);
      
      if (!userDoc.exists()) {
        await setDoc(userDocRef, { 
          lastActive: serverTimestamp(),
          createdAt: serverTimestamp()
        });
      } else {
        await setDoc(userDocRef, { 
          lastActive: serverTimestamp() 
        }, { merge: true });
      }
    } catch (error) {
      console.error('Error ensuring user document exists:', error);
      // Continue even if this fails
    }
    
    // Save each chat to Firestore using batch write
    const batch = writeBatch(db);
    let operationCount = 0;
    const maxBatchSize = 400; // Firestore limit is 500, but we'll stay well under
    
    for (const chat of chats) {
      if (!chat.id || (chat.id === 'default' && chat.messages.length === 0)) continue;
      
      const chatRef = doc(db, 'users', userId, 'chats', chat.id);
      batch.set(chatRef, {
        name: chat.name,
        messages: chat.messages,
        createdAt: chat.createdAt || serverTimestamp(),
        updatedAt: serverTimestamp(),
        deleted: false
      }, { merge: true });
      
      operationCount++;
      
      // If we're approaching the batch limit, commit and start a new batch
      if (operationCount >= maxBatchSize) {
        await batch.commit();
        operationCount = 0;
      }
    }
    
    // Commit any remaining operations
    if (operationCount > 0) {
      await batch.commit();
    }
    
    console.log('Successfully saved chats to Firebase');
  } catch (error) {
    console.error('Error saving chats to Firebase:', error);
    throw error; // Let the caller handle the error
  }
};

export const clearChatsFromStorage = async (userId?: string) => {
  // Always clear local storage
  localStorage.removeItem('guest_chats');
  
  // If no user ID, we're done
  if (!userId) {
    return;
  }
  
  try {
    console.log('Clearing chats for user:', userId);
    
    const chatsRef = collection(db, 'users', userId, 'chats');
    const querySnapshot = await getDocs(chatsRef);
    
    if (!querySnapshot.empty) {
      const batch = writeBatch(db);
      let operationCount = 0;
      const maxBatchSize = 400;
      
      querySnapshot.docs.forEach((doc) => {
        batch.set(doc.ref, { 
          deleted: true, 
          updatedAt: serverTimestamp() 
        }, { merge: true });
        
        operationCount++;
        
        // If we're approaching the batch limit, commit and start a new batch
        if (operationCount >= maxBatchSize) {
          batch.commit();
          operationCount = 0;
        }
      });
      
      // Commit any remaining operations
      if (operationCount > 0) {
        await batch.commit();
      }
      
      console.log('Successfully marked chats as deleted in Firebase');
    }
  } catch (error) {
    console.error('Error clearing chats:', error);
    throw error; // Let the caller handle the error
  }
};

export const transferGuestChats = async (guestChats: Chat[]) => {
  if (!guestChats || guestChats.length === 0) {
    console.log('No guest chats to transfer');
    return true; // Nothing to transfer is still a success
  }
  
  const user = auth.currentUser;
  if (!user) {
    console.log('No authenticated user to transfer chats to');
    return false;
  }
  
  try {
    console.log('Transferring guest chats for user:', user.uid);
    
    // Ensure the user document exists
    try {
      const userDocRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);
      
      if (!userDoc.exists()) {
        await setDoc(userDocRef, { 
          lastActive: serverTimestamp(),
          createdAt: serverTimestamp()
        });
      } else {
        await setDoc(userDocRef, { 
          lastActive: serverTimestamp() 
        }, { merge: true });
      }
    } catch (error) {
      console.error('Error ensuring user document exists:', error);
      // Continue even if this fails
    }
    
    // Process chats in batches to avoid Firestore limits
    const batch = writeBatch(db);
    let operationCount = 0;
    const maxBatchSize = 400;
    
    for (const chat of guestChats) {
      if (!chat.messages || chat.messages.length === 0) continue;
      
      const chatRef = doc(collection(db, 'users', user.uid, 'chats'));
      batch.set(chatRef, {
        name: chat.name || 'Imported Chat',
        messages: chat.messages,
        createdAt: chat.createdAt || serverTimestamp(),
        updatedAt: serverTimestamp(),
        deleted: false
      });
      
      operationCount++;
      
      // If we're approaching the batch limit, commit and start a new batch
      if (operationCount >= maxBatchSize) {
        await batch.commit();
        operationCount = 0;
      }
    }
    
    // Commit any remaining operations
    if (operationCount > 0) {
      await batch.commit();
    }
    
    console.log('Successfully transferred guest chats to Firebase');
    localStorage.removeItem('guest_chats');
    return true;
  } catch (error) {
    console.error('Error transferring guest chats to Firebase:', error);
    throw error; // Let the caller handle the error
  }
};