import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  getDocFromServer,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { ClientRecipient, DispatchLog } from '../types';

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const dbId = (firebaseConfig as any).firestoreDatabaseId;
export const db = dbId ? getFirestore(app, dbId) : getFirestore(app);

// Validate connection on startup as required by Firebase skill
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'reminderConfigs', 'main'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('[Firestore] Client is offline or Firestore config pending.');
    }
  }
}
testConnection();

export interface PersistentReminderConfig {
  reminderTime: string;
  targetEmail: string;
  enabled: boolean;
  lastSentDate?: string;
  lastSentTime?: string;
  googleConnectedEmail?: string;
  lastMessageId?: string;
  updatedAt?: string;
}

export const firestoreService = {
  /**
   * Loads permanent reminder configuration from Firestore
   */
  async getReminderConfig(): Promise<PersistentReminderConfig | null> {
    try {
      const docRef = doc(db, 'reminderConfigs', 'main');
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        return snap.data() as PersistentReminderConfig;
      }
    } catch (e) {
      console.warn('[Firestore] Error reading reminder config:', e);
    }
    return null;
  },

  /**
   * Saves permanent reminder configuration to Firestore
   */
  async saveReminderConfig(config: PersistentReminderConfig): Promise<void> {
    try {
      const docRef = doc(db, 'reminderConfigs', 'main');
      await setDoc(docRef, {
        ...config,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
    } catch (e) {
      console.warn('[Firestore] Error saving reminder config:', e);
    }
  },

  /**
   * Loads client recipients from Firestore
   */
  async getClients(): Promise<ClientRecipient[] | null> {
    try {
      const colRef = collection(db, 'clients');
      const snap = await getDocs(colRef);
      if (!snap.empty) {
        return snap.docs.map((d) => d.data() as ClientRecipient);
      }
    } catch (e) {
      console.warn('[Firestore] Error reading clients:', e);
    }
    return null;
  },

  /**
   * Saves client recipient to Firestore
   */
  async saveClient(client: ClientRecipient): Promise<void> {
    try {
      const docRef = doc(db, 'clients', client.id);
      await setDoc(docRef, client, { merge: true });
    } catch (e) {
      console.warn('[Firestore] Error saving client:', e);
    }
  },

  /**
   * Saves dispatch audit log to Firestore
   */
  async saveDispatchLog(log: DispatchLog): Promise<void> {
    try {
      const docRef = doc(db, 'dispatchLogs', log.id);
      await setDoc(docRef, log, { merge: true });
    } catch (e) {
      console.warn('[Firestore] Error saving dispatch log:', e);
    }
  },

  /**
   * Saves permanent Google connection state to Firestore
   */
  async savePermanentGoogleConnection(data: { userEmail: string; isConnected: boolean; accessToken?: string }): Promise<void> {
    try {
      const docRef = doc(db, 'connections', 'google');
      await setDoc(docRef, {
        ...data,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
    } catch (e) {
      console.warn('[Firestore] Error saving Google connection:', e);
    }
  },

  /**
   * Reads permanent Google connection state from Firestore
   */
  async getPermanentGoogleConnection(): Promise<{ userEmail: string; isConnected: boolean; accessToken?: string } | null> {
    try {
      const docRef = doc(db, 'connections', 'google');
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        return snap.data() as any;
      }
    } catch (e) {
      console.warn('[Firestore] Error reading Google connection:', e);
    }
    return null;
  },

  /**
   * Saves daily scraped TaxTMI data to Firestore
   */
  async saveLatestTaxTMIData(data: { cases: any[]; regulatoryUpdates: any[]; syncedAt: string; dateStr: string }): Promise<void> {
    try {
      const docRef = doc(db, 'taxtmiData', 'latest');
      await setDoc(docRef, {
        ...data,
        savedAt: new Date().toISOString(),
      }, { merge: true });
    } catch (e) {
      console.warn('[Firestore] Error saving TaxTMI data:', e);
    }
  },

  /**
   * Reads latest scraped TaxTMI data from Firestore
   */
  async getLatestTaxTMIData(): Promise<{ cases: any[]; regulatoryUpdates: any[]; syncedAt: string; dateStr: string } | null> {
    try {
      const docRef = doc(db, 'taxtmiData', 'latest');
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        return snap.data() as any;
      }
    } catch (e) {
      console.warn('[Firestore] Error reading TaxTMI data:', e);
    }
    return null;
  },
};
