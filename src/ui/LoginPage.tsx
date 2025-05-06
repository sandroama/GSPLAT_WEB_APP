import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    AuthError
} from 'firebase/auth';
import React, { useState, useEffect } from 'react';

import { auth } from '../firebase-config'; // Import Firebase auth instance

const LoginPage: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isRegistering, setIsRegistering] = useState(false); // State to toggle forms
    const [isLoading, setIsLoading] = useState(false); // Loading state for form submission

    const handleAuthAction = async (event: React.FormEvent) => {
        event.preventDefault();
        setError(''); // Clear previous errors
        setIsLoading(true); // Start loading

        try {
            if (isRegistering) {
                // Register user
                await createUserWithEmailAndPassword(auth, email, password);
                console.log('Registration successful!');
                // Optionally log the user in automatically after registration
                // Or redirect to login / show success message
                setIsRegistering(false); // Switch back to login view after registration
                setError('Registration successful! Please log in.'); // Inform user
            } else {
                // Login user
                await signInWithEmailAndPassword(auth, email, password);
                console.log('Login successful!');
                // Auth state change will be handled elsewhere (e.g., in index.tsx)
                // No need to manually set localStorage or redirect here
                // window.location.hash = '#/dashboard'; // Let auth state listener handle routing
            }
        } catch (err) {
            const authError = err as AuthError; // Type assertion for better error handling
            console.error('Authentication error:', authError);
            // Provide more specific error messages
            switch (authError.code) {
                case 'auth/invalid-email':
                    setError('Invalid email format.');
                    break;
                case 'auth/user-not-found':
                case 'auth/wrong-password':
                    setError('Invalid email or password.');
                    break;
                case 'auth/email-already-in-use':
                    setError('Email already in use. Please log in or use a different email.');
                    break;
                case 'auth/weak-password':
                    setError('Password should be at least 6 characters.');
                    break;
                default:
                    setError('An error occurred. Please try again.');
            }
        } finally {
            setIsLoading(false); // End loading state
        }
    };

    // Apply theme on initial load
    useEffect(() => {
        const theme = (localStorage.getItem('userTheme') as 'light' | 'dark') || 'light';
        document.body.classList.remove('theme-light', 'theme-dark');
        document.body.classList.add(`theme-${theme}`);
    }, []);

    return (
        <div className="login-page" style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            justifyContent: 'center',
            minHeight: '100vh',
            padding: '1rem'
        }}>
            <div className="login-container" style={{
                maxWidth: '420px',
                width: '100%',
                margin: '0 auto'
            }}>
                <div className="card" style={{
                    borderRadius: '10px',
                    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2)',
                    padding: '2rem',
                    background: 'var(--card-bg, #1e2736)'
                }}>
                    <div className="logo-container text-center">
                        <img 
                            src="static/Gsplat_main.png" 
                            alt="GSplat Logo" 
                            className="gsplat-logo" 
                            style={{ 
                                width: '180px',
                                height: 'auto',
                                marginBottom: '1.5rem'
                            }}
                        />
                    </div>
                    
                    <h2 className="text-center" style={{ 
                        fontSize: '1.75rem',
                        marginBottom: '0.75rem',
                        fontWeight: '600' 
                    }}>
                        {isRegistering ? 'Create Account' : 'Welcome Back'}
                    </h2>
                    
                    <p className="text-center text-secondary" style={{ marginBottom: '1.5rem' }}>
                        {isRegistering 
                            ? 'Register to upload and view Gaussian Splat models' 
                            : 'Sign in to your account to access your models'}
                    </p>
                    
                    <form onSubmit={handleAuthAction} className="login-form">
                        <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                            <label htmlFor="email" className="form-label" style={{ 
                                display: 'block', 
                                marginBottom: '0.5rem',
                                fontWeight: '500'
                            }}>
                                Email Address
                            </label>
                            <input
                                type="email"
                                id="email"
                                className="form-control"
                                style={{
                                    width: '100%',
                                    padding: '0.75rem',
                                    borderRadius: '6px',
                                    border: '1px solid var(--input-border, rgba(255, 255, 255, 0.1))',
                                    background: 'var(--input-bg, rgba(255, 255, 255, 0.05))',
                                    fontSize: '1rem'
                                }}
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                required
                                autoComplete="email"
                                placeholder="your.email@example.com"
                            />
                        </div>
                        
                        <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                            <label htmlFor="password" className="form-label" style={{ 
                                display: 'block', 
                                marginBottom: '0.5rem',
                                fontWeight: '500'
                            }}>
                                Password
                            </label>
                            <input
                                type="password"
                                id="password"
                                className="form-control"
                                style={{
                                    width: '100%',
                                    padding: '0.75rem',
                                    borderRadius: '6px',
                                    border: '1px solid var(--input-border, rgba(255, 255, 255, 0.1))',
                                    background: 'var(--input-bg, rgba(255, 255, 255, 0.05))',
                                    fontSize: '1rem'
                                }}
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                required
                                autoComplete={isRegistering ? "new-password" : "current-password"}
                                placeholder={isRegistering ? "Create a strong password" : "Enter your password"}
                            />
                        </div>
                        
                        {error && (
                            <div className={`login-error ${error.includes('successful') ? 'text-success' : 'text-error'}`}
                                style={{
                                    padding: '0.75rem',
                                    marginBottom: '1rem',
                                    borderRadius: '6px',
                                    background: error.includes('successful') ? 'rgba(0, 255, 0, 0.1)' : 'rgba(255, 0, 0, 0.1)',
                                    color: error.includes('successful') ? 'var(--success-color, #4caf50)' : 'var(--error-color, #f44336)',
                                    fontSize: '0.9rem'
                                }}>
                                {error}
                            </div>
                        )}
                        
                        <button 
                            type="submit" 
                            className="btn btn-primary"
                            style={{
                                width: '100%',
                                padding: '0.85rem',
                                borderRadius: '6px',
                                background: 'var(--primary-color, #0072ff)',
                                color: 'white',
                                border: 'none',
                                fontSize: '1rem',
                                fontWeight: '500',
                                cursor: 'pointer',
                                marginBottom: '1rem',
                                transition: 'background 0.2s ease'
                            }}
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <span className="spinner" style={{
                                        width: '16px', 
                                        height: '16px', 
                                        marginRight: '8px',
                                        border: '2px solid rgba(255,255,255,0.3)',
                                        borderTopColor: 'white',
                                        borderRadius: '50%',
                                        animation: 'spin 1s linear infinite'
                                    }}></span>
                                    {isRegistering ? 'Creating Account...' : 'Signing In...'}
                                </span>
                            ) : (
                                isRegistering ? 'Create Account' : 'Sign In'
                            )}
                        </button>
                        
                        <button
                            type="button"
                            onClick={() => {
                                setIsRegistering(!isRegistering);
                                setError(''); // Clear error when switching modes
                            }}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--link-color, #0072ff)',
                                width: '100%',
                                padding: '0.5rem',
                                textAlign: 'center',
                                cursor: 'pointer',
                                fontSize: '0.9rem'
                            }}
                        >
                            {isRegistering 
                                ? 'Already have an account? Sign in' 
                                : 'Need an account? Create one now'}
                        </button>
                    </form>
                </div>
            </div>
            
            <div className="login-footer text-center" style={{ marginTop: '2rem' }}>
                <p className="text-secondary" style={{ fontSize: '0.9rem', opacity: 0.7 }}>
                    GSPLAT Web App - A Gaussian Splatting Viewer
                </p>
            </div>
            
            {/* Add global styles for the spinner animation */}
            <style>{`
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
};

export default LoginPage;
