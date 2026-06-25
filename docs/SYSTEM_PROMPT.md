## Context

You are building "Awaaz" — a civic issue reporting platform.

Stack:
- Frontend: React + Tailwind CSS
- Backend: Node.js + Express
- Database: Firebase Firestore
- Auth: Firebase Authentication (Google Sign-In)
- Storage: Firebase Storage
- AI: Google GenAI SDK (Gemini 2.5 Flash, server-side only)
- Deploy: Google Cloud Run

Rules you must never break:
- All API responses use { success: boolean, data: any, error?: string }
- Gemini API key is server-side only, never in frontend
- All frontend API calls go through /client/src/api.js only
- Never write DB calls inside UI components
- camelCase for all variables
- Never use legacy SDK versions
- Firebase ID token sent as Authorization: Bearer <token> on every protected request

## What Awaaz Is

Awaaz (Hindi: "Voice") is a hyperlocal civic accountability platform for India.
Citizens report local problems. Communities validate them. Authorities resolve them.
AI independently verifies the resolution before the issue can be closed.

The name means everything: citizens in India have always had complaints but rarely
a voice that gets heard. Awaaz gives them one — and then proves it was listened to.

---

## The One Problem We Solve

Most civic complaint portals are black holes.
A citizen files a report. It disappears. Nothing happens.
Or worse — it gets marked "resolved" when nothing was fixed.

Every design decision in Awaaz exists to solve this one problem.
Not just to collect complaints. To prove resolution.

This distinction must never be lost in implementation.
If a feature does not serve reporting, validating, or proving resolution —
it does not belong in this product.

---

## Core Thesis

**Proving resolution, not just reporting.**

This is not a tagline. It is the architectural constraint.

- Issues cannot be closed by one person (admin).
- Issues cannot be closed without proof (resolution photo).
- Issues cannot be closed without independent verification (Truth Engine).
- Issues cannot be closed without community confirmation (3 members).

Every one of these layers exists because each one alone can be gamed.
Together, they make fake resolution nearly impossible.

---

## What Awaaz Is NOT

Understanding what we are not is as important as knowing what we are.

| What it is NOT | Why this matters in code |
|---|---|
| Not a complaint box | Do not design flows that end at submission |
| Not a government portal | Do not use bureaucratic, formal UI language |
| Not a social media app | Engagement is a means, not the goal |
| Not an AI chatbot | AI acts on data, it does not converse with users |
| Not a reporting dashboard | Analytics are secondary to the action loop |

---

## The Four Pillars

Every feature in Awaaz maps to one of these four pillars.
If a feature does not map to any of them, it should not be built.

### 1. Report Problems
Citizens submit evidence of civic failures.
The barrier must be as low as possible — photo, description, location.
AI handles categorization so the citizen does not have to.
Speed and simplicity over completeness.

### 2. Build Consensus
Individual complaints are noise. Community-validated issues are signal.
Endorsements transform a personal grievance into a collective demand.
The community brief synthesizes that demand for the person who must act.

### 3. Create Accountability
Every status change is recorded. Every resolution attempt is logged.
Nothing can be quietly swept under the rug.
Issue DNA is the institutional memory that makes history visible.
An issue resolved and reopened three times tells its own story.

### 4. Empower Citizens
The platform does not stop at the app.
The AI complaint letter bridges digital reporting with real-world action.
A citizen should be able to go from "I reported this" to
"I emailed the Ward Commissioner a formal letter" in under one minute.

---

## The Two AI Agents — Philosophy

AI in Awaaz is not a feature. It is the accountability infrastructure.
Both agents exist to do something humans cannot do fairly or consistently.

### Community Intelligence Agent
**Why it exists:** Admins are busy. Reading 40 raw comments before acting
on an issue is not realistic. Important context gets missed. Action is delayed.
The agent synthesizes community voice into a brief the admin can act on immediately.

**Design constraint:** The agent amplifies human input, it does not replace it.
Community members still write the comments. The agent only synthesizes.
Never let the agent generate content that did not come from real user input.

### Truth Engine
**Why it exists:** Admins can mark anything resolved. There is no technical
barrier to closing an issue without fixing it. The Truth Engine is the
independent check that humans in a position of authority cannot self-administer.

**Design constraint:** The Truth Engine verdict is advisory, not final.
It informs the community confirmation step — it does not replace it.
Even a "confirmed" verdict still requires 3 community members to close the issue.
The AI is a witness, not a judge.

**The reasoning trace must always be visible.**
Judges and users must be able to see how the verdict was reached.
A black-box verdict is just another authority that cannot be questioned.
That defeats the entire purpose of this product.

---

## Issue DNA — Philosophy

Issue DNA is not a feature. It is a principle.

Every issue has a history. That history must never be hidden, reset, or forgotten.
When an admin marks an issue resolved for the third time,
every member of that community should be able to see it was marked resolved twice before.

This creates a form of institutional memory that no single person controls.
The data itself becomes the accountability mechanism.

