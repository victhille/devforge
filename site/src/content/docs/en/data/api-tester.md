---
title: API Tester
description: Send HTTP requests and read the response, with headers, body, preview and history.
---

The **API Tester** sends HTTP requests and shows the response.

## The request

- **Method**: GET, POST, PUT, PATCH or DELETE.
- **URL**: for example `https://api.example.com/users`.
- **Params**: the URL's query, one row per parameter; what you change here is written into the URL, and the other way round. Untick a row to take it out of the URL without losing it.
- **Headers**: key / value pairs to tick, **Add a header**.
- **Body**: for example JSON `{ "key": "value" }` (not for a GET).
- **Auth**: a **Bearer** token or a **Basic** user and password, sent as an `Authorization` header (unless you already ticked one). Nothing is kept.

**Send** fires it.

## The response

At the top: the status, the time and the size. On the right:

- **JSON** (for a JSON response): the body indented;
- **Raw**: the body as received;
- **Headers** of the response;
- **Preview** (for an HTML response): the rendered page, isolated and with scripts disabled.

## History

The **History** panel, on the left, lists the requests sent (method and path, the status when it failed), from one session to the next: only the method and URL are kept, never the headers or the body. A click puts the method and URL back in the form; **+** starts from an empty request, **Clear the history** empties the list.

## With Forgy

On this page, Forgy receives the request and the response (sensitive headers masked). The **Analyze the API response** task explains a status, an error or a format. The routes of a Symfony, Next.js or Laravel project open here from the [workshop](/devforge/en/dev/projects/#framework-workshops).
