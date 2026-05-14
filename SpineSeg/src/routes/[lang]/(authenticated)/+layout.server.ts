import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ cookies, params }) => {
    // const session = cookies.get('sessionid');
    // if (!session) {
    //     throw redirect(303, `/${params.lang}/login`);
    // }

    // Optional: You can fetch user details from Django here 
    // to pass them down to all pages in the (app) group
    return {
        user: { name: "Doctor" } // Replace with real API call
    };
};