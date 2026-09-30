# Delp Beans

Delp Beans is a lightweight starter app for organizing weekly one-to-one introductions.

## Run locally

Open `index.html` in a browser. No package manager, build step, or server is required.

## What’s included

- Add and remove club members.
- Add or edit each member’s job role inline; roles are used to prefer cross-functional pairs.
- Create one matching round per calendar week.
- Simulate the next week with the developer-mode control, or return to the live calendar week.
- Prefer pairs with less pairing history, and prefer people who have gone longest without being paired together.
- Show meeting totals, unique connections, cross-functional match counts, and a role-to-role interaction heatmap.
- Use keyboard shortcuts: `A` add a person, `P` create pairs, `W` simulate a week, and `R` reset to the live week. Shortcuts are ignored while typing in a field.
- Rotate the sit-out among members when there’s an odd number of people.
- Keep a visible history of past rounds.

The current scaffold stores its data in the browser’s `localStorage`, including the simulated week offset. It is a single-device prototype: data is not shared between users or devices. A hosted multi-user app will need a backend, authentication, and a shared database.
