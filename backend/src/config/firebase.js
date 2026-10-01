let disabledLogged = false;

const getFirebaseApp = () => {
  if (!disabledLogged) {
    console.warn('[Firebase] Firebase auth is disabled. Only admin@salon.com login is available.');
    disabledLogged = true;
  }
  return null;
};

export const getAuth = () => null;

export const verifyIdToken = async () => {
  throw new Error('Firebase auth is disabled');
};

export default getFirebaseApp;
