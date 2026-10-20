"use client";

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { insforge } from '../../lib/insforge';

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Sync email from search parameter on mount
  useEffect(() => {
    const emailParam = searchParams.get('email');
    if (emailParam) {
      setEmail(emailParam);
    }
  }, [searchParams]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      const { data, error } = await insforge.auth.verifyEmail({
        email,
        otp: code,
      });

      if (error) {
        setErrorMsg(error.message || 'Verification failed. Please check your code.');
      } else if (data) {
        setSuccessMsg('Email verified successfully! Redirecting...');
        // Let session settle and redirect home
        setTimeout(() => {
          router.push('/');
        }, 1500);
      }
    } catch (err: unknown) {
      setErrorMsg((err as Error).message || 'An unexpected error occurred during verification.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!email) {
      setErrorMsg('Please enter an email address to resend code.');
      return;
    }
    setErrorMsg(null);
    setSuccessMsg(null);
    setResending(true);

    try {
      const { error } = await insforge.auth.resendVerificationEmail({
        email,
      });

      if (error) {
        setErrorMsg(error.message || 'Failed to resend code.');
      } else {
        setSuccessMsg('A new 6-digit verification code has been sent to your email.');
      }
    } catch (err: unknown) {
      setErrorMsg((err as Error).message || 'An unexpected error occurred.');
    } finally {
      setResending(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#070A0F] text-[#F8FAFC] flex items-center justify-center p-6 font-sans">
      <div className="w-full max-w-md bg-[#0B0F19] border border-[#1E293B] rounded-lg p-8 shadow-2xl space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-[#FFFFFF]">
            Email Verification
          </h1>
          <p className="text-sm text-[#94A3B8]">
            Enter the 6-digit confirmation code sent to your inbox.
          </p>
        </div>

        <form onSubmit={handleVerify} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#CBD5E1] uppercase mb-1 tracking-wider">Email Address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-[#070A0F] border border-[#1E293B] focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]/40 rounded-lg px-4 py-2.5 text-sm text-[#FFFFFF] outline-none transition-colors"
              placeholder="user@example.com"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#CBD5E1] uppercase mb-1 tracking-wider">6-Digit Code</label>
            <input
              type="text"
              required
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              className="w-full bg-[#070A0F] border border-[#1E293B] focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]/40 rounded-lg px-4 py-2.5 text-sm text-[#FFFFFF] outline-none tracking-widest text-center font-mono transition-colors"
              placeholder="000000"
            />
          </div>

          {errorMsg && (
            <p className="text-xs text-[#EF4444] bg-[#7F1D1D]/20 border border-[#991B1B]/40 p-2.5 rounded-lg text-center font-medium">
              {errorMsg}
            </p>
          )}

          {successMsg && (
            <p className="text-xs text-[#10B981] bg-[#064E3B]/20 border border-[#047857]/40 p-2.5 rounded-lg text-center font-medium">
              {successMsg}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || resending}
            className="w-full bg-[#2563EB] hover:bg-[#1D4ED8] text-[#FFFFFF] font-medium py-2.5 rounded-lg border border-[#38BDF8]/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer text-sm"
          >
            {loading ? 'Verifying...' : 'Verify Code'}
          </button>
        </form>

        <div className="flex flex-col items-center space-y-3 pt-2 text-xs">
          <button
            type="button"
            disabled={loading || resending}
            onClick={handleResend}
            className="text-[#94A3B8] hover:text-[#FFFFFF] transition-colors underline font-medium disabled:opacity-50"
          >
            {resending ? 'Sending...' : "Resend verification code"}
          </button>
          
          <button
            type="button"
            onClick={() => router.push('/')}
            className="text-[#38BDF8] hover:text-[#FFFFFF] hover:underline font-medium transition-colors"
          >
            Return to Sign In
          </button>
        </div>
      </div>
    </main>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
        <div className="text-slate-400 text-sm">Loading verification...</div>
      </main>
    }>
      <VerifyEmailContent />
    </Suspense>
  );
}
