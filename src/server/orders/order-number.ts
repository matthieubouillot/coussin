import { randomInt } from "node:crypto";

// Alphabet sans caractères ambigus (0/O, 1/I/L) : le numéro est dicté au téléphone ou recopié.
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

/**
 * Numéro de commande communiqué au client, ex. « C-7K3M9QX2 ».
 * Aléatoire plutôt que séquentiel : il ne révèle pas le volume de ventes et ne se devine pas
 * (il sert, avec l'email, à consulter le suivi). L'unicité est garantie par la base.
 */
export function generateOrderNumber(): string {
  let code = "";
  for (let i = 0; i < 8; i++) code += ALPHABET[randomInt(ALPHABET.length)];
  return `C-${code}`;
}
