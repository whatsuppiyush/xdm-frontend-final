"use client";

import { Suspense } from 'react';
import Login from "@/components/login/Login";

export default function LoginPage() {
  return (
    <div className="dark">
      <Suspense fallback={<div>Loading...</div>}>
        <Login />
      </Suspense>
    </div>
  );
} 