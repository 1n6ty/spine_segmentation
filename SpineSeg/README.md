# SpineSeg

SvelteKit frontend for a vertebra-segmentation and spine-deformity diagnostics tool: upload a spine DICOM X-ray, get (eventually AI-assisted) vertebra outlines, correct them interactively, and view computed geometric/clinical parameters intended to support a doctor's first-pass diagnosis.

## Developing

```sh
npm install
npm run dev       # dev server
npm run build      # production build (static SPA, see svelte.config.js)
npm run check      # svelte-check
npm run lint       # prettier + eslint
npm test           # vitest unit + playwright e2e
```

## Docs

`docs/` is a full audit of the current frontend (and brief backend-integration context), written for whoever picks up the next phase of work. Start here if you're new to the codebase:

- [Architecture](docs/architecture.md) — tech stack, routing, state management, local storage, folder layout.
- [Diagnostic pipeline](docs/diagnostic-pipeline.md) — the 5-screen user journey, file-by-file, and exactly what the medical-parameter calculators compute.
- [Clinical rules reference](docs/clinical-rules-reference.md) — the threshold tables behind a rule-based "first diagnosis," and how they map onto parameters already computed in code.
- [Backend integration](docs/backend-integration.md) — what the frontend expects from the backend, what currently exists, and why none of it is wired up yet.
- [Gaps & recommendations](docs/gaps-and-recommendations.md) — prioritized list of what's missing or broken.
- [Security & privacy](docs/security-privacy.md) — PHI handling concerns given DICOM data lives entirely client-side today.
- [Testing strategy](docs/testing-strategy.md) — current (near-zero) coverage and where to invest first.
