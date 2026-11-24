# VEDA holographic HUD

A frontend-only React, TypeScript, Vite, Three.js and React Three Fiber demo for the VEDA command-centre concept.

## Run locally

```sh
npm install
npm:cmd run dev
```

Use a current Chromium based browser for Web Speech recognition. Microphone access starts only when you press the mic button. Text commands work in every browser. Optional spoken replies use the browser's speech synthesis.

The assistant replies, system readings, web search, app shortcuts, code output and device controls are explicitly simulated. Tasks are saved in this browser's local storage. No backend or AI service is configured.

## Controls

- Move the pointer to create a subtle camera parallax; use **Reset view** to recenter it.
- Use **Settings** to change render quality, sound replies and reduced motion.
- Use the bottom command dock for voice or text. Chat history is held in page state for this session.
- Manage local tasks from the right panel or the task drawer.
