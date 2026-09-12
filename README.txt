MI MUSICA - PROTOTIPO

Esta es una primera versión funcional de un repositorio musical local.

Incluye:
- Carga de archivos de audio desde el navegador.
- Biblioteca de canciones.
- Búsqueda.
- Reproductor.
- Anterior / siguiente.
- Barra de progreso.
- Descarga de los archivos cargados.

IMPORTANTE:
Esta versión NO tiene servidor ni cuentas. Los archivos permanecen en el navegador y se pierden al cerrar/recargar según el navegador.

Siguiente etapa recomendada:
1. Backend con Node.js.
2. Base de datos PostgreSQL.
3. Cuentas de usuarios.
4. Almacenamiento de archivos en la nube.
5. Subida de portadas y metadatos.
6. Playlists y favoritos.
7. Control de permisos para que solo se descargue contenido autorizado.

Para probarla:
Abre index.html en un navegador moderno y pulsa "Subir música".


VERSIÓN CON CUENTAS
Esta versión conecta el inicio de sesión/registro con Supabase.
La contraseña no se guarda en el código: Supabase Auth la administra.
