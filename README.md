# my-first-race-game

Un pequeño juego de **rallies 2D** con estética de los 90, donde priman la
**jugabilidad y la diversión**. Vista cenital, físicas arcade sencillas y derrape
en las curvas sobre un circuito visible por completo.

> 🚧 v0.1 en curso: prototipo jugable. Circuitos y coches se definen por datos
> (JSON), no en código — ver [ANALISIS.md §3.7](docs/ANALISIS.md#37-diseño-orientado-a-datos-circuitos-y-coches-definidos-por-json-requisitos-a1-a2).

## Cómo jugar (desarrollo)

```bash
npm install
npm run dev
```

Abre la URL que muestre Vite (por defecto `http://localhost:5173`).
Controles: flechas para acelerar/frenar/girar, espacio para el freno de mano (derrapar).

## Scripts

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo con recarga en caliente |
| `npm run build` | Type-check + build de producción a `dist/` |
| `npm run test` | Tests (Vitest) del modelo de físicas y los esquemas de datos |
| `npm run lint` | ESLint |

## Documentación
- 📊 [Análisis técnico y de gestión](docs/ANALISIS.md) — tecnología, físicas,
  diseño orientado a datos, gestión del proyecto y dónde publicarlo.
- 🗺️ [Roadmap](docs/ROADMAP.md) — fases y estado.
- 📝 [Changelog](docs/CHANGELOG.md) — historial de cambios.

## Circuitos y coches (diseño orientado a datos)
Ni el circuito ni el coche están escritos en el código: se cargan y validan desde
JSON (`public/tracks/*.json`, `public/cars/*.json`) con un esquema versionado
(`src/config/schema/`). Añadir un circuito o vehículo nuevo es crear un fichero
que cumpla el esquema, sin tocar la lógica del juego.

## Stack
Phaser 3 · TypeScript · Vite · Zod (validación de datos) · Vitest · publicado en
GitHub Pages.

## Gestión
Tareas y bugs en [Issues](../../issues); tablero en Projects; versiones en Milestones.
