/** Consulta mínima de personas que necesitan los casos de uso de tareas (FR-017). */
export interface PersonLookup {
  existsInBoard(boardId: string, personId: string): Promise<boolean>;
}
