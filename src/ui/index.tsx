import { Observer } from '@playcanvas/observer';
import { Container, Spinner } from '@playcanvas/pcui/react';
import { onAuthStateChanged, User } from 'firebase/auth'; // Firebase Auth listener
import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';

import { auth } from '../firebase-config'; // Firebase auth instance
import { ObserverData } from '../types';
import DashboardPage from './DashboardPage'; // Import the new Dashboard page
import ErrorBox from './errors';
import LeftPanel from './left-panel';
import LoadControls from './load-controls';
import LoginPage from './LoginPage'; // Import the new Login page
import PopupPanel from './popup-panel';
import SelectedNode from './selected-node';
import { version as appVersion } from '../../package.json';

interface AppProps {
    observer: Observer;
    onReady?: () => void; // Add optional callback prop
}

class App extends React.Component<AppProps> {
    state: ObserverData = null;

    canvasRef: React.RefObject<HTMLCanvasElement>; // Use specific RefObject type

    constructor(props: AppProps) { // Use AppProps type
        super(props);

        this.canvasRef = React.createRef<HTMLCanvasElement>(); // Specify element type for ref
        this.state = this._retrieveState();

        props.observer.on('*:set', () => {
            // update the state
            this.setState(this._retrieveState());
        });
    }

    _retrieveState = () => {
        const state: any = {};
        (this.props.observer as any)._keys.forEach((key: string) => {
            state[key] = this.props.observer.get(key);
        });
        return state;
    };

    _setStateProperty = (path: string, value: string) => {
        this.props.observer.set(path, value);
    };

    componentDidMount() {
        // Call the onReady callback if provided, after the component mounts
        if (this.props.onReady) {
            this.props.onReady();
        }
    }

    render() {
        // This component now represents the "Viewer" part of the application
        return <div id="application-container">
            <Container id="panel-left" flex resizable='right' resizeMin={220} resizeMax={800}>
                {/* Header can remain or be adjusted as needed */}
                <div className="header" style={{ display: 'none' }}>
                    <div id="title">
                        <img src={'static/Gsplat_main.png'}/>
                        <div>{`MODEL VIEWER v${appVersion}`}</div>
                    </div>
                </div>
                <div id="panel-toggle">
                    <img src={'static/Gsplat_main.png'}/>
                </div>
                <LeftPanel observerData={this.state} setProperty={this._setStateProperty} />
            </Container>
            <div id='canvas-wrapper'>
                <canvas id="application-canvas" ref={this.canvasRef} />
                <LoadControls setProperty={this._setStateProperty}/>
                <SelectedNode sceneData={this.state.scene} />
                <PopupPanel observerData={this.state} setProperty={this._setStateProperty} />
                <ErrorBox observerData={this.state} />
                <Spinner id="spinner" size={30} hidden={true} />
            </div>
        </div>;
    }
} // <-- Correct placement of closing brace for the App class

// Define the callback type
type ViewerReadyCallback = () => void;

// Main function to initialize the UI with routing
export default (observer: Observer, onViewerReady: ViewerReadyCallback) => { // Accept the callback
    const Root: React.FC = () => {
        const [route, setRoute] = useState(window.location.hash);
        const [currentUser, setCurrentUser] = useState<User | null>(null); // State for Firebase user
        const [authLoading, setAuthLoading] = useState(true); // State to track initial auth check

        // Listener for Firebase Auth state changes
        useEffect(() => {
            const unsubscribe = onAuthStateChanged(auth, (user) => {
                console.log('Auth State Changed:', user ? `Logged in as ${user.email}` : 'Logged out');
                setCurrentUser(user);
                setAuthLoading(false); // Auth check complete

                // Redirect based on auth state after initial check
                if (!user && window.location.hash !== '#/login') {
                    console.log('User logged out or not logged in, redirecting to #/login');
                    window.location.hash = '#/login';
                } else if (user && window.location.hash === '#/login') {
                    console.log('User logged in, redirecting from #/login to #/dashboard');
                    window.location.hash = '#/dashboard'; // Redirect logged-in users away from login page
                }
            });

            // Cleanup subscription on unmount
            return () => unsubscribe();
        }, []); // Run only once on mount

        // Listener for hash changes (controls view *after* login)
        useEffect(() => {
            const handleHashChange = () => {
                console.log('Hash changed to:', window.location.hash);
                setRoute(window.location.hash);
            };

            window.addEventListener('hashchange', handleHashChange);
            // Initial check for hash
            handleHashChange();

            return () => {
                window.removeEventListener('hashchange', handleHashChange);
            };
        }, []); // Run only once on mount

        // Show loading indicator while checking auth state
        if (authLoading) {
            // You might want a more sophisticated loading UI here
            return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>Loading Authentication...</div>;
        }

        // Routing Logic based on Firebase Auth state
        if (!currentUser) {
            // If not logged in (and auth check is complete), always show Login page
            // The onAuthStateChanged listener handles redirecting to #/login
            return <LoginPage />;
        }

        // User is logged in
        if (route === '#/dashboard' || route === '' || route === '#/login') { // Default to dashboard if logged in
            // Redirect from #/login explicitly if somehow landed there while logged in
            if (window.location.hash !== '#/dashboard') {
                window.location.hash = '#/dashboard'; // Ensure hash matches state
            }
            return <DashboardPage />;
        }
        if (route === '#/viewer') {
            // Render the original App component which contains the viewer
            // Pass the onViewerReady callback to the App component
            return <App observer={observer} onReady={onViewerReady} />;
        }

        // Fallback for unknown hash when logged in, redirect to dashboard
        console.warn(`Unknown route "${route}" while logged in, redirecting to #/dashboard`);
        window.location.hash = '#/dashboard';
        return <DashboardPage />; // Render dashboard while hash updates
    };

    // Render the Root component which handles routing
    ReactDOM.render(
        <Root />,
        document.getElementById('app')
    );
};
