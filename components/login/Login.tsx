"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useSearchParams, useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import SignupForm from "./SignupForm";
import { toast } from "@/components/ui/use-toast";
import Image from "next/image";

export default function Login() {
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignup, setIsSignup] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const error = searchParams?.get("error");

  const getErrorMessage = (error: string) => {
    switch (error) {
      case "CredentialsSignin":
        return "Invalid email or password.";
      case "OAuthSignin":
        return "Could not sign in with Google.";
      default:
        return "An error occurred. Please try again.";
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        toast({
          variant: "destructive",
          title: "Login Failed",
          description: "Invalid email or password.",
        });
      } else {
        toast({
          title: "Success!",
          description: "You have successfully logged in.",
        });
        router.push("/");
        router.refresh();
      }
    } catch (error) {
      console.error("Login failed:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "An unexpected error occurred.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    try {
      const result = await signIn("google", {
        redirect: false,
        callbackUrl: "/"
      });

      if (result?.ok) {
        router.push("/");
        router.refresh();
      }
    } catch (error) {
      console.error("Google login failed:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to sign in with Google.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-950 via-purple-950/20 to-slate-950"
      data-oid="oymr3mq"
    >
      <Card className="w-[380px] border-none bg-slate-900/40 backdrop-blur-xl shadow-2xl dark:shadow-purple-500/10" data-oid="vvvaj69">
        <CardHeader className="text-center space-y-6" data-oid="e3.vhhx">
          <div className="flex items-center justify-center w-full">
            <div className="relative w-12 h-12">
              <Image
                src="https://xautodm.com/logo.svg"
                alt="xAutoDM"
                fill
                priority
                className="object-contain"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <CardTitle className="text-2xl font-bold bg-gradient-to-r from-white to-purple-200 bg-clip-text text-transparent" data-oid="b.1tfqt">
              {isSignup ? "Create Account" : "Welcome Back"}
            </CardTitle>
            <CardDescription className="text-slate-400" data-oid="8fxro9s">
              {isSignup
                ? "Sign up to get started"
                : "Login to access your dashboard"}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4" data-oid="aby.uqp">
          {error && (
            <Alert variant="destructive" className="bg-red-500/10 text-red-200 border-red-500/20" data-oid="sg.dw3t">
              <AlertDescription data-oid="jq.kc5r">
                {getErrorMessage(error)}
              </AlertDescription>
            </Alert>
          )}

          {isSignup ? (
            <SignupForm data-oid="5vo3c4x" />
          ) : (
            <>
              <form
                onSubmit={handleEmailLogin}
                className="space-y-4"
                data-oid="izeh.g."
              >
                <div className="space-y-2" data-oid="-fgfy4a">
                  <Label htmlFor="email" className="text-slate-200" data-oid="w3kg2a_">
                    Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="bg-white text-black border-0 rounded-xl placeholder:text-slate-400"
                    data-oid="8mdc8a4"
                  />
                </div>
                <div className="space-y-2" data-oid="cqb2057">
                  <Label htmlFor="password" className="text-slate-200" data-oid="k6y9cm.">
                    Password
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="bg-white text-black border-0 rounded-xl placeholder:text-slate-400"
                    data-oid="gt7j6e4"
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full bg-purple-600 hover:bg-purple-500 text-white transition-all duration-200"
                  disabled={isLoading}
                  data-oid="qzx:bkr"
                >
                  {isLoading ? "Signing in..." : "Sign in with Email"}
                </Button>
              </form>

              <div className="relative" data-oid="zqktp6c">
                <div className="absolute inset-0 flex items-center" data-oid="f2hui3v">
                  <span className="w-full border-t border-slate-700/50" data-oid="sn7h4mh" />
                </div>
                <div className="relative flex justify-center text-xs uppercase" data-oid="kyk-rz3">
                  <span className="bg-slate-900/40 px-2 text-slate-400" data-oid="z_3p0g.">
                    Or continue with
                  </span>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                className="w-full bg-slate-800/50 text-white border-slate-700/50 hover:bg-slate-700/50 hover:border-purple-500/50 transition-all duration-200"
                onClick={handleGoogleLogin}
                disabled={isLoading}
                data-oid="k_ntip-"
              >
                <svg
                  className="mr-2 h-4 w-4"
                  aria-hidden="true"
                  focusable="false"
                  data-prefix="fab"
                  data-icon="google"
                  role="img"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 488 512"
                  data-oid="jtm00c7"
                >
                  <path
                    fill="currentColor"
                    d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z"
                    data-oid="n6_zan4"
                  ></path>
                </svg>
                {isLoading ? "Signing in..." : "Sign in with Google"}
              </Button>
            </>
          )}

          <div className="text-center text-sm" data-oid="ap-xw7j">
            <button
              type="button"
              className="text-purple-400 hover:text-purple-300 transition-colors duration-200"
              onClick={() => setIsSignup(!isSignup)}
              data-oid="0vbwzs7"
            >
              {isSignup
                ? "Already have an account? Sign in"
                : "Don't have an account? Sign up"}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
