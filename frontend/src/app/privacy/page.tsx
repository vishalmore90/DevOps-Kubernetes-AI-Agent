import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Shield } from 'lucide-react';

export const metadata = {
  title: 'Privacy Policy | Kubernetes AI Troubleshooting Agent',
  description: 'Privacy Policy and data governance practices.',
};

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-[#070A0F] text-[#F8FAFC] font-sans antialiased p-6 sm:p-12">
      <div className="max-w-4xl mx-auto space-y-12">
        <div className="flex items-center justify-between border-b border-[#1E293B] pb-6">
          <Link
            href="/"
            className="inline-flex items-center space-x-2 text-sm text-[#94A3B8] hover:text-[#FFFFFF] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Console</span>
          </Link>
          <div className="flex items-center space-x-2 text-xs text-[#38BDF8] font-mono">
            <Shield className="w-4 h-4 text-[#2563EB]" />
            <span>DATA GOVERNANCE</span>
          </div>
        </div>

        <header className="space-y-4">
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-[#FFFFFF]">
            Privacy Policy
          </h1>
          <p className="text-base text-[#CBD5E1]">
            Last updated: October 2026. This policy outlines how telemetry and diagnostic metadata are handled.
          </p>
        </header>

        <section className="space-y-8 text-sm sm:text-base leading-relaxed text-[#CBD5E1]">
          <div className="space-y-3">
            <h2 className="text-xl font-bold text-[#FFFFFF]">1. Diagnostic Telemetry</h2>
            <p>
              Our diagnostic engine processes cluster resource metadata, pod state, and error logs strictly to produce root cause analyses. Cluster secrets, private tokens, and environment variables containing credentials are filtered out at the collector layer before reasoning.
            </p>
          </div>

          <div className="space-y-3">
            <h2 className="text-xl font-bold text-[#FFFFFF]">2. Authentication and Account Data</h2>
            <p>
              Account authentication is managed via InsForge. User emails and authentication tokens are securely encrypted in transit and at rest. We never sell, lease, or distribute your account identifiers to third parties.
            </p>
          </div>

          <div className="space-y-3">
            <h2 className="text-xl font-bold text-[#FFFFFF]">3. Row-Level Security</h2>
            <p>
              Every diagnostic record is stored with strict PostgreSQL Row-Level Security (RLS). Only your authenticated session can query or retrieve your past cluster investigation reports.
            </p>
          </div>

          <div className="space-y-3">
            <h2 className="text-xl font-bold text-[#FFFFFF]">4. Retention and Erasure</h2>
            <p>
              Investigation reports are retained in your personal history table until deleted. You can request full data erasure at any time through your account console.
            </p>
          </div>
        </section>

        <footer className="border-t border-[#1E293B] pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#94A3B8]">
          <span>Kubernetes AI Agent Console</span>
          <div className="flex space-x-6">
            <Link href="/terms" className="hover:text-[#FFFFFF] transition-colors">Terms of Service</Link>
            <Link href="/" className="hover:text-[#FFFFFF] transition-colors">Console</Link>
          </div>
        </footer>
      </div>
    </main>
  );
}
