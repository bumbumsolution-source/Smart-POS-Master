import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDS_Hy6WRRt00yXQLPpDKKR9-OXkr2u5tU",
  authDomain: "bumbumsolution-f6ca3.firebaseapp.com",
  projectId: "bumbumsolution-f6ca3",
  storageBucket: "bumbumsolution-f6ca3.firebasestorage.app",
  messagingSenderId: "654957271853",
  appId: "1:654957271853:web:f08e1973cab234f32ad1a4",
  measurementId: "G-16ERF1Q0VV"
};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);

export { app, db };
