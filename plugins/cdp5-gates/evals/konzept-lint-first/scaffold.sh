#!/bin/sh
# A thin concept document: it has a head and one use case, but no numbered steps, no error-case table, no AC table,
# no glossary and no changelog, so several deterministic gate items of the maturity policy are open.
set -e
mkdir -p docs
cat > docs/konzept.md <<'EOF'
# Concept: Invoice reminder service

**Version:** 2.1 · **Scope:** reminders for unpaid invoices of small businesses.

## 1. Goal

Customers with an unpaid invoice receive a reminder by e-mail after the due date.

## 2. Use Cases

### UC-01 Send a reminder

**Actor:** scheduler · **Route:** /internal/reminders/run

The scheduler looks for invoices past their due date and sends one reminder per invoice. A reminder is not sent twice. The e-mail text comes from a template.

## 3. Roles

| Role | Responsibility |
|---|---|
| Accountant | maintains the invoice list |
| System | sends reminders |
EOF
