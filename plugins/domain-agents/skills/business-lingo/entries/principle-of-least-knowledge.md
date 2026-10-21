# The Principle of Least Knowledge (The Law of Demeter)

Ref: `BL:principle-of-least-knowledge` · Category: principle · Entry version: 1
Source: business-lingo-guide Seite 70. Provenance: bulk extraction 2026-07-02, migrated to Orbit 2026-09-02 (riedl/nsai/doktrin/BL-principle-of-least-knowledge.json); content unverified against a primary source. Treat figures and legal statements as unverified until checked.

A software engineering principle promoting modular design: an object should have limited knowledge about other objects and communicate only with a select few of its immediate neighbors. This reduces coupling between modules and improves maintainability and scalability. For example, object A should reach object C only through its neighbor B rather than directly. It is named after the Demeter Project, an adaptive/aspect-oriented programming effort honoring the Greek goddess of agriculture, signifying a bottom-up philosophy of programming.

- Objects should only communicate with their direct neighbors, not reach through them
- Reduces coupling between modules
- Improves maintainability and scalability; changes to one module less likely to affect others
- Encourages abstraction and encapsulation
- Named after the Demeter Project (adaptive/aspect-oriented programming)
