'use client';

import { useRef } from 'react';
import type { ReactNode } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { cn } from '@/lib/cn';

type AnimateInProps = {
  children: ReactNode;
  className?: string;
  delay?: number;
};

export function AnimateIn({ children, className, delay = 0 }: AnimateInProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      gsap.fromTo(
        containerRef.current,
        { opacity: 0, y: 12 },
        { opacity: 1, y: 0, duration: 0.4, delay, ease: 'power2.out' },
      );
    },
    { scope: containerRef },
  );

  return (
    <div ref={containerRef} className={cn('opacity-0', className)}>
      {children}
    </div>
  );
}
