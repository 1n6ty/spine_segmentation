# Backend integration

**This doc is superseded.** It originally recorded that the integration was fully commented-out and blocked on deleted backend files (`Dicom/utils/*` missing from disk). Both are no longer true: the `Dicom/utils/` module has since been restored, and the frontend's login, autofill ("magic button"), and DSL cache-check are now wired up and working end-to-end (against mocked responses — see the limitation noted below).

For the current state, see the repo-root docs (these cover both frontend and backend, since the integration inherently spans both):

- [../../docs/backend-architecture.md](../../docs/backend-architecture.md) — what the backend actually exposes (auth, DICOM models, the segmentation Celery task + WebSocket, the DSL query API) and a correction about what is/isn't actually auth-gated.
- [../../docs/doctor-profile.md](../../docs/doctor-profile.md) — the login/logout wiring and what it does (and doesn't) gate.
- [../../docs/autofill-integration.md](../../docs/autofill-integration.md) — the magic-button flow in detail, what changed from the original broken attempt, and its one remaining limitation (no live end-to-end test against a running backend stack in this environment).
- [../../docs/build-and-deploy.md](../../docs/build-and-deploy.md) — how the two projects build and deploy together.

The frontend-side bug this doc previously flagged (`xraysockets.store.ts` importing a non-existent `study.store.ts`) is fixed — see `autofill-integration.md`.

The `classify/` module mentioned in the previous version of this doc is unchanged: a standalone, not-wired-into-Django scikit-learn classifier at the repo root, unrelated to this integration. See [clinical-rules-reference.md](clinical-rules-reference.md) for why the rule-based diagnosis engine remains the near-term approach.
