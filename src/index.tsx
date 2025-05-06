import { Observer } from '@playcanvas/observer';
import { version as pcuiVersion, revision as pcuiRevision } from '@playcanvas/pcui/react';
import {
    basisInitialize,
    createGraphicsDevice,
    Vec3,
    WasmModule,
    version as engineVersion,
    revision as engineRevision
} from 'playcanvas';
import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';

import { initMaterials } from './material';
import { ObserverData } from './types';
import { auth } from './firebase-config';
import LoginPage from './ui/LoginPage';
import DashboardPage from './ui/DashboardPage';
import Viewer from './viewer';
import './style.scss';
import { version as modelViewerVersion } from '../package.json';
import { DummyWebGPU } from './dummy-webgpu';

// Permit some additional properties to be set on the window
declare global {
    interface LaunchParams {
        readonly files: FileSystemFileHandle[];
    }
    interface Window {
        launchQueue: {
            setConsumer: (callback: (launchParams: LaunchParams) => void) => void;
        };
        pc: any;
        viewer: Viewer;
        webkit?: any;
    }
}

const skyboxes = [
    { label: 'Abandoned Tank Farm', url: './skybox/abandoned_tank_farm_01_2k.hdr' },
    { label: 'Adam\'s Place Bridge', url: './skybox/adams_place_bridge_2k.hdr' },
    { label: 'Artist Workshop', url: './skybox/artist_workshop_2k.hdr' },
    { label: 'Ballroom', url: './skybox/ballroom_2k.hdr' },
    { label: 'Circus Arena', url: './skybox/circus_arena_2k.hdr' },
    { label: 'Colorful Studio', url: './skybox/colorful_studio.hdr' },
    { label: 'Golf Course Sunrise', url: './skybox/golf_course_sunrise_2k.hdr' },
    { label: 'Helipad', url: './skybox/Helipad_equi.png' },
    { label: 'Kloppenheim', url: './skybox/kloppenheim_02_2k.hdr' },
    { label: 'Lebombo', url: './skybox/lebombo_2k.hdr' },
    { label: 'Outdoor Umbrellas', url: './skybox/outdoor_umbrellas_2k.hdr' },
    { label: 'Paul Lobe Haus', url: './skybox/paul_lobe_haus_2k.hdr' },
    { label: 'Reinforced Concrete', url: './skybox/reinforced_concrete_01_2k.hdr' },
    { label: 'Rural Asphalt Road', url: './skybox/rural_asphalt_road_2k.hdr' },
    { label: 'Spruit Sunrise', url: './skybox/spruit_sunrise_2k.hdr' },
    { label: 'Studio Small', url: './skybox/studio_small_03_2k.hdr' },
    { label: 'Venice Sunset', url: './skybox/venice_sunset_1k.hdr' },
    { label: 'Vignaioli Night', url: './skybox/vignaioli_night_2k.hdr' },
    { label: 'Wooden Motel', url: './skybox/wooden_motel_2k.hdr' }
];

