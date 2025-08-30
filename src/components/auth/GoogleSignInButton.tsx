"use client";
import * as React from "react";
import { auth, googleProvider } from "@/app/firebase";
import { signInWithPopup } from "firebase/auth";
import { Button } from "@/components/ui/button";

export function GoogleSignInButton() {
  const [busy, setBusy] = React.useState(false);
  const onClick = async () => {
    try {
      setBusy(true);
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      console.error("Google sign-in failed:", err);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Button onClick={onClick} disabled={busy}>
      {busy ? "Signing in..." : "Sign in with Google"}
    </Button>
  );
}
