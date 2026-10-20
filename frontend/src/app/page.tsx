"use client";

import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getHealth, getContexts } from '../services/api';
import { useInvestigation } from '../hooks/useInvestigation';
import { insforge } from '../lib/insforge';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Server,
  Activity,
  Terminal,
  ShieldCheck,
  CheckCircle2,
  Clock,
  AlertCircle,
  RefreshCw,
  LogOut,
  Layers,
  Network,
  AlertTriangle
} from 'lucide-react';

interface HistoryItem {
  id: number;
  root_cause: string;
  namespace: string;
  confidence: number;
  status: string;
  created_at: string;
}

interface AuthUser {
  id: string;
  email: string;
  name?: string;
  emailVerified?: boolean;
}

const DEFAULT_SANDBOX_CONTEXTS = [
  'k8s-sandbox-cluster',
  'k8s-sandbox-oom',
  'k8s-sandbox-imagepull'
];

export default function Home() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Cluster Selection State
  const [contexts, setContexts] = useState<string[]>([]);
  const [selectedContext, setSelectedContext] = useState<string>('');
  const [kubeconfigPath, setKubeconfigPath] = useState<string | null>(null);

  // Investigation & Realtime State
  const [showResults, setShowResults] = useState(false);
  const [activeTab, setActiveTab] = useState<'pods' | 'deployments' | 'events' | 'network'>('pods');
  const [history, setHistory] = useState<HistoryItem[]>([]);

  // Realtime progress tracking
  const [progressSteps, setProgressSteps] = useState<{ [key: string]: 'pending' | 'active' | 'completed' }>({
    "Checking Pods": 'pending',
    "Reading Logs": 'pending',
    "Analyzing Events": 'pending',
    "Inspecting Deployments": 'pending',
    "Checking Networking": 'pending',
    "AI Reasoning": 'pending',
    "Root Cause Found": 'pending'
  });

  // Check backend health
  const { data: healthData } = useQuery({
    queryKey: ['health'],
    queryFn: getHealth,
    refetchInterval: 10000,
    retry: 2,
  });

  const isBackendHealthy = !!healthData && healthData.status === "healthy";

  // Check auth session on mount
  useEffect(() => {
    insforge.auth.getCurrentUser().then(({ data }) => {
      if (data?.user) {
        if (!data.user.emailVerified) {
          router.push(`/verify-email?email=${encodeURIComponent(data.user.email || '')}`);
        } else {
          setUser(data.user as unknown as AuthUser);
        }
      }
      setAuthLoading(false);
    });
  }, [router]);

  // Fetch contexts on mount/user state change
  useEffect(() => {
    if (user) {
      getContexts().then(({ contexts, current_context, kubeconfig_path }) => {
        const available = contexts && contexts.length > 0 ? contexts : DEFAULT_SANDBOX_CONTEXTS;
        setContexts(available);
        setKubeconfigPath(kubeconfig_path || 'k8s-sandbox-cluster-mode');
        if (current_context && available.includes(current_context)) {
          setSelectedContext(current_context);
        } else {
          setSelectedContext(available[0]);
        }
      }).catch(err => {
        console.error("Failed to load clusters/contexts from backend, defaulting to sandbox:", err);
        setContexts(DEFAULT_SANDBOX_CONTEXTS);
        setSelectedContext(DEFAULT_SANDBOX_CONTEXTS[0]);
        setKubeconfigPath('k8s-sandbox-cluster-mode');
      });
    }
  }, [user]);

  const handleRefresh = async () => {
    if (!user) return;
    try {
      const { contexts, current_context, kubeconfig_path } = await getContexts();
      const available = contexts && contexts.length > 0 ? contexts : DEFAULT_SANDBOX_CONTEXTS;
      setContexts(available);
      setKubeconfigPath(kubeconfig_path || 'k8s-sandbox-cluster-mode');
      if (current_context && available.includes(current_context)) {
        setSelectedContext(current_context);
      } else {
        setSelectedContext(available[0]);
      }
    } catch (err) {
      console.error("Failed to refresh clusters/contexts, defaulting to sandbox:", err);
      setContexts(DEFAULT_SANDBOX_CONTEXTS);
      setSelectedContext(DEFAULT_SANDBOX_CONTEXTS[0]);
      setKubeconfigPath('k8s-sandbox-cluster-mode');
    }
  };

  // Fetch History once authenticated
  const fetchHistory = async (userId: string) => {
    try {
      const { data } = await insforge.database
        .from('investigations')
        .select()
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(5);
      if (data) {
        setHistory(data as HistoryItem[]);
      }
    } catch (err) {
      console.error("Failed to load history:", err);
    }
  };

  useEffect(() => {
    if (user?.id) {
      fetchHistory(user.id);
    }
  }, [user]);

  // Connect to realtime Socket.IO channel when authenticated
  useEffect(() => {
    if (!user?.id) return;

    let isSubscribed = false;
    const channelName = `investigation:${user.id}`;

    const setupRealtime = async () => {
      insforge.realtime.on('connect', () => {
        console.log('Realtime socket connected:', insforge.realtime.socketId);
      });

      insforge.realtime.on('error', (err: unknown) => {
        console.error('Realtime socket error:', err);
      });

      await insforge.realtime.connect();
      
      const response = await insforge.realtime.subscribe(channelName);
      if (response.ok) {
        isSubscribed = true;
        console.log(`Subscribed to realtime channel: ${channelName}`);
        
        insforge.realtime.on('progress', (message: { step?: string; status?: string; [key: string]: unknown }) => {
          const step = message.step as string | undefined;
          const status = message.status as string | undefined;
          
          setProgressSteps(prev => {
            const updated = { ...prev };
            if (status === 'completed') {
              Object.keys(updated).forEach(k => {
                updated[k] = 'completed';
              });
            } else {
              const stepsOrder = [
                "Checking Pods",
                "Reading Logs",
                "Analyzing Events",
                "Inspecting Deployments",
                "Checking Networking",
                "AI Reasoning",
                "Root Cause Found"
              ];
              const currentIndex = step ? stepsOrder.indexOf(step) : -1;
              if (currentIndex !== -1) {
                stepsOrder.forEach((name, idx) => {
                  if (idx < currentIndex) {
                    updated[name] = 'completed';
                  } else if (idx === currentIndex) {
                    updated[name] = 'active';
                  } else {
                    updated[name] = 'pending';
                  }
                });
              }
            }
            return updated;
          });
        });
      }
    };

    setupRealtime();

    return () => {
      if (isSubscribed) {
        insforge.realtime.unsubscribe(channelName);
      }
    };
  }, [user]);

  const { mutate, isPending, data: investigationResult, error: mutationError } = useInvestigation();

  const handleStartInvestigation = () => {
    if (!user) return;
    
    setProgressSteps({
      "Checking Pods": 'pending',
      "Reading Logs": 'pending',
      "Analyzing Events": 'pending',
      "Inspecting Deployments": 'pending',
      "Checking Networking": 'pending',
      "AI Reasoning": 'pending',
      "Root Cause Found": 'pending'
    });
    
    setShowResults(false);
    
    mutate({ userId: user.id, context: selectedContext }, {
      onSuccess: async (res) => {
        setShowResults(true);
        try {
          const problematicPods = res.investigation.pods.problematic_pods || [];
          const namespace = problematicPods[0]?.namespace || 'all';
          const status = res.investigation.pods.healthy ? 'Healthy' : 'Issues Detected';

          await insforge.database
            .from('investigations')
            .insert([{
              user_id: user.id,
              root_cause: res.diagnosis.root_cause,
              namespace: namespace,
              confidence: res.diagnosis.confidence,
              status: status
            }]);
            
          fetchHistory(user.id);
        } catch (err) {
          console.error("Failed to save record to history database:", err);
        }
      }
    });
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    try {
      if (isSignUp) {
        const { data, error } = await insforge.auth.signUp({
          email,
          password,
          name: name || undefined,
        });
        if (error) {
          setAuthError(error.message);
        } else if (data?.user) {
          if (!data.user.emailVerified) {
            router.push(`/verify-email?email=${encodeURIComponent(email)}`);
          } else {
            setUser(data.user as unknown as AuthUser);
          }
        }
      } else {
        const { data, error } = await insforge.auth.signInWithPassword({
          email,
          password,
        });
        if (error) {
          setAuthError(error.message);
        } else if (data?.user) {
          if (!data.user.emailVerified) {
            router.push(`/verify-email?email=${encodeURIComponent(email)}`);
          } else {
            setUser(data.user as unknown as AuthUser);
          }
        }
      }
    } catch (err: unknown) {
      setAuthError((err as Error).message || "An authentication error occurred.");
    }
  };

  const handleSignOut = async () => {
    await insforge.auth.signOut();
    setUser(null);
  };

  if (authLoading) {
    return (
      <main className="min-h-screen bg-[#070A0F] text-[#F8FAFC] flex items-center justify-center p-6 font-sans">
        <div className="flex items-center space-x-3 text-sm text-[#94A3B8]">
          <Activity className="w-5 h-5 text-[#2563EB] animate-spin" />
          <span>Initializing console...</span>
        </div>
      </main>
    );
  }

  // Render Login Card if not authenticated
  if (!user) {
    return (
      <main className="min-h-screen bg-[#070A0F] text-[#F8FAFC] flex items-center justify-center p-6 font-sans">
        <div className="w-full max-w-md bg-[#0B0F19] border border-[#1E293B] rounded-lg p-8 shadow-2xl space-y-8">
          <div className="space-y-3 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-[#2563EB]/10 border border-[#2563EB]/20 text-[#2563EB] mx-auto">
              <Server className="w-6 h-6 text-[#2563EB]" />
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-[#FFFFFF]">
              Kubernetes Agent
            </h1>
            <p className="text-sm text-[#94A3B8]">
              Automated cluster diagnostics and incident reasoning.
            </p>
          </div>

          <form onSubmit={handleAuth} className="space-y-4">
            {isSignUp && (
              <div>
                <label className="block text-xs font-semibold text-[#CBD5E1] uppercase mb-1 tracking-wider">Display Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-[#070A0F] border border-[#1E293B] focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]/40 rounded-lg px-4 py-2.5 text-sm text-[#FFFFFF] outline-none transition-colors"
                  placeholder="DevOps Engineer"
                />
              </div>
            )}
            <div>
              <label className="block text-xs font-semibold text-[#CBD5E1] uppercase mb-1 tracking-wider">Email Address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[#070A0F] border border-[#1E293B] focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]/40 rounded-lg px-4 py-2.5 text-sm text-[#FFFFFF] outline-none transition-colors"
                placeholder="engineer@company.com"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#CBD5E1] uppercase mb-1 tracking-wider">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#070A0F] border border-[#1E293B] focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]/40 rounded-lg px-4 py-2.5 text-sm text-[#FFFFFF] outline-none transition-colors"
                placeholder="Password"
              />
            </div>

            {authError && (
              <p className="text-xs text-[#EF4444] bg-[#7F1D1D]/20 border border-[#991B1B]/40 p-2.5 rounded-lg text-center font-medium">
                {authError}
              </p>
            )}

            <button
              type="submit"
              className="w-full bg-[#2563EB] hover:bg-[#1D4ED8] text-[#FFFFFF] font-medium py-2.5 rounded-lg border border-[#38BDF8]/20 transition-colors cursor-pointer text-sm"
            >
              {isSignUp ? 'Create Account' : 'Sign In'}
            </button>
          </form>

          <div className="text-center pt-2">
            <button
              type="button"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setAuthError(null);
              }}
              className="text-xs text-[#38BDF8] hover:text-[#FFFFFF] transition-colors font-medium hover:underline"
            >
              {isSignUp ? 'Already registered? Sign In' : 'Need an account? Register'}
            </button>
          </div>
        </div>
      </main>
    );
  }

  const diagnosis = investigationResult?.diagnosis;
  const report = investigationResult?.investigation;

  return (
    <main className="min-h-screen bg-[#070A0F] text-[#F8FAFC] flex flex-col font-sans antialiased">
      {/* Navigation Bar (Max 5 Links) */}
      <header className="border-b border-[#1E293B] bg-[#0B0F19]/90 sticky top-0 z-50 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-8">
            <Link href="/" className="flex items-center space-x-2.5 text-[#FFFFFF] font-bold tracking-tight text-lg">
              <Server className="w-5 h-5 text-[#2563EB]" />
              <span>Kubernetes Agent</span>
            </Link>

            {/* Exactly 5 Navigation Links */}
            <nav className="hidden md:flex items-center space-x-6 text-xs uppercase tracking-wider font-semibold text-[#94A3B8]">
              <Link href="/" className="text-[#FFFFFF] transition-colors">Overview</Link>
              <a href="#investigations" className="hover:text-[#FFFFFF] transition-colors">Investigations</a>
              <a href="#clusters" className="hover:text-[#FFFFFF] transition-colors">Clusters</a>
              <a href="#evidence" className="hover:text-[#FFFFFF] transition-colors">Documentation</a>
              <Link href="/privacy" className="hover:text-[#FFFFFF] transition-colors">Privacy</Link>
            </nav>
          </div>

          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-[#070A0F] border border-[#1E293B] text-xs">
              <span className={`w-2 h-2 rounded-full ${isBackendHealthy ? 'bg-[#10B981]' : 'bg-[#EF4444]'}`} />
              <span className="text-[#CBD5E1] font-mono text-[11px]">
                {isBackendHealthy ? 'Backend Live' : 'Backend Offline'}
              </span>
            </div>

            <div className="hidden sm:flex items-center space-x-2 text-xs text-[#94A3B8] border-l border-[#1E293B] pl-4">
              <span>{user.email}</span>
            </div>

            <button
              onClick={handleSignOut}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-[#070A0F] hover:bg-[#1E293B] text-[#F8FAFC] text-xs font-medium rounded-lg border border-[#334155] transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Hero / Action Section */}
      <section className="py-12 border-b border-[#1E293B] bg-[#090D16]">
        <div className="max-w-7xl mx-auto px-6 space-y-6">
          <div className="space-y-2">
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#FFFFFF]">
              Cluster Health Diagnostics
            </h1>
            <p className="text-sm sm:text-base text-[#94A3B8] max-w-2xl">
              Inspect pods, logs, events, and networking states. Analyze anomalies in real time.
            </p>
          </div>

          {/* Cluster Selector & Trigger */}
          <div id="clusters" className="bg-[#0B0F19] border border-[#1E293B] rounded-lg p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex-1 space-y-1">
                <label className="block text-xs font-semibold text-[#CBD5E1] uppercase tracking-wider">
                  Target Kubernetes Context
                </label>
                <div className="relative">
                  <select
                    value={selectedContext}
                    onChange={(e) => setSelectedContext(e.target.value)}
                    className="w-full bg-[#070A0F] border border-[#1E293B] focus:border-[#2563EB] rounded-lg px-4 py-2.5 text-sm text-[#FFFFFF] font-mono outline-none transition-colors appearance-none"
                  >
                    {contexts.length === 0 ? (
                      <option value="">No cluster contexts detected</option>
                    ) : (
                      contexts.map((ctx) => {
                        let label = ctx;
                        if (ctx === 'k8s-sandbox-cluster') label = 'k8s-sandbox-cluster (CrashLoopBackOff Incident)';
                        else if (ctx === 'k8s-sandbox-oom') label = 'k8s-sandbox-oom (OOMKilled Incident)';
                        else if (ctx === 'k8s-sandbox-imagepull') label = 'k8s-sandbox-imagepull (ImagePullBackOff Incident)';
                        return (
                          <option key={ctx} value={ctx}>
                            {label}
                          </option>
                        );
                      })
                    )}
                  </select>
                </div>
              </div>

              <div className="flex items-end space-x-3 pt-2 sm:pt-0">
                <button
                  type="button"
                  onClick={handleRefresh}
                  className="px-4 py-2.5 bg-[#070A0F] hover:bg-[#1E293B] text-[#F8FAFC] text-sm font-medium rounded-lg border border-[#334155] transition-colors inline-flex items-center space-x-2"
                >
                  <RefreshCw className="w-4 h-4 text-[#94A3B8]" />
                  <span>Refresh</span>
                </button>

                <button
                  type="button"
                  onClick={handleStartInvestigation}
                  disabled={isPending || !selectedContext}
                  className="px-5 py-2.5 bg-[#2563EB] hover:bg-[#1D4ED8] text-[#FFFFFF] text-sm font-medium rounded-lg border border-[#38BDF8]/20 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center space-x-2"
                >
                  <Activity className={`w-4 h-4 ${isPending ? 'animate-spin' : ''}`} />
                  <span>{isPending ? 'Diagnosing Cluster...' : 'Run Investigation'}</span>
                </button>
              </div>
            </div>

            {kubeconfigPath && (
              <div className="text-xs text-[#94A3B8] font-mono pt-2 border-t border-[#1E293B] flex flex-wrap items-center justify-between gap-2">
                <div>
                  Active configuration: <span className="text-[#F8FAFC]">{kubeconfigPath}</span>
                </div>
                {selectedContext.startsWith('k8s-sandbox') && (
                  <span className="px-2.5 py-0.5 rounded bg-[#2563EB]/10 text-[#38BDF8] border border-[#2563EB]/30 text-[10px] font-sans font-semibold uppercase tracking-wider">
                    Interactive Sandbox Mode
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Main Content Grid */}
      <div className="max-w-7xl mx-auto px-6 py-10 flex-1 w-full grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Milestones + History (4 Cols) */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Progress Timeline */}
          {isPending && (
            <div className="bg-[#0B0F19] border border-[#1E293B] rounded-lg p-6 space-y-4">
              <h3 className="text-xs font-semibold text-[#CBD5E1] uppercase tracking-wider flex items-center space-x-2">
                <Activity className="w-4 h-4 text-[#2563EB] animate-spin" />
                <span>Live Investigation Milestones</span>
              </h3>
              
              <div className="space-y-3">
                {Object.entries(progressSteps).map(([stepName, stepStatus]) => {
                  return (
                    <div key={stepName} className="flex items-center justify-between text-xs py-1 border-b border-[#1E293B]/60 last:border-none">
                      <span className={stepStatus === 'active' ? 'text-[#38BDF8] font-semibold' : stepStatus === 'completed' ? 'text-[#FFFFFF]' : 'text-[#94A3B8]'}>
                        {stepName}
                      </span>
                      {stepStatus === 'completed' && <CheckCircle2 className="w-4 h-4 text-[#10B981]" />}
                      {stepStatus === 'active' && <Clock className="w-4 h-4 text-[#38BDF8] animate-spin" />}
                      {stepStatus === 'pending' && <span className="w-2 h-2 rounded-full bg-[#1E293B]" />}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Recent History */}
          <div id="investigations" className="bg-[#0B0F19] border border-[#1E293B] rounded-lg p-6 space-y-4">
            <h3 className="text-xs font-semibold text-[#CBD5E1] uppercase tracking-wider flex items-center space-x-2">
              <Clock className="w-4 h-4 text-[#2563EB]" />
              <span>Recent Investigations</span>
            </h3>

            {history.length === 0 ? (
              <p className="text-xs text-[#94A3B8]">No past cluster investigation records found.</p>
            ) : (
              <div className="space-y-3">
                {history.map((item) => (
                  <div key={item.id} className="bg-[#070A0F] border border-[#1E293B] rounded-lg p-3 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-[#FFFFFF] truncate max-w-[180px]">{item.root_cause}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${item.status === 'Healthy' ? 'bg-[#064E3B]/40 text-[#10B981]' : 'bg-[#7F1D1D]/40 text-[#EF4444]'}`}>
                        {item.status}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-[#94A3B8]">
                      <span>Namespace: {item.namespace}</span>
                      <span>{item.confidence}% Confidence</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: AI Diagnosis + Cluster Evidence Report (8 Cols) */}
        <div id="evidence" className="lg:col-span-8 space-y-6">
          
          {mutationError && (
            <div className="bg-[#7F1D1D]/20 border border-[#991B1B]/40 rounded-lg p-6 space-y-3">
              <div className="flex items-center space-x-2 text-[#EF4444]">
                <AlertCircle className="w-5 h-5" />
                <h4 className="font-bold text-sm">Cluster Investigation Error</h4>
              </div>
              <p className="text-xs text-[#FCA5A5] leading-relaxed">
                {(mutationError as Error).message || "Failed to communicate with Kubernetes cluster or execute kubectl diagnostic checks."}
              </p>
            </div>
          )}

          {showResults && diagnosis && (
            <div className="bg-[#0B0F19] border border-[#1E293B] rounded-lg p-6 space-y-6">
              <div className="flex items-center justify-between border-b border-[#1E293B] pb-4">
                <div className="flex items-center space-x-3">
                  <div className="p-2 rounded-lg bg-[#2563EB]/10 border border-[#2563EB]/30 text-[#2563EB]">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-[#FFFFFF]">Root Cause Diagnosis</h2>
                    <span className="text-xs text-[#94A3B8]">Automated reasoning from cluster telemetry</span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-xs text-[#94A3B8] block">Confidence Score</span>
                  <span className="text-lg font-mono font-bold text-[#38BDF8]">{diagnosis.confidence}%</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-[#070A0F] border border-[#1E293B] rounded-lg p-4 space-y-2">
                  <span className="text-xs font-semibold text-[#CBD5E1] uppercase tracking-wide">Root Cause</span>
                  <p className="text-sm font-semibold text-[#FFFFFF]">{diagnosis.root_cause}</p>
                </div>

                <div className="bg-[#070A0F] border border-[#1E293B] rounded-lg p-4 space-y-2">
                  <span className="text-xs font-semibold text-[#CBD5E1] uppercase tracking-wide">Severity</span>
                  <p className="text-sm font-semibold text-[#F59E0B] uppercase">{diagnosis.severity || 'Medium'}</p>
                </div>
              </div>

              <div className="space-y-2">
                <span className="text-xs font-semibold text-[#CBD5E1] uppercase tracking-wide">Technical Explanation</span>
                <p className="text-xs sm:text-sm text-[#CBD5E1] leading-relaxed bg-[#070A0F] border border-[#1E293B] rounded-lg p-4">
                  {diagnosis.explanation}
                </p>
              </div>

              {diagnosis.fix && (
                <div className="space-y-2">
                  <span className="text-xs font-semibold text-[#CBD5E1] uppercase tracking-wide">Recommended Remediation</span>
                  <pre className="text-xs font-mono text-[#F8FAFC] bg-[#070A0F] border border-[#1E293B] rounded-lg p-4 overflow-x-auto leading-relaxed">
                    {diagnosis.fix}
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* Evidence Inspector Tabs */}
          {showResults && report && (
            <div className="bg-[#0B0F19] border border-[#1E293B] rounded-lg overflow-hidden">
              <div className="flex border-b border-[#1E293B] bg-[#070A0F] overflow-x-auto">
                <button
                  type="button"
                  onClick={() => setActiveTab('pods')}
                  className={`px-5 py-3 text-xs font-semibold uppercase tracking-wider flex items-center space-x-2 border-b-2 transition-colors ${
                    activeTab === 'pods'
                      ? 'border-[#2563EB] text-[#FFFFFF] bg-[#0B0F19]'
                      : 'border-transparent text-[#94A3B8] hover:text-[#FFFFFF]'
                  }`}
                >
                  <Server className="w-4 h-4" />
                  <span>Pods ({report.pods?.total_pods || 0})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('deployments')}
                  className={`px-5 py-3 text-xs font-semibold uppercase tracking-wider flex items-center space-x-2 border-b-2 transition-colors ${
                    activeTab === 'deployments'
                      ? 'border-[#2563EB] text-[#FFFFFF] bg-[#0B0F19]'
                      : 'border-transparent text-[#94A3B8] hover:text-[#FFFFFF]'
                  }`}
                >
                  <Layers className="w-4 h-4" />
                  <span>Deployments</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('events')}
                  className={`px-5 py-3 text-xs font-semibold uppercase tracking-wider flex items-center space-x-2 border-b-2 transition-colors ${
                    activeTab === 'events'
                      ? 'border-[#2563EB] text-[#FFFFFF] bg-[#0B0F19]'
                      : 'border-transparent text-[#94A3B8] hover:text-[#FFFFFF]'
                  }`}
                >
                  <AlertTriangle className="w-4 h-4" />
                  <span>Events</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('network')}
                  className={`px-5 py-3 text-xs font-semibold uppercase tracking-wider flex items-center space-x-2 border-b-2 transition-colors ${
                    activeTab === 'network'
                      ? 'border-[#2563EB] text-[#FFFFFF] bg-[#0B0F19]'
                      : 'border-transparent text-[#94A3B8] hover:text-[#FFFFFF]'
                  }`}
                >
                  <Network className="w-4 h-4" />
                  <span>Networking</span>
                </button>
              </div>

              <div className="p-6">
                {activeTab === 'pods' && (
                  <div className="space-y-4">
                    {report.pods?.problematic_pods?.length === 0 ? (
                      <p className="text-xs text-[#10B981]">All cluster pods report Running status.</p>
                    ) : (
                      report.pods?.problematic_pods?.map((pod: { name: string; namespace: string; status: string }, idx: number) => {
                        const logKey = `${pod.namespace}/${pod.name}`;
                        const logReport = report.logs?.[logKey];
                        return (
                          <div key={idx} className="bg-[#070A0F] border border-[#1E293B] rounded-lg p-4 space-y-3">
                            <div className="flex justify-between items-center border-b border-[#1E293B] pb-2">
                              <div>
                                <span className="text-[11px] font-mono text-[#38BDF8] block">{pod.namespace}</span>
                                <h4 className="text-sm font-bold text-[#FFFFFF]">{pod.name}</h4>
                              </div>
                              <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-[#7F1D1D]/40 text-[#EF4444]">
                                {pod.status}
                              </span>
                            </div>

                            {logReport?.critical_errors?.length > 0 && (
                              <div className="space-y-1">
                                <span className="text-[11px] font-semibold text-[#CBD5E1] uppercase">Critical Error Highlight</span>
                                <div className="bg-[#7F1D1D]/10 border border-[#991B1B]/30 rounded p-2.5 text-xs font-mono text-[#FCA5A5]">
                                  {logReport.critical_errors.map((err: string, eIdx: number) => (
                                    <div key={eIdx}>• {err}</div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {logReport?.current_logs && (
                              <div className="space-y-1">
                                <span className="text-[11px] font-semibold text-[#CBD5E1] uppercase">Pod Log Tail</span>
                                <pre className="bg-[#0B0F19] border border-[#1E293B] text-[#CBD5E1] text-xs font-mono p-3 rounded overflow-x-auto max-h-40 leading-relaxed">
                                  {logReport.current_logs}
                                </pre>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                )}

                {activeTab === 'deployments' && (
                  <div className="space-y-3">
                    {report.deployments?.unhealthy_deployments?.length === 0 ? (
                      <p className="text-xs text-[#10B981]">All deployments match desired replica specs.</p>
                    ) : (
                      report.deployments?.unhealthy_deployments?.map((deploy: { name: string; namespace: string; ready_replicas: number; desired_replicas: number; reason: string }, idx: number) => (
                        <div key={idx} className="bg-[#070A0F] border border-[#1E293B] rounded-lg p-4 space-y-2">
                          <div className="flex justify-between items-center">
                            <div>
                              <span className="text-[11px] font-mono text-[#38BDF8] block">{deploy.namespace}</span>
                              <h4 className="text-sm font-bold text-[#FFFFFF]">{deploy.name}</h4>
                            </div>
                            <span className="text-xs font-mono text-[#94A3B8]">
                              Replicas: {deploy.ready_replicas} / {deploy.desired_replicas}
                            </span>
                          </div>
                          <p className="text-xs text-[#FCA5A5] bg-[#7F1D1D]/10 border border-[#991B1B]/30 p-2.5 rounded">
                            {deploy.reason}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {activeTab === 'events' && (
                  <div className="space-y-3">
                    {report.events?.warnings?.length === 0 ? (
                      <p className="text-xs text-[#10B981]">Zero warning events logged across cluster namespaces.</p>
                    ) : (
                      report.events?.warnings?.map((ev: { reason: string; kind: string; name: string; message: string; count: number }, idx: number) => (
                        <div key={idx} className="bg-[#070A0F] border border-[#1E293B] rounded-lg p-3 space-y-1 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-[#F59E0B] font-semibold">{ev.reason}</span>
                            <span className="text-[#94A3B8] font-mono">{ev.kind}/{ev.name}</span>
                          </div>
                          <p className="text-[#CBD5E1]">{ev.message}</p>
                          <div className="text-[10px] text-[#94A3B8]">Occurrence count: {ev.count}</div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {activeTab === 'network' && (
                  <div className="space-y-3">
                    {report.network?.unhealthy_services?.length === 0 ? (
                      <p className="text-xs text-[#10B981]">All cluster service endpoints are healthy.</p>
                    ) : (
                      report.network?.unhealthy_services?.map((svc: { name: string; namespace: string; type: string; reason: string }, idx: number) => (
                        <div key={idx} className="bg-[#070A0F] border border-[#1E293B] rounded-lg p-3 space-y-1.5 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-[#FFFFFF]">{svc.name}</span>
                            <span className="font-mono text-[#94A3B8]">{svc.type}</span>
                          </div>
                          <p className="text-[#FCA5A5]">{svc.reason}</p>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {!showResults && !isPending && (
            <div className="bg-[#0B0F19] border border-[#1E293B] rounded-lg p-12 text-center space-y-3">
              <Terminal className="w-8 h-8 text-[#94A3B8] mx-auto" />
              <h3 className="text-base font-bold text-[#FFFFFF]">Ready for Cluster Diagnostics</h3>
              <p className="text-xs text-[#94A3B8] max-w-sm mx-auto">
                Select your target context above and click Run Investigation to gather live telemetry.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Production Footer (No AI badge, strictly compliant) */}
      <footer className="border-t border-[#1E293B] bg-[#070A0F] py-8 mt-12">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#94A3B8]">
          <div className="flex items-center space-x-2">
            <Server className="w-4 h-4 text-[#2563EB]" />
            <span className="text-[#CBD5E1] font-semibold">DevOps Kubernetes AI Agent</span>
            <span>© 2026. All rights reserved.</span>
          </div>

          <div className="flex items-center space-x-6">
            <Link href="/privacy" className="hover:text-[#FFFFFF] transition-colors">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-[#FFFFFF] transition-colors">Terms of Service</Link>
            <a href="https://github.com/vishalmore90/DevOps-Kubernetes-AI-Agent" target="_blank" rel="noreferrer" className="hover:text-[#FFFFFF] transition-colors">GitHub Repository</a>
          </div>
        </div>
      </footer>
    </main>
  );
}
