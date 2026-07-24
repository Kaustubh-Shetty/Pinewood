import { Link } from 'react-router-dom';
import type { Bill, BillShare } from '../types';
import { formatRupees } from '../types';

const CATEGORY_LABEL: Record<string, string> = {
  electricity: 'Electricity',
  water: 'Water',
  cleaning: 'Cleaning',
  other: 'Other'
};

export default function BillCard({ bill, shares }: { bill: Bill; shares: BillShare[] }) {
  const confirmed = shares.filter((s) => s.status === 'confirmed').length;
  const total = shares.length;

  return (
    <Link to={`/bills/${bill.id}`} className="bill-card">
      <div className="bill-card-main">
        <span className="bill-card-title">{bill.title}</span>
        <span className="bill-card-category">{CATEGORY_LABEL[bill.category] ?? bill.category}</span>
      </div>
      <div className="bill-card-meta">
        <span>{formatRupees(bill.totalAmountPaise)}</span>
        <span>
          {confirmed}/{total} settled
        </span>
        <span>{new Date(bill.billDate).toLocaleDateString('en-IN')}</span>
      </div>
    </Link>
  );
}
