import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDBBQ-Oof9yOmmsM3hISVU2Jgk7fhSWyuY",
  authDomain: "habit-ledger-653bf.firebaseapp.com",
  projectId: "habit-ledger-653bf",
  storageBucket: "habit-ledger-653bf.firebasestorage.app",
  messagingSenderId: "990054346104",
  appId: "1:990054346104:web:87c68d0010a625234a2c8d",
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

