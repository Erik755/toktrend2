# TokTrend

TokTrend es un proyecto Android-first para planear videos de TikTok con apoyo de IA, preparar ideas de campañas, organizar una cola de contenido y conectar la app con servicios externos.

El repositorio actual contiene dos componentes principales:

```text
toktrend/
├── app/                  # Aplicación Android en Kotlin + Jetpack Compose
├── web/                  # Landing/demo web estática para GitHub Pages
├── .github/workflows/    # Build APK y deploy de Pages
├── .env.example          # Variables locales de ejemplo
└── README.md
```

## Punto importante

Este repositorio **no es actualmente un backend Node.js en la raíz**. No debe documentarse como si se ejecutara con `npm start`, Docker o Railway, salvo que después se agregue una carpeta/backend separado.

## Página pública

La página web estática se publica desde `web/` en GitHub Pages:

```text
https://erik755.github.io/toktrend/
```

Esa página sirve como demo/landing para idear tendencias y preparar contenido. No sustituye la APK Android y no publica directamente en TikTok.

## Aplicación Android

La aplicación principal está en:

```text
app/
```

Tecnologías principales:

- Kotlin
- Jetpack Compose
- Gradle Kotlin DSL
- Room para persistencia local
- Servicio Gemini
- Servicio TikTok OAuth/API

## Requisitos

- Android Studio
- JDK 17
- Android SDK configurado
- Gradle wrapper o Gradle local

## Ejecutar localmente

```bash
git clone https://github.com/Erik755/toktrend.git
cd toktrend
cp .env.example .env
./gradlew assembleDebug
```

Si no existe `gradlew`:

```bash
gradle wrapper --gradle-version 9.3.1
./gradlew assembleDebug
```

APK generada:

```text
app/build/outputs/apk/debug/
```

## Variables locales

Copia `.env.example` a `.env` y llena los valores reales solo en tu entorno local. No subas `.env` al repositorio.

## GitHub Pages local

```bash
cd web
python -m http.server 8789
```

Abrir:

```text
http://127.0.0.1:8789/
```

## GitHub Actions

El repositorio debe mantener tres flujos:

- `build-apk.yml`: compila APK debug.
- `deploy-pages.yml`: despliega `web/` a GitHub Pages.
- `repo-validation.yml`: valida estructura y evita archivos sensibles.

## Backend futuro

Si TokTrend necesita publicación automática real, refresh de tokens, ejecución programada, o manejo seguro de credenciales, debe agregarse un backend separado, por ejemplo:

```text
backend/
├── src/
├── package.json
└── README.md
```

Hasta que ese backend exista, Railway/Render no son el flujo principal de este repositorio.

## Seguridad

- No subir `.env`.
- No subir claves reales.
- No subir keystores ni contraseñas de firma.
- Mantener los secretos fuera de GitHub.
- Tratar `web/` como código público.

## Reportes

Ver:

```text
CODEX_REPORT.md
CHANGELOG.md
```