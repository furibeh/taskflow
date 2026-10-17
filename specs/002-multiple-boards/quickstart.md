# Quickstart: Validación de múltiples tableros

**Plan**: [plan.md](./plan.md) | **Contrato**: [contracts/openapi.yaml](./contracts/openapi.yaml)
| **Modelo**: [data-model.md](./data-model.md)

Guía para comprobar de extremo a extremo la feature 002 tras `/speckit-implement`. Los
requisitos previos y la configuración base son los de
`specs/001-kanban-task-board/quickstart.md` (secciones 1–3); aquí solo se indica lo nuevo.

## 1. Configuración nueva

Variables opcionales en `.env` (ver `.env.example`):

| Variable | Por defecto | Efecto |
|---|---|---|
| `BOARD_CREATION_ENABLED` | `true` | `false` oculta "Crear tablero" y la API responde `403 BOARD_CREATION_DISABLED` (FR-106) |
| `BOARD_CREATION_PER_HOUR` | `10` | Creaciones nuevas por IP y hora (mínimo 1, FR-105) |

## 2. Actualización de una instalación existente (FR-118, SC-105)

1. Con la versión anterior en marcha, guardar el enlace del tablero y crear alguna tarea y
   persona.
2. `docker compose up --build`: el servicio `migrate` aplica `0005_board_name`.
3. Abrir el enlace guardado: mismas tareas y personas; la cabecera muestra "Mi tablero".

## 3. Pruebas automatizadas

```bash
docker compose up -d db-test
npm test               # incluye aislamiento entre tableros, creación idempotente y migración 0005
npm run test:e2e       # recorridos nuevos de crear, renombrar y borrar, a escritorio y 320 px, con axe
npm run lint && npm run lint:deps && npm run typecheck
```

Resultado esperado: todo en verde (constitución: ninguna tarea se da por terminada si falla).

## 4. Validación manual

| # | Escenario | Pasos | Resultado esperado |
|---|---|---|---|
| 1 | Inicio sin enlace (US1) | Abrir `http://localhost:5173/` | Pantalla de inicio con "Crear tablero" y explicación del enlace |
| 1b | Primer uso en < 60 s (SC-101) | Cronometrar a una persona que no conoce TaskFlow desde que abre `/` hasta que ve su primera tarea en el tablero nuevo, sin instrucciones | Menos de 60 s, copiando el enlace por el camino |
| 2 | Crear tablero (US1) | Crear "Equipo Diseño" | Aviso con el enlace, "Copiar enlace", "Abrir tablero" y "Guarda este enlace: no se volverá a mostrar" |
| 3 | Nombre inválido (US1) | Crear con "   " y con 61 caracteres | Mensaje junto al campo; no se crea nada |
| 3b | Respuesta perdida al crear (FR-104) | Con las herramientas de desarrollo, bloquear la respuesta de `POST /api/v1/boards` (o detener la API justo después) y pulsar "Reintentar" | No se crea un segundo tablero; se muestra "El tablero se creó, pero no se pudo mostrar su enlace. Crea otro tablero." |
| 4 | Cerrar sin copiar (FR-103a) | Crear otro tablero y cerrar el aviso sin copiar ni abrir | Pregunta "No podrás volver a ver este enlace. ¿Cerrar de todos modos?"; "Cancelar" mantiene el aviso |
| 5 | Copiar y abrir (US1) | "Copiar enlace" y después "Abrir tablero" | Se anuncia la copia; tablero vacío con "Equipo Diseño" en la cabecera y en el título de la pestaña |
| 6 | Aislamiento (US2) | En "Equipo Diseño" crear la tarea "Solo A" y la persona "Ana"; crear el tablero B y abrirlo | B no muestra "Solo A" ni ofrece "Ana"; en B se puede añadir otra "Ana" |
| 7 | Regenerar no afecta a otros (US2) | Regenerar el enlace de A | El enlace de B sigue funcionando |
| 8 | Renombrar (US3) | "Cambiar nombre" → "Diseño y UX"; recargar en otro navegador | Nombre nuevo en cabecera y pestaña en ambos |
| 9 | Fallo al renombrar (US3) | `docker compose stop api`; renombrar | Tras ≤ 10 s, error con "Reintentar"; el nombre no cambia y se conserva lo escrito |
| 10 | Borrar (US4) | "Borrar tablero" en A | Confirmación con nombre y nº de tareas y personas; el botón solo se activa al escribir el nombre exacto |
| 11 | Tras borrar (US4) | Confirmar el borrado; abrir el enlace de A en otra pestaña | Inicio con "Tablero «Diseño y UX» borrado"; el enlace muestra "Enlace no válido" con "Crear un tablero nuevo" |
| 12 | Límite de creación (FR-105) | `BOARD_CREATION_PER_HOUR=2`, reiniciar la API y crear 3 tableros | El tercero muestra "Has creado demasiados tableros. Inténtalo más tarde." |
| 13 | Creación desactivada (FR-106) | `BOARD_CREATION_ENABLED=false`, reiniciar la API y abrir `/` | Sin "Crear tablero"; el texto indica pedir el enlace al equipo |
| 14 | Teclado, lector y 320 px (SC-107) | Repetir 2, 8 y 10 solo con teclado y a 320 px | Todo operable, anunciado y sin desplazamiento horizontal |

## 5. Consola (FR-119)

```bash
npm run board:create -w apps/api -- --name "Equipo Infra"   # imprime el enlace una vez
npm run board:list -w apps/api                               # id, nombre, creación, tareas, personas, última actividad; sin códigos
npm run board:rotate -w apps/api -- --board <id>             # nuevo enlace de ese tablero
npm run board:delete -w apps/api -- --board <id>             # pide escribir el nombre; con otro texto no borra
npm run board:rotate -w apps/api -- --board 00000000-0000-4000-8000-000000000000   # "No existe ningún tablero con ese id", salida 1
```

## 6. Comprobaciones rápidas de la API

```bash
curl -s http://localhost:3000/api/v1/public-config            # {"boardCreationEnabled":true}
BODY='{"id":"7d9f1c2e-0000-4000-8000-0000000000b1","name":"Prueba"}'
CODE=$(curl -s -X POST -H 'Content-Type: application/json' -d "$BODY" \
  http://localhost:3000/api/v1/boards | jq -r .accessCode)    # 201 con accessCode
curl -s -w ' %{http_code}\n' -X POST -H 'Content-Type: application/json' -d "$BODY" \
  http://localhost:3000/api/v1/boards                          # 200 {"id":…,"name":"Prueba"}, sin accessCode
curl -s -H "Authorization: Bearer $CODE" http://localhost:3000/api/v1/board | jq .name   # "Prueba"
curl -s -o /dev/null -w '%{http_code}\n' -X DELETE -H "Authorization: Bearer $CODE" \
  http://localhost:3000/api/v1/board                           # 204
curl -s -o /dev/null -w '%{http_code}\n' -H "Authorization: Bearer $CODE" \
  http://localhost:3000/api/v1/board                           # 401
```

## 7. Migración

```bash
npm run db:migrate:down -w apps/api   # revierte 0005 sin perder tareas ni personas
npm run db:migrate -w apps/api        # vuelve a aplicarla; el tablero vuelve a llamarse "Mi tablero"
```