const observerData: ObserverData = {
    ui: {
        fullscreen: false,
        active: null,
        spinner: false,
        error: null
    },
    camera: {
        fov: 40,
        tonemapping: 'Linear',
        pixelScale: 1,
        multisampleSupported: true,
        multisample: true,
        hq: true
    },
    skybox: {
        value: 'Paul Lobe Haus',
        options: JSON.stringify(['None'].concat(skyboxes.map(s => s.label)).map(l => ({ v: l, t: l }))),
        exposure: 0,
        rotation: 0,
        background: 'Infinite Sphere',
        backgroundColor: { r: 0.4, g: 0.45, b: 0.5 },
        blur: 1,
        domeProjection: {
            domeRadius: 20,
            tripodOffset: 0.1
        }
    },
    light: {
        enabled: false,
        color: { r: 1, g: 1, b: 1 },
        intensity: 1,
        follow: false,
        shadow: false
    },
    shadowCatcher: {
        enabled: false,
        intensity: 0.4
    },
    debug: {
        renderMode: 'default',
        stats: false,
        wireframe: false,
        wireframeColor: { r: 0, g: 0, b: 0 },
        bounds: false,
        skeleton: false,
        axes: false,
        grid: true,
        normals: 0
    },
    animation: {
        playing: false,
        speed: 1.0,
        transition: 0.1,
        loops: 1,
        list: '[]',
        progress: 0,
        selectedTrack: 'ALL_TRACKS'
    },
    scene: {
        urls: [],
        filenames: [],
        nodes: '[]',
        selectedNode: {
            path: '',
            name: null,
            position: {
                0: 0,
                1: 0,
                2: 0
            },
            rotation: {
                0: 0,
                1: 0,
                2: 0,
                3: 0
            },
            scale: {
                0: 0,
                1: 0,
                2: 0
            }
        },
        meshCount: null,
        materialCount: null,
        textureCount: null,
        vertexCount: null,
        primitiveCount: null,
        textureVRAM: null,
        meshVRAM: null,
        bounds: null,
        variant: {
            selected: 0
        },
        variants: {
            list: '[]'
        },
        loadTime: null
    },
    runtime: {
        activeDeviceType: '',
        viewportWidth: 0,
        viewportHeight: 0,
        xrSupported: false,
        xrActive: false
    },
    morphs: null,
    enableWebGPU: false,
    centerScene: false
};

const saveOptions = (observer: Observer, name: string) => {
    const options = observer.json() as any;
    window.localStorage.setItem(`model-viewer-${name}`, JSON.stringify({
        camera: options.camera,
        skybox: options.skybox,
        light: options.light,
        debug: options.debug,
        shadowCatcher: options.shadowCatcher,
        enableWebGPU: options.enableWebGPU
    }));
};

const loadOptions = (observer: Observer, name: string, skyboxUrls: Map<string, string>) => {
    const filter = ['skybox.options', 'debug.renderMode'];

    const loadRec = (path: string, value:any) => {
        if (filter.indexOf(path) !== -1) {
            return;
        }

        if (typeof value === 'object') {
            Object.keys(value).forEach((k) => {
                loadRec(path ? `${path}.${k}` : k, value[k]);
            });
        } else {
            if (path !== 'skybox.value' || value === 'None' || skyboxUrls.has(value)) {
                observer.set(path, value);
            }
        }
    };

    const options = window.localStorage.getItem(`model-viewer-${name}`);
    if (options) {
        try {
            loadRec('', JSON.parse(options));
        } catch { }
    }
};

// Create and initialize the observer
const observer = new Observer(observerData);