**In implementation:** dna fields must be updated atomically with every status change.
Never let a status change happen without updating the corresponding DNA field.
reopenCount is especially critical — it feeds the priority score penalty
and the Truth Engine history check.

---

## Priority Score — Philosophy

Issues are not equal. Some affect 2 people. Some affect 2000.
Some have been ignored for a week. Some have been ignored for two years.
Some have been fake-resolved repeatedly.

The priority score exists so that the most impactful, most neglected,
most abused issues automatically surface to the top of the admin queue.
No manual curation. No favoritism. The data decides.

**The reopen penalty is intentional and important.**
An issue with reopenCount = 3 gets +15 on its priority score.
This means every fake resolution makes the next real resolution harder to ignore.
Negligence compounds. The score reflects that.

---

## Resolution Proof Score — Philosophy

Three layers. Each one exists because the previous one alone can be gamed.

**Layer 1 — Admin marks resolved + uploads proof photo**
Minimum bar. Anyone can upload an unrelated photo.
Necessary but not sufficient.

**Layer 2 — Truth Engine independently verifies**
AI compares before and after photos, checks neighborhood context,
checks resolution history. Cannot be manually triggered or overridden without trace.
Adds an objective check. But AI vision is not infallible.

**Layer 3 — Community confirms**
Three real humans who live near the issue confirm the fix.
The people most affected have final say.
This layer cannot be bypassed regardless of the Truth Engine verdict.

Only when all three layers complete does the issue close.

---

## UI Philosophy — Social Feed Pattern

Awaaz looks like a social media app deliberately.

**Why:** Civic engagement apps fail because citizens do not return to them.
A familiar social feed pattern reduces friction. Users already know how to use it.
The feed is interesting, active, and personalized — not a static list of complaints.

**Three-column layout:**
- Left sidebar: navigation and groups (your context and community)
- Center feed: issues from your world (the action space)
- Right sidebar: stats and activity (proof the platform is working)

**The feed must always feel alive.**
Empty states are death for a civic app. Seed realistic data for demo.
Use relative timestamps ("3 hours ago", not "14:32:07").
Show endorsement counts prominently — social proof drives more endorsements.

**Role differentiation is visual, not navigational.**
An admin and a member see the same URL, the same layout, the same issue.
The difference is what appears inside the issue card:
- Member: Endorse button, Complaint Letter button
- Admin: green left border, Community Brief indicator, status controls

Never create separate portals or separate login flows for different roles.
The platform is one community. The roles are context within it.

---

## Language and Tone

Awaaz is for Indian citizens reporting real problems in their communities.
The language must reflect that.

**In UI copy:**
- Use plain, direct English. No jargon.
- Action-oriented: "Report an issue" not "Submit a complaint"
- Community-first: "23 people in your area confirmed this" not "endorsementCount: 23"
- Humanize AI outputs: "Truth Engine found this suspicious" not "verdict: suspicious"

**In error messages:**
- Never blame the user.
- Always suggest what to do next.
- "Could not upload image — try a smaller file" not "Error 413"

**In AI-generated content (complaint letters, community briefs):**
- Formal where it matters (the letter to the commissioner)
- Human where it matters (the brief for the admin)
- Never robotic. Never generic.

---

## Gamification Philosophy

Ranks and points are secondary mechanics, not primary motivation.
Citizens should report issues because they care about their community,
not because they want points.

Gamification exists to:
- Acknowledge contribution publicly
- Give returning users a sense of progress
- Surface the most active community members

It should never:
- Gate features behind rank requirements
- Create competition that discourages new reporters
- Feel like the point of using the app

Ranks in order: Citizen → Contributor → Jan Sevak → Community Hero
Jan Sevak (Public Servant) is the aspirational middle rank —
it carries cultural weight in the Indian civic context.

---

## What a Good Implementation Feels Like

When built correctly, a user should be able to:

1. See an open manhole on their street
2. Open Awaaz, upload a photo, submit in under 60 seconds
3. Watch their community endorse the issue
4. Receive a ready-to-send formal complaint letter with one tap
5. Get notified when the admin acts
6. See the Truth Engine's verdict on the resolution
7. Confirm or reject the fix themselves
8. Know with certainty whether the problem was actually solved

That end-to-end experience — from frustration to confirmed resolution —
is the product. Every line of code serves that journey or it does not belong.

---

## Hackathon Context

- Competition: Coding Ninjas x Google for Developers
- Mandatory: Google AI Studio, Gemini API, deployed via Cloud Run
- Solo build
- Evaluation weighted heavily on: Agentic Depth (20%), Problem Solving (20%), Innovation (20%)

**What wins:** A smaller app that works completely and tells a clear story.
Not a large app with half-working features.

The winning demo flow is:
Report → AI categorizes → Duplicate/DNA shown → Community endorses →
Agent briefs admin → Admin resolves → Truth Engine verifies →
Community confirms → Issue closed with full audit trail visible.

Every feature built must serve this demo flow.
Features that do not appear in this flow are cut.
