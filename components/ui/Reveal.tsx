'use client';

import { useEffect } from 'react';

/**
 * Scroll reveal: adds `is-visible` to every element with the `.reveal` class
 * (styles live in app/globals.css) the first time it enters the viewport.
 * Render once per page. Without JavaScript a <noscript> style keeps content visible.
 */
export function RevealObserver() {
  useEffect(() => {
    const elements = Array.from(document.querySelectorAll<HTMLElement>('.reveal:not(.is-visible)'));
    if (!('IntersectionObserver' in window)) {
      elements.forEach((el) => el.classList.add('is-visible'));
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.12 },
    );
    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);
  return null;
}

export default RevealObserver;
