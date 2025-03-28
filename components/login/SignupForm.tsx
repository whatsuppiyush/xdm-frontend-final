"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { signIn } from "next-auth/react";
import { toast } from "sonner";

export default function SignupForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    name: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to sign up");
      }

      if (data.message) {
        // Display coming soon message
        setMessage(data.message);
        toast.info(data.message);
      } else if (data.success) {
        // Automatically sign in after successful signup
        await signIn("credentials", {
          email: formData.email,
          password: formData.password,
          callbackUrl: "/",
          redirect: true,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to sign up");
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4" data-oid="2epemmv">
      {error && (
        <Alert variant="destructive" className="bg-red-100 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-200 dark:border-red-500/20" data-oid="t.o1ba7">
          <AlertDescription data-oid="p4k1z52">{error}</AlertDescription>
        </Alert>
      )}
      
      {message && (
        <Alert className="bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-200 dark:border-blue-500/20">
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2" data-oid="2:fc.g7">
        <Label htmlFor="name" className="text-slate-700 dark:text-slate-200" data-oid="lb7bk5o">
          Name
        </Label>
        <Input
          id="name"
          name="name"
          placeholder="Enter your name"
          value={formData.name}
          onChange={handleChange}
          className="bg-white border border-slate-300 text-slate-900 dark:bg-white dark:text-black dark:border-0 rounded-xl placeholder:text-slate-400"
          data-oid="8o_g4xk"
        />
      </div>

      <div className="space-y-2" data-oid=":nvfr8m">
        <Label htmlFor="email" className="text-slate-700 dark:text-slate-200" data-oid="cr8j6hi">
          Email
        </Label>
        <Input
          id="email"
          name="email"
          type="email"
          placeholder="Enter your email"
          value={formData.email}
          onChange={handleChange}
          required
          className="bg-white border border-slate-300 text-slate-900 dark:bg-white dark:text-black dark:border-0 rounded-xl placeholder:text-slate-400"
          data-oid="ldw_46f"
        />
      </div>

      <div className="space-y-2" data-oid="kld1wcq">
        <Label htmlFor="password" className="text-slate-700 dark:text-slate-200" data-oid="qe0w.et">
          Password
        </Label>
        <Input
          id="password"
          name="password"
          type="password"
          placeholder="Create a password"
          value={formData.password}
          onChange={handleChange}
          required
          className="bg-white border border-slate-300 text-slate-900 dark:bg-white dark:text-black dark:border-0 rounded-xl placeholder:text-slate-400"
          data-oid="auab6-k"
        />
      </div>

      <Button
        type="submit"
        className="w-full bg-purple-600 hover:bg-purple-500 text-white transition-all duration-200"
        disabled={isLoading}
        data-oid=".degw-q"
      >
        {isLoading ? "Processing..." : "Sign Up"}
      </Button>
    </form>
  );
}
