
import firebase from "firebase/compat/app";
import "firebase/compat/auth";
import "firebase/compat/firestore";
import "firebase/compat/storage";
import "firebase/compat/functions";

const firebaseConfig = {
  apiKey: "AIzaSyBOhzEe5pLwlQvZr1gNQyaNNVP-1E-vtAk",
  authDomain: "ethereal-shine-436906-r5.firebaseapp.com",
  projectId: "ethereal-shine-436906-r5",
  storageBucket: "ethereal-shine-436906-r5.firebasestorage.app",
  messagingSenderId: "263629814273",
  appId: "1:263629814273:web:1513ad47ce9da151fe9e00",
  measurementId: "G-CT44E3S7QQ"
};

let app: firebase.app.App | null = null;
let auth: firebase.auth.Auth | null = null;
let db: firebase.firestore.Firestore | null = null;
let storage: firebase.storage.Storage | null = null;
let functions: firebase.functions.Functions | null = null;
let googleProvider: firebase.auth.GoogleAuthProvider | null = null;
let firebaseError: string | null = null;

try {
  // Use the imported firebase object directly.
  if (firebase) {
      // Check if firebase app is already initialized to avoid duplicate initialization errors
      if (!firebase.apps.length) {
        app = firebase.initializeApp(firebaseConfig);
      } else {
        app = firebase.app();
      }
      
      auth = firebase.auth();
      db = firebase.firestore();
      storage = firebase.storage();
      // Initialize Cloud Functions with the specific region 'us-east1'
      functions = firebase.app().functions('us-east1');
      googleProvider = new firebase.auth.GoogleAuthProvider();
  } else {
      throw new Error("Firebase module could not be imported.");
  }
  
} catch (error: any) {
  console.error("Firebase initialization failed:", error);
  firebaseError = `Firebase initialization failed: ${error.message}`;
}

export { app, auth, db, storage, functions, googleProvider, firebaseError };
