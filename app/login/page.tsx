import type { Metadata } from "next";
import LoginClient from "./login-client";

export const metadata: Metadata = { title: "Entrar · Kero" };

export default function LoginPage() {
  return <LoginClient />;
}
