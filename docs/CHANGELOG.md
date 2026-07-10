# Changelog

Todos los cambios notables de este proyecto se documentan aquí.
Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/)
y versionado según [SemVer](https://semver.org/lang/es/).

## [Unreleased]
### Added
- Documentación inicial: análisis técnico y de gestión (`docs/ANALISIS.md`),
  roadmap (`docs/ROADMAP.md`) y andamiaje de gestión del proyecto
  (plantillas de issues).
- Principio de **diseño orientado a datos** (requisitos A1/A2): circuitos y coches
  definidos por JSON con esquema versionado, con borradores de esquema y su impacto
  en la arquitectura, para permitir nuevos circuitos/vehículos a futuro (a mano o
  con editor) sin tocar la lógica del juego.
- Esqueleto del proyecto: Vite + Phaser 3 + TypeScript, ESLint/Prettier, Vitest.
- Esquemas de datos con Zod (`src/config/schema/track.ts`, `car.ts`) y sus
  cargadores/validadores (`TrackLoader`, `CarLoader`), con `schemaVersion` desde
  el día uno (requisitos A1/A2).
- Circuito de ejemplo `public/tracks/rally-01.json` (óvalo con isla interior,
  superficies asfalto/hierba, muros, waypoints) y coche de ejemplo
  `public/cars/rally-hatch.json`.
- Modelo de físicas arcade con derrape (`src/physics/carPhysics.ts`): aceleración,
  frenado, giro proporcional a la velocidad y descomposición de la velocidad en
  componente longitudinal/lateral con agarre configurable (incluye freno de mano);
  función pura, cubierta con tests de Vitest.
- Entidad `Car` y escenas `Boot`/`Race` de Phaser: cámara fija que encuadra el
  circuito completo, render del tilemap por datos, colisión simple con muros,
  cambio de color al derrapar.
- CI (lint + test + build) y despliegue automático a GitHub Pages vía GitHub
  Actions.
