import React, { useState } from 'react';
import {
  ArrowRight, Eye, EyeOff, Sun, Moon, Loader2, Zap, Shield, Sparkles, CheckCircle2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../store/useAuthStore';
import { useToastStore } from '../store/useToastStore';
import { useThemeStore } from '../store/useThemeStore';
import ThreeDBackground from './ThreeDBackground';
import logoImg from '../assets/logo.png';

export default function LoginPage() {
  const signInWithEmail = useAuthStore(s => s.signInWithEmail);
  const signUpWithEmail = useAuthStore(s => s.signUpWithEmail);
  const signInWithGoogle = useAuthStore(s => s.signInWithGoogle);
  const showToast = useToastStore(s => s.showToast);
  const isDark = useThemeStore(s => s.isDark);
  const toggleTheme = useThemeStore(s => s.toggle);

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      showToast('Please enter your email and password', 'warning');
      return;
    }

    if (mode === 'signup' && !name.trim()) {
      showToast('Please enter your full name', 'warning');
      return;
    }

    setIsLoading(true);
    try {
      if (mode === 'signin') {
        const res = await signInWithEmail(email.trim(), password);
        if (!res.success) {
          showToast(res.error || 'Sign in failed', 'error');
          setIsLoading(false);
          return;
        }
        showToast('Welcome back to Worklane!', 'success');
      } else {
        const res = await signUpWithEmail(name.trim(), email.trim(), password);
        if (!res.success) {
          showToast(res.error || 'Sign up failed', 'error');
          setIsLoading(false);
          return;
        }
        showToast('Account created successfully!', 'success');
        setMode('signin');
        setPassword('');
      }
    } catch (err: any) {
      showToast(err.message || 'Authentication error', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleClick = async () => {
    setIsLoading(true);
    try {
      const res = await signInWithGoogle();
      if (!res.success) {
        showToast(res.error || 'Google Sign In failed', 'error');
        setIsLoading(false);
      }
    } catch (err: any) {
      showToast(err.message || 'Google Auth error', 'error');
      setIsLoading(false);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        minHeight: '100vh',
        width: '100vw',
        position: 'relative',
        overflow: 'hidden',
        backgroundColor: isDark ? '#070a14' : '#f1f5f9',
        transition: 'background-color 0.4s ease',
      }}
    >
      {/* ── Left Side / Full View 3D Background Canvas ── */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 1,
        }}
      >
        <ThreeDBackground isDark={isDark} />
        {/* Soft Vignette */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: isDark
              ? 'radial-gradient(circle at 30% 50%, transparent 35%, rgba(5, 8, 18, 0.7) 100%)'
              : 'radial-gradient(circle at 30% 50%, transparent 40%, rgba(203, 213, 225, 0.45) 100%)',
            pointerEvents: 'none',
            zIndex: 2,
          }}
        />
      </div>

      {/* ── Left Side Showcase Branding (Visible on Desktop/Tablet) ── */}
      <div
        className="hide-on-mobile"
        style={{
          flex: 1,
          position: 'relative',
          zIndex: 10,
          padding: '48px 56px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          pointerEvents: 'none',
        }}
      >
        {/* Top Left Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <img src={logoImg} alt="Worklane" style={{ width: 34, height: 34, objectFit: 'contain' }} />
          <span
            style={{
              fontSize: 20,
              fontWeight: 800,
              color: isDark ? '#ffffff' : '#0f172a',
              letterSpacing: '-0.03em',
            }}
          >
            Worklane
          </span>
        </div>

        {/* Hero Narrative Copy */}
        <div style={{ maxWidth: 480 }}>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <h2
              style={{
                fontSize: 34,
                fontWeight: 800,
                lineHeight: 1.2,
                color: isDark ? '#ffffff' : '#0f172a',
                letterSpacing: '-0.03em',
                marginBottom: 12,
              }}
            >
              Organize projects. <br />
              <span
                style={{
                  background: 'linear-gradient(135deg, #38bdf8 0%, #818cf8 50%, #c084fc 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                Sync with your team.
              </span>
            </h2>
            <p
              style={{
                fontSize: 15,
                color: isDark ? 'rgba(255, 255, 255, 0.65)' : '#475569',
                lineHeight: 1.6,
                marginBottom: 24,
              }}
            >
              A fast, flexible workspace designed to help teams organize projects, track progress, and collaborate seamlessly.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13.5, color: isDark ? '#cbd5e1' : '#334155' }}>
                <div style={{ width: 22, height: 22, borderRadius: 6, backgroundColor: 'rgba(99, 102, 241, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Zap size={13} color="hsl(var(--primary))" />
                </div>
                <span>Real-time team collaboration</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13.5, color: isDark ? '#cbd5e1' : '#334155' }}>
                <div style={{ width: 22, height: 22, borderRadius: 6, backgroundColor: 'rgba(16, 185, 129, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Shield size={13} color="#10b981" />
                </div>
                <span>Agile boards & customizable workflows</span>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Footer Note */}
        <div style={{ fontSize: 12, color: isDark ? 'rgba(255, 255, 255, 0.4)' : '#94a3b8' }}>
          © {new Date().getFullYear()} Worklane. All rights reserved.
        </div>
      </div>

      {/* ── Right Side Full-Height Login Panel ── */}
      <motion.div
        initial={{ opacity: 0, x: 25 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        style={{
          width: '100%',
          maxWidth: 480,
          minHeight: '100vh',
          backgroundColor: isDark ? 'rgba(11, 15, 26, 0.85)' : 'rgba(255, 255, 255, 0.92)',
          backdropFilter: 'blur(36px)',
          WebkitBackdropFilter: 'blur(36px)',
          borderLeft: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)'}`,
          boxShadow: isDark
            ? '-20px 0 60px rgba(0, 0, 0, 0.75)'
            : '-20px 0 60px rgba(15, 23, 42, 0.08)',
          position: 'relative',
          zIndex: 20,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '36px 40px',
          overflowY: 'auto',
        }}
      >
        {/* Panel Top Header: Centered Theme Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
          {/* Neumorphic Theme Switcher */}
          <div
            onClick={toggleTheme}
            role="button"
            tabIndex={0}
            title={`Switch to ${isDark ? 'Light' : 'Dark'} mode`}
            style={{
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              padding: 3,
              borderRadius: 9999,
              backgroundColor: isDark ? 'rgba(15, 23, 42, 0.8)' : 'rgba(255, 255, 255, 0.9)',
              boxShadow: isDark
                ? 'inset 1px 1px 3px rgba(0,0,0,0.6), 0 2px 8px rgba(0,0,0,0.35)'
                : 'inset 1px 1px 3px rgba(160,175,200,0.4), 0 2px 8px rgba(0,0,0,0.08)',
              border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)'}`,
              userSelect: 'none',
              transition: 'background-color 0.25s ease',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '4px 9px',
                borderRadius: 9999,
                fontSize: 11,
                fontWeight: 600,
                color: !isDark ? 'hsl(var(--primary))' : 'rgba(255, 255, 255, 0.6)',
                backgroundColor: !isDark ? '#ffffff' : 'transparent',
                boxShadow: !isDark ? '0 1px 3px rgba(0,0,0,0.12)' : 'none',
                transition: 'all 0.2s ease',
              }}
            >
              <Sun size={12} color={!isDark ? '#f59e0b' : 'currentColor'} />
              <span>Light</span>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '4px 9px',
                borderRadius: 9999,
                fontSize: 11,
                fontWeight: 600,
                color: isDark ? '#ffffff' : 'rgba(15, 23, 42, 0.55)',
                backgroundColor: isDark ? 'hsl(var(--primary))' : 'transparent',
                boxShadow: isDark ? '0 1px 6px rgba(99,102,241,0.5)' : 'none',
                transition: 'all 0.2s ease',
              }}
            >
              <Moon size={12} color={isDark ? '#ffffff' : 'currentColor'} />
              <span>Dark</span>
            </div>
          </div>
        </div>

        {/* Main Form Center Area */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, margin: 'auto 0', padding: '16px 0' }}>
          {/* Header Typography */}
          <div>
            <h1
              style={{
                fontSize: 24,
                fontWeight: 800,
                color: isDark ? '#f8fafc' : '#0f172a',
                letterSpacing: '-0.03em',
                margin: 0,
              }}
            >
              {mode === 'signin' ? 'Welcome to Worklane' : 'Create your account'}
            </h1>
            <p
              style={{
                fontSize: 13.5,
                color: isDark ? '#94a3b8' : '#64748b',
                marginTop: 6,
                marginBottom: 0,
                lineHeight: 1.45,
              }}
            >
              {mode === 'signin'
                ? 'Sign in to access your agile boards, tasks & team workspace'
                : 'Sign up to start organizing projects and sprints'}
            </p>
          </div>

          {/* Segmented Mode Switch Tabs */}
          <div
            style={{
              display: 'flex',
              padding: 3,
              borderRadius: 10,
              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
              border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'}`,
            }}
          >
            <button
              type="button"
              onClick={() => setMode('signin')}
              style={{
                flex: 1,
                padding: '7px 0',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                backgroundColor: mode === 'signin' ? (isDark ? 'rgba(255, 255, 255, 0.12)' : '#ffffff') : 'transparent',
                color: mode === 'signin' ? (isDark ? '#ffffff' : '#0f172a') : (isDark ? '#94a3b8' : '#64748b'),
                boxShadow: mode === 'signin' ? (isDark ? '0 2px 8px rgba(0, 0, 0, 0.4)' : '0 2px 8px rgba(0, 0, 0, 0.08)') : 'none',
                transition: 'all 0.2s ease',
              }}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => setMode('signup')}
              style={{
                flex: 1,
                padding: '7px 0',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                backgroundColor: mode === 'signup' ? (isDark ? 'rgba(255, 255, 255, 0.12)' : '#ffffff') : 'transparent',
                color: mode === 'signup' ? (isDark ? '#ffffff' : '#0f172a') : (isDark ? '#94a3b8' : '#64748b'),
                boxShadow: mode === 'signup' ? (isDark ? '0 2px 8px rgba(0, 0, 0, 0.4)' : '0 2px 8px rgba(0, 0, 0, 0.08)') : 'none',
                transition: 'all 0.2s ease',
              }}
            >
              Create Account
            </button>
          </div>

          {/* Google Authentication Button */}
          <motion.button
            whileTap={{ scale: 0.98 }}
            type="button"
            onClick={handleGoogleClick}
            disabled={isLoading}
            style={{
              width: '100%',
              height: 44,
              borderRadius: 10,
              fontSize: 13.5,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              cursor: 'pointer',
              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : '#ffffff',
              color: isDark ? '#f1f5f9' : '#0f172a',
              border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.12)'}`,
              boxShadow: isDark ? '0 2px 8px rgba(0, 0, 0, 0.2)' : '0 2px 8px rgba(0, 0, 0, 0.06)',
              transition: 'all 0.15s ease',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                fill="#EA4335"
              />
            </svg>
            <span>{mode === 'signup' ? 'Sign up with Google' : 'Continue with Google'}</span>
          </motion.button>

          {/* Minimalist Hairline Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ flex: 1, height: 1, backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)' }} />
            <span style={{ fontSize: 11, color: isDark ? '#64748b' : '#94a3b8', fontWeight: 600, letterSpacing: '0.06em' }}>
              OR WITH EMAIL
            </span>
            <div style={{ flex: 1, height: 1, backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)' }} />
          </div>

          {/* Email & Password Form */}
          <form onSubmit={handleEmailSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {mode === 'signup' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: isDark ? '#cbd5e1' : '#334155' }}>
                  Full Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Alex Rivera"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  onFocus={() => setFocusedField('name')}
                  onBlur={() => setFocusedField(null)}
                  required={mode === 'signup'}
                  style={{
                    height: 42,
                    padding: '0 14px',
                    borderRadius: 10,
                    fontSize: 13.5,
                    outline: 'none',
                    backgroundColor: isDark ? 'rgba(10, 15, 28, 0.65)' : 'rgba(248, 250, 252, 0.85)',
                    color: isDark ? '#f8fafc' : '#0f172a',
                    border: focusedField === 'name'
                      ? '1px solid hsl(var(--primary))'
                      : `1px solid ${isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.12)'}`,
                    boxShadow: focusedField === 'name'
                      ? '0 0 0 3px rgba(99, 102, 241, 0.25)'
                      : 'none',
                    transition: 'all 0.15s ease',
                  }}
                />
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: isDark ? '#cbd5e1' : '#334155' }}>
                Email Address
              </label>
              <input
                type="email"
                placeholder="alex@company.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onFocus={() => setFocusedField('email')}
                onBlur={() => setFocusedField(null)}
                required
                style={{
                  height: 42,
                  padding: '0 14px',
                  borderRadius: 10,
                  fontSize: 13.5,
                  outline: 'none',
                  backgroundColor: isDark ? 'rgba(10, 15, 28, 0.65)' : 'rgba(248, 250, 252, 0.85)',
                  color: isDark ? '#f8fafc' : '#0f172a',
                  border: focusedField === 'email'
                    ? '1px solid hsl(var(--primary))'
                    : `1px solid ${isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.12)'}`,
                  boxShadow: focusedField === 'email'
                    ? '0 0 0 3px rgba(99, 102, 241, 0.25)'
                    : 'none',
                  transition: 'all 0.15s ease',
                }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: isDark ? '#cbd5e1' : '#334155' }}>
                  Password
                </label>
                {mode === 'signin' && (
                  <button
                    type="button"
                    style={{
                      background: 'none',
                      border: 'none',
                      fontSize: 11.5,
                      color: 'hsl(var(--primary))',
                      cursor: 'pointer',
                      fontWeight: 600,
                      padding: 0,
                    }}
                    onClick={() => showToast('Password reset instructions sent to your email', 'info')}
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onFocus={() => setFocusedField('password')}
                  onBlur={() => setFocusedField(null)}
                  required
                  style={{
                    width: '100%',
                    height: 42,
                    padding: '0 38px 0 14px',
                    borderRadius: 10,
                    fontSize: 13.5,
                    outline: 'none',
                    backgroundColor: isDark ? 'rgba(10, 15, 28, 0.65)' : 'rgba(248, 250, 252, 0.85)',
                    color: isDark ? '#f8fafc' : '#0f172a',
                    border: focusedField === 'password'
                      ? '1px solid hsl(var(--primary))'
                      : `1px solid ${isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.12)'}`,
                    boxShadow: focusedField === 'password'
                      ? '0 0 0 3px rgba(99, 102, 241, 0.25)'
                      : 'none',
                    transition: 'all 0.15s ease',
                  }}
                />
                <button
                  type="button"
                  style={{
                    position: 'absolute',
                    right: 12,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: isDark ? '#94a3b8' : '#64748b',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    padding: 0,
                  }}
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <motion.button
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={isLoading}
              style={{
                width: '100%',
                height: 44,
                marginTop: 6,
                borderRadius: 10,
                fontSize: 14,
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                cursor: 'pointer',
                background: 'linear-gradient(180deg, #6366f1 0%, #4f46e5 100%)',
                color: '#ffffff',
                border: '1px solid rgba(255, 255, 255, 0.25)',
                boxShadow: '0 4px 18px rgba(99, 102, 241, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.3)',
                transition: 'opacity 0.15s ease',
              }}
            >
              {isLoading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <span>{mode === 'signin' ? 'Sign In to Workspace' : 'Create Account'}</span>
                  <ArrowRight size={15} />
                </>
              )}
            </motion.button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
