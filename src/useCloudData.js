import { useEffect, useRef, useState } from "react";
import { onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db, googleProvider } from "./firebase";

const LOCAL_KEY = "habit-ledger-local-v1";

/**
 * Manages Google auth + Firestore-backed app data, one document per user:
 * users/{uid}/appdata/main
 *
 * While signed out, data is kept in localStorage only, so the app is still
 * usable offline / before signing in. On sign-in, local data is merged up
 * to the cloud copy (cloud wins if both exist and differ, since that's the
 * source of truth across devices).
 */
export function useCloudData(defaultData) {
  const [user, setUser] = useState(undefined); // undefined = auth not resolved yet
  const [data, setData] = useState(defaultData);
  const [ready, setReady] = useState(false);
  const saveTimer = useRef(null);
  const loadedFromLocal = useRef(false);

  // resolve auth state once
  useEffect(() => onAuthStateChanged(auth, (u) => setUser(u || null)), []);

  // load data whenever auth state resolves / changes
  useEffect(() => {
    if (user === undefined) return; // still resolving
    (async () => {
      if (!user) {
        try {
          const raw = localStorage.getItem(LOCAL_KEY);
          if (raw) setData(JSON.parse(raw));
        } catch (e) { /* ignore */ }
        loadedFromLocal.current = true;
        setReady(true);
        return;
      }
      try {
        const ref = doc(db, "users", user.uid, "appdata", "main");
        const snap = await getDoc(ref);
        if (snap.exists()) {
          setData(snap.data().payload ? JSON.parse(snap.data().payload) : defaultData);
        } else if (loadedFromLocal.current) {
          // first sign-in with existing local data: push it up as the seed
          await setDoc(ref, { payload: JSON.stringify(data), updatedAt: Date.now() });
        }
      } catch (e) {
        console.error("Firestore load failed", e);
      }
      setReady(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // debounced save on every data change
  useEffect(() => {
    if (!ready) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        if (user) {
          const ref = doc(db, "users", user.uid, "appdata", "main");
          await setDoc(ref, { payload: JSON.stringify(data), updatedAt: Date.now() });
        } else {
          localStorage.setItem(LOCAL_KEY, JSON.stringify(data));
        }
      } catch (e) {
        console.error("save failed", e);
      }
    }, 500);
    return () => clearTimeout(saveTimer.current);
  }, [data, ready, user]);

  const signIn = async () => {
    try { await signInWithPopup(auth, googleProvider); }
    catch (e) { console.error("sign-in failed", e); }
  };
  const signOutUser = () => signOut(auth);

  return { user, data, setData, ready, signIn, signOut: signOutUser };
}
