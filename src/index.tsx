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
import React from 'react'; // Need React for JSX potentially used by initializeUI
import ReactDOM from 'react-dom'; // Need ReactDOM for initializeUI

import { initMaterials } from './material';
import { ObserverData } from './types';
import initializeUI from './ui'; // This now contains the routing logic
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


// print out versions of dependent packages
console.log(`Model Viewer v${modelViewerVersion} | PCUI v${pcuiVersion} (${pcuiRevision}) | PlayCanvas Engine v${engineVersion} (${engineRevision})`);

const main = () => {
    // initialize the apps state
    const observer: Observer = new Observer(observerData);

    // global url
    const url = new URL(window.location.href);

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

    const skyboxUrls = new Map(skyboxes.map(s => [s.label, `static/${s.url}`]));

    // hide / show spinner when loading files
    observer.on('ui.spinner:set', (value: boolean) => {
        const spinner = document.getElementById('spinner');
        if (value) {
            spinner.classList.remove('pcui-hidden');
        } else {
            spinner.classList.add('pcui-hidden');
        }
    });

    if (!url.searchParams.has('default')) {
        // handle options
        loadOptions(observer, 'uistate', skyboxUrls);

        observer.on('*:set', () => {
            saveOptions(observer, 'uistate');
        });
    }

    // Initialize the UI *after* the viewer is created and assigned to window
    // initializeUI(observer); // Moved lower

    // create the canvas - this might be created dynamically by React now,
    // but we still need a reference if the Viewer expects an existing canvas ID.
    // Let's assume the Viewer component within initializeUI handles canvas creation/reference.
    // We might need to adjust how the Viewer gets the canvas reference later if needed.
    // For now, let's assume the canvas with id 'application-canvas' will exist when Viewer needs it.
    // const canvas = document.getElementById('application-canvas') as HTMLCanvasElement; // Potentially redundant if React manages the canvas

    const absoluteUrl = (relative: string) => new URL(relative, document.baseURI).toString();

    // Define the function to run when the viewer UI component is ready
    const startViewerInitialization = () => {
        // Now try to get the canvas rendered by the React UI
        const canvas = document.getElementById('application-canvas') as HTMLCanvasElement;

        if (!canvas) {
            console.error('Canvas element \'application-canvas\' not found after UI initialization.');
            const errorDiv = document.getElementById('app') || document.body;
            errorDiv.innerHTML = '<div style=\'padding: 20px; color: red;\'>Fatal Error: Canvas element not found.</div>';
            return; // Stop execution if canvas isn't found
        }

        // create the graphics device
        createGraphicsDevice(canvas, {
            deviceTypes: url.searchParams.has('webgpu') || observer.get('enableWebGPU') ? ['webgpu'] : [],
            glslangUrl: absoluteUrl('static/lib/glslang/glslang.js'),
            twgslUrl: absoluteUrl('static/lib/twgsl/twgsl.js'),
            antialias: false,
            depth: false,
            stencil: false,
            xrCompatible: true,
            powerPreference: 'high-performance'
        }).then(async (device) => { // Make async to handle potential awaits
            observer.set('runtime.activeDeviceType', device.deviceType);

            // create viewer instance
            const viewer = new Viewer(canvas, device, observer, skyboxUrls);

            // make viewer available globally
            window.viewer = viewer;

            // --- Model Loading Logic based on localStorage ---
            const currentModelUrl = localStorage.getItem('currentModelUrl');
            const currentModelName = localStorage.getItem('currentModelName') || 'model.ply'; // Default name

            if (window.location.hash === '#/viewer' && currentModelUrl) {
                console.log(`Loading model from localStorage: ${currentModelName} (${currentModelUrl})`);
                try {
                    // Ensure the viewer is ready before loading
                    // In complex scenarios, might need a more robust check or event
                    await viewer.loadFiles([{ url: currentModelUrl, filename: currentModelName }], true); // Reset scene when loading specific model
                } catch (error) {
                    console.error('Error loading model from localStorage:', error);
                    observer.set('ui.error', `Failed to load model: ${error}`);
                    // Optionally clear the stored URL if loading fails
                    // localStorage.removeItem('currentModelUrl');
                    // localStorage.removeItem('currentModelName');
                    // window.location.hash = '#/dashboard'; // Redirect back?
                }
            } else if (window.location.hash !== '#/login' && window.location.hash !== '#/dashboard') {
                // If logged in but not on viewer route and no model specified,
                // ensure we are on the dashboard. The routing in ui/index.tsx handles this,
                // but this is a fallback check.
                console.log('No model specified or not on viewer route, ensuring dashboard.');
            }
            // --- End Model Loading Logic ---


            // --- Start: PWA File Handling Logic ---
            // Re-introduce files array specifically for PWA launch handling
            const pwaFiles: { url: string, filename: string }[] = [];
            const pwaPromises: Promise<any>[] = [];
            if ('launchQueue' in window) {
                window.launchQueue.setConsumer((launchParams: LaunchParams) => {
                    for (const fileHandle of launchParams.files) {
                        pwaPromises.push(
                            fileHandle.getFile().then((file) => {
                                pwaFiles.push({ url: URL.createObjectURL(file), filename: file.name });
                            })
                        );
                    }
                    // After processing files, potentially load them if not handled by localStorage logic
                    Promise.all(pwaPromises).then(() => {
                        if (pwaFiles.length > 0 && window.location.hash !== '#/viewer') {
                            // Load PWA files only if not already loading a specific model via hash/localStorage
                            console.log('Loading files from PWA launch handler:', pwaFiles);
                            viewer.loadFiles(pwaFiles, true); // Reset scene for PWA launch
                        }
                    });
                });
            }
            // --- End: PWA File Handling Logic ---

            // handle search params - Keep camera/debug params, remove model loading ones
            for (const [key, value] of url.searchParams) {
                switch (key) {
                    // case 'load': // Removed
                    // case 'assetUrl': { // Removed
                    //     const url = decodeURIComponent(value);
                    //     files.push({ url, filename: url });
                    //     break;
                    // }
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
                        const dummy = new DummyWebGPU(viewer.app);
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

            // PWA file loading is handled within the launchQueue consumer now

        }).catch((err: Error) => { // Add type annotation for err
            console.error('Error initializing graphics device or viewer:', err);
            // Display error to the user if possible
            const errorDiv = document.getElementById('app') || document.body;
            errorDiv.innerHTML = `<div style='padding: 20px; color: red;'>Failed to initialize viewer: ${err.message || err}</div>`;
        });
    };

    // Initialize React UI and pass the callback
    initializeUI(observer, startViewerInitialization);
};

// start main
main();
