# ChatEarn UI preservation contract

## Reference

The only product-design reference is the live `https://chat-earn.xyz` experience and its source in this repository. The unrelated generic deployment is excluded.

## Elements that must remain recognizable

- Black mobile-first page background with bright ChatEarn green accents.
- Existing ChatEarn wordmark, rounded cards, green action buttons, status indicators, balance header, typography hierarchy, and spacing character.
- Landing headline, language/flag treatment, earnings presentation, and primary call to action.
- Full-page registration presentation and existing login sheet behavior.
- Dashboard header, signup-bonus card, journey progress strip, partner cards, earnings-per-reply labels, and current navigation order.
- Chat header, message bubbles, typing state, composer, suggestions, wallet visibility, and return behavior.
- Earnings, withdrawal, sharing, KYC, processing, and returning-user screens.
- Existing admin concepts, adapted only for pagination, lazy loading, clearer state, and secure actions.

## Allowed improvements

- Accessibility labels, keyboard focus, readable error states, safe-area spacing, and reduced-motion support.
- Safari/Chrome viewport fixes and layout stability.
- More natural deterministic conversations and matching suggestions.
- Large inline sponsored cards inside the message timeline.
- A large inline withdrawal gate card inside chat.
- Faster loading, modular event ownership, and fewer database calls.
- Clear pending/processing/resume state without changing brand identity.

## Prohibited changes

- Generic dashboard or SaaS styling.
- A new brand palette, light theme, or unrelated navigation model.
- Floating reward popups, tiny bonus modals, or dismissible sponsored windows.
- Client-calculated balances or client-selected reward amounts.
- Random partner responses unrelated to the latest user message.
- Critical journey progress held only in local/session storage.
- Multiple active reward engines or overlapping click/focus/pageshow listeners.

## Visual acceptance

Each rebuilt screen requires side-by-side mobile comparison with the live site at representative iPhone and Android widths. A screen passes when identity, structure, content hierarchy, and primary interactions remain equivalent, while the approved reliability and accessibility improvements are visible.
