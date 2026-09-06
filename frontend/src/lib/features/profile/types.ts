// Mirrors backend/Mainland/common/schemas/v1/domain/user.py's User_Item_Schema --
// the full shape (unlike auth.svelte.ts's partial `Me` type, which only mirrors
// what the session guard itself consumes).

export type ProfileCompany = { slug: string; name: string };
export type ProfileRole = { slug: string; name: string };

export type Profile = {
	id: number;
	first_name: string;
	last_name: string;
	patronymic: string;
	email: string;
	is_active: boolean;
	date_joined: string;
	last_login: string | null;
	phone: string | null;
	company: ProfileCompany | null;
	roles: ProfileRole[];
	managed_companies: ProfileCompany[];
	permissions: string[];
};

export type ProfilePatchFields = {
	first_name?: string;
	last_name?: string;
	patronymic?: string;
	phone?: string;
	email?: string;
};
