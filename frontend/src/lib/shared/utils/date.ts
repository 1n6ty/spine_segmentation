export function get_age(
	birth_date: Date | null | undefined,
	today: Date = new Date()
): number | null {
	if (!birth_date) return null;

	let age = today.getFullYear() - birth_date.getFullYear();

	// Adjust if birthday hasn't occurred yet this year
	const has_had_birthday_this_year =
		today.getMonth() > birth_date.getMonth() ||
		(today.getMonth() === birth_date.getMonth() && today.getDate() >= birth_date.getDate());

	if (!has_had_birthday_this_year) age--;

	return age >= 0 ? age : null;
}
