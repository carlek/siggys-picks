import { initializeApp, getApps } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
  enableAuth: process.env.NEXT_PUBLIC_FIREBASE_ENABLE_AUTH === "true",
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

export const auth = firebaseConfig.enableAuth ? getAuth(app) : null;
export const googleProvider = firebaseConfig.enableAuth ? new GoogleAuthProvider() : null;
