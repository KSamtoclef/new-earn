# Admin performance: latest 50 real users

The Performance tab is intentionally limited to the latest 50 registered users by real recorded activity.

It uses:

- `profiles` for registration, chats, shares, KYC and first withdrawal state
- `presence_sessions` for session count and real time spent
- `sponsored_events` for recorded ad views and opens
- `auth.users` for registration email

The dashboard does not invent missing values and does not delete older database records. Limiting the query and rendered list to 50 avoids loading unnecessary history while preserving analytics for later audits.
