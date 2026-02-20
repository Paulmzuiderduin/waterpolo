import React from 'react';

const PrivacyView = () => (
  <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div>
        <p className="text-sm font-semibold text-cyan-700">Privacy</p>
        <h2 className="text-2xl font-semibold">Privacy Policy</h2>
        <p className="mt-2 text-xs text-slate-500">Last updated: February 10, 2026</p>
      </div>
    </div>

    <div className="rounded-2xl bg-white p-6 shadow-sm text-sm text-slate-600 space-y-4">
      <p>
        This Privacy Policy explains how Waterpolo Shotmap & Analytics (“we”, “us”, or “the App”) collects,
        uses, and shares personal data. This policy is designed to comply with the EU General Data Protection
        Regulation (GDPR) and international privacy standards.
      </p>

      <div>
        <h3 className="text-sm font-semibold text-slate-700">1. Controller</h3>
        <p>Controller: Waterpolo Shotmap & Analytics</p>
        <p>Contact: privacy@paulzuiderduin.com</p>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-slate-700">2. Data We Collect</h3>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Account data: Email address used for magic‑link login.</li>
          <li>Team & match data: Seasons, teams, matches, and shot records you create.</li>
          <li>Player data: Name, cap number, birthday (used only to calculate age), dominant hand, height/weight, notes.</li>
          <li>Media: Optional player photos.</li>
          <li>Technical data: Session tokens, IP address, browser/device metadata necessary for security and service operation.</li>
        </ul>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-slate-700">3. Purposes and Legal Bases (GDPR)</h3>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Service delivery: Authentication, storage, and analytics.</li>
          <li>Security and maintenance: Monitoring, stability, and troubleshooting.</li>
          <li>Reporting: Generating analytics and PDF reports.</li>
        </ul>
        <p className="mt-2">
          Legal bases: Performance of contract (Art. 6(1)(b)), legitimate interests (Art. 6(1)(f)), and consent
          (Art. 6(1)(a)) for optional data such as photos.
        </p>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-slate-700">4. Processors and Storage</h3>
        <p>We use Supabase for authentication, database, and file storage. Supabase acts as a data processor on our behalf.</p>
        <p>Data may be processed internationally. Where required, appropriate safeguards (e.g., Standard Contractual Clauses) are used.</p>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-slate-700">5. Data Sharing</h3>
        <p>We do not sell personal data. We only share data with service providers (Supabase) and authorities if required by law.</p>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-slate-700">6. Retention</h3>
        <p>We retain data as long as your account is active or as required to provide the service. You can delete data in the App.</p>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-slate-700">7. Your Rights (GDPR)</h3>
        <p>
          You have the right to access, rectify, erase, restrict, object, and receive your data. Contact us at
          privacy@paulzuiderduin.com to exercise these rights.
        </p>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-slate-700">8. Security</h3>
        <p>We use Supabase authentication and database policies (RLS). No system is 100% secure; keep login links private.</p>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-slate-700">9. Children</h3>
        <p>The App is intended for coaches and team administrators. If you process data of minors, you are responsible for obtaining permissions.</p>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-slate-700">10. Changes</h3>
        <p>We may update this policy. The latest version will always be available in the App.</p>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-slate-700">11. Supervisory Authority</h3>
        <p>If you are in the EU, you can lodge a complaint with your local supervisory authority. In the Netherlands, this is the Autoriteit Persoonsgegevens.</p>
      </div>
    </div>
  </div>
);


export default PrivacyView;
