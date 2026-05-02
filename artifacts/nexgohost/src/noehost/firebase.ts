import { initializeApp, getApps } from 'firebase/app';
import { getDatabase, ref, set, onValue, get, off } from 'firebase/database';

const firebaseConfig = {
  apiKey: "AIzaSyD9G1t1mmol8Jp163cD9SYL0PHkNvOxGFo",
  authDomain: "noehost-7c4d8.firebaseapp.com",
  databaseURL: "https://noehost-7c4d8-default-rtdb.firebaseio.com",
  projectId: "noehost-7c4d8",
  storageBucket: "noehost-7c4d8.firebasestorage.app",
  messagingSenderId: "895978857909",
  appId: "1:895978857909:web:d85ce711b4d17f721325fc",
  measurementId: "G-EQRHELQT26",
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const database = getDatabase(app);

export { database, ref, set, onValue, get, off };
export default app;
