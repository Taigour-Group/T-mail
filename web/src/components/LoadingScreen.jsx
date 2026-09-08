import { BRAND } from '../lib/brand.js';

export default function LoadingScreen() {
  return (
    <main className="loading-screen" aria-live="polite" aria-label="Loading T-mail">
      <div className="loading-screen__grid" aria-hidden="true" />
      <div className="loading-screen__content">
        <div className="loading-screen__mark">
          <img src={BRAND.logoUrl} alt="" aria-hidden="true" />
        </div>
        <p className="loading-screen__name">{BRAND.name}</p>
        <p className="loading-screen__status">Preparing your inbox</p>
        <div className="loading-screen__track" aria-hidden="true">
          <span />
        </div>
      </div>
    </main>
  );
}
