import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  updateProfile 
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../config/firebase';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const login = async (email, password) => {
    return signInWithEmailAndPassword(auth, email.trim(), password);
  };

  const signup = async (name, email, password) => {
    const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
    const createdUser = userCredential.user;

    await updateProfile(createdUser, { displayName: name });

    // Create user profile in Firestore
    await setDoc(doc(db, 'users', createdUser.uid), {
      displayName: name,
      email: email.trim(),
      createdAt: serverTimestamp(),
      currency: 'INR',
      timezone: 'Asia/Kolkata',
      physicalWallet: {
        amount: 0,
        denominations: { 500: 0, 200: 0, 100: 0, 50: 0, 20: 0, 10: 0, coins: 0 },
        updatedAt: serverTimestamp()
      }
    }, { merge: true });

    return userCredential;
  };

  const logout = async () => {
    return signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

