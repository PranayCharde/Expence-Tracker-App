import { initializeApp, getApps, getApp } from "firebase/app";
import { 
  initializeAuth, 
  getAuth, 
  getReactNativePersistence,
  browserLocalPersistence,
  inMemoryPersistence 
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { Platform } from "react-native";
import safeStorage from "../utils/safeStorage";

const firebaseConfig = {
  apiKey: "AIzaSyCAQLFEdGoJWLPb3wAp96UpWOr79GeCG0Y",
  authDomain: "spendwise-tracker-pranay-13.firebaseapp.com",
  projectId: "spendwise-tracker-pranay-13",
  storageBucket: "spendwise-tracker-pranay-13.firebasestorage.app",
  messagingSenderId: "743686985267",
  appId: "1:743686985267:web:ae77148cb0a353cd0f3546"
};

// Initialize Firebase App
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize Auth with Cross-Platform Safe Persistence
let auth;
try {
  if (Platform.OS === 'web') {
    auth = initializeAuth(app, {
      persistence: browserLocalPersistence
    });
  } else {
    auth = initializeAuth(app, {
      persistence: getReactNativePersistence(safeStorage)
    });
  }
} catch (err) {
  try {
    auth = getAuth(app);
  } catch (e) {
    auth = initializeAuth(app, {
      persistence: inMemoryPersistence
    });
  }
}

export const db = getFirestore(app);
export const storage = getStorage(app);
export { auth };
export default app;

