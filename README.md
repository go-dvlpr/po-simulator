# Product Owner Simulator

A browser game for practicing product ownership: take an IT product from an idea to a Series A round in 18 in-game months. The UI is available in Ukrainian (default), Russian and English; the language picker is next to the theme switch.

Five scenarios:

- **FitLoop** — B2C subscription fitness app (US/UK).
- **ShiftMate** — B2B SaaS for shift scheduling in small businesses (US).
- **TalkTrail** — B2C spoken-English app with an AI conversation partner (Europe and Latin America).
- **Clearpenny** — B2C personal-finance app with bank sync, freemium vs trial (US).
- **Owlert** — B2B product-led dev tool: error tracking and uptime alerts, price per seat (US and Europe).

Each game randomizes the hidden market (which segment is best, real willingness to pay, feature value, true A/B effects), plus a market climate (ad prices, demand, willingness to pay, churn) and the CEO's style (how trust reacts, how often the CEO pushes ideas). Research and experiments matter and every run is different.

Every term a learner may not know has a "?" hint (`src/ui/glossary.ts`), every page explains what to do there, and a phase checklist in the top bar suggests the next step.

## Phases

1. **Discovery** — hypothesis board with success criteria; desk research, competitor analysis, interviews (open vs leading questions), surveys with Van Westendorp, smoke test / fake door, prototype test, concierge MVP.
2. **Strategy** — target segment, value proposition, North Star Metric, pricing model.
3. **Setup** — MVP scope (ICE, Kano), tech stack (build vs buy, monolith vs microservices, analytics, A/B platform), hiring (in-house / outsourcing / freelance), launch date commitment.
4. **Build** — 2-week sprints, velocity, tech debt, bugs, overtime, random events.
5. **Launch** — closed beta, launch checklist, soft / big / quiet launch.
6. **Growth** — monthly turns: channel budgets with diminishing returns, attribution gaps, A/B tests (sample size, p-value, CI, peeking, SRM, novelty, guardrails, extending a test after a peek), test ideas unlocked by research, features released behind feature flags, feature usage (with selection bias), quarterly OKRs checked at board meetings, North Star tracking, continuous discovery, a biased inbox of reviews and requests, CRM, price changes for new customers only, a Pro plan, B2B sales pipeline and NRR, cohorts, unit economics against market norms, pivots, fundraising. On top of that: live competitors that copy features and cut prices, compliance work (GDPR, COPPA, SOC 2, bank review), market expansion, stakeholders (CTO, sales, marketing, support) whose relations change the results, a budget of the PO's own hours per turn, mixed-quality traffic, failed payments and dunning, refunds, support load and CSAT, bridge rounds that dilute the company, early Series A, overlapping A/B tests, result slices and holdout groups.
7. **Debrief** — score, Series A criteria, top mistakes with handbook links, history of played games, the hidden truth compared with your decisions, and replay from checkpoints (phase starts and board meetings).

## Run

```bash
npm install
npm run dev
```

Other scripts:

```bash
npm test          # engine and translation tests (node:test, no extra dependencies)
npm run typecheck
npm run build     # static build in dist/
```

The game is frontend-only and autosaves to `localStorage`.

## Structure

- `src/engine` — pure simulation: world generation and save migration, research, product model, monthly market simulation, experiments, OKRs (`okr.ts`), user feedback (`inbox.ts`), events, scoring, reducer. `autoplay.ts` holds scripted players used by balance tests.
- `src/data` — scenarios, tech options, roles, research methods, events, launch checklist, handbook articles.
- `src/ui` — React screens and panels.
- `src/i18n` — translations. Player-facing text is written in Russian and wrapped in `t('…')`; `{0}`, `{1}` are placeholders. `uk.ts` and `en.ts` map the Russian strings to translations, and only the chosen language's dictionary is loaded. When you add or change a string, add it to both dictionaries: `npm test` fails on missing or unused entries.
