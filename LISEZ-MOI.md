# Radio Algérie — application Android

Version 1.2.0 — texte arabe en police Cairo, chiffres de l'horloge centrés avec une marge dans la carte, icônes de radios centrées.

Radios algériennes et du monde (annuaire gratuit Radio Browser), flip clock, thème jour/nuit automatique,
titre du morceau en cours, lecture en arrière-plan avec notification, minuterie de sommeil.

## Obtenir l'APK (sans rien installer sur votre ordinateur)

1. Sur github.com, créez un **nouveau dépôt** (ex. `radio-algerie`), public ou privé.
2. Décompressez ce zip sur votre ordinateur. Dans le dépôt : **Add file → Upload files**, puis glissez
   **le contenu** du dossier (`app`, `build.gradle.kts`, `settings.gradle.kts`, `gradle.properties`, `.github`, etc.).
   - Le dossier `.github` est caché sur certains systèmes. S'il n'est pas envoyé : **Add file → Create new file**,
     tapez le nom `.github/workflows/build.yml` et collez le contenu du fichier `build.yml`.
3. Validez avec **Commit changes**. La construction démarre toute seule.
4. Onglet **Actions** → cliquez sur la dernière exécution → en bas, **Artifacts** → `Radio-Algerie-APK`.
   Après environ 5 minutes, téléchargez-le et décompressez-le : vous obtenez `Radio-Algerie.apk`.
5. Copiez l'APK sur le téléphone et ouvrez-le. Android demandera d'autoriser l'installation depuis cette source.

Si la construction échoue (croix rouge dans Actions), ouvrez l'exécution, copiez le message d'erreur et envoyez-le-moi.
