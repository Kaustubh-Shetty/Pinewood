import { useEffect, useState } from 'react';
import { supabase, markPaidFn, confirmReceivedFn } from '../lib/supabase';
import { buildUpiLink, upiLinkToQrDataUrl } from '../lib/upi';
import { formatRupees } from '../types';
import type { Bill, BillShare, Household } from '../types';
import { useAuth } from '../context/AuthContext';

const STATUS_LABEL: Record<BillShare['status'], string> = {
  unpaid: 'Unpaid',
  claimed: 'Marked paid — awaiting confirmation',
  confirmed: 'Confirmed'
};

export default function ShareRow({
  bill,
  share,
  household,
  fronting
}: {
  bill: Bill;
  share: BillShare;
  household: Household;
  fronting: Household;
}) {
  const { flatId } = useAuth();
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isMine = flatId === household.flatId;
  const isFrontingFlat = flatId === bill.paidByFlatId;
  const upiLink = buildUpiLink({
    vpa: fronting.upiVpa,
    payeeName: fronting.displayName,
    amountRupees: share.shareAmountPaise / 100,
    note: `Pinewood: ${bill.title}`
  });

  useEffect(() => {
    upiLinkToQrDataUrl(upiLink).then(setQrDataUrl).catch(() => setQrDataUrl(null));
  }, [upiLink]);

  async function handleMarkPaid(file: File) {
    setError(null);
    setUploading(true);
    try {
      const path = `${bill.id}/${household.flatId}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage.from('proofs').upload(path, file);
      if (uploadError) throw uploadError;
      const { data: signed } = await supabase.storage.from('proofs').createSignedUrl(path, 60 * 60 * 24 * 365);
      await markPaidFn({ billId: bill.id, proofUrl: signed?.signedUrl ?? path });
    } catch {
      setError('Upload failed. Check your connection and try again.');
    } finally {
      setUploading(false);
    }
  }

  async function handleConfirm() {
    setError(null);
    setBusy(true);
    try {
      await confirmReceivedFn({ billId: bill.id, flatId: household.flatId });
    } catch {
      setError('Could not confirm right now. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`share-row share-status-${share.status}`}>
      <div className="share-row-header">
        <span className="share-flat">{household.displayName}</span>
        <span className={`status-pill status-${share.status}`}>{STATUS_LABEL[share.status]}</span>
      </div>
      <div className="share-amount">{formatRupees(share.shareAmountPaise)}</div>

      {error && <div className="banner banner-error small">{error}</div>}

      {share.status === 'unpaid' && isMine && (
        <div className="share-actions">
          <a className="upi-link" href={upiLink}>
            Pay with UPI app
          </a>
          {qrDataUrl && <img className="upi-qr" src={qrDataUrl} alt="UPI QR code" />}
          <label className="file-upload">
            {uploading ? 'Uploading…' : "Upload payment screenshot & mark paid"}
            <input
              type="file"
              accept="image/*,application/pdf"
              disabled={uploading}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleMarkPaid(file);
              }}
            />
          </label>
        </div>
      )}

      {share.proofUrl && (
        <a className="proof-link" href={share.proofUrl} target="_blank" rel="noreferrer">
          View payment screenshot
        </a>
      )}

      {share.status === 'claimed' && isFrontingFlat && (
        <button disabled={busy} onClick={handleConfirm}>
          {busy ? 'Confirming…' : "Confirm I've received this"}
        </button>
      )}
    </div>
  );
}
