# Roadmap

Estado de alto nivel del proyecto. Las tareas y bugs **vivos** se gestionan en
[GitHub Issues](../../issues); aquí solo el rumbo por fases. Cada fase se
corresponde con un *milestone* en GitHub.

Leyenda: ⬜ pendiente · 🟨 en curso · ✅ hecho

## Principios transversales (desde la v1)
- ⬜ **A1 — Circuitos definidos por datos (JSON)**: la lógica no hardcodea ningún
  circuito; se cargan y validan desde `public/tracks/*.json` con `schemaVersion`.
- ⬜ **A2 — Coches definidos por datos (JSON)**: peso, potencia, agarre, longitud y
  apariencia en `public/cars/*.json`; añadir vehículos = crear un fichero.
- Editor visual (propio o vía Tiled) y selector multi-circuito/coche: **a futuro**.

## v0.1 — Prototipo jugable ⬜
Que *conducir sea divertido* aunque no haya arte final.
- ⬜ Esqueleto del proyecto: Vite + Phaser 3 + TypeScript
- ⬜ Esquemas de datos + cargadores (`track`, `car`) con validación
- ⬜ Coche que acelera, frena y gira (parámetros leídos del JSON del coche)
- ⬜ Derrape (modelo de agarre longitudinal vs lateral)
- ⬜ Circuito visible por completo (cámara fija), cargado desde su JSON
- ⬜ Un `car.json` y un `track.json` de ejemplo

## v0.2 — Circuito y reglas ⬜
- ⬜ Tilemap (por datos) con superficies (asfalto/hierba) que afectan al agarre
- ⬜ Muros con colisión
- ⬜ Línea de meta, conteo de vueltas
- ⬜ Cronómetro y mejor vuelta

## v0.3 — Estética 90s ⬜
- ⬜ Pixel art del coche y el circuito
- ⬜ HUD retro
- ⬜ Audio (motor, derrape, checkpoint)

## v0.4 — Pulido y feel ⬜
- ⬜ Partículas de derrape
- ⬜ Tuning fino de la conducción

## v1.0 — Primera versión completa ⬜
- ⬜ Un circuito redondo y divertido
- ⬜ Publicado en GitHub Pages (y itch.io)

---
Ver el razonamiento completo en [`ANALISIS.md`](./ANALISIS.md).
