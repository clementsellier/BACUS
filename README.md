# BACUS

Tableau de bord des marchés : actions et indices, cryptomonnaies, immobilier et actualités,
avec projection statistique et recherche des causes des mouvements de cours.

- **Aperçu** — pouls du marché (0–100), facteurs clés (VIX, or, pétrole, taux, dollar, Bitcoin), plus fortes variations, favoris.
- **Actions** — indices (CAC 40, Nasdaq, S&P 500, DAX, Nikkei…) et grandes valeurs, filtrables par secteur.
- **Crypto** — 50 premières capitalisations, dominance du Bitcoin.
- **Immobilier** — prix des logements par pays (indices BIS) et foncières cotées.
- **Actualités** — extraits d'articles classés par rubrique et par facteur de marché (géopolitique, élections, banques centrales…).
- **Fiche d'un actif** — graphique, indicateurs (tendance, RSI, volatilité, repli), projection avec fourchette à 80 %
  et fiabilité mesurée sur le passé, mouvements marquants reliés aux articles parus à la même date.

Filtres globaux : région du monde, devise d'affichage (EUR, USD, GBP, CHF, JPY), période.

## Technique

Svelte 5 + Vite pour l'interface, `lightweight-charts` pour les graphiques, Capacitor pour l'emballage Android.
Tout le calcul se fait sur l'appareil ; il n'y a ni serveur ni clé d'API. Le bundle web pèse environ 300 Ko.

| Donnée | Source |
| --- | --- |
| Actions, indices, foncières, matières premières, devises | Yahoo Finance |
| Cryptomonnaies | CoinGecko (API publique) |
| Prix des logements | BIS, via FRED |
| Actualités | Flux RSS (Le Monde, France 24, BBC, CNBC, CoinDesk, Google Actualités) |

Ces sources sont gratuites et non garanties : usage personnel, sans engagement de disponibilité.

## Lancer en local

```bash
npm install
npm run dev
```

Puis ouvrir http://localhost:5173. Le serveur local relaie les requêtes vers les sources de données
(les navigateurs bloquent les appels directs ; l'APK, lui, les fait en natif).
`npm run build && npm run preview` sert la version optimisée de la même façon.

## Obtenir l'APK

**Sans rien installer** : chaque push sur `main` déclenche le workflow GitHub Actions « APK Android ».
L'APK se télécharge dans l'onglet *Actions* du dépôt, artefact `bacus-apk`.

**En local** (JDK 21 et Android SDK requis) :

```bash
npm run android:sync
cd android && ./gradlew assembleDebug
```

L'APK est produit dans `android/app/build/outputs/apk/debug/`.
Il s'agit d'un APK de débogage, installable directement ; une publication sur le Play Store demanderait une signature.

## Projection : ce qu'elle vaut

800 scénarios sont tirés par blocs dans les variations passées de l'actif (ce qui conserve les grappes de volatilité
et les mouvements extrêmes), avec une volatilité qui part du niveau récent et une tendance volontairement réduite.
La fiche affiche le taux de réussite de la fourchette rejouée sur des dates passées. Cela reste une lecture
statistique du passé : elle ignore les événements à venir et ne constitue pas un conseil en investissement.

## Structure

```
src/lib/catalog.js     actifs suivis, régions, devises
src/lib/data.js        accès aux cotations et conversion de devise
src/lib/analytics.js   indicateurs, mouvements marquants, projection, contrôle a posteriori
src/lib/news.js        flux RSS, étiquetage par facteur, recherche des causes
src/pages/             un fichier par onglet
src/components/        graphique, fiche détaillée, lignes et filtres
android/               projet Android généré par Capacitor
```
