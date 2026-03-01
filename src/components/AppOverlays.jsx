import React from 'react';

const AppOverlays = ({
  confirmDialog,
  setConfirmDialog,
  promptDialog,
  setPromptDialog,
  featureRequestDialog,
  setFeatureRequestDialog,
  featureRequestContext,
  submitFeatureRequest,
  toasts
}) => (
  <>
    {confirmDialog && (
      <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/35 px-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
          <h3 className="text-sm font-semibold text-slate-800">Please confirm</h3>
          <p className="mt-2 text-sm text-slate-600">{confirmDialog.message}</p>
          <div className="mt-4 flex justify-end gap-2">
            <button
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700"
              onClick={() => {
                const dialog = confirmDialog;
                setConfirmDialog(null);
                dialog.resolve(false);
              }}
            >
              Cancel
            </button>
            <button
              className="wp-primary-bg rounded-lg px-3 py-2 text-sm font-semibold text-white"
              onClick={() => {
                const dialog = confirmDialog;
                setConfirmDialog(null);
                dialog.resolve(true);
              }}
            >
              Confirm
            </button>
          </div>
        </div>
      </div>
    )}

    {promptDialog && (
      <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/35 px-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
          <h3 className="text-sm font-semibold text-slate-800">{promptDialog.message}</h3>
          <input
            autoFocus
            className="mt-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={promptDialog.value}
            onChange={(event) =>
              setPromptDialog((prev) => (prev ? { ...prev, value: event.target.value } : prev))
            }
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                const dialog = promptDialog;
                setPromptDialog(null);
                dialog.resolve(dialog.value);
              }
            }}
          />
          <div className="mt-4 flex justify-end gap-2">
            <button
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700"
              onClick={() => {
                const dialog = promptDialog;
                setPromptDialog(null);
                dialog.resolve(null);
              }}
            >
              Cancel
            </button>
            <button
              className="wp-primary-bg rounded-lg px-3 py-2 text-sm font-semibold text-white"
              onClick={() => {
                const dialog = promptDialog;
                setPromptDialog(null);
                dialog.resolve(dialog.value);
              }}
            >
              Save
            </button>
          </div>
        </div>
      </div>
    )}

    {featureRequestDialog && (
      <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/35 px-4">
        <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl">
          <h3 className="text-sm font-semibold text-slate-800">Request a feature</h3>
          <p className="mt-2 text-sm text-slate-600">
            This request will be stored in Supabase together with your current Waterpolo Hub context.
          </p>
          <div className="mt-3 rounded-lg border border-cyan-100 bg-cyan-50 px-3 py-2 text-xs text-cyan-800">
            Prefer email? You can also send feedback directly to{' '}
            <a className="font-semibold underline" href="mailto:info@paulzuiderduin.com">
              info@paulzuiderduin.com
            </a>
            .
          </div>
          <div className="mt-4 grid gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-500">Subject</label>
              <input
                aria-label="Feature request subject"
                className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={featureRequestDialog.subject}
                onChange={(event) =>
                  setFeatureRequestDialog((prev) =>
                    prev ? { ...prev, subject: event.target.value } : prev
                  )
                }
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500">Message</label>
              <textarea
                aria-label="Feature request message"
                className="mt-2 min-h-[140px] w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={featureRequestDialog.message}
                onChange={(event) =>
                  setFeatureRequestDialog((prev) =>
                    prev ? { ...prev, message: event.target.value } : prev
                  )
                }
                placeholder="Describe the feature, workflow, or pain point."
              />
            </div>
            <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
              Signed in as {featureRequestContext.email} · Context: {featureRequestContext.activeTab}
              {featureRequestContext.selectedSeasonName
                ? ` · Season: ${featureRequestContext.selectedSeasonName}`
                : ''}
              {featureRequestContext.selectedTeamName
                ? ` · Team: ${featureRequestContext.selectedTeamName}`
                : ''}
            </div>
            {featureRequestDialog.error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {featureRequestDialog.error}
              </div>
            )}
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700"
              onClick={() => setFeatureRequestDialog(null)}
              disabled={featureRequestDialog.submitting}
            >
              Cancel
            </button>
            <button
              className="wp-primary-bg rounded-lg px-3 py-2 text-sm font-semibold text-white"
              onClick={submitFeatureRequest}
              disabled={featureRequestDialog.submitting}
            >
              {featureRequestDialog.submitting ? 'Sending...' : 'Send request'}
            </button>
          </div>
        </div>
      </div>
    )}

    <div className="fixed right-4 top-4 z-[130] flex w-[min(360px,95vw)] flex-col gap-2">
      {toasts.map((item) => (
        <div
          key={item.id}
          className={`rounded-lg px-3 py-2 text-sm font-medium shadow-lg ${
            item.type === 'error'
              ? 'border border-red-200 bg-red-50 text-red-700'
              : 'border border-emerald-200 bg-emerald-50 text-emerald-700'
          }`}
        >
          {item.message}
        </div>
      ))}
    </div>
  </>
);

export default AppOverlays;
