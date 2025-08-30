"use client";
import { auth } from "@/app/firebase";
import { signOut } from "firebase/auth";
import { Button } from "@/components/ui/button";

export function SignOutButton() {
  return (
    <Button variant="outline" onClick={() => signOut(auth)}>
      Sign out
    </Button>
  );
}
