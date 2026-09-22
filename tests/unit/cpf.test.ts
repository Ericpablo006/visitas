import { describe, expect, it } from "vitest";
import { formatCPF, isValidCPF } from "@/lib/cpf";

describe("isValidCPF", () => {
  it.each([
    ["111.444.777-35", true],
    ["11144477735", true],
    ["529.982.247-25", true],
    ["529.982.247-26", false], // dígito verificador errado
    ["000.000.000-00", false], // todos os dígitos iguais
    ["111.111.111-11", false],
    ["123.456.789-00", false],
    ["", false],
    ["123", false],
    ["abc.def.ghi-jk", false],
  ])("%s -> %s", (input, expected) => {
    expect(isValidCPF(input)).toBe(expected);
  });
});

describe("formatCPF", () => {
  it("formata 11 dígitos", () => {
    expect(formatCPF("52998224725")).toBe("529.982.247-25");
  });

  it("mantém entrada inválida como está", () => {
    expect(formatCPF("123")).toBe("123");
  });
});
