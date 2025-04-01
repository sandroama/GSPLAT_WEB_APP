import { Observer } from '@playcanvas/observer';
import { Container, Spinner } from '@playcanvas/pcui/react';
import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';

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
        const [isLoggedIn, setIsLoggedIn] = useState(localStorage.getItem('isLoggedIn') === 'true');

        useEffect(() => {
            const handleHashChange = () => {
                setRoute(window.location.hash);
                // Re-check login status on navigation potentially triggered by components
                setIsLoggedIn(localStorage.getItem('isLoggedIn') === 'true');
            };

            window.addEventListener('hashchange', handleHashChange);
            // Also handle manual reloads which trigger component logic
            window.addEventListener('load', handleHashChange);


            // Initial check
            handleHashChange();

            return () => {
                window.removeEventListener('hashchange', handleHashChange);
                window.removeEventListener('load', handleHashChange);
            };
        }, []);

        // Routing Logic
        if (!isLoggedIn) {
            // If not logged in, always show Login page, regardless of hash
            // Set hash to #/login for consistency if it's not already set
            if (window.location.hash !== '#/login') {
                window.location.hash = '#/login';
            }
            return <LoginPage />;
        }
        // Logged in
        if (route === '#/dashboard' || route === '') { // Default to dashboard if logged in and no specific route
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
        window.location.hash = '#/dashboard';
        return <DashboardPage />; // Render dashboard while hash updates
    };

    // Render the Root component which handles routing
    ReactDOM.render(
        <Root />,
        document.getElementById('app')
    );
};
