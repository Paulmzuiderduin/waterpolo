# Umami website accounts

Reference for the Umami Cloud setup. Website IDs are public tracker identifiers, not API keys. Do not put Umami API keys in this repository.

| Website | Umami account | Website ID | Tracking status |
| --- | --- | --- | --- |
| `www.paulzuiderduin.com` / `paulzuiderduin.com` | `info@paulzuiderduin.com` | `7da38100-4be9-4a6b-9cea-0f1a5e1e2236` | Active on the landing page only |
| `games28.paulzuiderduin.com` | `info@paulzuiderduin.com` | Managed separately | Do not change from the shared projects workspace |
| `zorgvergelijker.paulzuiderduin.com` | `paul.m.zuiderduin@gmail.com` | `3fa659b2-1096-4c2c-899b-39cb9f6b23b4` | Active on Zorgvergelijker only |
| `mov2mp4.paulzuiderduin.com` | `privacy@paulzuiderduin.com` | `524fa32a-c355-4552-9211-2ccd42b5cbd5` | Active on MOV2MP4 only |

## Event tracking

### Landing page

- `app_opened`: app name and placement (`header`, `hero`, or `app_list`)
- `contact_email_opened`

### Zorgvergelijker

- `comparison_started`: current policy or example data
- `step_opened`
- `policy_added`, `policy_deleted`, `policy_duplicated`: policy count only
- `comparison_imported`, `comparison_exported`: file format and policy count only

### MOV2MP4

- File queue, conversion, download, ZIP, and speed-mode events
- Event data contains counts, file sizes, conversion mode, method, and duration only; it does not include filenames or video content.

## Guardrails

- The landing-page tracking ID must not be installed on Waterpolo Hub, Field Hockey Hub, Sportkijken, or IdleSports.
- Keep Games28 separate unless its own owner account and configuration are explicitly being changed.
- Never send form contents, policy names, care-cost inputs, filenames, email addresses, or other personal data to Umami events.
