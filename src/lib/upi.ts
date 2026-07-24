import QRCode from 'qrcode';

// Builds a standard UPI deep link. Any UPI app on the phone can open this —
// no gateway, no SDK, money moves directly bank-to-bank between the two
// households. Pinewood never touches the funds.
export function buildUpiLink(params: {
  vpa: string;
  payeeName: string;
  amountRupees: number;
  note: string;
}): string {
  const query = new URLSearchParams({
    pa: params.vpa,
    pn: params.payeeName,
    am: params.amountRupees.toFixed(2),
    cu: 'INR',
    tn: params.note
  });
  return `upi://pay?${query.toString()}`;
}

// Renders the UPI link as a QR code data URL, for households opening the
// app on a desktop browser (no UPI app to hand off to directly).
export async function upiLinkToQrDataUrl(upiLink: string): Promise<string> {
  return QRCode.toDataURL(upiLink, { margin: 1, width: 240 });
}
