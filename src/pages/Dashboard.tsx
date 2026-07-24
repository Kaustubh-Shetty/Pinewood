import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAllBillShares, useBills, useHouseholds, isBillActive } from '../lib/hooks';
import { formatRupees } from '../types';
import BillCard from '../components/BillCard';

export default function Dashboard() {
  const { bills, loading: loadingBills } = useBills();
  const { shares, loading: loadingShares } = useAllBillShares();
  const { households } = useHouseholds();
  const [tab, setTab] = useState<'active' | 'history'>('active');

  const sharesByBill = useMemo(() => {
    const map = new Map<string, typeof shares>();
    for (const s of shares) {
      const list = map.get(s.billId) ?? [];
      list.push(s);
      map.set(s.billId, list);
    }
    return map;
  }, [shares]);

  const { activeBills, historyBills } = useMemo(() => {
    const active: typeof bills = [];
    const history: typeof bills = [];
    for (const bill of bills) {
      const billShares = sharesByBill.get(bill.id) ?? [];
      (isBillActive(bill, billShares) ? active : history).push(bill);
    }
    return { activeBills: active, historyBills: history };
  }, [bills, sharesByBill]);

  // Who owes what: sum of every unconfirmed share, grouped by flat.
  // Always derived live from billShares — never a stored running balance.
  const owedByFlat = useMemo(() => {
    const totals = new Map<string, number>();
    for (const s of shares) {
      if (s.status === 'confirmed') continue;
      totals.set(s.flatId, (totals.get(s.flatId) ?? 0) + s.shareAmountPaise);
    }
    return totals;
  }, [shares]);

  const householdByFlat = Object.fromEntries(households.map((h) => [h.flatId, h]));
  const loading = loadingBills || loadingShares;
  const shownBills = tab === 'active' ? activeBills : historyBills;

  return (
    <div className="page">
      <div className="dashboard-header">
        <h1>Dashboard</h1>
        <Link className="button-link" to="/add-bill">
          + Add bill
        </Link>
      </div>

      {owedByFlat.size > 0 && (
        <div className="summary-box">
          <h3>Who owes what</h3>
          <ul>
            {Array.from(owedByFlat.entries())
              .sort((a, b) => b[1] - a[1])
              .map(([flatId, paise]) => (
                <li key={flatId}>
                  <span>{householdByFlat[flatId]?.displayName ?? flatId}</span>
                  <span>{formatRupees(paise)}</span>
                </li>
              ))}
          </ul>
        </div>
      )}

      <div className="tabs">
        <button className={tab === 'active' ? 'tab-active' : ''} onClick={() => setTab('active')}>
          Active ({activeBills.length})
        </button>
        <button className={tab === 'history' ? 'tab-active' : ''} onClick={() => setTab('history')}>
          History ({historyBills.length})
        </button>
      </div>

      {loading && <p>Loading…</p>}
      {!loading && shownBills.length === 0 && <p className="empty-state">Nothing here yet.</p>}

      <div className="bill-list">
        {shownBills.map((bill) => (
          <BillCard key={bill.id} bill={bill} shares={sharesByBill.get(bill.id) ?? []} />
        ))}
      </div>
    </div>
  );
}
