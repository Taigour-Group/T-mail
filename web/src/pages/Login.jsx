import { api } from '../lib/api.js';

export default function Login() {
  return (
    <div className="h-full grid place-items-center p-6">
      <div className="card p-8 w-full max-w-sm text-center">
        <div className="text-3xl font-bold tracking-tight mb-1">tmail</div>
        <p className="text-gray-500 text-sm mb-6">Email for @tgo.com</p>
        <a href={api.loginUrl()} className="btn-primary w-full">Sign in with TGO</a>
        <p className="text-xs text-gray-400 mt-4">
          You'll be redirected to TGO ID to sign in, then back to your inbox.
        </p>
      </div>
    </div>
  );
}
