"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ResidentRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace("/join"); }, [router]);
  return null;
}
