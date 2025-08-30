"use client";
import * as React from "react";
import { auth } from "@/app/firebase";
import { onAuthStateChanged, User } from "firebase/auth";

export function useAuth() {
  const [user, setUser] = React.useState<User | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!auth) {
      setUser(null);
      setLoading(false);
      return;
    }
    const unsub = onAuthStateChanged(auth, u => {
      setUser(u);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  return { user, loading };
}
