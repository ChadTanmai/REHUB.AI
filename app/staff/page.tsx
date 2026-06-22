"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function StaffRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace("/therapist"); }, [router]);
  return null;
}
