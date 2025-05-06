
## How to build

Ensure you have [Node.js](https://nodejs.org) installed (v18.0+). Then, from a command prompt, run:

    npm install
    npm run build

This will invoke Rollup and output the built viewer to the `dist` folder. To invoke Rollup with the `--watch` flag (which rebuilds the viewer on saving any source file), do:

    npm run watch

## How to build with local PlayCanvas engine

You can set the npm build scripts to use local versions of the PlayCanvas engine & PlayCanvas extras builds by setting the following environment variables when launching the npm build scripts:

    ENGINE_PATH=./path/to/engine npm run build

## How to run

Run:

    npm run serve

Open a browser and navigate to http://localhost:3000.

## Development 

Run:

    npm run develop

Open a browser and navigate to http://localhost:3000.

N.B. To load local models run `npx server --cors` in the directory containing the model (disables CORS).
