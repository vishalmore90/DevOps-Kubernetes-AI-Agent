"use client";

import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getHealth, getContexts } from '../services/api';
import { useInvestigation } from '../hooks/useInvestigation';
import { insforge } from '../lib/insforge';
import { useRouter } from 'next/navigation';

interface HistoryItem {
  id: number;
  root_cause: string;
  namespace: string;
  confidence: number;
  status: string;
  created_at: string;
}

export default function Home() {
  const [user, setUser] = useState<any>(null);
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
    insforge.auth.getCurrentUser().then(({ data, error }) => {
      if (data?.user) {
        if (!data.user.emailVerified) {
          router.push(`/verify-email?email=${encodeURIComponent(data.user.email)}`);
        } else {
          setUser(data.user);
        }
      }
      setAuthLoading(false);
    });
  }, []);

  // Fetch contexts on mount/user state change
  useEffect(() => {
    if (user) {
      getContexts().then(({ contexts, current_context, kubeconfig_path }) => {
        setContexts(contexts || []);
        setKubeconfigPath(kubeconfig_path || null);
        if (current_context) {
          setSelectedContext(current_context);
        } else if (contexts && contexts.length > 0) {
          setSelectedContext(contexts[0]);
        }
      }).catch(err => console.error("Failed to load clusters/contexts:", err));
    }
  }, [user]);

  const handleRefresh = async () => {
    if (!user) return;
    try {
      const { contexts, current_context, kubeconfig_path } = await getContexts();
      setContexts(contexts || []);
      setKubeconfigPath(kubeconfig_path || null);
      if (current_context) {
        setSelectedContext(current_context);
      } else if (contexts && contexts.length > 0) {
        setSelectedContext(contexts[0]);
      }
    } catch (err) {
      console.error("Failed to refresh clusters/contexts:", err);
    }
  };

  // Fetch History once authenticated
  const fetchHistory = async (userId: string) => {
    try {
      const { data, error } = await insforge.database
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
      // Pre-register status handlers
      insforge.realtime.on('connect', () => {
        console.log('Realtime socket connected:', insforge.realtime.socketId);
      });

      insforge.realtime.on('error', (err) => {
        console.error('Realtime socket error:', err);
      });

      await insforge.realtime.connect();
      
      const response = await insforge.realtime.subscribe(channelName);
      if (response.ok) {
        isSubscribed = true;
        console.log(`Subscribed to realtime channel: ${channelName}`);
        
        // Listen for progress changes
        insforge.realtime.on('progress', (message: any) => {
          const step = message.step;
          const status = message.status; // 'active' or 'completed'
          
          setProgressSteps(prev => {
            const updated = { ...prev };
            
            // If completed, make sure the step is marked completed
            if (status === 'completed') {
              Object.keys(updated).forEach(k => {
                updated[k] = 'completed';
              });
            } else {
              // Mark all prior steps as completed, and current step as active
              const stepsOrder = [
                "Checking Pods",
                "Reading Logs",
                "Analyzing Events",
                "Inspecting Deployments",
                "Checking Networking",
                "AI Reasoning",
                "Root Cause Found"
              ];
              const currentIndex = stepsOrder.indexOf(step);
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
        insforge.realtime.disconnect();
      }
    };
  }, [user]);

  const { mutate, data, isPending, error: mutationError } = useInvestigation();

  const handleInvestigate = () => {
    if (!user?.id) return;
    
    // Reset progress steps to pending
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
        // Save to History Database
        try {
          const problematicPods = res.investigation.pods.problematic_pods || [];
          const namespace = problematicPods[0]?.namespace || 'all';
          const status = res.investigation.pods.healthy ? 'Healthy' : 'Issues Detected';

          await insforge.database
            .from('investigations')
            .insert({
              user_id: user.id,
              root_cause: res.diagnosis.root_cause,
              namespace: namespace,
              confidence: res.diagnosis.confidence,
              status: status
            });
            
          // Refresh list
          fetchHistory(user.id);
        } catch (err) {
          console.error("Failed to save record to history database:", err);
        }
      }
    });
  };

  // Auth Handlers
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);

    if (isSignUp) {
      const { data, error } = await insforge.auth.signUp({
        email,
        password,
        name,
      });
      if (error) {
        setAuthError(error.message || 'Failed to sign up.');
      } else if (data) {
        if (data.requireEmailVerification) {
          router.push(`/verify-email?email=${encodeURIComponent(email)}`);
        } else if (data.user) {
          setUser(data.user);
        }
      }
    } else {
      const { data, error } = await insforge.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        setAuthError(error.message || 'Invalid email or password.');
      } else if (data?.user) {
        if (!data.user.emailVerified) {
          router.push(`/verify-email?email=${encodeURIComponent(email)}`);
        } else {
          setUser(data.user);
        }
      }
    }
  };

  const handleSignOut = async () => {
    await insforge.auth.signOut();
    setUser(null);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
        <svg className="animate-spin h-8 w-8 text-indigo-500 mr-2" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span>Loading session...</span>
      </div>
    );
  }


  // Render Login Card if not authenticated
  if (!user) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6 relative overflow-hidden font-sans">
        <div className="absolute top-[-25%] left-[-20%] w-[65%] h-[65%] bg-blue-900/10 rounded-full blur-[140px] pointer-events-none"></div>
        <div className="absolute bottom-[-25%] right-[-20%] w-[65%] h-[65%] bg-indigo-900/10 rounded-full blur-[140px] pointer-events-none"></div>
        <div className="absolute top-[40%] left-[35%] w-[30%] h-[30%] bg-violet-900/5 rounded-full blur-[120px] pointer-events-none"></div>

        <div className="z-10 w-full max-w-md bg-slate-900/40 border border-slate-800/80 hover:border-slate-700/50 rounded-3xl p-8 backdrop-blur-xl shadow-[0_0_50px_-12px_rgba(99,102,241,0.15)] space-y-6 transition-all duration-500">
          <div className="text-center space-y-2">
            <h1 className="text-4xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-indigo-300 to-violet-400">
              K8sInvestigator
            </h1>
            <p className="text-xs text-slate-400">
              Authenticate with your InsForge account to access cluster diagnostics.
            </p>
          </div>

          <form onSubmit={handleAuth} className="space-y-4">
            {isSignUp && (
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1 tracking-wider">Display Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-950/60 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 rounded-xl px-4 py-3 text-sm text-slate-200 outline-none transition-all duration-350"
                  placeholder="John Doe"
                />
              </div>
            )}
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
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1 tracking-wider">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-950/60 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 rounded-xl px-4 py-3 text-sm text-slate-200 outline-none transition-all duration-350"
                placeholder="••••••••"
              />
            </div>

            {authError && (
              <p className="text-xs text-red-400 bg-red-950/20 border border-red-900/30 p-2.5 rounded-lg text-center font-semibold">
                {authError}
              </p>
            )}

            <button
              type="submit"
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-655 hover:from-blue-500 hover:to-indigo-600 text-white font-bold py-3.5 rounded-xl shadow-lg hover:shadow-indigo-500/20 hover:scale-[1.01] hover:-translate-y-0.5 active:scale-95 transition-all duration-300 cursor-pointer text-sm"
            >
              {isSignUp ? 'Create Account' : 'Sign In'}
            </button>
          </form>

          <div className="text-center text-xs text-slate-500 space-y-2.5 pt-2">
            <div>
              {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
              <button
                onClick={() => {
                  setIsSignUp(!isSignUp);
                  setAuthError(null);
                }}
                className="text-indigo-400 hover:text-indigo-300 hover:underline font-semibold transition"
              >
                {isSignUp ? 'Sign In' : 'Create Account'}
              </button>
            </div>
            <div>
              <button
                onClick={() => router.push(`/verify-email?email=${encodeURIComponent(email)}`)}
                className="text-slate-400 hover:text-white transition underline font-medium"
              >
                Already have a verification code? Verify email
              </button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  const report = data?.investigation;
  const diagnosis = data?.diagnosis;

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center p-4 sm:p-12 relative overflow-y-auto font-sans">
      
      {/* Background Gradients */}
      <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[50%] bg-blue-950/15 rounded-full blur-[140px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[50%] bg-indigo-950/15 rounded-full blur-[140px] pointer-events-none"></div>
      <div className="absolute top-[20%] left-[45%] w-[40%] h-[40%] bg-violet-950/10 rounded-full blur-[130px] pointer-events-none"></div>

      {/* Top Bar */}
      <div className="z-10 w-full max-w-5xl flex items-center justify-between border-b border-slate-800/40 pb-5 mb-6">
        {/* Signed In As info badge */}
        <div className="flex items-center space-x-2.5 bg-slate-900/40 border border-slate-850/80 px-3.5 py-2 rounded-2xl">
          <div className="bg-blue-600/20 text-blue-400 p-1.5 rounded-lg border border-blue-500/20">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <div className="text-[10px] text-left">
            <div className="font-bold text-slate-500 uppercase tracking-wider text-[8px]">Signed In As</div>
            <div className="font-semibold text-slate-350">{user.email}</div>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <div className="hidden sm:flex items-center space-x-2 bg-slate-900/60 border border-slate-800/80 px-4 py-2 rounded-full backdrop-blur-md">
            <div className={`w-2.5 h-2.5 rounded-full ${isBackendHealthy ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]'}`} />
            <span className="text-xs font-semibold text-slate-300">
              {isBackendHealthy ? 'Connected' : 'Disconnected'}
            </span>
          </div>
          <button
            onClick={handleSignOut}
            className="text-xs text-slate-400 hover:text-white transition font-medium cursor-pointer"
          >
            Sign out
          </button>
        </div>
      </div>

      {/* Main Page Title */}
      <div className="text-center space-y-2 mt-8 mb-10 z-10">
        <h1 className="text-4xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-indigo-200 to-white">
          AI Kubernetes Agent
        </h1>
        <p className="text-sm text-slate-400 max-w-md mx-auto">
          Investigate cluster issues with AI-powered root cause analysis
        </p>
      </div>

      {/* SELECT CLUSTER Panel */}
      {(() => {
        const defaultMockContexts = [
          "kind-kubernetes-demo-cluster",
          "arn:aws:eks:ap-south-1:418384447924:cluster/demo-cluster",
          "flyte-devbox",
          "flytev2-sandbox",
          "gke_neat-dryad-493910-b0_asia-south1_escbash-production",
          "iam-root-account@o2-demo-eks.ap-south-1.eksctl.io"
        ];
        const displayedContexts = Array.from(new Set([...contexts, ...defaultMockContexts]));

        return displayedContexts.length > 0 && (
          <div className="z-10 w-full max-w-5xl bg-slate-900/40 border border-slate-850/80 rounded-3xl p-6 backdrop-blur-xl shadow-2xl space-y-4 hover:border-slate-800/80 transition duration-300 mb-8">
            <div className="flex items-center justify-between border-b border-slate-850/60 pb-3">
              <div className="flex items-center space-x-2.5">
                <div className="bg-blue-950/40 border border-blue-900/30 text-blue-400 p-1.5 rounded-lg">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">Select Cluster</h3>
                </div>
              </div>
              <span className="bg-indigo-950/30 border border-indigo-900/20 text-indigo-400 px-2.5 py-1 rounded-full text-[10px] font-bold">
                {displayedContexts.length} clusters available
              </span>
            </div>

            <div className="text-[10px] font-mono text-slate-400 bg-slate-950/60 border border-slate-850/80 rounded-xl px-3.5 py-2 inline-block">
              {kubeconfigPath || "/tmp/k8s-agent-kubeconfig.json"}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {displayedContexts.map((ctx) => {
                const isSelected = selectedContext === ctx;
                const isKind = ctx.includes('kind');
                const isEks = ctx.includes('eks') || ctx.includes('aws') || ctx.includes('arn:aws');
                const isGke = ctx.includes('gke') || ctx.includes('google');
                const isFlyte = ctx.includes('flyte');
                
                let subtitle = "kubernetes-cluster";
                let endpoint = "https://127.0.0.1:6443";
                
                if (isKind) {
                  subtitle = "kind-kubernetes-demo-cluster";
                  endpoint = "https://test_docker_internal:50170";
                } else if (isEks) {
                  if (ctx.includes('iam-root-account')) {
                    subtitle = "o2-demo-eks.ap-south-1.eksctl.io";
                    endpoint = "https://A3F49A1C1CA3A6D71D22DFEE3E15B.gr7.ap-south-1.eksctl.io";
                  } else {
                    subtitle = "arn:aws:eks:ap-south-1:418384447924:cluster/...";
                    endpoint = "https://3E95914C0AF7EE71F958021E431E248A.gr7.ap-south-1.eks.amazonaws.com";
                  }
                } else if (isGke) {
                  subtitle = "gke_neat-dryad-493910-b0_asia-...";
                  endpoint = "https://35.82.47.244";
                } else if (isFlyte) {
                  subtitle = ctx === "flyte-devbox" ? "flytev2-sandbox" : "flytev2-sandbox";
                  endpoint = "https://host.docker.internal:6443";
                }

                return (
                  <button
                    key={ctx}
                    onClick={() => setSelectedContext(ctx)}
                    className={`text-left p-4 rounded-2xl border transition-all duration-300 flex items-start space-x-3 cursor-pointer group relative overflow-hidden ${
                      isSelected
                        ? 'bg-slate-900/80 border-blue-500/80 shadow-[0_0_20px_-3px_rgba(59,130,246,0.15)] scale-[1.01]'
                        : 'bg-slate-950/40 border-slate-850 hover:border-slate-800 hover:bg-slate-950/60'
                    }`}
                  >
                    <div className={`p-2 rounded-xl border transition-all ${
                      isSelected
                        ? 'bg-blue-950/60 border-blue-500/30 text-blue-400'
                        : 'bg-slate-900 border-slate-850 text-slate-400 group-hover:text-slate-200'
                    }`}>
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                      </svg>
                    </div>

                    <div className="flex-1 min-w-0 pr-12">
                      <div className="font-bold text-xs text-slate-250 truncate group-hover:text-white transition">
                        {ctx}
                      </div>
                      <div className="text-[10px] text-slate-500 truncate mt-0.5">
                        {subtitle}
                      </div>
                      <div className="text-[9px] text-slate-650 truncate mt-1 font-mono">
                        {endpoint}
                      </div>
                    </div>

                    {isSelected && (
                      <div className="absolute top-3 right-3 flex flex-col items-end space-y-1">
                        <span className="bg-blue-950/60 border border-blue-500/40 text-blue-400 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider">
                          selected
                        </span>
                        <span className="bg-emerald-950/60 border border-emerald-500/40 text-emerald-400 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider">
                          current
                        </span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* Action Buttons Section */}
      <div className="z-10 w-full max-w-5xl flex items-center space-x-6 mb-8">
        <button
          onClick={handleInvestigate}
          disabled={isPending || !isBackendHealthy}
          className={`px-8 py-3.5 rounded-2xl font-bold tracking-wide transition duration-300 transform active:scale-95 shadow-xl ${
            isPending 
              ? 'bg-indigo-950/80 text-indigo-300 border border-indigo-850 cursor-not-allowed'
              : !isBackendHealthy
              ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
              : 'bg-gradient-to-r from-blue-600 to-indigo-655 hover:from-blue-500 hover:to-indigo-600 text-white shadow-indigo-500/10 cursor-pointer hover:-translate-y-0.5 hover:shadow-indigo-500/25 transition-all duration-300'
          }`}
        >
          <div className="flex items-center justify-center space-x-2">
            {isPending && (
              <svg className="animate-spin h-5 w-5 text-indigo-400" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            )}
            <span>{isPending ? 'Diagnosing...' : 'Investigate Cluster'}</span>
          </div>
        </button>

        <button
          onClick={handleRefresh}
          className="text-xs font-semibold text-slate-400 hover:text-white transition cursor-pointer flex items-center space-x-1.5"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 7.89H17v4.11" />
          </svg>
          <span>Refresh clusters</span>
        </button>
      </div>

      {/* Main Section */}
      <div className="z-10 w-full max-w-5xl grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: CTA, Realtime steps, and History */}
        <div className="lg:col-span-1 space-y-6">
          
          {/* Active Context Card */}
          {selectedContext && (
            <div className="bg-slate-900/40 border border-slate-850/80 rounded-3xl p-5 backdrop-blur-xl shadow-2xl space-y-2">
              <span className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider">Active Target Context</span>
              <span className="block text-xs font-mono font-bold text-slate-300 truncate">{selectedContext}</span>
            </div>
          )}

          {/* Realtime Progress Steps */}
          {isPending && (
            <div className="bg-slate-900/40 border border-slate-850/80 rounded-3xl p-6 backdrop-blur-xl shadow-2xl space-y-4">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Investigation Status</h4>
              <div className="space-y-3">
                {Object.entries(progressSteps).map(([step, state], index) => (
                  <div key={index} className="flex items-center justify-between text-sm">
                    <div className="flex items-center space-x-3">
                      {state === 'completed' ? (
                        <div className="bg-emerald-950 text-emerald-400 p-0.5 rounded-full border border-emerald-900/35 shadow-[0_0_8px_rgba(16,185,129,0.2)]">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                        </div>
                      ) : state === 'active' ? (
                        <div className="w-4.5 h-4.5 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin"></div>
                      ) : (
                        <div className="w-4.5 h-4.5 rounded-full border border-slate-800 bg-slate-950"></div>
                      )}
                      <span className={`${state === 'active' ? 'text-indigo-400 font-semibold' : state === 'completed' ? 'text-slate-400' : 'text-slate-500'}`}>
                        {step}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Previous Investigations (History) */}
          <div className="bg-slate-900/40 border border-slate-850/80 rounded-3xl p-6 backdrop-blur-xl shadow-2xl space-y-4">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Recent History</h4>
            {history.length === 0 ? (
              <p className="text-xs text-slate-500">No previous investigations found.</p>
            ) : (
              <div className="space-y-3">
                {history.map((item, idx) => (
                  <div key={idx} className="bg-slate-950/40 border border-slate-850 hover:border-indigo-900/40 rounded-xl p-3 flex items-center justify-between text-xs hover:scale-[1.01] hover:shadow-[0_0_15px_-3px_rgba(99,102,241,0.06)] hover:-translate-y-0.5 transition-all duration-300">
                    <div className="space-y-1">
                      <div className="font-semibold text-slate-300 truncate max-w-[140px]">{item.root_cause}</div>
                      <div className="text-[10px] text-slate-500">Namespace: {item.namespace}</div>
                    </div>
                    <div className="text-right space-y-1">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${item.status === 'Healthy' ? 'bg-emerald-950/30 text-emerald-400' : 'bg-red-950/30 text-red-400'}`}>
                        {item.status}
                      </span>
                      <div className="text-[10px] text-slate-400 font-semibold">{item.confidence}% Conf</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: AI Diagnosis + Cluster Evidence Report */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Error Message */}
          {mutationError && (
            <div className="bg-red-950/20 border border-red-900/35 rounded-3xl p-6 text-center shadow-lg">
              {(() => {
                const err = mutationError as any;
                const detail = err.response?.data?.detail || err.message || String(err);
                if (detail.includes("Unable to connect") || detail.includes("connection to the server") || detail.includes("connection refused")) {
                  return (
                    <div className="space-y-3 text-left">
                      <p className="font-bold text-red-400 text-sm">Unable to connect to Kubernetes cluster.</p>
                      <div className="text-slate-350 text-xs space-y-2">
                        <p className="font-semibold text-slate-400">Please verify:</p>
                        <ul className="list-disc pl-4 space-y-1 text-slate-400">
                          <li>Your kubeconfig path configuration is correct</li>
                          <li>The cluster is running and active</li>
                          <li>Your kubectl context has appropriate permissions</li>
                        </ul>
                        <p className="text-[10px] text-slate-500 font-mono mt-2 pt-2 border-t border-red-900/10">
                          Raw Error: {detail}
                        </p>
                      </div>
                    </div>
                  );
                }
                return <p className="text-red-400 text-xs">{detail}</p>;
              })()}
            </div>
          )}

          {/* Healthy State Card */}
          {showResults && report && report.pods?.healthy && report.deployments?.healthy && report.network?.healthy && (
            <div className="bg-emerald-950/15 border border-emerald-900/20 rounded-3xl p-8 text-center space-y-3 backdrop-blur-xl shadow-2xl">
              <div className="inline-flex bg-emerald-950/40 text-emerald-400 p-3 rounded-full border border-emerald-900/30 shadow-lg shadow-emerald-500/5">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-emerald-400 font-bold text-lg">No critical Kubernetes issues detected.</h3>
              <p className="text-slate-400 text-xs">Cluster appears healthy.</p>
            </div>
          )}

          {/* AI Diagnosis Card */}
          {showResults && diagnosis && report && (!report.pods?.healthy || !report.deployments?.healthy || !report.network?.healthy) && (
            <div className="bg-indigo-950/10 border border-indigo-900/20 rounded-3xl p-6 backdrop-blur-xl shadow-2xl space-y-5">
              <div className="flex items-center justify-between border-b border-indigo-950 pb-3">
                <h3 className="text-lg font-bold text-indigo-400 flex items-center space-x-2">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                  <span>SRE AI Incident Report</span>
                </h3>
                <div className="flex items-center space-x-1 bg-indigo-950/30 border border-indigo-900/20 px-3 py-1 rounded-full text-xs font-mono font-bold text-indigo-300">
                  <span>Confidence:</span>
                  <span className="text-indigo-400">{diagnosis.confidence}%</span>
                </div>
              </div>

              <div className="space-y-4 text-sm">
                <div>
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Root Cause</span>
                  <div className="text-base font-bold text-slate-200 mt-0.5">{diagnosis.root_cause}</div>
                </div>

                <div>
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Explanation</span>
                  <p className="text-slate-300 leading-relaxed mt-1">{diagnosis.explanation}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div className="bg-slate-900/40 p-4 rounded-2xl border border-slate-850">
                    <span className="text-xs font-bold text-indigo-400 uppercase tracking-wide">Suggested Fix</span>
                    <p className="text-slate-300 text-xs leading-relaxed mt-1.5">{diagnosis.fix}</p>
                  </div>
                  <div className="bg-slate-900/40 p-4 rounded-2xl border border-slate-850">
                    <span className="text-xs font-bold text-violet-400 uppercase tracking-wide">Prevention Plan</span>
                    <p className="text-slate-300 text-xs leading-relaxed mt-1.5">{diagnosis.prevention}</p>
                  </div>
                </div>

                {diagnosis.kubectl_command && (
                  <div className="space-y-2 pt-2">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Remediation Command</span>
                    <pre className="bg-slate-950 text-slate-300 text-xs font-mono p-4 rounded-xl border border-slate-850 overflow-x-auto">
                      {diagnosis.kubectl_command}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Cluster Evidence Card */}
          {showResults && report && (
            <div className="bg-slate-900/30 border border-slate-850 rounded-3xl p-6 backdrop-blur-xl shadow-2xl space-y-5">
              <div className="flex border-b border-slate-850 overflow-x-auto whitespace-nowrap">
                <button
                  onClick={() => setActiveTab('pods')}
                  className={`py-3 px-6 text-sm font-bold border-b-2 transition-all ${
                    activeTab === 'pods' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Pods & Logs ({report.pods.failed_pods ?? 0})
                </button>
                <button
                  onClick={() => setActiveTab('deployments')}
                  className={`py-3 px-6 text-sm font-bold border-b-2 transition-all ${
                    activeTab === 'deployments' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Deployments ({report.deployments.unhealthy_deployments?.length ?? 0})
                </button>
                <button
                  onClick={() => setActiveTab('events')}
                  className={`py-3 px-6 text-sm font-bold border-b-2 transition-all ${
                    activeTab === 'events' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Events & Warnings ({report.events.warnings?.length ?? 0})
                </button>
                <button
                  onClick={() => setActiveTab('network')}
                  className={`py-3 px-6 text-sm font-bold border-b-2 transition-all ${
                    activeTab === 'network' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Network ({report.network.unhealthy_services?.length ?? 0})
                </button>
              </div>

              {/* Tab Outputs */}
              <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
                {activeTab === 'pods' && (
                  <div className="space-y-4">
                    {report.pods.success && (!report.pods.problematic_pods || report.pods.problematic_pods.length === 0) ? (
                      <p className="text-slate-400 text-sm">All pods are running smoothly.</p>
                    ) : (
                      report.pods.problematic_pods?.map((pod, idx) => {
                        const logKey = `${pod.namespace}/${pod.name}`;
                        const logReport = report.logs[logKey];
                        return (
                          <div key={idx} className="bg-slate-950/80 border border-slate-850 rounded-2xl p-5 space-y-4">
                            <div className="flex justify-between items-center border-b border-slate-900 pb-3">
                              <div>
                                <span className="text-xs text-indigo-400 font-bold uppercase font-mono tracking-wider">{pod.namespace}</span>
                                <h5 className="text-md font-bold">{pod.name}</h5>
                              </div>
                              <span className="px-3 py-1 rounded-md text-xs font-bold uppercase bg-red-950/30 text-red-400 border border-red-900/20">
                                {pod.status}
                              </span>
                            </div>

                            {logReport && logReport.critical_errors.length > 0 && (
                              <div className="space-y-2">
                                <div className="text-xs font-bold text-slate-400 uppercase tracking-wide">Error Highlights</div>
                                <div className="bg-red-950/5 border border-red-900/10 rounded-lg p-3 space-y-1.5">
                                  {logReport.critical_errors.map((err, eIdx) => (
                                    <div key={eIdx} className="text-xs font-mono text-red-300 flex items-start">
                                      <span className="mr-2 text-red-500">•</span>
                                      <span>{err}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {logReport && (
                              <div className="space-y-2">
                                <div className="text-xs font-bold text-slate-400 uppercase tracking-wide">Logs (Tail)</div>
                                <pre className="bg-slate-900 text-slate-300 text-xs font-mono p-4 rounded-lg overflow-x-auto max-h-48 overflow-y-auto border border-slate-850/60 leading-relaxed">
                                  {logReport.current_logs || "No logs available."}
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
                  <div className="space-y-4">
                    {report.deployments.success && (!report.deployments.unhealthy_deployments || report.deployments.unhealthy_deployments.length === 0) ? (
                      <p className="text-slate-400 text-sm">All deployments are healthy.</p>
                    ) : (
                      report.deployments.unhealthy_deployments?.map((deploy, idx) => (
                        <div key={idx} className="bg-slate-950/80 border border-slate-850 rounded-2xl p-5 space-y-3">
                          <div className="flex justify-between items-center border-b border-slate-900 pb-2">
                            <div>
                              <span className="text-xs text-indigo-400 font-bold uppercase font-mono tracking-wider">{deploy.namespace}</span>
                              <h5 className="text-md font-bold">{deploy.name}</h5>
                            </div>
                            <div className="text-xs text-slate-400 font-mono">
                              Replicas: {deploy.ready_replicas} / {deploy.desired_replicas}
                            </div>
                          </div>
                          <div className="bg-red-950/5 border border-red-900/10 rounded-lg p-3 text-xs text-red-300 leading-relaxed">
                            {deploy.reason}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {activeTab === 'events' && (
                  <div className="space-y-3">
                    {report.events.success && (!report.events.warnings || report.events.warnings.length === 0) ? (
                      <p className="text-slate-400 text-sm">No warning events logged in the cluster.</p>
                    ) : (
                      <div className="border border-slate-850 rounded-2xl overflow-hidden bg-slate-950/60 divide-y divide-slate-850">
                        {report.events.warnings?.map((event, idx) => (
                          <div key={idx} className="p-4 hover:bg-slate-900/30 flex flex-col sm:flex-row sm:items-start justify-between gap-3 text-sm">
                            <div className="space-y-1">
                              <div className="flex items-center space-x-2">
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950/50 text-amber-400 border border-amber-900/20 uppercase font-mono">
                                  {event.reason}
                                </span>
                                <span className="text-slate-500 font-mono text-xs">{event.kind}/{event.name}</span>
                              </div>
                              <p className="text-slate-300 leading-relaxed text-xs">{event.message}</p>
                            </div>
                            <div className="text-right text-xs text-slate-500 shrink-0">
                              <div>Count: {event.count}</div>
                              <div className="text-[10px]">{event.last_timestamp ? new Date(event.last_timestamp).toLocaleTimeString() : 'N/A'}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'network' && (
                  <div className="space-y-4">
                    {report.network.success && (!report.network.unhealthy_services || report.network.unhealthy_services.length === 0) ? (
                      <p className="text-slate-400 text-sm">All service endpoints are healthy.</p>
                    ) : (
                      report.network.unhealthy_services?.map((svc, idx) => (
                        <div key={idx} className="bg-slate-950/80 border border-slate-850 rounded-2xl p-5 space-y-3">
                          <div className="flex justify-between items-center border-b border-slate-900 pb-2">
                            <div>
                              <span className="text-xs text-indigo-400 font-bold uppercase font-mono tracking-wider">{svc.namespace}</span>
                              <h5 className="text-md font-bold">{svc.name}</h5>
                            </div>
                            <span className="text-xs font-mono bg-slate-900 text-slate-400 px-2 py-0.5 rounded">{svc.type}</span>
                          </div>
                          <div className="bg-red-950/5 border border-red-900/10 rounded-lg p-3 text-xs text-red-300 leading-relaxed">
                            {svc.reason}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Footer */}
      <div className="z-10 text-xs text-slate-600 mt-12 pb-6">
        AI Kubernetes Troubleshooting Agent • Platform Integration
      </div>
    </main>
  );
}
