import { initializeApp, type FirebaseApp } from "firebase/app";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";
import {
  addDoc,
  collection,
  getDocs,
  getFirestore,
  limit,
  orderBy,
  query,
  serverTimestamp,
  type Firestore
} from "firebase/firestore";

export interface LeaderboardEntry {
  playerName: string;
  score: number;
  createdAt?: unknown;
}

export interface LeaderboardService {
  enabled: boolean;
  submitScore(entry: LeaderboardEntry): Promise<void>;
  fetchTopScores(): Promise<LeaderboardEntry[]>;
}

const COLLECTION_NAME = "leaderboard";
const MAX_SCORE = 300;
const MAX_NAME_LENGTH = 16;

let app: FirebaseApp | null = null;
let db: Firestore | null = null;

export function createLeaderboardService(): LeaderboardService {
  const config = getFirebaseConfig();

  if (!config) {
    return createDisabledLeaderboardService();
  }

  app = initializeApp(config);

  if (import.meta.env.PUBLIC_RECAPTCHA_V3_SITE_KEY) {
    initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(import.meta.env.PUBLIC_RECAPTCHA_V3_SITE_KEY),
      isTokenAutoRefreshEnabled: true
    });
  }

  db = getFirestore(app);

  return {
    enabled: true,
    async submitScore(entry) {
      assertValidEntry(entry);
      await addDoc(collection(db as Firestore, COLLECTION_NAME), {
        playerName: entry.playerName,
        score: entry.score,
        createdAt: serverTimestamp()
      });
    },
    async fetchTopScores() {
      const topScoresQuery = query(
        collection(db as Firestore, COLLECTION_NAME),
        orderBy("score", "desc"),
        orderBy("createdAt", "asc"),
        limit(10)
      );
      const snapshot = await getDocs(topScoresQuery);

      return snapshot.docs.map((doc) => {
        const data = doc.data() as LeaderboardEntry;
        return {
          playerName: data.playerName,
          score: data.score,
          createdAt: data.createdAt
        };
      });
    }
  };
}

function createDisabledLeaderboardService(): LeaderboardService {
  return {
    enabled: false,
    async submitScore() {
      return undefined;
    },
    async fetchTopScores() {
      return [];
    }
  };
}

function getFirebaseConfig() {
  const { PUBLIC_FIREBASE_API_KEY, PUBLIC_FIREBASE_AUTH_DOMAIN, PUBLIC_FIREBASE_PROJECT_ID, PUBLIC_FIREBASE_APP_ID } =
    import.meta.env;

  if (!PUBLIC_FIREBASE_API_KEY || !PUBLIC_FIREBASE_AUTH_DOMAIN || !PUBLIC_FIREBASE_PROJECT_ID || !PUBLIC_FIREBASE_APP_ID) {
    return null;
  }

  return {
    apiKey: PUBLIC_FIREBASE_API_KEY,
    authDomain: PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: PUBLIC_FIREBASE_PROJECT_ID,
    appId: PUBLIC_FIREBASE_APP_ID
  };
}

function assertValidEntry(entry: LeaderboardEntry): void {
  if (entry.playerName.length < 1 || entry.playerName.length > MAX_NAME_LENGTH) {
    throw new Error("玩家名稱長度不符合排行榜限制。");
  }

  if (!Number.isInteger(entry.score) || entry.score < 0 || entry.score > MAX_SCORE) {
    throw new Error("分數超出排行榜允許範圍。");
  }
}
