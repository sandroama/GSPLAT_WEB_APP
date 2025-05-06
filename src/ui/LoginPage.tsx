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
        <div className="login-page">
            <div className="card">
                <form onSubmit={handleAuthAction} className="login-form">
                    <h2 className="text-center">{isRegistering ? 'Create Account' : 'Welcome Back'}</h2>
                    <p className="text-center mb-4 text-secondary">
                        {isRegistering 
                            ? 'Register to upload and view Gaussian Splat models' 
                            : 'Sign in to your account to access your models'}
                    </p>
                    
                    <div className="form-group">
                        <label htmlFor="email" className="form-label">Email Address</label>
                        <input
                            type="email"
                            id="email"
                            className="form-control"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            required
                            autoComplete="email"
                            placeholder="your.email@example.com"
                        />
                    </div>
                    
                    <div className="form-group">
                        <label htmlFor="password" className="form-label">Password</label>
                        <input
                            type="password"
                            id="password"
                            className="form-control"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            required
                            autoComplete={isRegistering ? "new-password" : "current-password"}
                            placeholder={isRegistering ? "Create a strong password" : "Enter your password"}
                        />
                    </div>
                    
                    {error && (
                        <div className={`login-error ${error.includes('successful') ? 'text-success' : 'text-error'}`}>
                            {error}
                        </div>
                    )}
                    
                    <button 
                        type="submit" 
                        className="btn btn-primary mt-3"
                        disabled={isLoading}
                    >
                        {isLoading ? (
                            <span>
                                <span className="spinner" style={{width: '16px', height: '16px', marginRight: '8px'}}></span>
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
                        className='toggle-auth-mode'
                    >
                        {isRegistering 
                            ? 'Already have an account? Sign in' 
                            : 'Need an account? Create one now'}
                    </button>
                </form>
            </div>
            
            <div className="login-footer text-center mt-5">
                <p className="text-secondary">
                    GSPLAT Web App - A Gaussian Splatting Viewer
                </p>
            </div>
        </div>
    );
};

export default LoginPage;
