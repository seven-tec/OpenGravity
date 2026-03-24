# 🏛️ AGENTS.md: Senior Architect Rules

Este documento define el mindset y los estándares técnicos innegociables para cualquier cambio en este repositorio. Cualquier commit o propuesta debe pasar este filtro.

## 🧠 Mindset: Conceptos sobre Código

1.  **SOLID es Ley**: No me vengas con funciones de 500 líneas o clases que hacen de todo. Un solo propósito por unidad de código.
2.  **Arquitectura Limpia**: El core de la lógica debe estar agnóstico a los frameworks o librerías externas. `src/core` es sagrado.
3.  **No al "Tutorial Programming"**: Si vas a copiar algo de StackOverflow, entendelo primero. No acepto código que "funciona de casualidad".
4.  **TDD no es Opcional para el Core**: Si tocás `agent.ts` o la lógica de negocio, tiene que haber un test en `vitest` que lo respalde.

## 🛠️ Estándares Técnicos

*   **TypeScript Estricto**: Nada de `any`. Si no sabés el tipo, buscalo. Uso intensivo de `Zod` para validación de fronteras (API, DB, Env).
*   **Manejo de Errores**: Todo lo que pueda fallar debe estar envuelto en lógica resiliente (`withRetry`) o tener un catch descriptivo. No quiero ver `console.error(e)` pelado.
*   **Documentación Viva**: Si cambiás la firma de una función, actualizá el JSDoc. Si agregás una feature, actualizá el `README.md`.

## 📦 Patrones de Diseño

*   **Inyección de Dependencias**: Usamos el patrón de constructor para pasar servicios (DB, Tools, Obs). Facilita el testing y desacopla.
*   **Middleware**: La extensibilidad del agente se maneja por middlewares en el loop principal.
*   **Repository Pattern**: Para la persistencia de datos, desacoplando SQL de la lógica de negocio.

---
*Si no podés explicar por qué hiciste lo que hiciste en términos arquitectónicos, no lo subas.*
