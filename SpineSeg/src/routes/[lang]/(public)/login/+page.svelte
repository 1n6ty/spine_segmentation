<script lang="ts">
    import { t } from 'svelte-i18n';

    import favicon from '$lib/assets/icons/favicon.svg';
</script>

<div class="min-h-screen flex items-center justify-center bg-linear-to-br from-blue-50 to-indigo-100">
    <div class="w-full max-w-md">
        <div class="text-center mb-8">
            <div class="inline-flex items-center justify-center w-16 h-16 bg-white rounded-full mb-4">
                <img src={ favicon } alt="favicon" class="w-8 h-8"/>
            </div>
            <h1 class="text-3xl text-gray-900 mb-2">Spine Segmentation</h1>
            <p class="text-gray-600">{ $t('header.p') }</p>
        </div>
        <div class="bg-white rounded-lg shadow-xl p-8">
            <form class="space-y-4">
                <div>
                    <label class="flex items-center gap-2 text-sm leading-none font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50" for="login-email">
                        { $t('login.email') }
                    </label>
                    <input type="email" id="login-email" class="file:text-(--foreground) placeholder:text-(--muted-foreground) selection:bg-(--primary) selection:text-(--primary-foreground) dark:bg-(--input)/30 border-(--border) flex h-9 w-full min-w-0 rounded-md border px-3 py-1 text-base bg-(--input-background) transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-(--transparent) file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm focus-visible:border-(--ring) focus-visible:ring-(--ring)/50 focus-visible:ring-[3px] aria-invalid:ring-(--destructive)/20 dark:aria-invalid:ring-(--destructive)/40 aria-invalid:border-(--destructive)" placeholder="doctor@email.com" required/>
                </div>
                <div>
                    <label class="flex items-center gap-2 text-sm leading-none font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50" for="login-password">
                        { $t('login.password') }
                    </label>
                    <input type="password" id="login-password" class="file:text-(--foreground) placeholder:text-(--muted-foreground) selection:bg-(--primary) selection:text-(--primary-foreground) dark:bg-(--input)/30 border-(--border) flex h-9 w-full min-w-0 rounded-md border px-3 py-1 text-base bg-(--input-background) transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-(--transparent) file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm focus-visible:border-(--ring) focus-visible:ring-(--ring)/50 focus-visible:ring-[3px] aria-invalid:ring-(--destructive)/20 dark:aria-invalid:ring-(--destructive)/40 aria-invalid:border-(--destructive)" placeholder="••••••••" required/>
                </div>
                <button type="submit" class="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_img]:pointer-events-none [&_img:not([class*='size-'])]:size-4 shrink-0 [&_img]:shrink-0 outline-none focus-visible:border-(--ring) focus-visible:ring-(--ring)/50 focus-visible:ring-[3px] aria-invalid:ring-(--destructive)/20 dark:aria-invalid:ring-(--destructive)/40 aria-invalid:border-(--destructive) bg-(--primary) text-(--primary-foreground) hover:bg-(--primary)/90 h-9 px-4 py-2 has-[>img]:px-3 w-full cursor-pointer">
                    { $t('login.submit') }
                </button>
            </form>
        </div>
    </div>
</div>