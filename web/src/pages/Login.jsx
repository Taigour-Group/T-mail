import { api } from '../lib/api.js';
import { BRAND } from '../lib/brand.js';

export default function Login() {
  return (
    <div className="h-full grid place-items-center p-6">
      <div className="card p-8 w-full max-w-sm text-center">
        <div className="mb-3 flex items-center justify-center gap-2">
          <img src={BRAND.logoUrl} alt="" aria-hidden="true" className="h-14 w-auto max-w-[220px] object-contain" />
          <span className="text-3xl font-bold tracking-tight">{BRAND.name}</span>
        </div>
        <p className="text-gray-500 text-sm mb-6">Email for @tgo.com</p>
        <a href={api.loginUrl()} className="btn-primary w-full">Sign in with TGO</a>
        <p className="text-xs text-gray-400 mt-4">
          You'll be redirected to TGO ID to sign in, then back to your inbox.
        </p>
      </div>
    </div>
  );
}
