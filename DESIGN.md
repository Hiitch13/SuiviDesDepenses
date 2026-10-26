# thrift — parti pris de conception

Notes de travail pour garder la refonte cohérente. À lire avant de toucher au style.

## Le sujet

Un suivi de budget mensuel pour un couple. Ce n'est pas un tableau de bord
financier : c'est une app ouverte sur un téléphone, au milieu du mois, dans une
file de caisse, pour répondre à deux questions et pas une de plus.

1. Combien il me reste pour finir le mois ?
2. Comment je note ces 62 € de courses en trois gestes ?

Tout le reste (projets, projection d'épargne, historique) est de la consultation
occasionnelle et doit s'effacer derrière ces deux-là.

## Le geste central

Le haut de l'écran est un réservoir. Le laiton monte depuis le bas à hauteur de
ce qu'il reste à vivre ; le vide sombre au-dessus, c'est ce qui est déjà parti.
Le mois se vide à vue d'œil. C'est le seul élément décoratif de l'app, et il
porte une donnée.

Quand le reste passe sous les seuils, le remplissage vire au terreux puis à
l'argile : la couleur porte la sévérité (contrat « meter »).

## Couleurs

| Jeton      | Hex       | Emploi                                   |
| ---------- | --------- | ---------------------------------------- |
| `--ink`    | `#071A17` | fond de page, le plus profond            |
| `--pine`   | `#0B2621` | surface principale, fond des graphiques  |
| `--moss`   | `#13362E` | blocs surélevés, champs de saisie        |
| `--line`   | `#1D4A3F` | filets de séparation                     |
| `--paper`  | `#F2EDE1` | texte principal, panneaux inversés       |
| `--sage`   | `#8A9A94` | texte secondaire, catégorie « Autres »   |
| `--brass`  | `#E8B84B` | l'unique accent : ce qu'il reste, action |
| `--clay`   | `#C8402F` | dépassement, suppression                 |

Le fond est un vert de pin franc, pas un noir teinté. L'accent est un laiton
chaud et désaturé, pas un vert acide. Ces deux écarts sont volontaires : le
couple « presque-noir + accent fluo » est le réflexe par défaut de n'importe
quel tableau de bord sombre.

### Catégories

Teintes de la palette sombre de référence, **ordre figé**, jamais recyclé.
L'ordre a été choisi en énumérant les 40 320 permutations et en ne gardant que
celles qui passent les cinq contrôles sur le fond `--pine` (3 008 ordres
valides), puis en prenant celle dont les associations sont les plus évidentes.

| Catégorie    | Hex       |
| ------------ | --------- |
| Alimentation | `#d95926` |
| Transport    | `#3987e5` |
| Loisirs      | `#d55181` |
| Restaurant   | `#c98500` |
| Shopping     | `#9085e9` |
| Santé        | `#e66767` |
| Épargne      | `#008300` |
| Autres       | `--sage`  |

Écart le plus faible : ΔE 8,6 en deutéranopie, 19,3 en vision normale — au-dessus
des planchers (8 et 15). `#199e70` reste libre pour une catégorie personnalisée.

Le laiton n'est jamais une couleur de série : il n'encode qu'une grandeur (ce
qu'il reste) ou une action. Aucune confusion possible avec le jaune Restaurant,
qui n'apparaît que dans une légende.

## Typographie

Une seule famille : **Archivo** (variable, axes `wght` et `wdth`). La largeur
variable donne assez d'amplitude pour ne pas avoir besoin d'une seconde fonte.

- Chiffre héros : `wght 700`, `wdth 112`, chiffres **proportionnels** (les
  chiffres tabulaires font flotter un grand nombre), ≥ 48 px, un seul par écran.
- Titres de section : `wght 600`, casse normale.
- Texte courant : `wght 400–500`.
- Montants en liste : `wght 600`, `tabular-nums` — là, l'alignement compte.

Pas de capitales pour les étiquettes, pas de fonte à chasse fixe, pas de second
caractère d'affichage.

## Structure

Mobile d'abord. Une colonne, barre d'onglets fixée en bas, le pouce atteint tout.

- Pas de cartes. Des lignes séparées par des filets, sur deux niveaux de fond.
- Aucune ombre portée. La profondeur vient du ton du fond.
- La couleur n'apparaît que là où elle identifie une catégorie. Le reste est
  encre, papier, laiton.

## Formes des graphiques

- « Où ça part » : barres classées avec repère de budget. Pas un anneau — on
  compare des catégories entre elles, c'est un travail de barres.
- Évolution : ligne 2 px, point final ≥ 8 px, valeur posée au bout.
- Barres ≤ 24 px, bout arrondi 4 px côté donnée, carré sur la ligne de base.
- Écart de 2 px dans la couleur du fond entre deux tracés qui se touchent.
- Légende dès deux séries. Le texte ne porte jamais la couleur de la donnée.
