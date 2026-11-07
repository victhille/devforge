---
title: Explore a SQLite database
description: Step-by-step guide to add a project's database, browse its tables, understand its structure and query it, alone or with Forgy.
---

Your project has a SQLite database and you want to see what is inside, without installing an SQL client.

**You need**: a project with a SQLite file (`.db`, `.sqlite`). About 5 minutes.

## 1. Add the database

**Database** page, **+**: type **SQLite**, then pick the database file. **Test connection** checks that it opens.

For PostgreSQL or MySQL, **Find databases** finds on its own those described in your projects' `.env` files or installed on your servers.

## 2. Browse a table

Pick the connection: the list of tables shows, filterable. Click a table: the **Browse** tab shows the rows page by page. Click a column to sort.

![A SQLite table in the Browse tab](../../../../assets/screens/database-en.png)

## 3. Understand the structure

- **Structure**: the columns (type, null, default, key) and indexes.
- **Relations**: foreign keys to other tables, and tables pointing to this one.
- The **Database** tab sums it all up: number of tables, views and rows, indexes and foreign keys.

## 4. Write a query

**New query** opens an SQL editor. <kbd>Ctrl</kbd> <kbd>Enter</kbd> runs it:

```sql
SELECT status, COUNT(*) AS total
FROM orders
GROUP BY status
ORDER BY total DESC;
```

Results are limited to 1000 rows. A write query shows the number of rows changed.

## 5. Ask Forgy

With the page open, <kbd>Ctrl</kbd> <kbd>J</kbd> and ask: "Which customers placed more than three orders?". Forgy reads the tables' **structure**, never their data, and writes the query. It can run it for you after your approval, with guardrails: no `DROP`, no `DELETE` or `UPDATE` without `WHERE`.

## Going further

- [Database](/devforge/en/data/database/): PostgreSQL, MySQL, SSH tunnel.
- [Forgy's actions](/devforge/en/forgy/actions/#guardrails): every guardrail.
