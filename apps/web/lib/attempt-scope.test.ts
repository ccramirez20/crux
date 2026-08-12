import { describe, expect, it } from 'vitest';
import { attemptVerdict } from './attempt-scope';

const problem = { categoryId: 'cat-open-f', judgeCode: 'PARAMO26' };
const registration = { categoryId: 'cat-open-f' };

describe('attemptVerdict', () => {
  it('acepta la captura cuando el código y la categoría cuadran', () => {
    expect(attemptVerdict(problem, registration, 'PARAMO26')).toBe('ok');
  });

  it('no le pide código a un evento que no puso ninguno', () => {
    expect(attemptVerdict({ ...problem, judgeCode: null }, registration, null)).toBe('ok');
  });

  it('acepta el código escrito con espacios y en minúsculas', () => {
    expect(attemptVerdict(problem, registration, '  paramo26 ')).toBe('ok');
  });

  it('rechaza un código equivocado', () => {
    expect(attemptVerdict(problem, registration, 'OTRO')).toBe('bad-code');
  });

  it('rechaza cuando el evento exige código y no llegó ninguno', () => {
    expect(attemptVerdict(problem, registration, null)).toBe('bad-code');
  });

  it('rechaza una inscripción de otra categoría', () => {
    expect(attemptVerdict(problem, { categoryId: 'cat-open-m' }, 'PARAMO26')).toBe('out-of-scope');
  });

  it('rechaza una inscripción que no existe', () => {
    expect(attemptVerdict(problem, undefined, 'PARAMO26')).toBe('out-of-scope');
  });

  it('rechaza un bloque que no existe', () => {
    expect(attemptVerdict(undefined, registration, 'PARAMO26')).toBe('out-of-scope');
  });

  // El orden es la parte que se rompe sola en una refactorización: con las dos
  // cosas mal, lo que el juez tiene que ver es el código, que es lo corregible.
  it('con código malo Y categoría cruzada, culpa al código', () => {
    expect(attemptVerdict(problem, { categoryId: 'cat-open-m' }, 'OTRO')).toBe('bad-code');
  });

  // Sin bloque no hay código contra el cual comparar, así que un bloque
  // inexistente no puede reportarse como código incorrecto — eso mandaría al
  // juez a reescribir un código que estaba bien.
  it('un bloque inexistente no se reporta como código incorrecto', () => {
    expect(attemptVerdict(undefined, registration, 'OTRO')).toBe('out-of-scope');
  });
});
