---
description: Revision critica del diff actual
---
Revisa `git diff` contra main y reporta como lista de hallazgos:
- Reglas de negocio incorrectas o casos de borde omitidos.
- Violaciones de las reglas de dependencia declaradas en CLAUDE.md.
- Logica de dominio filtrada a la UI o a la capa de base de datos.
- Abstracciones prematuras (menos de tres usos concretos).
- Faltantes de validacion en bordes de entrada.
- Riesgos de concurrencia o de integridad de datos.

Sin elogios. Solo hallazgos, ordenados por gravedad.
