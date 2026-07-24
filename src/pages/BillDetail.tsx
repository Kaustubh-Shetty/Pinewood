import { useParams } from 'react-router-dom';
import { useBill, useBillShares, useHouseholds, isBillActive } from '../lib/hooks';
import { closeBillFn } from '../lib/supabase';
import { formatRupees } from '../types';
import ShareRow from '../components/ShareRow';
import { useAuth } from '../context/AuthContext';
import { useState } from 'react';

function daysSince(millis: number): number {
  return Math.floor((Date.now() - millis) / (24 * 60 * 60 * 1000));
}

export default function BillDetail() {
  const { billId } = useParams<{ billId: string }>();
  const { bill, loading: loadingBill } = useBill(billId);
  const { shares, loading: loadingShares } = useBillShares(billId);
  const { households } = useHouseholds();
  const { flatId } = useAuth();
  const [closing, setClosing] = useState(false);

  if (loadingBill || loadingShares) return <div className="page">Loading…</div>;
  if (!bill) return <div className="page">This bill doesn't exist.</div>;

  const householdByFlat = Object.fromEntries(households.map((h) => [h.flatId, h]));
  const frontingHousehold = householdByFlat[bill.paidByFlatId];
  const active = isBillActive(bill, shares);
  const unpaidShares = shares.filter((s) => s.status !== 'confirmed');
  const isFrontingFlat = flatId === bill.paidByFlatId;

  async function handleClose() {
    if (!billId) return;
    setClosing(true);
    try {
      await closeBillFn({ billId });
    } finally {
      setClosing(false);
    }
  }

  return (
    <div className="page">
      <div className="bill-detail-header">
        <div>
          <h1>{bill.title}</h1>
          <p className="subtitle">
            {formatRupees(bill.totalAmountPaise)} · fronted by {frontingHousehold?.displayName ?? bill.paidByFlatId} ·{' '}
            {new Date(bill.billDate).toLocaleDateString('en-IN')}
          </p>
        </div>
        <a className="receipt-link" href={bill.receiptUrl} target="_blank" rel="noreferrer">
          View receipt
        </a>
      </div>

      {!active && <div className="banner banner-success">Settled{bill.closedManually ? ' (closed manually)' : ''}.</div>}

      {active && unpaidShares.length > 0 && (
        <div className="defaulter-box">
          <h3>Still outstanding</h3>
          <ul>
            {unpaidShares.map((s) => (
              <li key={s.id}>
                {householdByFlat[s.flatId]?.displayName ?? s.flatId} — {s.status === 'claimed' ? 'awaiting confirmation' : 'unpaid'},{' '}
                {daysSince(bill.createdAt)} day{daysSince(bill.createdAt) === 1 ? '' : 's'} since bill added
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="share-list">
        {shares.map((share) => {
          const household = householdByFlat[share.flatId];
          if (!household || !frontingHousehold) return null;
          return <ShareRow key={share.id} bill={bill} share={share} household={household} fronting={frontingHousehold} />;
        })}
      </div>

      {active && isFrontingFlat && (
        <button className="secondary" disabled={closing} onClick={handleClose}>
          {closing ? 'Closing…' : 'Close this bill (mark settled)'}
        </button>
      )}
    </div>
  );
}
