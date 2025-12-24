import { getStorage } from "firebase-admin/storage";
import { getFirestore } from "firebase-admin/firestore";
import { initializeApp, cert, getApps, getApp } from "firebase-admin/app";
import { getDatabase } from "firebase-admin/database";

export type GCSBucket = ReturnType<typeof adminStorage.bucket>;

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY!);

const adminApp = !getApps().length
  ? initializeApp({ 
      credential: cert(serviceAccount),
      storageBucket: 'quiz-whiz-hqbig',
      databaseURL: 'https://quiz-whiz-hqbig-default-rtdb.asia-southeast1.firebasedatabase.app',
    })
  : getApp();

export const adminFirestore = getFirestore(adminApp, "quizgen-db");
adminFirestore.settings({ ignoreUndefinedProperties: true });

export const adminDatabase = getDatabase(adminApp);
export const adminStorage = getStorage(adminApp);
export const bucket = adminStorage.bucket('quiz-whiz-hqbig');