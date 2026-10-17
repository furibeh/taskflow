import type { TaskDto, TaskStatusDto } from '@taskflow/contracts';
import { createContext, useContext } from 'react';

export interface KeyboardMove {
  readonly taskId: string;
  readonly target: TaskStatusDto;
}

export interface MoveContextValue {
  /** Arrastrar y soltar disponible (tres columnas visibles, FR-019a). */
  readonly dragEnabled: boolean;
  readonly keyboardMove: KeyboardMove | null;
  readonly instructionsId: string;
  move(task: TaskDto, status: TaskStatusDto): void;
  startKeyboardMove(task: TaskDto): void;
  shiftKeyboardTarget(delta: -1 | 1): void;
  dropKeyboardMove(task: TaskDto): void;
  cancelKeyboardMove(): void;
}

export const MoveContext = createContext<MoveContextValue | null>(null);

export const useMoveContext = (): MoveContextValue => {
  const value = useContext(MoveContext);
  if (!value) throw new Error('useMoveContext requiere BoardDnd');
  return value;
};
