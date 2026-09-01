import React, { useState } from 'react';
import { Mail, Lock, User, ArrowRight, Eye, EyeOff, X } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuthStore } from '../store/useAuthStore';
import { useToastStore } from '../store/useToastStore';
import logoImg from '../assets/logo.png';

export default function LoginPage() {
  const signInWithEmail = useAuthStore(s => s.signInWithEmail);
  const signUpWithEmail = useAuthStore(s => s.signUpWithEmail);
  const signInWithGoogle = useAuthStore(s => s.signInWithGoogle);
  const signUpWithGoogle = useAuthStore(s => s.signUpWithGoogle);
  const showToast = useToastStore(s => s.showToast);

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Google Modal State
  const [showGoogleModal, setShowGoogleModal] = useState(false);
  const [googleName, setGoogleName] = useState('Alex Rivera');
  const [googleEmail, setGoogleEmail] = useState('alex.rivera@gmail.com');

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      showToast('Please enter your email and password', 'warning');
      return;
    }

    if (mode === 'signup' && !name.trim()) {
      showToast('Please enter your full name to sign up', 'warning');
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
        showToast('Welcome back!', 'success');
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

  const handleGoogleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      if (mode === 'signup') {
        const res = await signUpWithGoogle(googleName.trim() || 'Google User', googleEmail.trim());
        if (!res.success) {
          showToast(res.error || 'Google Sign Up failed', 'error');
          setIsLoading(false);
          return;
        }
        showToast('Google authentication initialized', 'success');
        setShowGoogleModal(false);
      } else {
        const res = await signInWithGoogle(googleEmail.trim());
        if (!res.success) {
          showToast(res.error || 'Google Sign In failed', 'error');
          setIsLoading(false);
          return;
        }
        showToast('Signed in successfully', 'success');
        setShowGoogleModal(false);
      }
    } catch (err: any) {
      showToast(err.message || 'Google Auth error', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        width: '100vw',
        backgroundColor: 'hsl(var(--background))',
        padding: 20
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="modal"
        style={{ maxWidth: 420, boxShadow: 'var(--neu-shadow-floating)' }}
      >
        {/* Header */}
        <div style={{ padding: '28px 28px 16px 28px', textAlign: 'center' }}>
          <img
            src={logoImg}
            alt="Worklane"
            style={{
              width: 52,
              height: 52,
              borderRadius: 14,
              boxShadow: 'var(--neu-shadow-raised-sm)',
              display: 'inline-block',
              marginBottom: 12,
              objectFit: 'contain'
            }}
          />
          <h2 style={{ fontSize: 18, fontWeight: 700, color: 'hsl(var(--foreground))', letterSpacing: '-0.2px' }}>
            {mode === 'signin' ? 'Welcome to Worklane' : 'Create an account'}
          </h2>
          <p style={{ fontSize: 12.5, color: 'hsl(var(--muted-foreground))', marginTop: 4 }}>
            {mode === 'signin'
              ? 'Enter your credentials to access your workspace'
              : 'Sign up to start organizing projects with your team'}
          </p>
        </div>

        <div style={{ padding: '0 28px 28px 28px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Google Button */}
          <motion.button
            whileTap={{ scale: 0.97 }}
            type="button"
            className="btn btn-secondary"
            style={{ width: '100%', padding: '10px 14px', fontSize: 13 }}
            onClick={() => setShowGoogleModal(true)}
            disabled={isLoading}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ marginRight: 6 }}>
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
            </svg>
            <span>{mode === 'signup' ? 'Sign up with Google' : 'Sign in with Google'}</span>
          </motion.button>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '2px 0' }}>
            <div style={{ flex: 1, height: 1, backgroundColor: 'hsl(var(--border) / 0.5)' }} />
            <span style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))' }}>or continue with</span>
            <div style={{ flex: 1, height: 1, backgroundColor: 'hsl(var(--border) / 0.5)' }} />
          </div>

          {/* Form */}
          <form onSubmit={handleEmailSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {mode === 'signup' && (
              <div className="form-group">
                <label className="field-label">Full Name</label>
                <input
                  type="text"
                  className="text-input"
                  placeholder="e.g. Alex Rivera"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required={mode === 'signup'}
                />
              </div>
            )}

            <div className="form-group">
              <label className="field-label">Email</label>
              <input
                type="email"
                className="text-input"
                placeholder="alex@company.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label className="field-label">Password</label>
                {mode === 'signin' && (
                  <button
                    type="button"
                    style={{ background: 'none', border: 'none', fontSize: 11, color: 'hsl(var(--primary))', cursor: 'pointer' }}
                    onClick={() => showToast('Password reset link sent to your email', 'info')}
                  >
                    Forgot?
                  </button>
                )}
              </div>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="text-input"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  style={{
                    position: 'absolute',
                    right: 8,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: 'hsl(var(--muted-foreground))',
                    cursor: 'pointer',
                    display: 'flex'
                  }}
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            <motion.button
              whileTap={{ scale: 0.97 }}
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', padding: '10px 14px', marginTop: 6 }}
              disabled={isLoading}
            >
              {isLoading ? (
                <span>Loading...</span>
              ) : (
                <>
                  <span>{mode === 'signin' ? 'Sign In' : 'Create Account'}</span>
                  <ArrowRight size={14} />
                </>
              )}
            </motion.button>
          </form>

          {/* Mode Switch Footer */}
          <div style={{ textAlign: 'center', fontSize: 12, color: 'hsl(var(--muted-foreground))', paddingTop: 6 }}>
            {mode === 'signin' ? (
              <span>
                Don't have an account?{' '}
                <button
                  type="button"
                  style={{ background: 'none', border: 'none', color: 'hsl(var(--primary))', fontWeight: 600, cursor: 'pointer' }}
                  onClick={() => setMode('signup')}
                >
                  Sign up
                </button>
              </span>
            ) : (
              <span>
                Already have an account?{' '}
                <button
                  type="button"
                  style={{ background: 'none', border: 'none', color: 'hsl(var(--primary))', fontWeight: 600, cursor: 'pointer' }}
                  onClick={() => setMode('signin')}
                >
                  Sign in
                </button>
              </span>
            )}
          </div>
        </div>
      </motion.div>

      {/* Google Auth Modal */}
      {showGoogleModal && (
        <div className="modal-overlay" onClick={() => setShowGoogleModal(false)}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="modal small-modal"
            onClick={e => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2 className="modal-title">Google Authentication</h2>
              <motion.button whileTap={{ scale: 0.92 }} className="icon-btn" onClick={() => setShowGoogleModal(false)}><X size={15} /></motion.button>
            </div>
            <form onSubmit={handleGoogleSubmit} className="modal-body">
              {mode === 'signup' && (
                <div className="form-group">
                  <label className="field-label">Google Account Name</label>
                  <input
                    type="text"
                    className="text-input"
                    value={googleName}
                    onChange={e => setGoogleName(e.target.value)}
                    required
                  />
                </div>
              )}
              <div className="form-group">
                <label className="field-label">Google Email Address</label>
                <input
                  type="email"
                  className="text-input"
                  value={googleEmail}
                  onChange={e => setGoogleEmail(e.target.value)}
                  required
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                <motion.button type="button" whileTap={{ scale: 0.95 }} className="btn btn-secondary" onClick={() => setShowGoogleModal(false)}>
                  Cancel
                </motion.button>
                <motion.button type="submit" whileTap={{ scale: 0.95 }} className="btn btn-primary" disabled={isLoading}>
                  {mode === 'signup' ? 'Sign Up with Google' : 'Sign In with Google'}
                </motion.button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
