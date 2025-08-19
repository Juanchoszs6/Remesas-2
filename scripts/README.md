# 📊 Scripts de Importación de Datos

Este directorio contiene los scripts para importar datos desde archivos Excel a la base de datos Neon PostgreSQL.

## 📋 Archivos Requeridos

Coloca estos archivos Excel en la **raíz del proyecto** (no en la carpeta scripts):

### `Proveedores.xlsx`
- **Codigo_Prov**: Código único del proveedor
- **Nombre_Prov**: Nombre completo del proveedor

### `Productos.xlsx`
- **Codigo_Prod**: Código único del producto
- **Nombre_Prod**: Nombre completo del producto
- **Precio_Base**: Precio base del producto (opcional)
- **Tiene_IVA**: Si el producto tiene IVA (opcional, default: true)

## 🔧 Configuración

1. **Archivo `.env`** en la raíz del proyecto:
\`\`\`env
DATABASE_URL='postgresql://neondb_owner:npg_mcqP3G6CKrku@ep-summer-moon-ads46xxn-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require'
\`\`\`

2. **Instalar dependencias**:
\`\`\`bash
npm install dotenv xlsx pg
\`\`\`

## 🚀 Uso de los Scripts

### Importar solo productos:
\`\`\`bash
node scripts/02-import-productos.js
\`\`\`

### Importar solo proveedores:
\`\`\`bash
node scripts/03-import-proveedores.js
\`\`\`

### Importar todo de una vez:
\`\`\`bash
node scripts/04-import-all.js
\`\`\`

### Verificar datos importados:
\`\`\`bash
node scripts/05-verify-data.js
\`\`\`

## ✅ Características

- **Auto-creación de tablas**: Los scripts crean las tablas si no existen
- **Manejo de duplicados**: Actualiza registros existentes
- **Validación de datos**: Verifica que los campos requeridos estén presentes
- **Logs detallados**: Muestra progreso y errores
- **Conexión segura**: SSL configurado para Neon
- **Índices optimizados**: Para búsquedas rápidas

## 📊 Estructura de las Tablas

### Tabla `proveedores`
\`\`\`sql
CREATE TABLE proveedores (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(50) UNIQUE NOT NULL,
    nombre VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
\`\`\`

### Tabla `productos`
\`\`\`sql
CREATE TABLE productos (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(50) UNIQUE NOT NULL,
    nombre VARCHAR(255) NOT NULL,
    precio_base DECIMAL(10,2) DEFAULT 0,
    tiene_iva BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
\`\`\`

## 🔍 Solución de Problemas

### Error: "Cannot find module"
- Asegúrate de ejecutar `npm install` primero

### Error: "File not found"
- Verifica que los archivos Excel estén en la raíz del proyecto
- Revisa que los nombres sean exactos: `Productos.xlsx` y `Proveedores.xlsx`

### Error de conexión a BD
- Verifica que la variable `DATABASE_URL` esté configurada
- Comprueba que la conexión a internet funcione

### Columnas no encontradas
- Revisa que las columnas en Excel tengan los nombres exactos
- Asegúrate de que la primera fila contenga los encabezados

## 📈 Después de la Importación

Una vez importados los datos:

1. **El autocompletado funcionará automáticamente** en el formulario
2. **Las búsquedas serán en tiempo real** desde la base de datos
3. **Los precios se auto-llenarán** al seleccionar productos
4. **La configuración de IVA se aplicará** automáticamente

¡Todo listo para usar! 🎉
