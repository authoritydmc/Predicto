import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";
import { getFirestore } from "firebase/firestore";

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyCHzMhjOePcNBkvCpJE0H-S2jZ7q9cgaaE",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "scorepredictor-9dd45.firebaseapp.com",
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || "https://scorepredictor-9dd45-default-rtdb.firebaseio.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "scorepredictor-9dd45",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "scorepredictor-9dd45.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "555373343943",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:555373343943:web:64e8233090daa9a7043ae2",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-N10HQR1382"
};

const app = initializeApp(firebaseConfig);
export const rtdb = getDatabase(app);
export const db = getFirestore(app);
