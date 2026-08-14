# Naming

**Convention (not lint-enforced — `eslint.config.js` has no naming rule):** prefer whatever
casing an external standard already uses for that identifier; fall back to `snake_case` for
everything internal with no external standard to match.

- **Matches an external standard → keep its casing**, even mid-camelCase-file: `sopInstanceUID`,
  `SOPInstanceUID`-derived fields (DICOM standard's own casing, `core/session/sop-instance.svelte.ts`),
  request/response JSON keys that mirror the backend's Pydantic field names (`remember_me`,
  `first_name`, `sop_instance_uid` — Python/Django convention on that side, kept verbatim rather
  than re-cased at the boundary).
- **No external standard → `snake_case`**: `set_locale`, `is_supported_url_lang`,
  `detect_url_lang`, `url_lang_to_locale`, `stream_segmentation_events`, `has_session` (removed,
  see `auth.md`), `format_json_to_polygons`. This is the large majority of function/variable names
  written since the naming convention was established.
- **Known pre-existing exceptions, not to be treated as the pattern to copy:** `runAutofill`,
  `orderAndName` (`features/autofill/autofill.ts`, `features/editor/logic/orderer.ts`) predate the
  convention and are camelCase. Don't propagate this style into new code; rename opportunistically
  if touching these files for another reason, but a naming-only pass across the whole codebase
  hasn't been done.
- **Svelte component files** — `PascalCase.svelte`, standard Svelte convention, not part of the
  above rule at all (`ProfileBar.svelte`, `EditorCanvas.svelte`).
- **Directories and non-component files** — `kebab-case` (`dicom-upload-card/`,
  `medical-parameters/`, `dicom-upload-card.type.ts`), matching URL-slug/RFC 3986 convention,
  distinct from the identifier-naming rule above.
- **Types/interfaces** — `PascalCase` (`SessionValue`, `AutofillStatus`, `UrlLang`), standard
  TypeScript convention.

Singleton instance exports are the one place camelCase is always correct regardless of the above
— `project`, `authService`, `researcherService`, `registry`, `i18nState` — because they're values
being imported and read like any other JS binding, not domain identifiers being transliterated
from a spec.
