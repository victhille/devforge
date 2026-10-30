---
title: Modeling
description: Design your database and your app before coding — an MCD (Merise) drawn in DevForge, saved in the project and versioned with Git.
---

The **Modeling** page (*Data & API* menu) is for designing before coding. Models are kept **per project**: they are files of the project's `conception/` folder (`shop.mcd.json`…), so versioned with Git like the rest of the code.

## The page

- **The project picker**, top right: the active project by default.
- **The project's chain**: MCD → MLD → MPD → SQL → linked database, with the state of each. The MCD is there; the next steps come with the next versions.
- **The project's models**: a preview, the kind, the date, the file. A click opens the model; rename and delete on hover.
- **Create a model**: an **MCD** for now (UML diagrams and the rest follow).

## The MCD editor

An MCD describes the data the Merise way: **entities** (CUSTOMER, ORDER…) with their attributes, **associations** between them (PLACE, CONTAIN…) and the **cardinality** of each entity in each association.

| Action | How |
|---|---|
| Add an entity | **Entity** in the palette, or double-click the background |
| Add an association | **Association** in the palette |
| Link | **Link**, then an entity and an association (Esc to stop) |
| Change a cardinality | click it: 0,1 → 1,1 → 0,n → 1,n |
| Move | drag a part; dragging the background moves the view |
| Zoom | the wheel, or − / +; **Fit** shows everything |
| Delete | **Delete** on the chosen part |
| Undo, redo | **Ctrl+Z**, **Ctrl+Y** |

The right panel edits the chosen part: the name, the **attributes** (name, type, length of a short text) and those forming the **identifier** (underlined). An association can carry attributes (a quantity, a date…).

Every change is **saved on its own** in the project's file.

### Check

**Check** lists what would stop the next step (the MLD) or is worth a look: an entity without an identifier, a part without a name, two parts with the same name, an attribute without a type, an association linked to fewer than two entities, an entity linked to nothing. A click on a line picks the part.

### Export

**PNG** or **SVG** saves the MCD as an image.
