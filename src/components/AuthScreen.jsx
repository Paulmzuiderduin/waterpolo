import React from 'react';
import { Target, BarChart3, Download } from 'lucide-react';

const AuthScreen = ({
  authEmail, setAuthEmail, authPassword, setAuthPassword, authMessage,
  onPasswordSignIn, onPasswordSignUp, onSendMagicLink, overlays
}) => (
  <main className="wp-public-page">
    <div className="wp-public-layout">
      <section className="wp-introduction">
        <div className="wp-brand"><Target size={23} strokeWidth={1.8} /><span>Waterpolo Hub</span></div>
        <p className="wp-eyebrow">Shot logging &amp; match review</p>
        <h1>Water Polo Shotmap</h1>
        <p className="wp-lead">See where your shots come from and how they finish. A focused workspace for logging matches and reviewing your team's shooting.</p>
        <ul className="wp-benefits">
          <li><Target size={21} /><div><h2>Record every shot</h2><p>Select a location, player, result, period, and situation directly on the field.</p></div></li>
          <li><BarChart3 size={21} /><div><h2>Understand the patterns</h2><p>Compare locations, players, and conversion across a match or a whole season.</p></div></li>
          <li><Download size={21} /><div><h2>Share your review</h2><p>Export the shotmap as an image or download shot records as CSV.</p></div></li>
        </ul>
        <div className="wp-public-links"><a href="#sign-in">Sign in to start</a><a href="/docs/waterpolo-quickstart.html">Read the quickstart guide</a></div>
      </section>

      <section id="sign-in" className="wp-auth-card">
        <p className="wp-eyebrow">Your workspace</p>
        <h2>Sign in</h2>
        <p className="wp-auth-description">Continue to your teams, matches, and saved shots.</p>
        <label className="wp-form-label" htmlFor="auth-email">Email</label>
        <input id="auth-email" className="wp-input" type="email" autoComplete="email" placeholder="you@example.com" value={authEmail} onChange={(event) => setAuthEmail(event.target.value)} />
        <label className="wp-form-label" htmlFor="auth-password">Password</label>
        <input id="auth-password" className="wp-input" type="password" autoComplete="current-password" placeholder="Enter your password" value={authPassword} onChange={(event) => setAuthPassword(event.target.value)} />
        <button className="wp-auth-submit" onClick={onPasswordSignIn}>Sign in</button>
        <button className="wp-auth-secondary" onClick={onPasswordSignUp}>Create account</button>
        <div className="wp-auth-divider"><span>or sign in by email</span></div>
        <button className="wp-auth-secondary" onClick={onSendMagicLink}>Send magic link</button>
        {authMessage && <p className="wp-auth-message" role="status">{authMessage}</p>}
        <p className="wp-auth-footnote">Choose your team and match after signing in. New here? Start by creating a season and team.</p>
      </section>

      <figure className="wp-workspace-preview">
        <figcaption><span className="wp-eyebrow">Inside the workspace</span><h2>The field comes first.</h2><p>Shot locations, results, and match context together. Shown with example data.</p></figcaption>
        <img src="/images/shotmap-preview.png" width="1180" height="920" loading="lazy" alt="Water Polo Shotmap workspace showing shot locations on the field and a match shot list using example data" />
      </figure>
    </div>
    {overlays}
  </main>
);

export default AuthScreen;
