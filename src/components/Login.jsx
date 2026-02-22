import { useState } from 'react';
import { Ghost, Mail, Lock, Eye, EyeOff, ArrowRight, Loader } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import './Login.css';

const Login = () => {
  const { signInWithGoogle, signInWithEmail, signUpWithEmail } = useAuth();
  const [mode, setMode] = useState('main'); // 'main' | 'email-signin' | 'email-signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  const handleGoogleLogin = async () => {
    setError(null);
    setLoading(true);
    await signInWithGoogle(); // Redirects — loading state clears on return
  };

  const handleEmailAuth = async (e) => {
    e.preventDefault();
    if (!email || !password) return;
    setError(null);
    setLoading(true);
    try {
      if (mode === 'email-signup') {
        await signUpWithEmail(email, password);
        setSuccessMsg('Account created! Check your email to confirm, then sign in.');
        setMode('email-signin');
      } else {
        await signInWithEmail(email, password);
        // AuthContext onAuthStateChange will set user → App.jsx handles routing
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-content">
        <div className="login-logo-container">
          <Ghost className="login-logo" size={80} />
        </div>
        <h1 className="login-title">MYSTERY DUEL</h1>
        <p className="login-subtitle">Face off against opponents in real-time deduction games.</p>

        {error && (
          <div className="auth-error">{error}</div>
        )}
        {successMsg && (
          <div className="auth-success">{successMsg}</div>
        )}

        {mode === 'main' && (
          <>
            <button className="google-login-btn" onClick={handleGoogleLogin} disabled={loading}>
              {loading ? (
                <Loader size={20} className="spin" />
              ) : (
                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google Logo" className="google-icon" />
              )}
              Continue with Google
            </button>

            <div className="auth-divider">
              <span>or</span>
            </div>

            <button className="email-login-btn" onClick={() => setMode('email-signin')}>
              <Mail size={18} />
              Continue with Email
            </button>
          </>
        )}

        {(mode === 'email-signin' || mode === 'email-signup') && (
          <form className="email-form" onSubmit={handleEmailAuth}>
            <div className="input-group">
              <Mail size={16} className="input-icon" />
              <input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="auth-input"
                required
                autoFocus
              />
            </div>

            <div className="input-group">
              <Lock size={16} className="input-icon" />
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="auth-input"
                required
                minLength={6}
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(v => !v)}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            <button className="submit-btn" type="submit" disabled={loading}>
              {loading ? <Loader size={18} className="spin" /> : <ArrowRight size={18} />}
              {mode === 'email-signup' ? 'Create Account' : 'Sign In'}
            </button>

            <div className="auth-switch">
              {mode === 'email-signin' ? (
                <>Don't have an account? <button type="button" onClick={() => { setMode('email-signup'); setError(null); }}>Sign up</button></>
              ) : (
                <>Already have an account? <button type="button" onClick={() => { setMode('email-signin'); setError(null); }}>Sign in</button></>
              )}
            </div>

            <button type="button" className="back-btn" onClick={() => { setMode('main'); setError(null); }}>
              ← Back
            </button>
          </form>
        )}

        <p className="login-terms">By logging in, you agree to our terms of service and privacy policy.</p>
      </div>
    </div>
  );
};

export default Login;
