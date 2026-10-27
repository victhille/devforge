---
title: Docker
description: Containers, images and Compose projects, locally and on your server, with live logs.
---

The **Docker** page drives this PC's Docker engine (Docker Desktop) and your servers' one.

:::note
[Docker Desktop](https://www.docker.com/products/docker-desktop/) must be running. Otherwise the page says "Docker is not available"; the state also shows in [Connections](/devforge/en/getting-started/connections/#docker).
:::

## Local

At the top: Docker's version and the number of running containers. Two views:

- **Compose**: each Compose project with its services (image, ports, status, CPU), its state (*online*, *stopped*, *Never started*) and the DevForge project it belongs to. **Start**, **Stop**, **Restart**, and **Remove containers** (volumes, so database data, are kept: the project can be started again).
- **Standalone**: standalone containers, with start, stop, restart and remove (data not stored in a volume is then lost).

An **Images** view lists the images.

### Logs

**Logs** opens the logs of a container or of all the services of a project, **live**. **Ask Forgy** hands the logs over to diagnose a crashing container.

### Clean up

**Clean up** removes stopped containers (except those of Compose projects), unused networks, dangling images and the build cache. Volumes are kept.

## On a server

The **VPS** tab shows the Docker of an SSH server: its containers and their logs, through the SSH connection. If Docker cannot be reached on the server, the page shows the error.

## Elsewhere in DevForge

- The **Docker** tab of each [project page](/devforge/en/dev/projects/) shows its Compose project.
- The **Docker** widget on Home starts and stops Compose projects.
- [New Project](/devforge/en/dev/new-project/) can create a PostgreSQL or MySQL database in Docker.
- Forgy can propose to start, stop or restart a Compose project or a container ([Actions](/devforge/en/forgy/actions/)).