// Initialize the viewer component
const ViewerComponent: React.FC = () => {
    const [isInitialized, setIsInitialized] = useState(false);
    const [error, setError] = useState<string | null>(null);
    
    useEffect(() => {
        const url = new URL(window.location.href);
        const skyboxUrls = new Map(skyboxes.map(s => [s.label, `static/${s.url}`]));
        
        // Load options
        if (!url.searchParams.has('default')) {
            loadOptions(observer, 'uistate', skyboxUrls);
            
            observer.on('*:set', () => {
                saveOptions(observer, 'uistate');
            });
        }
        
        // Setup spinner
        observer.on('ui.spinner:set', (value: boolean) => {
            const spinner = document.getElementById('spinner');
            if (spinner) {
                if (value) {
                    spinner.classList.remove('pcui-hidden');
                } else {
                    spinner.classList.add('pcui-hidden');
                }
            }
        });
        
        // When component mounts, create canvas and initialize viewer
        const canvasContainer = document.getElementById('viewer-container');
        if (canvasContainer) {
            // Create canvas wrapper first - ensure it exists and has proper size
            let canvasWrapper = document.getElementById('canvas-wrapper') as HTMLDivElement;
            if (!canvasWrapper) {
                canvasWrapper = document.createElement('div');
                canvasWrapper.id = 'canvas-wrapper';
                canvasWrapper.style.width = '100%';
                canvasWrapper.style.height = '100%';
                canvasWrapper.style.position = 'relative';
                canvasContainer.appendChild(canvasWrapper);
            }

            // Force the container to have dimensions
            canvasContainer.style.width = '100%';
            canvasContainer.style.height = '100vh';
            canvasContainer.style.display = 'block';

            let canvas = document.getElementById('application-canvas') as HTMLCanvasElement;
            if (!canvas) {
                canvas = document.createElement('canvas');
                canvas.id = 'application-canvas';
                canvas.style.width = '100%';
                canvas.style.height = '100%';
                canvas.style.display = 'block';
                canvasWrapper.appendChild(canvas);
            }
            
            // Wait for canvas to be properly sized
            const waitForCanvasSize = () => {
                const rect = canvas.getBoundingClientRect();
                
                if (rect.width > 0 && rect.height > 0) {
                    // Initialize materials and Basis
                    try {
                        initMaterials();
                        
                        basisInitialize({
                            glueUrl: 'static/lib/basis/basis.wasm.js',
                            wasmUrl: 'static/lib/basis/basis.wasm.wasm',
                            fallbackUrl: 'static/lib/basis/basis.js',
                            lazyInit: true
                        });
                        
                        WasmModule.setConfig('DracoDecoderModule', {
                            glueUrl: 'static/lib/draco/draco.wasm.js',
                            wasmUrl: 'static/lib/draco/draco.wasm.wasm',
                            fallbackUrl: 'static/lib/draco/draco.js'
                        });
                        
                        // Create graphics device
                        const absoluteUrl = (relative: string) => new URL(relative, document.baseURI).toString();
                        
                        createGraphicsDevice(canvas, {
                            deviceTypes: url.searchParams.has('webgpu') || observer.get('enableWebGPU') ? ['webgpu'] : [],
                            glslangUrl: absoluteUrl('static/lib/glslang/glslang.js'),
                            twgslUrl: absoluteUrl('static/lib/twgsl/twgsl.js'),
                            antialias: false,
                            depth: false,
                            stencil: false,
                            xrCompatible: true,
                            powerPreference: 'high-performance'
                        }).then(async (device) => {
                            try {
                                observer.set('runtime.activeDeviceType', device.deviceType);
                                console.log("Graphics device created successfully:", device.deviceType);
                                
                                // Create viewer instance
                                const viewer = new Viewer(canvas, device, observer, skyboxUrls);
                                
                                // Make viewer available globally
                                window.viewer = viewer;
                                
                                // Create required elements if they don't exist
                                if (!document.querySelector('#panel-left')) {
                                    const panelLeft = document.createElement('div');
                                    panelLeft.id = 'panel-left';
                                    panelLeft.classList.add('no-cta');
                                    document.body.appendChild(panelLeft);
                                }
                                
                                if (!document.querySelector('.load-button-panel')) {
                                    const loadPanel = document.createElement('div');
                                    loadPanel.className = 'load-button-panel hide';
                                    document.body.appendChild(loadPanel);
                                }
                                
                                // Load model if specified in localStorage
                                const currentModelUrl = localStorage.getItem('currentModelUrl');
                                const currentModelName = localStorage.getItem('currentModelName') || 'model.ply';
                                
                                if (currentModelUrl) {
                                    try {
                                        console.log("Loading model from URL:", currentModelUrl);
                                        await viewer.loadFiles([{ url: currentModelUrl, filename: currentModelName }], true);
                                    } catch (error) {
                                        console.error('Error loading model:', error);
                                        observer.set('ui.error', `Failed to load model: ${error}`);
                                        setError(`Failed to load model: ${error instanceof Error ? error.message : String(error)}`);
                                    }
                                }
                                
                                // Handle PWA file handling
                                if ('launchQueue' in window) {
                                    window.launchQueue.setConsumer(async (launchParams: LaunchParams) => {
                                        const pwaFiles: { url: string, filename: string }[] = [];
                                        
                                        for (const fileHandle of launchParams.files) {
                                            const file = await fileHandle.getFile();
                                            pwaFiles.push({ url: URL.createObjectURL(file), filename: file.name });
                                        }
                                        
                                        if (pwaFiles.length > 0) {
                                            viewer.loadFiles(pwaFiles, true);
                                        }
                                    });
                                }
                                
                                // Handle URL parameters
                                for (const [key, value] of url.searchParams) {
                                    switch (key) {
                                        case 'cameraPosition': {
                                            const pos = value.split(',').map(Number);
                                            if (pos.length === 3) {
                                                viewer.initialCameraPosition = new Vec3(pos);
                                            }
                                            break;
                                        }
                                        case 'cameraFocus': {
                                            const pos = value.split(',').map(Number);
                                            if (pos.length === 3) {
                                                viewer.initialCameraFocus = new Vec3(pos);
                                            }
                                            break;
                                        }
                                        case 'dummyWebGPU': {
                                            new DummyWebGPU(viewer.app);
                                            break;
                                        }
                                        default: {
                                            if (observer.has(key)) {
                                                switch (typeof observer.get(key)) {
                                                    case 'boolean':
                                                        observer.set(key, value.toLowerCase() === 'true');
                                                        break;
                                                    case 'number':
                                                        observer.set(key, Number(value));
                                                        break;
                                                    default:
                                                        observer.set(key, decodeURIComponent(value));
                                                        break;
                                                }
                                            }
                                            break;
                                        }
                                    }
                                }
                                
                                setIsInitialized(true);
                            } catch (err) {
                                const errorMessage = err instanceof Error ? err.message : String(err);
                                console.error('Error initializing viewer:', errorMessage);
                                setError(`Error initializing viewer: ${errorMessage}`);
                            }
                        }).catch((err: Error) => {
                            console.error('Error initializing graphics device:', err);
                            setError(`Failed to initialize graphics device: ${err.message || String(err)}`);
                        });
                    } catch (err) {
                        const errorMessage = err instanceof Error ? err.message : String(err);
                        console.error('Error during initialization:', errorMessage);
                        setError(`Initialization error: ${errorMessage}`);
                    }
                } else {
                    // If canvas is not sized yet, wait and try again
                    console.log("Waiting for canvas size, current size:", rect.width, "x", rect.height);
                    setTimeout(waitForCanvasSize, 100); // Use setTimeout instead of requestAnimationFrame
                }
            };

            // Start waiting for canvas size
            waitForCanvasSize();
        } else {
            setError("Could not find viewer container element");
        }
        
        return () => {
            // Cleanup when component unmounts
            if (window.viewer) {
                window.viewer = null;
            }
        };
    }, []);
    
    return (
        <div id="viewer-container" style={{ width: '100%', height: '100vh', display: 'block' }}>
            {!isInitialized && !error && (
                <div className="loading-container">
                    <div className="loading-spinner"></div>
                    <span>Initializing viewer...</span>
                </div>
            )}
            {error && (
                <div className="error-container" style={{ padding: '20px', color: 'red' }}>
                    {error}
                </div>
            )}
        </div>
    );
};

