import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, addBillFn } from '../lib/supabase';
import { useHouseholds } from '../lib/hooks';
import { computeEqualSplit, rupeesToPaise } from '../lib/split';
import { BILL_CATEGORIES, formatRupees, type BillCategory } from '../types';

export default function AddBill() {
  const navigate = useNavigate();
  const { households, loading: loadingHouseholds } = useHouseholds();

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<BillCategory>('electricity');
  const [amount, setAmount] = useState('');
  const [billDate, setBillDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [selectedFlats, setSelectedFlats] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useMemo(() => {
    if (households.length && selectedFlats.size === 0) {
      setSelectedFlats(new Set(households.map((h) => h.flatId)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [households]);

  const amountPaise = amount ? rupeesToPaise(Number(amount)) : 0;
  const preview = useMemo(() => {
    if (amountPaise <= 0 || selectedFlats.size === 0) return null;
    try {
      return computeEqualSplit(amountPaise, Array.from(selectedFlats));
    } catch {
      return null;
    }
  }, [amountPaise, selectedFlats]);

  function toggleFlat(flatId: string) {
    setSelectedFlats((prev) => {
      const next = new Set(prev);
      if (next.has(flatId)) next.delete(flatId);
      else next.add(flatId);
      return next;
    });
  }

  function validate(): string | null {
    if (!title.trim()) return 'Give the bill a short title.';
    if (!amount || Number(amount) <= 0) return 'Enter a valid amount greater than zero.';
    const dateMs = new Date(billDate).getTime();
    if (Number.isNaN(dateMs)) return 'Enter a valid date.';
    if (dateMs > Date.now() + 24 * 60 * 60 * 1000) return 'Bill date cannot be in the future.';
    if (!receiptFile) return 'Attach a receipt photo or PDF.';
    if (selectedFlats.size === 0) return 'Select at least one flat to split this bill across.';
    return null;
  }

  async function handleSubmit() {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const path = `${Date.now()}_${receiptFile!.name}`;
      const { error: uploadError } = await supabase.storage.from('receipts').upload(path, receiptFile!);
      if (uploadError) throw new Error('Could not upload the receipt. Try again.');
      const { data: signed } = await supabase.storage.from('receipts').createSignedUrl(path, 60 * 60 * 24 * 365);

      const result = await addBillFn({
        title: title.trim(),
        category,
        totalAmountPaise: rupeesToPaise(Number(amount)),
        billDate: new Date(billDate).getTime(),
        receiptUrl: signed?.signedUrl ?? path,
        flatIds: Array.from(selectedFlats)
      });

      navigate(`/bills/${result.billId}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not save the bill. Try again.';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page">
      <h1>Add a bill</h1>

      {error && <div className="banner banner-error">{error}</div>}

      <label htmlFor="title">Title</label>
      <input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. March electricity bill" />

      <label htmlFor="category">Category</label>
      <select id="category" value={category} onChange={(e) => setCategory(e.target.value as BillCategory)}>
        {BILL_CATEGORIES.map((c) => (
          <option key={c} value={c}>
            {c[0].toUpperCase() + c.slice(1)}
          </option>
        ))}
      </select>

      <label htmlFor="amount">Total amount (₹)</label>
      <input id="amount" type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />

      <label htmlFor="date">Bill date</label>
      <input id="date" type="date" value={billDate} onChange={(e) => setBillDate(e.target.value)} />

      <label htmlFor="receipt">Receipt (photo or PDF)</label>
      <input id="receipt" type="file" accept="image/*,application/pdf" onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)} />

      <fieldset className="flat-picker">
        <legend>Split across</legend>
        {loadingHouseholds && <p>Loading flats…</p>}
        {households.map((h) => (
          <label key={h.flatId} className="checkbox-row">
            <input type="checkbox" checked={selectedFlats.has(h.flatId)} onChange={() => toggleFlat(h.flatId)} />
            {h.displayName}
          </label>
        ))}
      </fieldset>

      {preview && (
        <div className="split-preview">
          <h3>Per-flat share (preview)</h3>
          <ul>
            {Object.entries(preview).map(([flatId, paise]) => (
              <li key={flatId}>
                {households.find((h) => h.flatId === flatId)?.displayName ?? flatId}: {formatRupees(paise)}
              </li>
            ))}
          </ul>
        </div>
      )}

      <button disabled={submitting} onClick={handleSubmit}>
        {submitting ? 'Saving…' : 'Add bill'}
      </button>
    </div>
  );
}
