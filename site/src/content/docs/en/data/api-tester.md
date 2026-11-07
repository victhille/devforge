---
title: API Tester
description: Send HTTP requests and read the response, with headers, body, preview and history.
---

The **API Tester** sends HTTP requests and shows the response.

## The request

- **Method**: GET, POST, PUT, PATCH or DELETE.
- **URL**: for example `https://api.example.com/users`.
- **Headers**: key / value pairs, **Add header**.
- **Body**: for example JSON `{ "key": "value" }`.

**Send** fires it.

## The response

At the top: **Status**, **Time** and **Size**. The tabs:

- **Preview** (for an HTML response): the rendered page, isolated and with scripts disabled;
- **Raw**: the response body;
- **Headers** of the response.

## History

The requests of the session are listed in **History** (method, path, status); a click puts the method and URL back in the form.

## With Forgy

On this page, Forgy receives the request and the response (sensitive headers masked). The **Analyze the API response** task explains a status, an error or a format. The routes of a Symfony, Next.js or Laravel project open here from the [workshop](/devforge/en/dev/projects/#framework-workshops).
