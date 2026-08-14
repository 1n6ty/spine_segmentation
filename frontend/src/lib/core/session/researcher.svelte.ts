class ResearcherService {
	email = $state<string | null>(null);
	fullName = $state<string | null>(null);
	password = $state<string | null>(null);
	duty = $state<string | null>(null);
}

export const researcherService = new ResearcherService();
