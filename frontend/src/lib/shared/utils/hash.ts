export async function sha256_hex(file: File): Promise<string> {
	const array_buffer = await file.arrayBuffer();
	const hash_buffer = await crypto.subtle.digest('SHA-256', array_buffer);

	return Array.from(new Uint8Array(hash_buffer))
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
}
