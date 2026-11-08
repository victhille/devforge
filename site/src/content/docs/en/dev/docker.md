---
title: Docker
description: Containers, images and Compose projects, locally and on your server, with live logs.
---

The **Docker** page drives this PC's Docker engine (Docker Desktop) and your servers' one.

:::note
[Docker Desktop](https://www.docker.com/products/docker-desktop/) must be running. Otherwise the page says "Docker is not available"; the state also shows in [Connections](/devforge/en/getting-started/connections/#docker).
:::

## This PC

At the top: Docker's version, the number of running containers and of images. The **This PC** tab shows this PC's Docker, and each server has its tab (beyond three servers, one **VPS** tab and a picker).

The menu on the left:

- **Compose**: each Compose project, with how many services are online. On the right, its services (image, ports, CPU, memory, state *online* or *stopped*) and the DevForge project it belongs to. **Start**, **Restart**, **Stop**, and **Remove containers** (volumes, so database data, are kept: the project can be started again). A project never started says so.
- **Others** › **Standalone containers**: the containers started without a Compose project, with start, stop, restart and remove (data not stored in a volume is then lost).
- **Others** › **Images**: the images, their date and size.

### Logs

Under the services, the **logs** of all the services of a project, **live**; a click on a service shows only its own. **Ask Forgy** hands the logs over to diagnose a crashing container.

### Clean up

**Clean up** removes stopped containers (except those of Compose projects), unused networks, dangling images and the build cache. Volumes are kept.

## On a server

A server's tab shows its Docker, through the SSH connection: its Compose projects and containers, with start, stop and restart; a click on a container shows its last log lines. If Docker cannot be reached on the server, the page shows the error.

## Elsewhere in DevForge

- The **Docker** tab of each [project page](/devforge/en/dev/projects/) shows its Compose project.
- The **Docker** widget on Home starts and stops Compose projects.
- [New Project](/devforge/en/dev/new-project/) can create a PostgreSQL or MySQL database in Docker.
- Forgy can propose to start, stop or restart a Compose project or a container ([Actions](/devforge/en/forgy/actions/)).
