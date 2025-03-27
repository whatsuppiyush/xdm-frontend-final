"use client";

import { Suspense } from 'react';
import Login from "@/components/login/Login";

export default function LoginPage() {
  return (
    <div>
      <Suspense fallback={<div>Loading...</div>}>
        <Login />
      </Suspense>
    </div>
  );
} 