'use client';

import React, { useState } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { Navbar } from '@/components/Navbar';
import { BottomNav } from '@/components/BottomNav';
import { AIAssistantFAB } from '@/components/AIAssistantFAB';
import { TransactionModal } from '@/components/TransactionModal';

export function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [entryModalOpen, setEntryModalOpen] = useState(false);

  const handleEntryAdded = () => {
    // Dispatch a global event so any active page (Dashboard, Transactions, etc.) refreshes
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('cashmanager:refresh'));
    }
  };

  return (
    <div className="flex min-h-screen bg-neutral-50/40 text-neutral-900 overflow-x-hidden selection:bg-neutral-900 selection:text-white">
      {/* Desktop Sidebar & Mobile Drawer */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex flex-1 flex-col min-w-0 overflow-x-hidden">
        <Navbar
          onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
          onOpenEntryModal={() => setEntryModalOpen(true)}
        />

        {/* Content area: optimized padding for mobile (tight, crisp, no excessive whitespace) */}
        <main className="flex-1 px-3 py-3.5 sm:px-6 sm:py-6 lg:px-8 max-w-7xl w-full mx-auto pb-24 md:pb-10">
          {children}
        </main>
      </div>

      {/* Modern Mobile Bottom Navigation Dock */}
      <BottomNav onOpenEntryModal={() => setEntryModalOpen(true)} />

      {/* Global Entry Modal */}
      <TransactionModal
        isOpen={entryModalOpen}
        onClose={() => setEntryModalOpen(false)}
        onEntryAdded={handleEntryAdded}
      />

      {/* Floating AI Assistant FAB */}
      <AIAssistantFAB />
    </div>
  );
}
