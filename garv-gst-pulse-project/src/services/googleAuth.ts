import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
  signOut
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { firestoreService } from './firestoreService';

// Initialize Firebase App instance safely
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);

export const SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/gmail.send'
];

const provider = new GoogleAuthProvider();
SCOPES.forEach(scope => provider.addScope(scope));
provider.setCustomParameters({
  access_type: 'offline',
  prompt: 'consent',
});

let isSigningIn = false;
const TOKEN_KEY = 'gstpulse_google_access_token';
let cachedAccessToken: string | null = null;

try {
  cachedAccessToken = localStorage.getItem(TOKEN_KEY);
} catch {}

export const getPermanentConnectionDetails = () => {
  let token = cachedAccessToken;
  if (!token) {
    try {
      token = localStorage.getItem(TOKEN_KEY);
    } catch {}
  }
  const isPermanent = typeof localStorage !== 'undefined' && localStorage.getItem('gstpulse_permanent_connected') === 'true';
  const email =
    (typeof localStorage !== 'undefined' ? localStorage.getItem('gstpulse_google_user_email') : null) ||
    auth.currentUser?.email ||
    'anshumadocuments@gmail.com';
  const savedAt = Number((typeof localStorage !== 'undefined' ? localStorage.getItem('gstpulse_token_saved_at') : null) || '0');
  const ageMs = savedAt ? Date.now() - savedAt : Infinity;
  const isFresh = ageMs < 55 * 60 * 1000;
  const minutesRemaining = Math.max(0, Math.floor((55 * 60 * 1000 - ageMs) / 60000));

  return {
    isConnected: isPermanent || !!token || !!auth.currentUser,
    email,
    isFresh,
    minutesRemaining,
    savedAt,
    user: auth.currentUser,
  };
};

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  const isPermanent = typeof localStorage !== 'undefined' && localStorage.getItem('gstpulse_permanent_connected') === 'true';
  const storedEmail = typeof localStorage !== 'undefined' ? localStorage.getItem('gstpulse_google_user_email') : null;

  if (!cachedAccessToken) {
    try {
      cachedAccessToken = localStorage.getItem(TOKEN_KEY);
    } catch {}
  }

  // 1. Immediately provide permanent session synchronously if previously connected!
  if ((isPermanent || storedEmail) && onAuthSuccess) {
    const permanentUser: any = {
      email: storedEmail || 'anshumadocuments@gmail.com',
      displayName: (storedEmail || 'anshumadocuments').split('@')[0],
      photoURL: null,
      uid: 'permanent-user-id',
    };
    onAuthSuccess(permanentUser, cachedAccessToken || '');
  }

  // 2. Restore permanent Google connection from Firestore in background
  firestoreService.getPermanentGoogleConnection().then((saved) => {
    if (saved?.isConnected && saved?.userEmail) {
      try {
        localStorage.setItem('gstpulse_permanent_connected', 'true');
        localStorage.setItem('gstpulse_google_user_email', saved.userEmail);
        if (saved.accessToken && saved.accessToken !== 'permanent-google-drive-session') {
          cachedAccessToken = saved.accessToken;
          localStorage.setItem(TOKEN_KEY, saved.accessToken);
        }
        if (onAuthSuccess) {
          const permUser: any = {
            email: saved.userEmail,
            displayName: saved.userEmail.split('@')[0],
            photoURL: null,
            uid: 'permanent-google-user',
          };
          onAuthSuccess(permUser, cachedAccessToken || '');
        }
      } catch {}
    }
  }).catch(() => {});

  // 3. Listen to Firebase auth state changes
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (!cachedAccessToken) {
        try {
          const stored = localStorage.getItem(TOKEN_KEY);
          if (stored && stored !== 'permanent-google-drive-session') {
            cachedAccessToken = stored;
          }
        } catch {}
      }

      if (user.email) {
        try {
          localStorage.setItem('gstpulse_google_user_email', user.email);
          localStorage.setItem('gstpulse_permanent_connected', 'true');
        } catch {}
      }

      if (onAuthSuccess) {
        onAuthSuccess(user, cachedAccessToken || '');
      }
    } else {
      // Do NOT erase connection when user is null on initial load!
      // If user had permanent connection enabled, maintain connected state forever
      if (isPermanent || storedEmail || cachedAccessToken) {
        const permanentUser: any = {
          email: storedEmail || 'anshumadocuments@gmail.com',
          displayName: (storedEmail || 'anshumadocuments').split('@')[0],
          photoURL: null,
          uid: 'permanent-user-id',
        };
        if (onAuthSuccess) {
          onAuthSuccess(permanentUser, cachedAccessToken || '');
        }
      } else if (onAuthFailure) {
        onAuthFailure();
      }
    }
  });
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  if (isSigningIn) {
    return null;
  }
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to get access token from Google sign in');
    }

    cachedAccessToken = credential.accessToken;
    try {
      localStorage.setItem(TOKEN_KEY, credential.accessToken);
      localStorage.setItem('gstpulse_token_saved_at', String(Date.now()));
      if (result.user.email) {
        localStorage.setItem('gstpulse_google_user_email', result.user.email);
      }
      localStorage.setItem('gstpulse_permanent_connected', 'true');

      // Persist to Cloud Firestore for permanent cross-session Google Drive connection
      firestoreService.savePermanentGoogleConnection({
        userEmail: result.user.email || 'anshumadocuments@gmail.com',
        isConnected: true,
        accessToken: credential.accessToken,
      }).catch(() => {});
    } catch {}
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    // Gracefully handle user closing the popup or cancelling without generating console errors
    if (
      error?.code === 'auth/popup-closed-by-user' ||
      error?.code === 'auth/cancelled-popup-request' ||
      error?.message?.includes('popup-closed-by-user')
    ) {
      console.info('Google sign-in popup was closed by user.');
      return null;
    }

    if (error?.code === 'auth/popup-blocked') {
      console.warn('Google sign-in popup was blocked by browser.');
      throw new Error('Sign-in popup was blocked by your browser. Please allow popups for this site and try again.');
    }

    const errStr = `${error?.code || ''} ${error?.message || ''}`;
    if (errStr.includes('access_denied') || errStr.includes('403') || errStr.includes('blocked')) {
      throw new Error('OAUTH_TESTING_MODE_ACCESS_DENIED');
    }

    console.warn('Google Sign in note:', error?.message || error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  if (cachedAccessToken && cachedAccessToken !== 'permanent-google-drive-session') {
    return cachedAccessToken;
  }
  try {
    const stored = localStorage.getItem(TOKEN_KEY);
    if (stored && stored !== 'permanent-google-drive-session') {
      cachedAccessToken = stored;
      return stored;
    }
    const firestoreConn = await firestoreService.getPermanentGoogleConnection();
    if (firestoreConn?.accessToken && firestoreConn.accessToken !== 'permanent-google-drive-session') {
      cachedAccessToken = firestoreConn.accessToken;
      return firestoreConn.accessToken;
    }
  } catch {}
  return null;
};

export const logout = async () => {
  await signOut(auth);
  cachedAccessToken = null;
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem('gstpulse_token_saved_at');
  } catch {}
};
