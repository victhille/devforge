---
title: Database
description: A PostgreSQL, MySQL / MariaDB and SQLite client, finding the databases of your projects and servers, with SSH tunnels, editable tables and rows, CSV import and export.
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
| Browse | the rows, page by page, sortable by clicking a column; editable (see below), exportable, and a CSV imports into it |
| Structure | columns (type, null, default, key, extra, comment) and indexes; add, edit or drop a column, rename or drop the table (see below) |
| Relations | foreign keys to other tables, and tables pointing to this one |
| SQL | a query on this table |
| Info | rows, size (data and indexes), engine, collation, encoding, definition (DDL) |

## The schema

**Schema** (at the top of the explorer) opens the database full screen: each table as a card, with its columns, their type, the primary key 🔑 and the required columns (`!`). One arrow per foreign key goes from the column that points to the column pointed at.

- **Automatic layout**: the tables pointed at on the left, the ones pointing at them on the right, ordered so arrows cross little. Tables without links go below.
- **Move** a table: drag it by its title. Positions are kept for each database; **Rearrange** goes back to the automatic layout.
- **Navigate**: drag the background to move around, the wheel zooms, **Fit** shows everything. The **minimap** at the bottom right shows the part on screen; a click on it goes there.
- **Tables shown**: the list on the left checks and searches them; **+ neighbours** adds those linked to the checked tables. Over 60 tables, none is shown at first: check the ones you care about.
- A click on a table's title opens its **Structure**.
- **PNG** or **SVG** saves the schema as an image, in the theme's colours.

PostgreSQL (all schemas), MySQL / MariaDB and SQLite.

## Creating and changing tables

- **New table** (the **+** at the top of the tables list): its name and columns. An auto-incremented `id` column is ready; each column has a **type** (offered per database, or typed: `VARCHAR(255)`, `NUMERIC(10, 2)`…), a **default**, and the boxes **Required**, **Primary key**, **Auto-increment**.
- In **Structure**: **Add a column**, a column's pencil to edit it (name, type, default, required), its bin to drop it; **Rename the table**; **Drop the table**, which asks for its name typed again.

Each dialog first shows the **query about to run**; nothing runs before **Apply**. If the database refuses, its message stays on screen and nothing else runs.

A default is kept as is when it is a number, a keyword (`CURRENT_TIMESTAMP`, `NULL`, `TRUE`…), a function (`now()`) or a string already in quotes; otherwise it is quoted.

**SQLite** can only rename a column: to change its type, default or "Required", the dialog points to the **SQL** tab.

## Editing rows

In **Browse**, a table with a **primary key** is edited in place:

- **double-click** (or <kbd>Enter</kbd>) a cell to edit it; **NULL** in one click next to the field; <kbd>Esc</kbd> cancels;
- **Add a row**: an empty row at the top; a cell left empty keeps the column's default (an auto-increment, say);
- check rows, then **Delete**: they are struck through; **Keep** takes them back.

Pending changes are highlighted; while there are some, the page and the sort stay put. **Apply (n changes)** shows the `UPDATE`, `INSERT` and `DELETE` queries, then runs them **in one transaction**: if one fails, none is kept and the database's message stays on screen. **Drop the changes** forgets them.

Values travel as parameters, never pasted into the SQL. A table without a primary key, a view and the SQL tab's results stay read only; binary columns are not edited here.

## Import and export

- **Export** (in **Browse**) writes **the whole table** to a file, not just the page shown: **CSV**, **JSON**, **SQL** (`INSERT`s) or **SQL with CREATE TABLE**. Rows are read 1,000 at a time, in primary key order.
- A query's results can be saved too, as CSV or JSON, with the button next to **Copy**.
- **Import a CSV**: pick the file; the separator (`,`, `;`, tab, `|`) and the encoding (UTF-8, or Windows-1252 as Excel's CSVs) are recognised. Each column of the file goes into the table's column of the same name (case, spaces, `_` and `-` ignored); under each header you change it or skip it. The first 10 rows show; **An empty cell becomes NULL** is checked by default.
- The import runs **in one transaction**: if a row is refused (a required column empty, a duplicate key…), none is kept and the file's faulty line is given. 50 MB at most.

Files always go through Windows' save or open window.

## SQL queries

**New query** opens an SQL editor. <kbd>Ctrl</kbd> <kbd>Enter</kbd> runs it. Results are limited to 1000 rows; a write query shows the number of rows changed. Above the results, **CSV** or **JSON** picks the copy format (remembered): in JSON, one object per row.

## Elsewhere

- A database can be linked to a project: the **Database** tab of its [page](/devforge/en/dev/projects/#the-projects-database) explores it in place. **Open full size** leads here, and **← Back to** *project name* takes you back.
- [New Project](/devforge/en/dev/new-project/) adds the database it creates here.
- Forgy reads the structure of the tables (never the data) when this page is open, writes SQL and can run a query after your approval, with guardrails (see [Actions](/devforge/en/forgy/actions/#guardrails)).
