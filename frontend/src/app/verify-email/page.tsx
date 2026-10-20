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
    <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6 relative overflow-hidden font-sans">
      {/* Background blur effects */}
      <div className="absolute top-[-25%] left-[-20%] w-[65%] h-[65%] bg-blue-900/10 rounded-full blur-[140px] pointer-events-none"></div>
      <div className="absolute bottom-[-25%] right-[-20%] w-[65%] h-[65%] bg-indigo-900/10 rounded-full blur-[140px] pointer-events-none"></div>
      <div className="absolute top-[40%] left-[35%] w-[30%] h-[30%] bg-violet-900/5 rounded-full blur-[120px] pointer-events-none"></div>

      <div className="z-10 w-full max-w-md bg-slate-900/40 border border-slate-800/80 hover:border-slate-700/50 rounded-3xl p-8 backdrop-blur-xl shadow-[0_0_50px_-12px_rgba(99,102,241,0.15)] space-y-6 transition-all duration-500">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-indigo-300 to-violet-400">
            Verify email
          </h1>
          <p className="text-xs text-slate-400">
            Enter the 6-digit code sent to your email
          </p>
        </div>

        <form onSubmit={handleVerify} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase mb-1 tracking-wider">Email Address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-slate-950/60 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 rounded-xl px-4 py-3 text-sm text-slate-200 outline-none transition-all duration-350"
              placeholder="user@example.com"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase mb-1 tracking-wider">6-digit code</label>
            <input
              type="text"
              required
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              className="w-full bg-slate-950/60 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 rounded-xl px-4 py-3 text-sm text-slate-200 outline-none transition tracking-widest text-center font-mono transition-all duration-350"
              placeholder="6-digit code"
            />
          </div>

          {errorMsg && (
            <p className="text-xs text-red-400 bg-red-950/20 border border-red-900/30 p-2.5 rounded-lg text-center font-semibold">
              {errorMsg}
            </p>
          )}

          {successMsg && (
            <p className="text-xs text-emerald-400 bg-emerald-950/20 border border-emerald-900/30 p-2.5 rounded-lg text-center font-semibold">
              {successMsg}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || resending}
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-655 hover:from-blue-500 hover:to-indigo-600 text-white font-bold py-3.5 rounded-xl shadow-lg hover:shadow-indigo-500/20 hover:scale-[1.01] hover:-translate-y-0.5 active:scale-95 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer text-sm"
          >
            {loading ? 'Verifying...' : 'Verify'}
          </button>
        </form>

        <div className="flex flex-col items-center space-y-3 pt-2 text-xs">
          <button
            type="button"
            disabled={loading || resending}
            onClick={handleResend}
            className="text-slate-400 hover:text-white transition underline font-semibold disabled:opacity-50"
          >
            {resending ? 'Resending...' : "Didn't get a code? Resend email"}
          </button>
          
          <button
            type="button"
            onClick={() => router.push('/')}
            className="text-indigo-400 hover:text-indigo-300 hover:underline font-semibold transition"
          >
            Back to sign in
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
