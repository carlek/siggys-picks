"use client";
import { useAuth } from "@/hooks/useAuth";
import { GoogleSignInButton } from "./GoogleSignInButton";
import { SignOutButton } from "./SignOutButton";

export function AuthStrip() {
  const { user, loading } = useAuth();
  if (loading) return <div className="text-sm text-muted-foreground">Loading...</div>;

  return user ? (
    <div className="flex items-center gap-3">
      <span className="text-sm">{user.displayName || user.email}</span>
      <SignOutButton />
    </div>
  ) : (
    <GoogleSignInButton />
  );
}
