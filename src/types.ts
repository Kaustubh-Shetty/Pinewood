// Mirrors the data model from the architecture blueprint. Keep this file and
// functions/src/types.ts in sync — they describe the same Firestore documents.

export type BillCategory = 'electricity' | 'water' | 'cleaning' | 'other';

export type ShareStatus = 'unpaid' | 'claimed' | 'confirmed';

export interface Household {
  flatId: string;
  phoneNumber: string;
  displayName: string;
  upiVpa: string;
  fcmToken?: string;
  createdAt: number; // epoch millis
}

export interface Bill {
  id: string;
  title: string;
  category: BillCategory;
  totalAmountPaise: number; // stored as integer paise to avoid float rounding
  receiptUrl: string;
  paidByFlatId: string; // the flat that fronted the money to the vendor
  flatIds: string[]; // flats included in this bill's split
  createdAt: number;
  billDate: number; // the date on the receipt, may differ from createdAt
  closedManually: boolean;
}

export interface BillShare {
  id: string; // `${billId}_${flatId}`
  billId: string;
  flatId: string;
  shareAmountPaise: number;
  status: ShareStatus;
  proofUrl?: string;
  paidAt?: number;
  confirmedAt?: number;
}

export const BILL_CATEGORIES: BillCategory[] = ['electricity', 'water', 'cleaning', 'other'];

export function paiseToRupees(paise: number): number {
  return paise / 100;
}

export function formatRupees(paise: number): string {
  return `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
