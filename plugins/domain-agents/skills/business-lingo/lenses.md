# Lenses for plans

The checklist that replaces the former principle-guard role. Run it when a plan touches staffing, team structure, interfaces, complexity or the removal of something. The devils-advocate pass carries the decision lenses; the orchestrator carries the structure lenses.

A lens "applies" when its situation is present in the plan with a locator. A finding is "applies and the plan has no countermeasure" or "applies and the countermeasure does not cover every locator"; otherwise nothing is reported. These are heuristics, not laws that can be violated; a deliberate decision against a lens is allowed when the decider records it with a reason. Several lenses pull in opposite directions by design (move fast versus Chesterton's fence); name the tension, do not pick one silently.

## Decision lenses (devils-advocate pass)

| Lens | Entry | Applies when |
|---|---|---|
| Sunk cost fallacy | `BL:sunk-cost-fallacy` | the reason to continue is what was already spent |
| Pareto principle | `BL:pareto-principle` | effort is spread evenly over items of unequal value |
| Chesterton's fence | `BL:chestertons-fence` | something is removed or replaced before its purpose is understood |
| Good enough for now | `BL:good-enough-for-now-gefn` | the plan optimises past the point the task needs |

## Structure lenses (orchestrator, planning)

| Lens | Entry | Applies when |
|---|---|---|
| Brooks' law | `BL:brooks-law` | people are added to a late project |
| Conway's law | `BL:conways-law` | the system structure is designed without the team structure that will own it |
| Law of conservation of complexity | `BL:law-of-conservation-of-complexity` | complexity is moved from one party to another and presented as removed |
| Hyrum's law | `BL:hyrums-law` | an interface with consumers is changed on the assumption that only the documented contract is used |
| Principle of least knowledge | `BL:principle-of-least-knowledge` | a component reaches through others' internals |
| Metcalfe's law | `BL:metcalfes-law` | value is assumed to scale linearly with a network |
| Gresham's law | `BL:greshams-law` | a cheap signal is allowed to displace a costly one (metrics, reviews) |
| Culture eats strategy for breakfast | `BL:culture-eats-strategy-for-breakfast` | a plan relies on behaviour change without a change in incentives |
| Move fast and break things | `BL:move-fast-and-break-things` | speed is chosen in a domain where breakage is irreversible |
| Tragedy of the commons | `BL:tragedy-of-the-commons` | a shared resource (build, pipeline, budget) has no owner |
