
import React, { useState } from 'react';
import { auth, googleProvider } from '../firebaseConfig';
import { AnimatedLogoIcon } from './launch/LaunchIcons';

interface LoginPageProps {
  authError?: string;
}

const EnvelopeIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
    </svg>
);


const LockIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 0 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
    </svg>
);

const GoogleIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg viewBox="0 0 24 24" className={className} xmlns="http://www.w3.org/2000/svg">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
);

const LoginPage: React.FC<LoginPageProps> = ({ authError }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  React.useEffect(() => {
    if (authError) {
      // Check for environment restriction errors in the prop
      if (authError.includes('auth/operation-not-supported-in-this-environment') || 
          authError.includes('operation is not supported') || 
          authError.includes('location.protocol')) {
          setError("Preview environment detected. Authentication is unavailable.");
      } else {
          setError(authError);
      }
    }
  }, [authError]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    if (!auth) {
        setError("Firebase is not configured correctly. Authentication is disabled.");
        setIsLoading(false);
        return;
    }
    
    // Use compat auth instance method
    auth.signInWithEmailAndPassword(email, password)
      .then((userCredential) => {
        // Login successful. The onAuthStateChanged listener in App.tsx
        // will handle the navigation and authorization check.
      })
      .catch((err) => {
        handleAuthError(err);
      })
      .finally(() => {
        setIsLoading(false);
      });
  };

  const handleGoogleLogin = async () => {
      setError('');
      setIsGoogleLoading(true);

      if (!auth || !googleProvider) {
          setError("Google Authentication is not configured.");
          setIsGoogleLoading(false);
          return;
      }

      try {
          // Use compat auth instance method
          await auth.signInWithPopup(googleProvider);
          // Success is handled by App.tsx listener
      } catch (err: any) {
          handleAuthError(err);
          setIsGoogleLoading(false);
      }
  };

  const handleAuthError = (err: any) => {
      console.error("Auth error:", err);
      
      // Explicit check for the environment error or its message content
      if (err.code === 'auth/operation-not-supported-in-this-environment' || 
          (err.message && (err.message.includes('operation is not supported') || err.message.includes('location.protocol')))) {
          setError("Preview environment detected. Authentication is restricted.");
          return;
      }

      switch (err.code) {
          case 'auth/user-not-found':
          case 'auth/wrong-password':
          case 'auth/invalid-credential':
              setError("Invalid email or password.");
              break;
          case 'auth/invalid-email':
              setError("Please enter a valid email address.");
              break;
          case 'auth/popup-closed-by-user':
              setError("Sign-in cancelled.");
              break;
          case 'auth/popup-blocked':
              setError("Sign-in popup blocked. Please allow popups for this site.");
              break;
          case 'auth/unauthorized-domain':
              setError("This domain is not authorized in Firebase Console.");
              break;
          case 'auth/operation-not-allowed':
              setError("Login provider is disabled in Firebase Console. Please enable it in the console.");
              break;
          default:
              if (err.message && err.message.includes('unauthorized-domain')) {
                  setError("Domain not authorized.");
              } else {
                  setError(`Authentication failed (${err.code}).`);
              }
      }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <div className="w-full max-w-2xl text-center animate-fade-in" style={{animationDelay: '0.1s'}}>
            <AnimatedLogoIcon className="w-24 h-24 mx-auto mb-4" />
            <h1 className="text-4xl md:text-5xl font-bold text-gray-800">Aideaon</h1>
            <p className="text-lg text-gray-500 mt-2">出海DTC Agentic AI</p>
        </div>

        <div className="w-full max-w-md bg-white/80 backdrop-blur-sm rounded-2xl shadow-2xl shadow-purple-500/10 p-8 md:p-12 mt-10 border border-gray-200/30 animate-fade-in" style={{animationDelay: '0.2s'}}>
            <h2 className="text-2xl font-bold text-center text-gray-800 mb-2">Welcome Back</h2>
            <p className="text-center text-gray-500 mb-8">Sign in to continue your journey</p>
            
            <div className="space-y-6">
                {/* Google Login Button */}
                <button
                    onClick={handleGoogleLogin}
                    disabled={isLoading || isGoogleLoading}
                    className="w-full bg-white text-gray-700 border border-gray-300 rounded-full py-3 text-lg font-medium hover:bg-gray-50 transition-all shadow-sm flex items-center justify-center space-x-3 disabled:opacity-50 disabled:cursor-not-allowed group"
                >
                     {isGoogleLoading ? (
                        <svg className="animate-spin h-5 w-5 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                     ) : (
                         <>
                            <GoogleIcon className="w-6 h-6" />
                            <span>Sign in with Google</span>
                         </>
                     )}
                </button>

                <div className="flex items-center">
                    <div className="flex-grow border-t border-gray-300"></div>
                    <span className="flex-shrink-0 mx-4 text-gray-400 text-sm">Or continue with email</span>
                    <div className="flex-grow border-t border-gray-300"></div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="relative">
                        <EnvelopeIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="Email"
                            required
                            className="w-full py-3 pl-12 pr-4 text-md bg-white border border-gray-200 rounded-full transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-purple-400/50 focus:border-purple-400 disabled:bg-gray-100"
                            aria-label="Email"
                        />
                    </div>
                    <div className="relative">
                        <LockIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Password"
                            required
                            className="w-full py-3 pl-12 pr-4 text-md bg-white border border-gray-200 rounded-full transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-purple-400/50 focus:border-purple-400 disabled:bg-gray-100"
                            aria-label="Password"
                        />
                    </div>
                    
                    {error && <p className="text-sm text-red-500 text-center animate-fade-in px-2 font-medium">{error}</p>}
                    
                    <button 
                    type="submit" 
                    disabled={isLoading || isGoogleLoading}
                    className="w-full bg-gray-800 text-white rounded-full py-3 text-lg font-semibold hover:bg-gray-900 transition-colors shadow-lg shadow-gray-800/20 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center"
                    >
                    {isLoading ? (
                        <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                    ) : 'Login'}
                    </button>
                </form>
            </div>
        </div>
    </div>
  );
};

export default LoginPage;
