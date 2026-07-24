import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import type { Bill, BillShare, Household } from '../types';

// Same role as before: thin wrappers that keep local state live, giving the
// dashboard its "live" status for free with no polling. Supabase Realtime
// (Postgres logical replication under the hood) replaces Firestore's
// onSnapshot here.

function rowToHousehold(row: Record<string, unknown>): Household {
  return {
    flatId: row.flat_id as string,
    phoneNumber: (row.phone_number as string) ?? '',
    displayName: row.display_name as string,
    upiVpa: (row.upi_vpa as string) ?? '',
    createdAt: new Date(row.created_at as string).getTime()
  };
}

function rowToBill(row: Record<string, unknown>): Bill {
  return {
    id: row.id as string,
    title: row.title as string,
    category: row.category as Bill['category'],
    totalAmountPaise: Number(row.total_amount_paise),
    receiptUrl: row.receipt_url as string,
    paidByFlatId: row.paid_by_flat_id as string,
    flatIds: row.flat_ids as string[],
    createdAt: new Date(row.created_at as string).getTime(),
    billDate: new Date(row.bill_date as string).getTime(),
    closedManually: Boolean(row.closed_manually)
  };
}

function rowToShare(row: Record<string, unknown>): BillShare {
  return {
    id: row.id as string,
    billId: row.bill_id as string,
    flatId: row.flat_id as string,
    shareAmountPaise: Number(row.share_amount_paise),
    status: row.status as BillShare['status'],
    proofUrl: (row.proof_url as string) ?? undefined,
    paidAt: row.paid_at ? new Date(row.paid_at as string).getTime() : undefined,
    confirmedAt: row.confirmed_at ? new Date(row.confirmed_at as string).getTime() : undefined
  };
}

export function useHouseholds() {
  const [households, setHouseholds] = useState<Household[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    supabase
      .from('households')
      .select('*')
      .order('flat_id')
      .then(({ data }) => {
        if (!active) return;
        setHouseholds((data ?? []).map(rowToHousehold));
        setLoading(false);
      });

    const channel = supabase
      .channel('households-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'households' }, () => {
        // Household edits are rare (upi_vpa mostly); simplest correct thing
        // is to just re-fetch rather than hand-merge the change locally.
        supabase
          .from('households')
          .select('*')
          .order('flat_id')
          .then(({ data }) => setHouseholds((data ?? []).map(rowToHousehold)));
      })
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, []);

  return { households, loading };
}

export function useBills() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    supabase
      .from('bills')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (!active) return;
        setBills((data ?? []).map(rowToBill));
        setLoading(false);
      });

    const channel = supabase
      .channel('bills-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bills' }, (payload) => {
        setBills((prev) => {
          if (payload.eventType === 'INSERT') {
            const newBill = rowToBill(payload.new as Record<string, unknown>);
            return [newBill, ...prev.filter((b) => b.id !== newBill.id)];
          }
          if (payload.eventType === 'UPDATE') {
            const updated = rowToBill(payload.new as Record<string, unknown>);
            return prev.map((b) => (b.id === updated.id ? updated : b));
          }
          return prev;
        });
      })
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, []);

  return { bills, loading };
}

export function useAllBillShares() {
  const [shares, setShares] = useState<BillShare[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    supabase
      .from('bill_shares')
      .select('*')
      .then(({ data }) => {
        if (!active) return;
        setShares((data ?? []).map(rowToShare));
        setLoading(false);
      });

    const channel = supabase
      .channel('bill-shares-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bill_shares' }, (payload) => {
        setShares((prev) => {
          if (payload.eventType === 'INSERT') {
            const share = rowToShare(payload.new as Record<string, unknown>);
            return [...prev.filter((s) => s.id !== share.id), share];
          }
          if (payload.eventType === 'UPDATE') {
            const updated = rowToShare(payload.new as Record<string, unknown>);
            return prev.map((s) => (s.id === updated.id ? updated : s));
          }
          return prev;
        });
      })
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, []);

  return { shares, loading };
}

export function useBillShares(billId: string | undefined) {
  const { shares, loading } = useAllBillShares();
  return { shares: billId ? shares.filter((s) => s.billId === billId) : [], loading };
}

export function useBill(billId: string | undefined) {
  const { bills, loading } = useBills();
  return { bill: billId ? (bills.find((b) => b.id === billId) ?? null) : null, loading };
}

/** A bill is "active" while any of its shares is unconfirmed, unless the fronting flat force-closed it. */
export function isBillActive(bill: Bill, shares: BillShare[]): boolean {
  if (bill.closedManually) return false;
  return shares.some((s) => s.status !== 'confirmed');
}
