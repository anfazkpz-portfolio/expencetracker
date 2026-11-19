'use client';

import React, { useEffect } from 'react';
import { motion, AnimatePresence, HTMLMotionProps } from 'framer-motion';

// Page-level entrance animation - initial={false} ensures immediate visibility on first load with zero blank screen
export function PageTransition({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      initial={false}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// Stagger container for dashboard cards & lists - always visible by default
export const staggerContainerVariants: any = {
  hidden: { opacity: 1 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.04,
      delayChildren: 0.01,
    },
  },
};

export const staggerItemVariants: any = {
  hidden: { opacity: 1, y: 0 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.24,
      ease: 'easeOut',
    },
  },
};

export function StaggerContainer({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      variants={staggerContainerVariants}
      initial={false}
      animate="visible"
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div variants={staggerItemVariants} initial={false} className={className}>
      {children}
    </motion.div>
  );
}

// Scroll reveal animation for sections entering the viewport - defaults to visible to prevent blank screens
export function ScrollReveal({
  children,
  className = '',
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={false}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-20px' }}
      transition={{ duration: 0.25, delay, ease: 'easeOut' }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// Premium card with hover lift and soft glow
export function CardMotion({
  children,
  className = '',
  onClick,
  ...props
}: HTMLMotionProps<'div'> & {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      whileHover={{
        y: -2,
        transition: { duration: 0.18, ease: 'easeOut' },
      }}
      whileTap={{ scale: 0.995 }}
      onClick={onClick}
      className={`transition-shadow duration-200 hover:shadow-md hover:border-neutral-300 ${className}`}
      {...props}
    >
      {children}
    </motion.div>
  );
}

// Button micro-interaction
export function ButtonMotion({
  children,
  className = '',
  onClick,
  type = 'button',
  disabled = false,
  ...props
}: HTMLMotionProps<'button'> & {
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <motion.button
      type={type}
      disabled={disabled}
      onClick={onClick}
      whileHover={!disabled ? { scale: 1.02 } : undefined}
      whileTap={!disabled ? { scale: 0.98 } : undefined}
      transition={{ duration: 0.12 }}
      className={className}
      {...props}
    >
      {children}
    </motion.button>
  );
}

// Animated modal with backdrop blur & spring entrance
export function AnimatedModal({
  isOpen,
  onClose,
  children,
  maxWidth = 'max-w-md',
  className = '',
}: {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: string;
  className?: string;
}) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 1, y: 0 }}
            transition={{
              type: 'spring',
              damping: 26,
              stiffness: 340,
            }}
            className={`relative z-10 w-[94vw] sm:w-full ${maxWidth} max-h-[88vh] overflow-y-auto rounded-2xl border border-neutral-200/90 bg-white p-4 sm:p-6 shadow-2xl my-auto ${className}`}
          >
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
