import { colToLetters, type CellAddr, type Range } from "@cellrush/engine";
import { A1, R1 } from "./data";
import type { Scenario } from "./scenarios";
import type { Task } from "./types";

export type DrillLang = "en" | "fr";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type P = any;
const row = (a: CellAddr) => a.r + 1;
const col = (a: CellAddr) => colToLetters(a.c);
const q = (s: string) => `« ${s} »`;

/**
 * French prompts, one per drill id. A drill without an entry here fails the i18n test,
 * so contributors add both languages (docs/ADDING_A_DRILL.md).
 */
export const FR_PROMPTS: Record<string, (p: P) => string> = {
  // navigation
  "jump-bottom": (p) => `Saute à la dernière ligne de données de la colonne ${p.col}`,
  "jump-top": (p) => `Saute à l'en-tête de la colonne ${p.col}`,
  "jump-right": (p) => `Saute à la dernière colonne de la ligne ${row(p.to)}`,
  "jump-left": (p) => `Reviens au libellé en début de ligne ${row(p.to)}`,
  "jump-next-table": (p) => `Descends à l'en-tête du tableau suivant (${A1(p.to)})`,
  "jump-second-table-end": (p) => `Va à la dernière ligne du deuxième tableau (${A1(p.to)})`,
  "table-corner": (p) => `Va au coin inférieur droit du tableau (${A1(p.to)})`,
  "go-home": () => "Reviens à la cellule A1",
  "go-last-cell": (p) => `Va à la dernière cellule utilisée de la feuille (${A1(p.to)})`,
  "row-start": (p) => `Va au début de la ligne ${row(p.to)} (colonne A)`,
  "move-to-cell": (p) => `Va en ${A1(p.to)}`,
  "page-down": (p) => `Descends d'un écran (jusqu'en ${A1(p.to)})`,
  // selection
  "select-row": (p) => `Sélectionne toute la ligne ${(p.want as Range).r1 + 1}`,
  "select-column": (p) => `Sélectionne toute la colonne ${colToLetters((p.want as Range).c1)}`,
  "select-table": (p) => `Sélectionne tout le tableau (${R1(p.want)})`,
  "select-sheet": () => "Sélectionne toute la feuille",
  "select-column-data": (p) => `Sélectionne les nombres ${R1(p.want)}`,
  "select-row-data": (p) => `Sélectionne les nombres ${R1(p.want)}`,
  "select-number-block": (p) => `Sélectionne tous les nombres ${R1(p.want)}`,
  "extend-cells": (p) => `Sélectionne ${R1(p.want)}`,
  "extend-to-last-cell": (p) => `Sélectionne d'ici jusqu'à la dernière cellule utilisée (${R1(p.want)})`,
  "extend-row-start": (p) => `Sélectionne jusqu'au début de la ligne (${R1(p.want)})`,
  "select-rows": (p) => `Sélectionne les lignes entières ${p.want.r1 + 1} à ${p.want.r2 + 1}`,
  "select-columns": (p) => `Sélectionne les colonnes entières ${colToLetters(p.want.c1)} à ${colToLetters(p.want.c2)}`,
  // editing
  "type-number": (p) => `Tape ${p.text} en ${A1(p.cell)} puis Entrée`,
  "replace-text": (p) => `Remplace ${q(p.was)} par ${q("Done")} en ${A1(p.cell)}`,
  "append-text": (p) => `Ajoute ${q(" Ltd")} (espace compris) à la fin de ${q(p.was)} en ${A1(p.cell)}, sans effacer le nom`,
  "edit-mode": (p) => `Ouvre ${A1(p.cell)} en modification (mode Modifier, curseur à la fin)`,
  "clear-cell": (p) => `Efface le contenu de ${A1(p.cell)}`,
  "clear-range": (p) => `Efface ${R1(p.range)}`,
  "fill-down": (p) => `Recopie la formule de ${A1(p.top)} vers le bas jusqu'en ${A1({ r: p.range.r2, c: p.range.c1 })}`,
  "fill-right": (p) => `Recopie la formule de ${A1(p.left)} vers la droite jusqu'en ${A1({ r: p.range.r1, c: p.range.c2 })}`,
  "fill-selection": (p) => `Mets 0 dans toutes les cellules de ${R1(p.range)} d'un seul coup`,
  "undo-delete": (p) => `Oups, ${A1(p.cell)} a été effacée. Annule`,
  redo: (p) => `Rétablis la saisie ${p.text} en ${A1(p.cell)} qui vient d'être annulée`,
  "copy-formula-above": (p) => `Recopie la formule exacte de la cellule du dessus en ${A1(p.cell)} (sans décalage)`,
  "insert-today": (p) => `Saisis la date du jour en ${A1(p.cell)}`,
  "line-break": (p) => `En ${A1(p.cell)}, tape ${q("Net")}, un retour à la ligne, puis ${q("income")}`,
  "repeat-bold": (p) => `Mets ${A1(p.a)} en gras, puis répète la même action sur ${A1(p.b)}`,
  // formatting
  "bold-cell": (p) => `Mets ${A1(p.cell)} en gras`,
  "italic-cell": (p) => `Mets ${A1(p.cell)} en italique`,
  "underline-cell": (p) => `Souligne ${A1(p.cell)}`,
  "bold-header-row": (p) => `Mets toute la ligne d'en-tête en gras (ligne ${p.range.r1 + 1})`,
  "format-percent": (p) => `Mets ${R1(p.range)} au format pourcentage`,
  "format-currency": (p) => `Mets ${R1(p.range)} au format monétaire`,
  "format-number": (p) => `Mets ${R1(p.range)} au format nombre à 2 décimales`,
  "format-date": (p) => `Mets ${R1(p.range)} au format date`,
  "format-general": (p) => `Remets ${R1(p.range)} au format Standard (enlève le format monétaire)`,
  "add-decimal": (p) => `Affiche une décimale de plus en ${A1(p.cell)}`,
  "remove-decimal": (p) => `Affiche une décimale de moins en ${A1(p.cell)}`,
  "percent-one-decimal": (p) => `Mets ${A1(p.cell)} en pourcentage avec 1 décimale`,
  "autofit-column": (p) => `Ajuste la largeur de la colonne ${col(p.cell)} à son contenu`,
  // rows & columns
  "insert-row": (p) => `Insère une ligne vide au-dessus de la ligne ${p.r + 1} (${q(p.label)})`,
  "insert-two-rows": (p) => `Insère deux lignes vides au-dessus de la ligne ${p.r + 1} (${q(p.label)})`,
  "delete-row": (p) => `Supprime la ligne ${p.r + 1} (${q(p.label)})`,
  "delete-row-dialog": (p) => `Supprime toute la ligne de la cellule active (ligne ${p.r + 1}) avec la boîte Supprimer`,
  "insert-column": (p) => `Insère une colonne vide avant la colonne ${colToLetters(p.c)} (${q(p.header)})`,
  "delete-column": (p) => `Supprime la colonne ${colToLetters(p.c)} (${q(p.header)})`,
  // clipboard
  "copy-cell": (p) => `Copie ${A1(p.from)} en ${A1(p.to)}`,
  "copy-formula": (p) => `Copie la formule de ${A1(p.from)} en ${A1(p.to)} (les références doivent suivre)`,
  "cut-cell": (p) => `Déplace ${A1(p.from)} en ${A1(p.to)} (couper, pas copier)`,
  "paste-values": (p) => `Remplace les formules de ${R1(p.range)} par leurs valeurs`,
  "paste-formats": (p) => `Copie seulement la mise en forme de ${A1(p.from)} sur ${A1(p.to)} (garde son texte)`,
  "paste-into-range": (p) => `Copie ${A1(p.from)} dans toutes les cellules de ${R1(p.range)}`,
  // formulas
  "autosum-column": (p) => `Fais le total de la colonne au-dessus en ${A1(p.cell)} avec une formule`,
  "average-column": (p) => `En ${A1(p.cell)}, calcule la moyenne des nombres au-dessus avec AVERAGE`,
  "growth-formula": (p) => `En ${A1(p.cell)}, calcule la croissance par rapport à l'année précédente (${p.note})`,
  "margin-formula": (p) => `En ${A1(p.cell)}, calcule la marge brute (${p.note})`,
  "round-formula": (p) => `En ${A1(p.cell)}, arrondis le nombre à gauche à 0 décimale avec ROUND`,
  "anchor-reference": (p) => `Fige la référence au taux de croissance en ${A1(p.cell)} pour qu'elle ne bouge plus (passe-la en $B$1)`,
  "show-formulas": () => "Affiche les formules au lieu de leurs résultats",
  // sheets
  "next-sheet": (p) => `Passe à la feuille suivante (${q(p.names[p.want])})`,
  "prev-sheet": (p) => `Reviens à la feuille précédente (${q(p.names[p.want])})`,
  "insert-sheet": () => "Insère une nouvelle feuille de calcul",
};

