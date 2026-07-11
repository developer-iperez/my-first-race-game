# Roadmap

Estado de alto nivel del proyecto. Las tareas y bugs **vivos** se gestionan en
[GitHub Issues](../../issues); aquí solo el rumbo por fases. Cada fase se
corresponde con un *milestone* en GitHub.

Leyenda: ⬜ pendiente · 🟨 en curso · ✅ hecho

## Principios transversales (desde la v1)
- ✅ **A1 — Circuitos definidos por datos (JSON)**: la lógica no hardcodea ningún
  circuito; se cargan y validan (Zod) desde `public/tracks/*.json` con `schemaVersion`.
- ✅ **A2 — Coches definidos por datos (JSON)**: peso, potencia, agarre, longitud y
  apariencia en `public/cars/*.json`; añadir vehículos = crear un fichero.
- ⬜ Editor visual (propio o vía Tiled) y selector multi-circuito/coche: **a futuro**.
- ✅ CI/CD activo: cada push a esta rama se despliega y prueba en GitHub Pages.

## v0.1 — Prototipo jugable ✅
Que *conducir sea divertido* aunque no haya arte final.
- ✅ Esqueleto del proyecto: Vite + Phaser 3 + TypeScript
- ✅ Esquemas de datos + cargadores (`track`, `car`) con validación
- ✅ Coche que acelera, frena y gira (parámetros leídos del JSON del coche)
- ✅ Derrape (modelo de agarre longitudinal vs lateral, con freno de mano)
- ✅ Circuito visible por completo (cámara fija), cargado desde su JSON
- ✅ Un `car.json` y un `track.json` de ejemplo (óvalo con isla interior)
- ✅ Controles táctiles en pantalla (móvil/tablet sin teclado físico)
- ✅ Menú de ajustes extensible (⚙️): dificultad (aceleración + velocidad
  máxima, 3 niveles) y pantalla completa

## v0.2 — Circuito y reglas ✅
- ✅ Tilemap (por datos) con superficies (asfalto/hierba) que afectan al agarre
- ✅ Muros con colisión (rebote simple)
- ✅ Línea de meta, conteo de vueltas (exige pasar por los checkpoints en
  orden, no vale con tocar la meta sin dar la vuelta)
- ✅ Cronómetro y mejor vuelta (HUD en pantalla)
- ✅ Fase de fin de carrera: coche se congela al completar las vueltas,
  botón para volver a empezar

## v0.3 — Estética 90s ✅
- ✅ Pixel art del coche y el circuito (sprites generados: coche, asfalto,
  hierba, arena, muro a rayas)
- ✅ HUD retro (marcador con marco pixelado estilo arcade, iconos por línea)
- ✅ Audio (motor en bucle con tono/volumen por velocidad, derrape,
  checkpoint y fanfarria de meta — sintetizado, sin bancos externos)

## v0.4 — Pulido y feel 🟨
- ✅ Partículas de derrape (humo/polvo tras el coche mientras derrapa)
- ✅ Derrape más espectacular en curvas cerradas a velocidad, manteniendo
  la maniobrabilidad (giro suave/lento intacto, se puede contravolantear)
- ✅ Salirse de pista ya no para el coche en seco: fricción fuerte pero
  el coche sigue moviéndose, más fácil recuperar el trazado

## v1.0 — Primera versión completa 🟨
- ✅ Pantalla de inicio (título + "pulsa para empezar", con ajustes de
  dificultad accesibles antes de correr) y cuenta atrás de salida 3·2·1·¡YA!
- ⬜ Un circuito redondo y divertido
- ⬜ Publicado en GitHub Pages (y itch.io)

---
Ver el razonamiento completo en [`ANALISIS.md`](./ANALISIS.md).
