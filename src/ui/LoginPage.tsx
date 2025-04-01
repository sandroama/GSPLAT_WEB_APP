import React, { useState, useEffect } from 'react';

const LoginPage: React.FC = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleLogin = (event: React.FormEvent) => {
        event.preventDefault();
        setError(''); // Clear previous errors

        // Simple hardcoded credentials
        if (username === 'admin' && password === 'password') {
            console.log('Login successful!');
            localStorage.setItem('isLoggedIn', 'true');
            // In a real app, you'd redirect here, e.g., using react-router
            // For now, just set the hash to trigger routing logic in index.tsx
            window.location.hash = '#/dashboard';
        } else {
            setError('Invalid username or password');
        }
    };

    // Apply theme on initial load (in case user navigates directly to login)
    useEffect(() => {
        const theme = (localStorage.getItem('userTheme') as 'light' | 'dark') || 'light';
        document.body.classList.remove('theme-light', 'theme-dark');
        document.body.classList.add(`theme-${theme}`);
    }, []);

    return (
        <div className="login-page">
            <form onSubmit={handleLogin} className="login-form">
                 <h2>Login</h2>
                <div>
                    <label htmlFor="username">Username:</label>
                    <input
                        type="text"
                        id="username"
                        value={username}
                        onChange={e => setUsername(e.target.value)}
                        required
                        autoComplete="username" // Added for better UX
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
                        autoComplete="current-password" // Added for better UX
                    />
                </div>
                {error && <p className="login-error">{error}</p>}
                <button type="submit">Login</button>
            </form>
        </div>
    );
};

export default LoginPage;