// Main App component with routing
const App = () => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // Handle authentication state
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            setIsAuthenticated(!!user);
            setIsLoading(false);
        });

        // Log version info
        console.log(`Model Viewer v${modelViewerVersion} | PCUI v${pcuiVersion} (${pcuiRevision}) | PlayCanvas Engine v${engineVersion} (${engineRevision})`);

        return () => unsubscribe();
    }, []);

    if (isLoading) {
        return (
            <div className="loading-container">
                <div className="loading-spinner"></div>
                <span>Loading...</span>
            </div>
        );
    }

    return (
        <HashRouter>
            <Routes>
                <Route 
                    path="/login" 
                    element={isAuthenticated ? <Navigate to="/dashboard" /> : <LoginPage />} 
                />
                <Route 
                    path="/dashboard" 
                    element={isAuthenticated ? <DashboardPage /> : <Navigate to="/login" />} 
                />
                <Route 
                    path="/viewer" 
                    element={isAuthenticated ? <ViewerComponent /> : <Navigate to="/login" />} 
                />
                <Route path="/" element={<Navigate to={isAuthenticated ? "/dashboard" : "/login"} />} />
            </Routes>
        </HashRouter>
    );
};

// Render the React application
ReactDOM.render(
    <React.StrictMode>
        <App />
    </React.StrictMode>,
    document.getElementById('app')
);
