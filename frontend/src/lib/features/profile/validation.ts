// 'email' is included here for the component's benefit, not set by
// validatePersonalInfo() below -- email format/uniqueness is validated
// server-side (Profile_PATCH_Request), and PersonalInfoCard maps a returned
// ProfilePatchError's `field: "email"` issue onto this same error-state shape.
export type ValidationErrors = Partial<Record<'first_name' | 'last_name' | 'email', string>>;

/** Returns raw error keys, not translated strings -- the component maps them
 * to $t(...) calls, keeping this logic free of an i18n dependency (and
 * directly testable without one). patronymic/phone/email aren't validated
 * here: patronymic/phone are optional on the backend's Profile_PATCH_Request,
 * and email format/uniqueness is validated server-side (see above). */
export function validatePersonalInfo(fields: {
	first_name: string;
	last_name: string;
}): ValidationErrors {
	const errors: ValidationErrors = {};
	if (!fields.first_name.trim()) errors.first_name = 'required';
	if (!fields.last_name.trim()) errors.last_name = 'required';
	return errors;
}
