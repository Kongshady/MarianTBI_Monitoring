import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyBwUbZoHRbAoKg_WI7WJ-LsqSdLXSGJQRg",
  authDomain: "mariantbi.firebaseapp.com",
  projectId: "mariantbi",
  storageBucket: "mariantbi.firebasestorage.app",
  messagingSenderId: "718144640151",
  appId: "1:718144640151:web:e6afd706ce1fdff8c085d2"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
