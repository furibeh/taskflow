/** Generador de identificadores para entidades que no crea el cliente (p. ej., el tablero). */
export interface IdGenerator {
  newId(): string;
}
