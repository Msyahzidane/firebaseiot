import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
  // Use environment variables for flexibility, but default to the user's provided config
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyBj6bhAq584TStUQDuP-Ee0rBuxnbjgyoA",
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || "https://dane-27e94-default-rtdb.firebaseio.com",
};

const app = initializeApp(firebaseConfig);
export const database = getDatabase(app);
