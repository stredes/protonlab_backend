function normalizeQuestion(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function hasUserInventoryTerm(question: string): boolean {
  const words = question.match(/[a-z0-9]+/g) ?? [];

  return words.some((word) => {
    if (/^(users?|cuentas?)$/.test(word)) {
      return true;
    }

    return (
      word.includes("usuario") ||
      word.includes("usuarios") ||
      /^(s?u?sarios?|s?u?suario?s?)$/.test(word)
    );
  });
}

export function isUserQuestion(question: string): boolean {
  const normalized = normalizeQuestion(question);

  return (
    hasUserInventoryTerm(normalized) &&
    /\b(cuantos?|cantidad|existen|hay|lista|listar|muestra|mostrar|ver)\b/.test(
      normalized
    )
  );
}

export function isProductQuestion(question: string): boolean {
  const normalized = normalizeQuestion(question);

  return (
    /\b(productos?|catalogo|inventario|items?)\b/.test(normalized) &&
    /\b(cuantos?|cantidad|existen|hay|lista|listar|muestra|mostrar|ver)\b/.test(
      normalized
    )
  );
}
