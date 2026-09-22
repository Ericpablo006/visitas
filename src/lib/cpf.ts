// Validação/formatação de CPF — algoritmo de dígito verificador.
// IMPORTANTE: existe uma implementação Kotlin equivalente em
// android/app/src/main/java/com/taboa/visitas/domain/validation/CpfValidator.kt
// para validação offline no app. Se este algoritmo mudar, atualize os dois.

export const onlyDigits = (s: string) => s.replace(/\D/g, "");

export function isValidCPF(input: string): boolean {
  const c = onlyDigits(input);
  if (c.length !== 11 || /^(\d)\1{10}$/.test(c)) return false;
  const calc = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(c[i]) * (len + 1 - i);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return calc(9) === Number(c[9]) && calc(10) === Number(c[10]);
}

export function formatCPF(input: string): string {
  const d = onlyDigits(input);
  if (d.length !== 11) return input;
  return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}
