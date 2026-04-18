import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";
import { getFirestore } from "firebase/firestore";

export const firebaseConfig = {
  apiKey: "AIzaSyCHzMhjOePcNBkvCpJE0H-S2jZ7q9cgaaE",
  authDomain: "scorepredictor-9dd45.firebaseapp.com",
  projectId: "scorepredictor-9dd45",
  storageBucket: "scorepredictor-9dd45.firebasestorage.app",
  messagingSenderId: "555373343943",
  appId: "1:555373343943:web:64e8233090daa9a7043ae2",
  measurementId: "G-N10HQR1382"
};

const app = initializeApp(firebaseConfig);
export const rtdb = getDatabase(app);
export const db = getFirestore(app);
