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

    const handleAuthAction = async (event: React.FormEvent) => {
        event.preventDefault();
        setError(''); // Clear previous errors

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
            <form onSubmit={handleAuthAction} className="login-form">
                <h2>{isRegistering ? 'Register' : 'Login'}</h2>
                <div>
                    <label htmlFor="email">Email:</label>
                    <input
                        type="email" // Changed type to email
                        id="email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        required
                        autoComplete="email" // Updated autocomplete
                    />
                </div>
                <div>
                    <label htmlFor="password">Password:</label>
                    <input
                        type="password"
                        id="password"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        required
                        autoComplete={isRegistering ? "new-password" : "current-password"} // Dynamic autocomplete
                    />
                </div>
                {error && <p className="login-error">{error}</p>}
                <button type="submit">{isRegistering ? 'Register' : 'Login'}</button>
                <button
                    type="button" // Important: prevent form submission
                    onClick={() => {
                        setIsRegistering(!isRegistering);
                        setError(''); // Clear error when switching modes
                    }}
                    className='toggle-auth-mode' // Add class for styling if needed
                >
                    {isRegistering ? 'Already have an account? Login' : 'Need an account? Register'}
                </button>
            </form>
        </div>
    );
};

export default LoginPage;
