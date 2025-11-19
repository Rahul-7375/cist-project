import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Helper to safely get env vars or default to placeholder
const getEnv = (key: string, fallback: string) => {
  // Check if process.env exists (Node/Build env)
  if (typeof process !== 'undefined' && process.env && process.env[key]) {
    return process.env[key];
  }
  // Check if import.meta.env exists (Vite env)
  // @ts-ignore
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) {
    // @ts-ignore
    return import.meta.env[key];
  }
  return fallback;
};

// For Firebase JS SDK v7.20.0 and later, measurementId is optional
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyC1S6qoxeq76PZvgqTRRt5YxgX8QiewZm0",
  authDomain: "attandence-systam.firebaseapp.com",
  projectId: "attandence-systam",
  storageBucket: "attandence-systam.firebasestorage.app",
  messagingSenderId: "550025220620",
  appId: "1:550025220620:web:78279ddc006b799d895429",
  measurementId: "G-WW0ZEMF108"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);