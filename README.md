# BACUS

Tableau de bord des marchés : actions et indices, cryptomonnaies, immobilier et actualités,
avec projection statistique et recherche des causes des mouvements de cours.

- **Aperçu** — pouls du marché (0–100), ce qui a bougé depuis la dernière visite, facteurs clés (VIX, or, pétrole, taux,
  dollar, Bitcoin), plus fortes variations, favoris.
- **Marchés** — actions et indices (liste ou carte de chaleur, palmarès des secteurs), 50 premières cryptomonnaies,
  immobilier (prix des logements par pays, foncières cotées, pouvoir d'achat immobilier).
- **Portefeuille** — vos lignes additionnées dans une seule devise, répartition, risque et diversification.
- **Analyse** — comparaison base 100 et corrélations, onde de choc d'un événement, carte risque / rendement,
  scanner des figures en chandeliers apparues ces 3 dernières séances.
- **Actualités** — fil en direct (32 sources relues chaque minute), mots-clés surveillés avec alertes, détecteur de
  mouvements de prix inhabituels, de quoi parle-t-on en ce moment, actifs exposés à chaque facteur.
- **Recherche** (loupe) — n'importe quelle action, ETF, indice ou crypto référencé par Yahoo Finance.
- **Fiche d'un actif** — graphique, indicateurs (tendance, RSI, volatilité, repli), projection avec fourchette à 80 %
  et fiabilité mesurée sur le passé, mouvements marquants reliés aux articles parus à la même date.

Filtres globaux : région du monde, devise d'affichage (EUR, USD, GBP, CHF, JPY), période.

## Les questions auxquelles l'application répond

| Question | Où |
| --- | --- |
| Combien vaut l'ensemble de mes placements, et ma performance vient-elle de mes actifs ou du taux de change ? | Portefeuille |
| Mes lignes se protègent-elles vraiment les unes les autres ? | Portefeuille, Analyse › Comparer |
| Quand un événement frappe, comment réagit chaque marché, et dans quel ordre de grandeur ? | Analyse › Onde de choc |
| À quoi cette valeur est-elle sensible : taux, pétrole, dollar, peur du marché ? | Fiche d'un actif |
| Cette figure en chandeliers annonce-t-elle vraiment quelque chose sur cette valeur ? | Fiche d'un actif › Bougies, Analyse › Bougies |
| Les prix de l'immobilier montent peu, mais puis-je encore acheter ? | Marchés › Immobilier › Pouvoir d'achat |
| De quoi parle la presse, et quels actifs sont concernés ? | Actualités |
| Que se passe-t-il en ce moment, et pourquoi ce marché décroche-t-il ? | Actualités › fil en direct, mouvements inhabituels |
| Qu'est-ce qui a changé depuis ma dernière visite ? | Aperçu |

Le portefeuille, les favoris et les réglages restent sur l'appareil.

## Technique

Svelte 5 + Vite pour l'interface, `lightweight-charts` pour les graphiques, Capacitor pour l'emballage Android.
Tout le calcul se fait sur l'appareil ; il n'y a ni serveur ni clé d'API. Le bundle web pèse environ 300 Ko.

| Donnée | Source |
| --- | --- |
| Actions, indices, foncières, matières premières, devises | Yahoo Finance |
| Cryptomonnaies | CoinGecko (API publique) |
| Prix des logements | BIS, via FRED |
| Taux des crédits immobiliers | BCE (France, Allemagne, Espagne), Freddie Mac via FRED (États-Unis) |
| Actualités | Flux RSS : Le Monde, BFM Business, France 24, Bloomberg, Financial Times, New York Times, The Guardian, BBC, CNBC, DW, Seeking Alpha, FXStreet, OilPrice, SCMP, Al Jazeera, CoinDesk, Cointelegraph, Google Actualités ; communiqués de la Fed et de la BCE |

Ces sources sont gratuites et non garanties : usage personnel, sans engagement de disponibilité.

## Lancer en local

```bash
npm install
npm run dev
```

Puis ouvrir http://localhost:5173. Le serveur local relaie les requêtes vers les sources de données
(les navigateurs bloquent les appels directs ; l'APK, lui, les fait en natif).
`npm run build && npm run preview` sert la version optimisée de la même façon.

## Obtenir l'APK et les mises à jour

Chaque push sur `main` déclenche le workflow GitHub Actions « APK Android », qui publie une
[Release](https://github.com/clementsellier/BACUS/releases/latest) contenant :

| Fichier | Rôle |
| --- | --- |
| `bacus.apk` | l'application à installer sur Android |
| `bacus-web.zip` | le paquet de mise à jour à distance |
| `version.json` | le numéro de la dernière version, lu par l'application |

**Mises à jour à distance** : au lancement puis toutes les heures, l'application lit `version.json`. Si seule la
partie web a changé (écrans, données, calculs), elle télécharge le paquet en arrière-plan et l'applique au
lancement suivant, ou tout de suite via « Redémarrer maintenant ». Si la nouvelle version plante au démarrage,
elle revient d'elle-même à la précédente. Si la partie Android a changé, elle propose le nouvel APK.

**Niveau natif** : `native-level.txt` doit être augmenté de 1 chaque fois que la partie Android change (ajout
d'un module natif Capacitor, modification de `android/`). La version affichée est « niveau.fabrication ».

**Signature** : l'APK est signé avec une clé fixe, fournie au workflow par deux secrets du dépôt :
`BACUS_KEYSTORE_BASE64` (le fichier `.p12` encodé en base64) et `BACUS_KEYSTORE_PASSWORD`. Sans clé identique
d'une version à l'autre, Android refuse d'installer une mise à jour. La clé n'est pas dans le dépôt : en garder une
copie de sauvegarde.

**En local** (JDK 21 et Android SDK requis) :

```bash
npm run android:sync
cd android && ./gradlew assembleDebug
```

## Projection : ce qu'elle vaut

800 scénarios sont tirés par blocs dans les variations passées de l'actif (ce qui conserve les grappes de volatilité
et les mouvements extrêmes), avec une volatilité qui part du niveau récent et une tendance volontairement réduite.
La fiche affiche le taux de réussite de la fourchette rejouée sur des dates passées. Cela reste une lecture
statistique du passé : elle ignore les événements à venir et ne constitue pas un conseil en investissement.

## Structure

```
src/lib/catalog.js     actifs suivis, régions, devises, facteurs, panel de l'onde de choc
src/lib/data.js        cotations, historiques, recherche, taux de crédit, conversion de devise
src/lib/analytics.js   indicateurs, projection, corrélations, réaction aux chocs, calcul du portefeuille
src/lib/candles.js     figures en chandeliers et statistiques de ce qui les a suivies
src/lib/state.svelte.js réglages, favoris et portefeuille conservés sur l'appareil
src/lib/news.js        flux RSS, étiquetage par facteur, recherche des causes
src/lib/live.svelte.js fil en direct, alertes, détecteur de mouvements inhabituels
src/lib/update.svelte.js mise à jour à distance
src/pages/             un fichier par onglet
src/components/        graphique, fiche détaillée, lignes et filtres
android/               projet Android généré par Capacitor
```
