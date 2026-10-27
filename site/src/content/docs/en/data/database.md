---
title: Database
description: A PostgreSQL, MySQL / MariaDB and SQLite client, finding the databases of your projects and servers, with SSH tunnels.
---

The **Database** page is a client for **PostgreSQL**, **MySQL / MariaDB** and **SQLite**. Passwords are encrypted by Windows.

## Adding a connection

**+** opens the form:

| Field | Detail |
|---|---|
| Type | PostgreSQL, MySQL / MariaDB or SQLite |
| Name | optional, defaults to `database@host` |
| Host, port, user, password, database | for PostgreSQL and MySQL |
| SQLite file | for SQLite |
| Connect through | **Direct connection**, or an SSH server: the connection then goes through an **SSH tunnel**, nothing to open on the server. Host and port are those seen from the server (`127.0.0.1` for a local service) |

**Test connection** checks before saving.

## Find databases

**Find databases** looks for databases to add without typing anything:

- **On a server (SSH)**: Docker PostgreSQL / MySQL / MariaDB containers (credentials read from their config) and services installed on the server. These databases go through an SSH tunnel.
- **In your projects (.env)**: the databases described in your projects' `.env` files.

**Add** saves a database found. The *Databases on this server* button of the [SSH](/devforge/en/servers/ssh/) page opens this search directly.

## Explore

![A SQLite table in the Browse tab](../../../../assets/screens/database-en.png)

Pick a connection: the list of tables (filterable) shows. The **Database** tab sums up the server, the database, the number of tables, views and rows (estimate), indexes and foreign keys.

For a table:

| Tab | Content |
|---|---|
| Browse | the rows, page by page, sortable by clicking a column |
| Structure | columns (type, null, default, key, extra, comment) and indexes |
| Relations | foreign keys to other tables, and tables pointing to this one |
| SQL | a query on this table |
| Info | rows, size (data and indexes), engine, collation, encoding, definition (DDL) |

## SQL queries

**New query** opens an SQL editor. <kbd>Ctrl</kbd> <kbd>Enter</kbd> runs it. Results are limited to 1000 rows; a write query shows the number of rows changed.

## Elsewhere

- A database can be linked to a project (the **Database** tab of its [page](/devforge/en/dev/projects/)).
- [New Project](/devforge/en/dev/new-project/) adds the database it creates here.
- Forgy reads the structure of the tables (never the data) when this page is open, writes SQL and can run a query after your approval, with guardrails (see [Actions](/devforge/en/forgy/actions/#guardrails)).
