
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// TODO: REPLACE THIS WITH YOUR ACTUAL FIREBASE PROJECT CONFIGURATION
// 1. Go to console.firebase.google.com
// 2. Create a new project
// 3. Enable Firestore Database
// 4. Copy the config object from Project Settings
export const firebaseConfig = {
  apiKey: "AIzaSyAY0jIgDvI_JOkIrviTDt6U_MGA48hZVuk",
  authDomain: "smart-attendance-123.firebaseapp.com",
  projectId: "smart-attendance-123",
  storageBucket: "smart-attendance-123.firebasestorage.app",
  messagingSenderId: "1070720250180",
  appId: "1:1070720250180:web:f7a82e8f7fa789a8c4a711",
  measurementId: "G-5N46E8ZY82"
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
