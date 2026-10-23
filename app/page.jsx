'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/collezione');
  }, [router]);

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-[#08060C]">
      <div className="h-12 w-12 rounded-full border-2 border-emerald-400 border-t-transparent animate-spin" />
    </div>
  );
}
