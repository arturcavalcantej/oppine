import { useEffect, useRef, useState, RefObject } from 'react';

interface UseScrollAnimationOptions {
  threshold?: number;
  once?: boolean;
  rootMargin?: string;
}

export function useScrollAnimation<T extends HTMLElement = HTMLDivElement>(
  options: UseScrollAnimationOptions = {}
): [RefObject<T>, boolean] {
  const { threshold = 0.15, once = true, rootMargin = '0px' } = options;
  const ref = useRef<T>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    // Check for reduced motion preference
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          if (once) {
            observer.unobserve(element);
          }
        } else if (!once) {
          setIsVisible(false);
        }
      },
      {
        threshold,
        rootMargin,
      }
    );

    observer.observe(element);

    return () => {
      observer.unobserve(element);
    };
  }, [threshold, once, rootMargin]);

  return [ref, isVisible];
}

// Hook for staggered animations (multiple children)
export function useStaggerAnimation<T extends HTMLElement = HTMLDivElement>(
  itemCount: number,
  options: UseScrollAnimationOptions = {}
): [RefObject<T>, boolean[]] {
  const [containerRef, isContainerVisible] = useScrollAnimation<T>(options);
  const [visibleItems, setVisibleItems] = useState<boolean[]>(
    new Array(itemCount).fill(false)
  );

  useEffect(() => {
    if (!isContainerVisible) {
      setVisibleItems(new Array(itemCount).fill(false));
      return;
    }

    // Stagger the visibility of items
    const timers: NodeJS.Timeout[] = [];

    for (let i = 0; i < itemCount; i++) {
      const timer = setTimeout(() => {
        setVisibleItems(prev => {
          const next = [...prev];
          next[i] = true;
          return next;
        });
      }, i * 100); // 100ms stagger
      timers.push(timer);
    }

    return () => {
      timers.forEach(clearTimeout);
    };
  }, [isContainerVisible, itemCount]);

  return [containerRef, visibleItems];
}
