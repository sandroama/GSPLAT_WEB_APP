import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    AuthError
} from 'firebase/auth';
import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, LogIn, UserPlus, Sparkles, Cloud, Smartphone } from "lucide-react";

import { auth } from '../firebase-config';

const LoginPage: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isRegistering, setIsRegistering] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const handleAuthAction = async (event: React.FormEvent) => {
        event.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            if (isRegistering) {
                await createUserWithEmailAndPassword(auth, email, password);
                setIsRegistering(false);
                setError('Registration successful! Please log in.');
            } else {
                await signInWithEmailAndPassword(auth, email, password);
            }
        } catch (err) {
            const authError = err as AuthError;
            console.error('Authentication error:', authError);
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
            setIsLoading(false);
        }
    };

    useEffect(() => {
        const theme = (localStorage.getItem('userTheme') as 'light' | 'dark') || 'light';
        document.body.classList.remove('theme-light', 'theme-dark');
        document.body.classList.add(`theme-${theme}`);
    }, []);

    return (
        <div className="login-page">
            <div className="auth-container">
                <div className="auth-brand">
                    <div className="brand-banner">
                        <img src="static/Gsplat_main.png" alt="GSPLAT Banner" className="fade-in" />
                    </div>
                    <h1 className="brand-title slide-in">GSPLAT</h1>
                    <p className="brand-description slide-in-delayed">
                        Experience 3D Gaussian Splatting in your browser. Upload, view, and share your models with ease.
                    </p>
                    <div className="brand-features">
                        <div className="feature fade-in">
                            <div className="feature-icon">
                                <Sparkles size={24} />
                            </div>
                            <div className="feature-text">Real-time rendering</div>
                        </div>
                        <div className="feature fade-in-delayed">
                            <div className="feature-icon">
                                <Cloud size={24} />
                            </div>
                            <div className="feature-text">Cloud synchronization</div>
                        </div>
                        <div className="feature fade-in-delayed-2">
                            <div className="feature-icon">
                                <Smartphone size={24} />
                            </div>
                            <div className="feature-text">Mobile compatible</div>
                        </div>
                    </div>
                </div>

                <div className="auth-form-container">
                    <form onSubmit={handleAuthAction} className="login-form">
                        <h2 className="form-title">{isRegistering ? 'Create Account' : 'Welcome Back'}</h2>
                        <p className="form-subtitle">
                            {isRegistering
                                ? "Register to upload and view Gaussian Splat models"
                                : "Sign in to your account to access your models"}
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
                            <div className="password-input-container">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    id="password"
                                    className="form-control"
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    required
                                    autoComplete={isRegistering ? "new-password" : "current-password"}
                                    placeholder={isRegistering ? "Create a strong password" : "Enter your password"}
                                />
                                <button
                                    type="button"
                                    className="password-toggle"
                                    onClick={() => setShowPassword(!showPassword)}
                                    aria-label={showPassword ? "Hide password" : "Show password"}
                                >
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>

                        {error && (
                            <div className={`auth-message ${error.includes("successful") ? "success" : "error"}`}>
                                {error}
                            </div>
                        )}
                        
                        <button 
                            type="submit" 
                            className={`btn btn-primary ${isLoading ? 'loading' : ''}`}
                            disabled={isLoading}
                        >
                            <span className="button-content">
                                {isLoading ? (
                                    <>
                                        <span className="spinner"></span>
                                        <span>{isRegistering ? 'Creating Account...' : 'Signing In...'}</span>
                                    </>
                                ) : (
                                    <>
                                        {isRegistering ? <UserPlus size={18} /> : <LogIn size={18} />}
                                        <span>{isRegistering ? 'Create Account' : 'Sign In'}</span>
                                    </>
                                )}
                            </span>
                        </button>
                        
                        <button
                            type="button"
                            onClick={() => {
                                setIsRegistering(!isRegistering);
                                setError('');
                            }}
                            className="toggle-auth-mode"
                        >
                            {isRegistering ? 'Already have an account? Sign in' : 'Need an account? Create one now'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default LoginPage;
