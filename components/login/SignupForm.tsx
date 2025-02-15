"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { signIn } from "next-auth/react";

export default function SignupForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    name: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

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

      // Automatically sign in after successful signup
      await signIn("credentials", {
        email: formData.email,
        password: formData.password,
        callbackUrl: "/",
        redirect: true,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to sign up");
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
        <Alert variant="destructive" data-oid="t.o1ba7">
          <AlertDescription data-oid="p4k1z52">{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2" data-oid="2:fc.g7">
        <Label htmlFor="name" data-oid="lb7bk5o">
          Name
        </Label>
        <Input
          id="name"
          name="name"
          placeholder="Enter your name"
          value={formData.name}
          onChange={handleChange}
          data-oid="8o_g4xk"
        />
      </div>

      <div className="space-y-2" data-oid=":nvfr8m">
        <Label htmlFor="email" data-oid="cr8j6hi">
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
          data-oid="ldw_46f"
        />
      </div>

      <div className="space-y-2" data-oid="kld1wcq">
        <Label htmlFor="password" data-oid="qe0w.et">
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
          data-oid="auab6-k"
        />
      </div>

      <Button
        type="submit"
        className="w-full"
        disabled={isLoading}
        data-oid=".degw-q"
      >
        {isLoading ? "Creating Account..." : "Sign Up"}
      </Button>
    </form>
  );
}