interface ScenarioFr {
  title: string;
  blurb: string;
  prompt?: (p: P) => string;
  conditions: Record<string, string>;
}

export const FR_SCENARIOS: Record<string, ScenarioFr> = {
  "pnl-banking": {
    title: "Mettre un P&L aux normes banque",
    blurb: "Saisies en bleu, formules en noir, marges en %, totaux en gras avec une bordure en haut, négatifs entre parenthèses.",
    conditions: {
      "inputs-blue": "Saisies en dur (Revenue, COGS, Opex) en bleu",
      "formulas-black": "Formules en noir",
      "margins-percent": "Lignes de marge au format %",
      "totals-bold-border": "Gross profit et EBITDA en gras avec une bordure en haut",
      "negatives-parens": "Nombres négatifs entre parenthèses",
    },
  },
  "revenue-projection": {
    title: "Construire une projection de chiffre d'affaires",
    blurb: "Fais croître les deux segments jusqu'à FY28 avec le taux de B1 (ancré), puis totalise chaque année.",
    prompt: (p) => `Fais croître les deux segments jusqu'à FY28 à ${Math.round(p.rate * 100)} % (B1, ancré), puis totalise chaque année en ligne 6.`,
    conditions: {
      "growth-formulas": "FY25–FY28 croissent à partir de l'année précédente (C4:F5)",
      "rate-anchored": "Chaque formule de croissance utilise le taux ancré $B$1",
      totals: "La ligne 6 totalise chaque année avec une formule (B6:F6)",
    },
  },
  "clean-data": {
    title: "Nettoyer un export de données",
    blurb: "Supprime les lignes vides, ajuste la colonne Client et transforme les formules de TVA en valeurs.",
    conditions: {
      "no-blank-rows": "Plus aucune ligne vide dans les données, rien de perdu",
      "client-autofit": "Colonne Client assez large pour chaque nom (ajustement automatique)",
      "vat-values": "La colonne VAT contient des valeurs, pas des formules, et elles sont justes",
    },
  },
};

/** The drill's prompt in a language (falls back to English). */
export function promptText(task: Task, params: unknown, lang: DrillLang): string {
  if (lang === "fr") {
    const sc = FR_SCENARIOS[task.id];
    if (sc) return sc.prompt ? sc.prompt(params) : sc.blurb;
    const fr = FR_PROMPTS[task.id];
    if (fr) return fr(params);
  }
  return task.prompt(params);
}

export function scenarioText(s: Scenario, lang: DrillLang): { title: string; blurb: string } {
  const fr = lang === "fr" ? FR_SCENARIOS[s.id] : undefined;
  return fr ? { title: fr.title, blurb: fr.blurb } : { title: s.title, blurb: s.blurb };
}

export function conditionLabel(scenarioId: string, conditionId: string, english: string, lang: DrillLang): string {
  return (lang === "fr" && FR_SCENARIOS[scenarioId]?.conditions[conditionId]) || english;
}
