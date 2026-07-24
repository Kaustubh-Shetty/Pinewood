import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

const OTP_LENGTH = 6;
const MAX_OTP_ATTEMPTS = 5;

export default function Login() {
  const { registrationError, completeRegistration } = useAuth();
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function sendOtp() {
    setError(null);
    const digitsOnly = phone.replace(/\D/g, '');
    if (digitsOnly.length !== 10) {
      setError('Enter a 10-digit phone number.');
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setError('Enter a valid email address.');
      return;
    }
    setSending(true);
    // shouldCreateUser: true — a brand-new email is fine to sign in with;
    // register-household is what actually checks it's on the approved list
    // and rejects/deletes the account if it isn't.
    const { error: otpError } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
    setSending(false);
    if (otpError) {
      setError('Could not send the code. Check the email address and try again.');
      return;
    }
    setCodeSent(true);
  }

  async function verifyOtp() {
    if (attempts >= MAX_OTP_ATTEMPTS) {
      setError('Too many incorrect attempts. Request a new code.');
      return;
    }
    setError(null);
    setSending(true);
    const { data, error: verifyError } = await supabase.auth.verifyOtp({ email, token: otp, type: 'email' });
    if (verifyError || !data.session) {
      setAttempts((a) => a + 1);
      setError('That code is incorrect or expired. Try again.');
      setSending(false);
      return;
    }

    // Already registered on a previous login — nothing further to do, the
    // flat_id claim is already on the session.
    if (data.session.user.app_metadata.flat_id) {
      setSending(false);
      return;
    }

    const digitsOnly = phone.replace(/\D/g, '');
    await completeRegistration(`+91${digitsOnly}`);
    setSending(false);
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <h1>Pinewood</h1>
        <p className="subtitle">One login per flat.</p>

        {(error || registrationError) && <div className="banner banner-error">{error ?? registrationError}</div>}

        {!codeSent ? (
          <>
            <label htmlFor="phone">Phone number (your flat's registered number)</label>
            <div className="phone-input">
              <span>+91</span>
              <input
                id="phone"
                type="tel"
                inputMode="numeric"
                placeholder="98765 43210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                maxLength={10}
              />
            </div>

            <label htmlFor="email">Email (where we'll send the code)</label>
            <input id="email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />

            <button disabled={sending} onClick={sendOtp}>
              {sending ? 'Sending code…' : 'Send code'}
            </button>
          </>
        ) : (
          <>
            <label htmlFor="otp">Enter the {OTP_LENGTH}-digit code sent to {email}</label>
            <input
              id="otp"
              type="text"
              inputMode="numeric"
              maxLength={OTP_LENGTH}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
            />
            <button disabled={sending || otp.length !== OTP_LENGTH} onClick={verifyOtp}>
              {sending ? 'Verifying…' : 'Verify & continue'}
            </button>
            <button className="link-button" onClick={() => setCodeSent(false)}>
              Use a different number or email
            </button>
          </>
        )}
      </div>
    </div>
  );
}
