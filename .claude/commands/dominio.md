---
description: Implementa logica de dominio pura, sin IO
---
Implementa en el paquete de dominio que corresponda: $ARGUMENTS

Restricciones obligatorias:
- Funciones puras. Sin base de datos, red, sistema de archivos ni Date.now().
  El tiempo y los identificadores se inyectan como parametros.
- Tipos primero. Sin `any`, sin `as` para callar al compilador.
- Tests de Vitest en el mismo commit, con casos de borde y de error.
- Sin dependencias nuevas salvo que lo justifiques en una linea y yo lo apruebe.

Muestrame el plan y las firmas de tipos antes de escribir implementaciones.
