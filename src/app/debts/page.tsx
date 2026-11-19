'use client';

import React, { useState, useMemo } from 'react';
import {
  HandCoins,
  Plus,
  UserPlus,
  Search,
  ArrowUpRight,
  ArrowDownRight,
  Users,
  CheckCircle2,
  Phone,
  RefreshCw,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useLedgerOverview } from '@/lib/queries/hooks';
import { invalidateFinanceQueries } from '@/lib/queries/invalidation';
import { formatCurrency, formatDateDDMMYYYY } from '@/lib/utils';
import {
  PageTransition,
  StaggerContainer,
  StaggerItem,
  CardMotion,
} from '@/components/animations/MotionWrapper';
import { AddContactModal } from '@/components/ledger/AddContactModal';
import { AddLedgerEntryModal } from '@/components/ledger/AddLedgerEntryModal';
import { ContactLedgerDrawer } from '@/components/ledger/ContactLedgerDrawer';
import type { LedgerOverview, ContactSummary, LedgerEntryType } from '@/types/ledger';

const DEFAULT_LEDGER: LedgerOverview = {
  totalToReceive: 0,
  totalToPay: 0,
  netBalance: 0,
  contactsCount: 0,
  activeContactsCount: 0,
  contacts: [],
};

export default function DebtsPage() {
  const { data: ledger = DEFAULT_LEDGER, isLoading, isFetching, refetch } = useLedgerOverview();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState<'all' | 'to_receive' | 'to_pay' | 'settled'>('all');

  // Modals & Drawer State
  const [isAddContactOpen, setIsAddContactOpen] = useState(false);
  const [isAddEntryOpen, setIsAddEntryOpen] = useState(false);
  const [selectedContactForEntry, setSelectedContactForEntry] = useState<string | undefined>();
  const [defaultEntryType, setDefaultEntryType] = useState<LedgerEntryType>('give');
  const [selectedContactName, setSelectedContactName] = useState<string | null>(null);

  const selectedContactDrawer = useMemo(() => {
    if (!selectedContactName) return null;
    return ledger.contacts.find((c) => c.name.toLowerCase() === selectedContactName.toLowerCase()) || null;
  }, [ledger.contacts, selectedContactName]);

  const handleRefresh = () => {
    refetch();
  };

  // Filter contacts by search query & status tab
  const filteredContacts = ledger.contacts.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.phone && c.phone.includes(searchQuery));

    if (!matchesSearch) return false;

    if (filterTab === 'all') return true;
    return c.status === filterTab;
  });

  const availableContactNames = ledger.contacts.map((c) => c.name);

  const handleOpenAddEntryFor = (type: LedgerEntryType, contactName?: string) => {
    setDefaultEntryType(type);
    setSelectedContactForEntry(contactName || availableContactNames[0]);
    setIsAddEntryOpen(true);
  };

  return (
    <PageTransition className="space-y-4 sm:space-y-5">
      {/* Top Header & Actions */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900 flex items-center gap-2">
            <HandCoins className="h-5 w-5 text-neutral-700" />
            Ledger & Accounts
          </h1>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <motion.button
            type="button"
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsAddContactOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold text-neutral-700 shadow-2xs hover:bg-neutral-50 hover:border-neutral-300 transition-colors"
          >
            <UserPlus className="h-3.5 w-3.5 text-neutral-600" />
            <span>Add Person</span>
          </motion.button>

          <motion.button
            type="button"
            whileTap={{ scale: 0.95 }}
            onClick={() => handleOpenAddEntryFor('give')}
            className="inline-flex items-center gap-1.5 rounded-xl bg-neutral-900 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-neutral-800 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>New Entry</span>
          </motion.button>
        </div>
      </div>

      {/* Hero Summary Cards (Receive, Pay, Net) */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
        {/* 1. You will receive (Total To Receive) */}
        <CardMotion className="rounded-2xl border border-emerald-200/80 bg-emerald-50/30 p-3 sm:p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-emerald-800">
              You will get
            </span>
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
              <ArrowDownRight className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="mt-1 text-base sm:text-xl font-bold tracking-tight text-emerald-700">
            {formatCurrency(ledger.totalToReceive)}
          </div>
        </CardMotion>

        {/* 2. You will give (Total To Pay) */}
        <CardMotion className="rounded-2xl border border-rose-200/80 bg-rose-50/30 p-3 sm:p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-rose-800">
              You will give
            </span>
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-rose-100 text-rose-700">
              <ArrowUpRight className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="mt-1 text-base sm:text-xl font-bold tracking-tight text-rose-700">
            {formatCurrency(ledger.totalToPay)}
          </div>
        </CardMotion>

        {/* 3. Net Balance */}
        <CardMotion className="col-span-2 sm:col-span-1 rounded-2xl border border-neutral-200/80 bg-white p-3 sm:p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-neutral-500">
              Net Outstanding
            </span>
            <span className="text-[10px] font-semibold text-neutral-400">
              {ledger.activeContactsCount} active
            </span>
          </div>
          <div
            className={`mt-1 text-base sm:text-xl font-bold tracking-tight ${
              ledger.netBalance > 0
                ? 'text-emerald-700'
                : ledger.netBalance < 0
                ? 'text-rose-700'
                : 'text-neutral-900'
            }`}
          >
            {formatCurrency(ledger.netBalance)}
          </div>
          <span className="text-[10px] text-neutral-400 font-medium">
            {ledger.netBalance > 0
              ? 'Net in your favor'
              : ledger.netBalance < 0
              ? 'Net you owe'
              : 'All settled'}
          </span>
        </CardMotion>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between pt-1">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-neutral-400" />
          <input
            type="text"
            placeholder="Search person or account..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-neutral-200 bg-white pl-8 pr-3 py-1.5 text-xs text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-hidden"
          />
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-0.5">
          <button
            type="button"
            onClick={() => setFilterTab('all')}
            className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
              filterTab === 'all'
                ? 'bg-neutral-900 text-white'
                : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200/80'
            }`}
          >
            All ({ledger.contacts.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterTab('to_receive')}
            className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
              filterTab === 'to_receive'
                ? 'bg-emerald-600 text-white'
                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
            }`}
          >
            To Receive
          </button>
          <button
            type="button"
            onClick={() => setFilterTab('to_pay')}
            className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
              filterTab === 'to_pay'
                ? 'bg-rose-600 text-white'
                : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
            }`}
          >
            To Give
          </button>
          <button
            type="button"
            onClick={() => setFilterTab('settled')}
            className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
              filterTab === 'settled'
                ? 'bg-neutral-700 text-white'
                : 'bg-neutral-100 text-neutral-500 hover:bg-neutral-200/80'
            }`}
          >
            Settled
          </button>
        </div>
      </div>

      {/* Contacts Ledger List */}
      {isLoading ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-16 rounded-2xl bg-neutral-100/70 animate-pulse" />
          ))}
        </div>
      ) : filteredContacts.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-200 bg-neutral-50/50 py-12 text-center">
          <Users className="h-10 w-10 text-neutral-300 stroke-[1.2] mb-3" />
          <h3 className="text-sm font-semibold text-neutral-700">No accounts found</h3>
          <p className="text-xs text-neutral-400 mt-1 max-w-xs">
            {searchQuery
              ? `No contacts matching "${searchQuery}".`
              : 'Add your friends, suppliers, or contacts to start tracking balances.'}
          </p>
          <button
            type="button"
            onClick={() => setIsAddContactOpen(true)}
            className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-neutral-900 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-neutral-800 transition-colors"
          >
            <UserPlus className="h-3.5 w-3.5" />
            <span>Add Person</span>
          </button>
        </div>
      ) : (
        <StaggerContainer className="space-y-2">
          {filteredContacts.map((contact) => {
            const initials = contact.name
              .split(' ')
              .map((n) => n[0])
              .join('')
              .toUpperCase()
              .slice(0, 2);

            return (
              <StaggerItem key={contact.name}>
                <CardMotion
                  onClick={() => setSelectedContactName(contact.name)}
                  className="group flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-neutral-200/80 bg-white p-3.5 shadow-2xs hover:border-neutral-300 hover:shadow-xs transition-all cursor-pointer"
                >
                  {/* Left: Contact Info */}
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-xs font-bold text-white shadow-2xs">
                      {initials}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-neutral-900 group-hover:text-emerald-700 transition-colors">
                          {contact.name}
                        </h4>
                        {contact.phone && (
                          <span className="hidden sm:inline-flex items-center gap-0.5 text-[11px] text-neutral-400">
                            <Phone className="h-2.5 w-2.5" />
                            {contact.phone}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-[10px] text-neutral-400 mt-0.5">
                        <span>{contact.entriesCount} transaction(s)</span>
                        {contact.lastEntryDate && (
                          <>
                            <span>•</span>
                            <span>Last: {formatDateDDMMYYYY(contact.lastEntryDate)}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Net Balance & Quick Give/Take Mobile Buttons */}
                  <div className="flex items-center justify-between sm:justify-end gap-3.5 border-t border-neutral-100 sm:border-0 pt-2 sm:pt-0 shrink-0">
                    {/* Net Balance Status with aligned width */}
                    <div className="text-left sm:text-right sm:w-28 shrink-0">
                      <div
                        className={`text-sm sm:text-base font-bold tracking-tight ${
                          contact.status === 'to_receive'
                            ? 'text-emerald-600'
                            : contact.status === 'to_pay'
                            ? 'text-rose-600'
                            : 'text-neutral-400'
                        }`}
                      >
                        {contact.status === 'to_receive' && '+'}
                        {contact.status === 'to_pay' && '-'}
                        {formatCurrency(Math.abs(contact.netBalance))}
                      </div>
                      <span
                        className={`text-[10px] font-semibold block ${
                          contact.status === 'to_receive'
                            ? 'text-emerald-700'
                            : contact.status === 'to_pay'
                            ? 'text-rose-700'
                            : 'text-neutral-400'
                        }`}
                      >
                        {contact.status === 'to_receive'
                          ? 'You will get'
                          : contact.status === 'to_pay'
                          ? 'You will give'
                          : 'Settled'}
                      </span>
                    </div>

                    {/* Quick Give / Take Buttons */}
                    <div
                      className="flex items-center gap-1.5 shrink-0"
                      onClick={(e) => e.stopPropagation()} // Prevent opening drawer when tapping buttons
                    >
                      <button
                        type="button"
                        onClick={() => handleOpenAddEntryFor('give', contact.name)}
                        className="w-12 text-center rounded-lg border border-rose-200 bg-rose-50/60 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-100 transition-colors shadow-2xs"
                        title="Record money you gave to this person"
                      >
                        Give
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenAddEntryFor('take', contact.name)}
                        className="w-12 text-center rounded-lg border border-emerald-200 bg-emerald-50/60 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100 transition-colors shadow-2xs"
                        title="Record money you received from this person"
                      >
                        Take
                      </button>
                    </div>
                  </div>
                </CardMotion>
              </StaggerItem>
            );
          })}
        </StaggerContainer>
      )}

      {/* Slide-over Ledger Drawer */}
      <ContactLedgerDrawer
        contact={selectedContactDrawer}
        onClose={() => setSelectedContactName(null)}
        onOpenAddEntry={(type, contactName) => {
          setSelectedContactName(null);
          handleOpenAddEntryFor(type, contactName);
        }}
        onRefresh={handleRefresh}
      />

      {/* Add Contact Modal */}
      <AddContactModal
        isOpen={isAddContactOpen}
        onClose={() => setIsAddContactOpen(false)}
        onContactCreated={(c) => {
          setSelectedContactName(c.name);
        }}
      />

      {/* Add Transaction Entry Modal */}
      <AddLedgerEntryModal
        isOpen={isAddEntryOpen}
        onClose={() => {
          setIsAddEntryOpen(false);
          setSelectedContactForEntry(undefined);
        }}
        defaultContactName={selectedContactForEntry}
        defaultType={defaultEntryType}
        availableContacts={availableContactNames}
        onEntryAdded={handleRefresh}
        onOpenAddContact={() => {
          setIsAddEntryOpen(false);
          setIsAddContactOpen(true);
        }}
      />
    </PageTransition>
  );
}
