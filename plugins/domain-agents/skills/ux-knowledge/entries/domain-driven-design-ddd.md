# Domain-Driven Design (DDD)

Ref: `UX:domain-driven-design-ddd` · Category: method · Entry version: 1
Source: ui-ux-design-guide Seite 95. Provenance: bulk extraction 2026-07-02, migrated to Orbit 2026-09-02 (riedl/nsai/doktrin/UX-domain-driven-design-ddd.json); content unverified against a primary source. Treat figures and legal statements as unverified until checked.

Domain-Driven Design (DDD) is a software development approach that helps teams create software aligned with a business's needs and requirements. It focuses on breaking down complex business domains (the subject matter and context in which a business operates) into components that can be implemented in software.

- Ubiquitous Language: shared language and vocabulary between business stakeholders and developers
- Bounded Contexts: breaking a domain into smaller subdomains, each with its own language, models, and constraints
- Entities and Value Objects: entities have unique identity and change over time; value objects represent a value or concept (e.g. a date or currency)
- Aggregates: collections of entities and value objects treated as a single unit for consistency and integrity
- Domain Events: occurrences within the domain (e.g. order placed, product shipped) that can trigger actions
