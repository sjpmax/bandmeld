import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/auth-form";

export const metadata: Metadata = { title: "Sign up" };

export default function SignupPage() {
  return (
    <>
      <h1 className="text-3xl font-bold">Create your account</h1>
      <AuthForm mode="signup" />
    </>
  );
}
