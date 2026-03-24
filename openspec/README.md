# 📐 Spec-Driven Development (SDD)

Este directorio contiene los artefactos de diseño y planificación para cambios estructurales en el repositorio.

## 🏗️ Structure

*   **/changes**: Cada feature o refactor tiene su propia subcarpeta.
    *   `state.yaml`: Estado actual del DAG de dependencias.
    *   `explore.md`: Análisis inicial del problema.
    *   `proposal.md`: Propuesta de solución de alto nivel.
    *   `spec.md`: Especificaciones técnicas detalladas.
    *   `design.md`: Arquitectura de archivos y diagramas.
    *   `tasks.md`: Lista de tareas para los subagentes.

## 🔄 Workflow

1.  `/sdd-init`: Inicializa el contexto del proyecto.
2.  `/sdd-new <change>`: Crea una nueva carpeta en `changes/` y arranca la fase de exploración.
3.  `/sdd-ff`: Avanza automáticamente por las fases de planificación hasta tener las tareas listas.
4.  `/sdd-apply`: Delega la implementación a subagentes basándose en los specs.
5.  `/sdd-verify`: Valida que la implementación cumpla con el diseño y los specs.
6.  `/sdd-archive`: Cierra el ciclo y guarda los aprendizajes en **Engram**.
