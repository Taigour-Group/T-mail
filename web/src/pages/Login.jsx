import { api } from '../lib/api.js';
import { BRAND } from '../lib/brand.js';

export default function Login() {
  return (
    <main className="h-full min-h-0 overflow-hidden bg-[#f4f7fb] text-slate-950 md:grid md:grid-cols-[minmax(320px,0.82fr)_minmax(460px,1.18fr)]">
      <section className="relative hidden min-h-full overflow-hidden bg-[#101828] px-10 py-10 text-white md:flex md:flex-col lg:px-16">
        <div className="login-grid absolute inset-0 opacity-30" aria-hidden="true" />
        <div className="relative flex items-center gap-3">
          <img src={BRAND.logoUrl} alt="" aria-hidden="true" className="h-10 w-10 rounded-xl object-cover" />
          <span className="text-xl font-bold tracking-tight">{BRAND.name}</span>
        </div>

        <div className="relative mt-auto max-w-md pb-8 login-reveal">
          <p className="mb-5 text-xs font-semibold uppercase tracking-[0.28em] text-blue-300">TGO mail service</p>
          <h1 className="max-w-sm text-4xl font-semibold leading-[1.08] tracking-[-0.04em] lg:text-5xl">
            A calmer place for important mail.
          </h1>
          <p className="mt-6 max-w-sm text-sm leading-6 text-slate-300">
            Keep your @tgo.com conversations close, clear, and easy to return to.
          </p>
          <div className="mt-12 flex items-center gap-3 text-xs text-slate-400">
            <span className="h-px w-10 bg-blue-400" />
            Secure access for the TGO team
          </div>
        </div>
      </section>

      <section className="flex min-h-0 items-center justify-center overflow-hidden px-5 py-6 sm:px-10 sm:py-12 md:min-h-full">
        <div className="w-full max-w-md login-reveal">
          <div className="relative mb-5 overflow-hidden rounded-2xl bg-[#101828] px-4 py-4 text-white shadow-lg shadow-slate-900/10 sm:mb-10 sm:px-5 sm:py-6 md:hidden">
            <div className="login-grid absolute inset-0 opacity-30" aria-hidden="true" />
            <div className="relative flex items-center gap-3">
              <img src={BRAND.logoUrl} alt={BRAND.logoAlt} className="h-10 w-10 rounded-xl object-cover" />
              <div>
                <span className="block text-xl font-bold tracking-tight">{BRAND.name}</span>
                <span className="block text-xs text-slate-300">TGO mail service</span>
              </div>
            </div>
            <p className="relative mt-4 max-w-[16rem] text-sm leading-5 text-slate-300 sm:mt-6">Your work conversations, ready when you are.</p>
          </div>

          <div className="mb-5 sm:mb-9">
            <p className="mb-3 text-sm font-semibold text-accent">Welcome back</p>
            <h2 className="text-[2rem] font-semibold leading-tight tracking-[-0.035em] text-slate-950 sm:text-4xl">Sign in to your inbox</h2>
            <p className="mt-4 max-w-sm text-sm leading-6 text-slate-500">Use your TGO account to continue to T-mail.</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_20px_60px_-35px_rgba(15,23,42,0.45)] sm:p-8">
            <div className="mb-4 flex items-center gap-3 rounded-xl bg-slate-50 px-4 py-3 sm:mb-6">
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-blue-100 text-accent" aria-hidden="true">
                <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current" strokeWidth="1.8">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 7.5 12 13l8-5.5M5.5 5h13A1.5 1.5 0 0 1 20 6.5v11a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5v-11A1.5 1.5 0 0 1 5.5 5Z" />
                </svg>
              </span>
              <div>
                <p className="text-sm font-semibold text-slate-800">TGO account</p>
                <p className="text-xs text-slate-500">For @tgo.com addresses</p>
              </div>
            </div>

            <a href={api.loginUrl()} className="btn-primary w-full py-3 shadow-lg shadow-blue-600/15">
              Sign in with TGO
              <svg viewBox="0 0 20 20" className="h-4 w-4 fill-none stroke-current" strokeWidth="1.8" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.5 10h12m-5-5 5 5-5 5" />
              </svg>
            </a>
            <p className="mt-4 text-center text-xs leading-5 text-slate-400 sm:mt-5">
              You&apos;ll be redirected to TGO ID to sign in, then brought back here.
            </p>
          </div>

          <p className="mt-5 text-center text-xs text-slate-400 sm:mt-8">Private workspace · T-mail</p>
        </div>
      </section>
    </main>
  );
}
