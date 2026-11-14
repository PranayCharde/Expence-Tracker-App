import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// In-memory fallback dictionary
const memoryStore = new Map();

// Flag to track whether native AsyncStorage has failed
let nativeStorageBroken = false;

export const safeStorage = {
  async getItem(key) {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
      try {
        return window.localStorage.getItem(key);
      } catch (e) {
        return memoryStore.get(key) || null;
      }
    }

    if (!nativeStorageBroken) {
      try {
        const value = await AsyncStorage.getItem(key);
        return value;
      } catch (err) {
        nativeStorageBroken = true;
      }
    }

    return memoryStore.get(key) || null;
  },

  async setItem(key, value) {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(key, String(value));
        return;
      } catch (e) {
        memoryStore.set(key, String(value));
        return;
      }
    }

    if (!nativeStorageBroken) {
      try {
        await AsyncStorage.setItem(key, String(value));
        return;
      } catch (err) {
        nativeStorageBroken = true;
      }
    }

    memoryStore.set(key, String(value));
  },

  async removeItem(key) {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.removeItem(key);
        return;
      } catch (e) {
        memoryStore.delete(key);
        return;
      }
    }

    if (!nativeStorageBroken) {
      try {
        await AsyncStorage.removeItem(key);
        return;
      } catch (err) {
        nativeStorageBroken = true;
      }
    }

    memoryStore.delete(key);
  }
};

export default safeStorage;

