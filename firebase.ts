
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

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
export const auth = getAuth(app);
export const db = getFirestore(app);
