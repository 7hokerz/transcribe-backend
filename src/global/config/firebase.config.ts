import { getStorage } from "firebase-admin/storage";
import { getFirestore } from "firebase-admin/firestore";
import { initializeApp, cert, getApps, getApp } from "firebase-admin/app";
import { getDatabase } from "firebase-admin/database";

const isDevelopment = process.env.NODE_ENV === 'development';
const useEmulator = process.env.USE_FIREBASE_EMULATOR === 'true';

// 에뮬레이터 연결
if (isDevelopment && useEmulator) {
  process.env.STORAGE_EMULATOR_HOST = '127.0.0.1:9199';
}

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

export type GCSBucket = ReturnType<typeof adminStorage.bucket>;