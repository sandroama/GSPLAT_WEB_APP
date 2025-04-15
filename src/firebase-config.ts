// Import the functions you need from the SDKs you need
import { initializeApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';
// import { getAnalytics } from 'firebase/analytics'; // Analytics can be added if needed

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
    apiKey: 'AIzaSyBovwP8aOJjmdJ5XxkrQMLiYY-8eNY6pqM',
    authDomain: 'gauss-mobile.firebaseapp.com',
    projectId: 'gauss-mobile',
    storageBucket: 'gauss-mobile.appspot.com', // Corrected storage bucket domain
    messagingSenderId: '883069691924',
    appId: '1:883069691924:web:0cc94a13eb70a0be769f01',
    measurementId: 'G-YW2GMFB2XX'
};

// Initialize Firebase
const app: FirebaseApp = initializeApp(firebaseConfig);
// const analytics = getAnalytics(app); // Initialize Analytics if needed

// Initialize Firebase services
const auth: Auth = getAuth(app);
const db: Firestore = getFirestore(app);
const storage: FirebaseStorage = getStorage(app);

// Export the initialized services
export { app, auth, db, storage };
