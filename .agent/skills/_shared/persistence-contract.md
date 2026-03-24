# 💾 Persistence Contract

Define cómo se gestiona el conocimiento y el contexto en **OpenGravity**.

## 🧠 Memory Layers

1.  **Engram (Short-Term / Local)**:
    *   **Source**: SQLite (`data/opengravity.db`).
    *   **Usage**: Contexto de sesión, historial de chat reciente (max 10-20 mensajes), y descubrimientos técnicos inmediatos.
    *   **Format**: Tablas `messages` y `long_term_memory`.
2.  **Omni-Brain (Long-Term / Cloud)**:
    *   **Source**: Google Cloud Firestore.
    *   **Usage**: Búsqueda semántica estratégica, objetivos de largo plazo, y trazabilidad de eventos.
    *   **Format**: Documentos en colecciones `messages` y `observations`.

## 📜 Conventions

*   **Discoveries**: Todo bug crítico o decisión de diseño "que dolió" debe guardarse en Engram vía `mem_save` para evitar repetirlo.
*   **Traces**: Cada interacción genera un `traceId` persistido en Firestore para auditoría técnica.
*   **Context Backfill**: Si la memoria local está vacía, el agente debe intentar recuperar el contexto desde Firestore automáticamente.
