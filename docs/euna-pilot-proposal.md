# Proposal: "EUNA Pilot" — an assistant that can actually use the dashboard

**Presenter's note:** this is the boss-friendly version. The engineering detail lives in
`docs/euna-pilot-plan.md` and the research it's based on in `docs/euna-pilot-report.md`.

---

## The problem

Our dashboard is good, but every new teacher still has to *learn* it — and every
"where do I click to…?" question lands on someone. Meanwhile, the AI features we
already have answer questions, but none of them can *show* a teacher anything or *do*
anything for them. They talk; they don't walk.

## The idea

Put EUNA on the teacher side with one new ability: **she can take control of the page**.
A teacher types what they want in plain English —

- *"Is there a student named Andrew in my class?"* → she checks and answers.
- *"Show me Anna's grades."* → she opens the gradebook and points at Anna's row.
- *"How do I remove a student?"* → she walks them through it, pointing at each button.
- *"Remove Andrew from my class."* → she does it — with the teacher's OK, and the
  teacher presses the final Remove button themselves.

And while she does it, you *see* her do it: a cursor glides across the screen, the
thing she's touching lights up, and she explains every step in the chat. That visible
part is what makes it feel alive — it's also the part that builds trust, because
nothing happens invisibly.

## The one rule that keeps it out of trouble

**EUNA Pilot never writes learning content.** Lessons, quizzes, modules — that stays
with our existing AI generation studio, which is built for that job. If a teacher asks
her to "make a quiz", she says so, walks them to the studio, and hands off. She is a
guide and an operator, not a second content engine. That boundary is written into the
system, not just prompted.

What she does instead, in three lanes:

| Lane | What it means | Examples |
|---|---|---|
| **Show** | Take me there | "Open Anna's grades" |
| **Tell** | Answer or walk me through it | "Is Andrew in my class?", "How do I delete a class?" |
| **Do** | Operate the page for me — with my OK | "Remove this student", "Set up an empty quiz" |

## Safety, in plain terms

- **Nothing destructive is ever finished by the AI.** It can open the confirmation
  dialog for "remove student" or "delete class" — but the teacher's own click is the
  one that confirms. The AI's finger never lands on that button.
- **Anything that changes data needs one explicit "Take the wheel" approval** first,
  and every step is narrated on screen as it happens.
- **A big stop button** interrupts her at any moment, and every action she takes is
  written to an audit log.
- **She only sees and touches what that teacher is allowed to** — the same school-wide
  permissions teachers already have apply to her, on the server, not on her honor.
- If the AI service is down, she simply isn't there. The dashboard never breaks
  because of her.

## What it's worth

- **Onboarding time drops.** New teachers are walked through the real UI, not a manual.
- **Support questions drop.** "Where do I…" becomes a chat message, answered by
  pointing at the actual buttons.
- **A demo that stuns.** Watching the AI take the wheel is the single most impressive
  thing we can show a school administrator — and it's built on the AI plumbing we
  already run, so the incremental cost is engineering time, not new infrastructure.
- **It reuses what we have.** Same AI service, same login/permissions, same design
  system. We are not bolting on a second product.

## Timeline (each phase ends in something you can see)

| Phase | What you get | When |
|---|---|---|
| **A. The alive demo** | EUNA's cursor touring a real class page, pointing things out | days |
| **B. She answers & guides** | The lookup/guide questions: Andrew, Anna's grades, "how do I…" | ~1 week |
| **C. She operates** | "Take the wheel" for real tasks, with the approval + audit machinery | ~1 week |
| **D. Power features** | Bulk operations, voice narration, autonomy settings | later |

**Recommendation:** approve Phase A now — it's frontend-only, carries zero risk to
teacher data, and gives us the demo footage to decide on B/C with our own eyes.

---

*Ask me anything about the how — but the short version is: we studied the best
implementation of this on the market, down to its network protocol, and we're building
the same experience, tailored to our stack and our safety rules.*
